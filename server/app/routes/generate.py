import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, Optional, Callable, Awaitable, AsyncGenerator
from pydantic import BaseModel
from app.extensions import supabase
from app.services.chat.chat_processor import ChatProcessor, ChatMessage
import json
import re

router = APIRouter()

class ChatRequest(BaseModel):
    chat_id: str
    message_id: str

async def fetch_document_resources(supabase, current_message):
    """
    Fetch all resources (lectures, chapters, textbooks, homeworks, exercises) 
    related to the current message's documents.
    
    Returns a dictionary containing all the fetched resources.
    """
    # Get documents for the current message
    document_ids = current_message.get('documents', [])
    current_documents_response = supabase.table("documents").select("*").in_("id", document_ids).order("page", desc=False).execute()
    current_documents = current_documents_response.data or []
    
    # Extract IDs for related resources
    lecture_ids = list(set([doc.get('lecture') for doc in current_documents if doc.get('lecture') is not None])) or []
    chapter_ids = list(set([doc.get('chapter') for doc in current_documents if doc.get('chapter') is not None])) or []
    textbook_ids = list(set([doc.get('textbook') for doc in current_documents if doc.get('textbook') is not None])) or []
    homework_ids = list(set([doc.get('homework') for doc in current_documents if doc.get('homework') is not None])) or []
    
    # Fetch all related resources
    all_lectures = []
    if lecture_ids:
        lectures_response = supabase.table("lectures").select("*").in_("id", lecture_ids).order("note_number", desc=False).execute()
        all_lectures = lectures_response.data or []
    
    all_chapters = []
    if chapter_ids:
        chapters_response = supabase.table("chapters").select("*").in_("id", chapter_ids).order("chapter_number", desc=False).execute()
        all_chapters = chapters_response.data or []
    
    all_textbooks = []
    if textbook_ids:
        textbooks_response = supabase.table("textbooks").select("*").in_("id", textbook_ids).order("textbook_number", desc=False).execute()
        all_textbooks = textbooks_response.data or []
    
    all_homeworks = []
    if homework_ids:
        homeworks_response = supabase.table("homeworks").select("*").in_("id", homework_ids).order("homework_number", desc=False).execute()
        all_homeworks = homeworks_response.data or []
    
    # For exercises, we need to get them based on chapters and homeworks
    # Use a set to track exercise IDs we've already added to avoid duplicates
    seen_exercise_ids = set()
    all_exercises = []
    
    # Get exercises related to chapters
    if chapter_ids:
        exercises_response = supabase.table("exercises").select("*").in_("chapter", chapter_ids).execute()
        chapter_exercises = exercises_response.data or []
        for exercise in chapter_exercises:
            if exercise.get('id') not in seen_exercise_ids:
                seen_exercise_ids.add(exercise.get('id'))
                all_exercises.append(exercise)
    
    # Get exercises directly linked to documents
    exercise_ids = list(set([doc.get('exercise') for doc in current_documents if doc.get('exercise') is not None])) or []
    if exercise_ids:
        direct_exercises_response = supabase.table("exercises").select("*").in_("id", exercise_ids).execute()
        direct_exercises = direct_exercises_response.data or []
        for exercise in direct_exercises:
            if exercise.get('id') not in seen_exercise_ids:
                seen_exercise_ids.add(exercise.get('id'))
                all_exercises.append(exercise)
    
    # Get exercises related to homeworks
    if homework_ids:
        homework_exercises_response = supabase.table("exercises").select("*").in_("homework", homework_ids).execute()
        homework_exercises = homework_exercises_response.data or []
        for exercise in homework_exercises:
            if exercise.get('id') not in seen_exercise_ids:
                seen_exercise_ids.add(exercise.get('id'))
                all_exercises.append(exercise)
    
    return {
        "documents": current_documents,
        "lectures": all_lectures,
        "chapters": all_chapters,
        "textbooks": all_textbooks,
        "homeworks": all_homeworks,
        "exercises": all_exercises
    }

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

        chat_response = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        chat = chat_response.data
        class_id = chat.get('class')

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get output formatting rules for this class
        output_rules = await fetch_output_rules(supabase, class_id)

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase.table("messages").select("*").order("created_at", desc=False).eq("chat", chat_id).execute()
        messages = messages_response.data

        # Get the first message (the one we need to process)
        current_message = next((msg for msg in messages if msg['id'] == message_id), None)
        
        # Format past messages for context
        past_messages = [(msg['id'], msg['bare_question'], msg.get('bare_response', '')) for msg in messages if msg['id'] != message_id]

        # Fetch all resources related to the current message
        resources = await fetch_document_resources(supabase, current_message)
        
        current_documents = resources["documents"]
        all_lectures = resources["lectures"]
        all_chapters = resources["chapters"]
        all_textbooks = resources["textbooks"]
        all_homeworks = resources["homeworks"]
        all_exercises = resources["exercises"]

        # Sort documents by lecture number and page number
        current_documents = sorted(current_documents, 
            key=lambda doc: (
                next((l.get('note_number') for l in all_lectures if l.get('id') == doc.get('lecture')), float('inf')),
                doc.get('page', float('inf'))
            ) if doc.get('lecture') is not None else (float('inf'), float('inf'))
        )

        # Format the context for the current message
        message_context = []
        for doc in current_documents:
            content = ""
            
            # Start with document type and number
            if doc.get('lecture') is not None:
                lecture_number = next((l.get('note_number') for l in all_lectures if l.get('id') == doc.get('lecture')), None)
                content = f"\nLECTURE NUMBER: {lecture_number} SLIDE: {doc.get('page')}\n"
            if doc.get('textbook') is not None:
                textbook_number = next((t.get('textbook_number') for t in all_textbooks if t.get('id') == doc.get('textbook')), None)
                content = f"\nTEXTBOOK NUMBER: {textbook_number} PAGE: {doc.get('page')}\n"
            
            # Add chapter, subchapter, and homework info if available
            if (doc.get('chapter') is not None):
                chapter_name = next((str(c.get('chapter_number')) + ": " + c.get('title') for c in all_chapters if c.get('id') == doc.get('chapter')), None)
                content += f"CHAPTER {chapter_name}\n"
            if (doc.get('homework') is not None):
                # First get the basic homework info
                homework = next((h for h in all_homeworks if h.get('id') == doc.get('homework')), None)
                if homework:
                    # Sanitize additional info to be on one line
                    additional_info = homework.get('additional_info', '').replace('\n', ' ').strip()
                    content += f"HOMEWORK {homework.get('homework_number')}: {homework.get('title')}, WITH INFO: {additional_info}\n"
            
            # Add main content and description last
            if doc.get('text') is not None and doc.get('text') != "":
                content += f"\nContent: {doc.get('text')}\n"
            if doc.get('description') is not None and doc.get('description') != "":
                content += f"\nDescription: {doc.get('description')}\n"
            
            message_context.append(content)

        # Add exercise information to the message context
        for doc in current_documents:
            if doc.get('exercise') is not None:
                exercise = next((e for e in all_exercises if e.get('id') == doc.get('exercise')), None)
                if exercise:
                    exercise_chapter = next((c for c in all_chapters if c.get('id') == exercise.get('chapter')), None)
                    if exercise_chapter:
                        exercise_textbook_id = exercise_chapter.get('textbook')
                        exercise_textbook_number = next((t.get('textbook_number') for t in all_textbooks if t.get('id') == exercise_textbook_id), None)
                        exercise_info = f"EXERCISE: {exercise.get('title')} ON TEXTBOOK {exercise_textbook_number} START PAGE: {doc.get('start_page', 'N/A')} END PAGE: {doc.get('end_page', 'N/A')}\n"
                        message_context.append(exercise_info)
        
        # Add homework exercises to the message context
        for homework_id in list(set([doc.get('homework') for doc in current_documents if doc.get('homework') is not None])):
            homework_exercises = [e for e in all_exercises if e.get('homework') == homework_id]
            homework = next((h for h in all_homeworks if h.get('id') == homework_id), None)
            
            if homework and homework_exercises:
                for exercise in homework_exercises:
                    exercise_info = f"PROBLEM: {exercise.get('title')} ON HOMEWORK {homework.get('homework_number')}: {homework.get('title')}\n"
                    if exercise.get('description'):
                        exercise_info += f"Description: {exercise.get('description')}\n"
                    message_context.append(exercise_info)

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

            
            # Remove any malformed closing tags without matching opening tags
            text = re.sub(r'</(?:SLIDE|LECTURE|TEXTBOOK|PAGE)>', '', text)

            
            # Remove any malformed opening tags without matching closing tags
            tag_patterns = {
                'LECTURE': r'<LECTURE ([^>]+)>(?!(?:.*?</LECTURE>))',
                'TEXTBOOK': r'<TEXTBOOK ([^>]+)>(?!(?:.*?</TEXTBOOK>))',
                'SLIDE': r'<SLIDE ([^>]+)>(?!(?:.*?</SLIDE>))',
                'PAGE': r'<PAGE ([^>]+)>(?!(?:.*?</PAGE>))',
            }
            
            for pattern in tag_patterns.values():
                text = re.sub(pattern, '', text)
            
            # Remove any remaining valid tags
            cleaned_result = re.sub(r'<(LECTURE|TEXTBOOK|SLIDE|PAGE)[^>]*>', '', text)
            cleaned_result = re.sub(r'</(LECTURE|TEXTBOOK|SLIDE|PAGE)>', '', cleaned_result)

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
                all_lectures=all_lectures,
                all_textbooks=all_textbooks,
                all_documents=current_documents,
                output_rules=output_rules,
                stream_callback=update_callback
            ):
                pass  # We're handling updates in the callback

            # Clean the response and extract document references
            cleaned_result = processor.clean_result(
                total_response,
                all_lectures,
                all_textbooks,
                current_documents
            )
            # Final update to the message in Supabase
            supabase.table("messages").update({
                "bare_response": total_response,
                "response": cleaned_result['response'],
                "references": cleaned_result['references'],
                "generation_status": "complete",
                "generation_error": ""
            }).eq("id", message_id).execute()

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






