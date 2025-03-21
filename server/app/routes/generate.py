import asyncio
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, Optional, Callable, Awaitable, AsyncGenerator
from pydantic import BaseModel
from app.extensions import supabase, QUESTIONS_DIR
from app.services.chat.chat_processor import ChatProcessor, ChatMessage
from app.utils.get_content import fetch_lecture_resources, fetch_chapter_resources, fetch_homework_resources, fetch_lecture_content, fetch_chapter_content, fetch_homework_content
import json
import re

router = APIRouter()

class ChatRequest(BaseModel):
    chat_id: str
    message_id: str

@router.post('/chat')
async def handle_message(request: ChatRequest):
    """Handle chat for a class with streaming support."""
    try:
        print("Starting handle-chat function...")
        chat_id = request.chat_id
        message_id = request.message_id

        # Mark message as generating
        supabase.table("messages").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("id", message_id).execute()

        # Get chat and class info
        chat_response = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        chat = chat_response.data
        class_id = chat.get('class')

        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get output formatting rules for this class
        output_rules = await fetch_output_rules(supabase, class_id)

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase.table("messages").select("*").order("created_at", desc=False).eq("chat", chat_id).execute()
        messages = messages_response.data

        # Get the current message and format past messages for context
        current_message = next((msg for msg in messages if msg['id'] == message_id), None)
        past_messages = [(msg['id'], msg['bare_question'], msg.get('bare_response', '')) for msg in messages if msg['id'] != message_id]

        # Get resource IDs from the message
        lecture_ids = current_message.get('lectures', []) or []
        chapter_ids = current_message.get('chapters', []) or []
        homework_ids = current_message.get('homeworks', []) or []

        # Fetch resources and their documents
        lecture_resources = await fetch_lecture_resources(supabase, lecture_ids)
        chapter_resources = await fetch_chapter_resources(supabase, chapter_ids)
        homework_resources = await fetch_homework_resources(supabase, homework_ids)
        
        # Extract the individual components
        all_lectures = lecture_resources.get('lectures', [])
        all_chapters = chapter_resources.get('chapters', [])
        all_homeworks = homework_resources.get('homeworks', [])
        
        # Get documents for each resource type
        all_lecture_documents = lecture_resources.get('documents', [])
        all_chapter_documents = chapter_resources.get('documents', [])
        all_chapter_exercises = chapter_resources.get('exercises', [])
        all_homework_exercises = homework_resources.get('exercises', [])

        # Generate textual content for context
        lecture_content = await fetch_lecture_content(supabase, lecture_ids)
        chapter_content = await fetch_chapter_content(supabase, chapter_ids)
        homework_content = await fetch_homework_content(supabase, homework_ids)
        
        # Combine all content for context
        message_context = []
        if lecture_content:
            message_context.append(lecture_content)
        if chapter_content:
            message_context.append(chapter_content)
        if homework_content:
            message_context.append(homework_content)

        # Initialize processor and response
        processor = ChatProcessor(
            prompt_type=chat['type'],
            course_title=class_title,
            message_id=message_id,
            question=current_message['bare_question'],
            past_messages=past_messages,
        )

        total_response = ""

        def sanitize_for_supabase(text: str) -> str:
            """
            Sanitizes text for Supabase storage by removing incomplete tags.
            Uses similar regex approach as clean_result function.
            """
            # First remove any incomplete tags at the end
            # This looks for any < that isn't followed by a > before the end of the string
            if '<' in text:
                last_complete_tag = text.rfind('>')
                last_open_tag = text.rfind('<')
                if last_open_tag > last_complete_tag:
                    text = text[:last_open_tag]
            
            # Normalize incorrect closing tags like </CHAPTER 2> to </CHAPTER>
            text = re.sub(r'</((LECTURE|CHAPTER|HOMEWORK))\s+\d+>', r'</\1>', text)
            
            # Handle standalone tags without proper closing
            standalone_tags = re.finditer(r'<(CHAPTER|LECTURE|HOMEWORK)\s+(\d+)>(?!\s*<(?:SLIDE|PAGE|EXERCISE|PROBLEM))', text)
            for tag in reversed(list(standalone_tags)):
                tag_type, number = tag.groups()
                # Replace with proper opening and closing tags
                start, end = tag.span()
                text = text[:start] + f'<{tag_type} {number}></{tag_type}>' + text[end:]
            
            # Remove any malformed closing tags without matching opening tags
            text = re.sub(r'</(?:SLIDE|LECTURE|CHAPTER|PAGE|PROBLEM|HOMEWORK|EXERCISE)>', '', text)
            
            # Remove any malformed opening tags without matching closing tags
            tag_patterns = {
                'LECTURE': r'<LECTURE ([^>]+)>(?!(?:.*?</LECTURE>))',
                'CHAPTER': r'<CHAPTER ([^>]+)>(?!(?:.*?</CHAPTER>))',
                'HOMEWORK': r'<HOMEWORK ([^>]+)>(?!(?:.*?</HOMEWORK>))',
                'SLIDE': r'<SLIDE ([^>]+)>(?!(?:.*?</SLIDE>))',
                'PAGE': r'<PAGE ([^>]+)>(?!(?:.*?</PAGE>))',
                'PROBLEM': r'<PROBLEM ([^>]+)>(?!(?:.*?</PROBLEM>))',
                'EXERCISE': r'<EXERCISE ([^>]+)>(?!(?:.*?</EXERCISE>))',
            }
            
            for pattern in tag_patterns.values():
                text = re.sub(pattern, '', text)
            
            # Remove any remaining valid tags
            cleaned_result = re.sub(r'<(LECTURE|CHAPTER|HOMEWORK|SLIDE|PAGE|PROBLEM|EXERCISE)[^>]*>', '', text)
            cleaned_result = re.sub(r'</(LECTURE|CHAPTER|HOMEWORK)(\s[^>]*)?>', '', cleaned_result)  # Updated to handle any content in closing tags
            cleaned_result = re.sub(r'<(?:DOCUMENT|EXERCISE)_(?:LECTURE|CHAPTER|HOMEWORK)>[^<]+</(?:DOCUMENT|EXERCISE)_(?:LECTURE|CHAPTER|HOMEWORK)>', '', cleaned_result)
            cleaned_result = re.sub(r'<PROBLEM_HOMEWORK>[^<]+</PROBLEM_HOMEWORK>', '', cleaned_result)

            return cleaned_result.strip()

        async def update_callback(chunk: str):
            nonlocal total_response
            total_response += chunk
            
            # Create sanitized version for Supabase
            sanitized_response = sanitize_for_supabase(total_response)
            
            # Update Supabase with the sanitized version
            supabase.table("messages").update({
                "bare_response": total_response,
                "response": sanitized_response,
                "generation_status": "generating"
            }).eq("id", message_id).execute()
            
            return chunk

        try:
            async for _ in processor.process_message(
                complete_context="\n".join(message_context),
                output_rules=output_rules,
                stream_callback=update_callback
            ):
                pass  # We're handling updates in the callback


            # Extract and remove the practice problem prompts from the response
            practice_problem_prompts, reference_response = processor.extract_practice_problem_prompts(total_response)

            # Clean the response and extract document references
            cleaned_result = processor.clean_result(
                reference_response,
                all_lectures=all_lectures,
                all_chapters=all_chapters,
                all_homeworks=all_homeworks,
                all_lecture_documents=all_lecture_documents,
                all_chapter_documents=all_chapter_documents,
                all_chapter_exercises=all_chapter_exercises,
                all_homework_exercises=all_homework_exercises,
            )
            
            # Final update to the message in Supabase
            supabase.table("messages").update({
                "bare_response": total_response,
                "response": cleaned_result["response"],
                "lecture_references": cleaned_result["lecture_references"],
                "chapter_references": cleaned_result["chapter_references"],
                "chapter_exercise_references": cleaned_result["chapter_exercise_references"],
                "homework_exercise_references": cleaned_result["homework_exercise_references"],
                "generation_status": "complete",
                "generation_error": ""
            }).eq("id", message_id).execute()

            # generate practice problems
            practice_problems = await processor.generate_practice_problems(
                practice_problem_prompts,
                output_rules,
                message_context,
                all_lectures,
                all_chapters,
                all_homeworks,
                all_lecture_documents,
                all_chapter_documents,
                all_chapter_exercises,
                all_homework_exercises,
            )

            # save the practice problems to the questions directory
            for problem in practice_problems:
                with open(os.path.join(QUESTIONS_DIR, f"{problem['id']}.json"), "w") as f:
                    json.dump(problem, f)

            return {"status": "success", "message_id": message_id}

        except Exception as error:
            # throw the error to the outside block
            raise error
    except Exception as error:
        print("Error in generate-chat function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })

        # Update message status to error
        supabase.table("messages").update({
            "generation_status": "error",
            "generation_error": str(error),
        }).eq("id", message_id).execute()
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(error),
                "stack": traceback.format_exc(),
                "name": type(error).__name__
            }
        )

async def fetch_output_rules(supabase, class_id):
    """
    Fetch output formatting rules from Supabase for the given class.
    
    Returns a formatted string with instructions for the LLM about how to format its output.
    """
    try:
        # Fetch rules from the class_rules table
        rules_response = supabase.table("rules").select("*").eq("class", class_id).eq("enabled", True).execute()
        rules = rules_response.data or []
        
        if not rules:
            return ""
        
        # Format the rules as instructions
        rules_text = "RULES: The following are the rules for the output formatting, created by the professor. Please follow these rules:\n\n"
        
        for rule in rules:
            rule_text = rule.get('rule', '')
            if rule_text:
                rules_text += f"- {rule_text}\n"
        
        # Add citation instructions which are always required
        # rules_text += (
        #     "\nWhen citing course content:\n"
        #     "- For lectures: Use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags\n"
        #     "- For textbooks: Use <TEXTBOOK x><PAGE a><PAGE b><PAGE c></TEXTBOOK> tags\n"
        #     "- Place citations at the end of your response\n"
        #     "- Add any period before the citation tags, not after"
        # )
        
        return rules_text
    
    except Exception as e:
        print(f"Error fetching output rules: {str(e)}")
        # Return basic formatting instructions if there's an error
        return "Format your response clearly with appropriate citations to course materials."