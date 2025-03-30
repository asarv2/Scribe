import asyncio
import os
import uuid
from fastapi import APIRouter, HTTPException, Request, Form
from fastapi.responses import StreamingResponse
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, Optional, Callable, Awaitable, AsyncGenerator
from pydantic import BaseModel
from app.extensions import supabase
from app.services.chat.chat_processor import ChatProcessor
from app.utils.get_content import fetch_lecture_resources, fetch_chapter_resources, fetch_homework_resources, fetch_lecture_content, fetch_chapter_content, fetch_homework_content, fetch_file_resources, fetch_file_content
import json
import re
from app.services.chat.summary_processor import SummaryPrompt, SummaryProcessor
from app.services.chat.problems_processor import QuestionPrompt, ProblemsProcessor
from app.utils.chat import get_critical_instructions, clean_result, ChatMessage
from app.services.base_processor import MCQQuestion, FRQQuestion, Summary, Figure
from app.services.chat.figure_processor import FigurePrompt, FigureProcessor

router = APIRouter()


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

@router.post('/chat')
async def handle_chat(
    request: Request,
    chat_id: str = Form(...),
    message_id: str = Form(...)
):
    """Handle chat for a class with streaming support."""
    try:
        print("Starting handle-chat function...")
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
        file_ids = current_message.get('files', []) or []

        # Fetch resources and their documents
        lecture_resources = await fetch_lecture_resources(supabase, lecture_ids)
        chapter_resources = await fetch_chapter_resources(supabase, chapter_ids)
        homework_resources = await fetch_homework_resources(supabase, homework_ids)
        file_resources = await fetch_file_resources(supabase, file_ids)
        
        # Extract the individual components
        all_lectures = lecture_resources.get('lectures', [])
        all_chapters = chapter_resources.get('chapters', [])
        all_homeworks = homework_resources.get('homeworks', [])
        all_files = file_resources.get('files', [])

        # Get documents for each resource type
        all_lecture_documents = lecture_resources.get('documents', [])
        all_chapter_documents = chapter_resources.get('documents', [])
        all_chapter_exercises = chapter_resources.get('exercises', [])
        all_homework_exercises = homework_resources.get('exercises', [])
        all_file_documents = file_resources.get('documents', [])
        google_file_ids = file_resources.get('google_file_ids', [])
        

        # Generate textual content for context
        lecture_content = await fetch_lecture_content(supabase, lecture_ids)
        chapter_content = await fetch_chapter_content(supabase, chapter_ids)
        homework_content = await fetch_homework_content(supabase, homework_ids)
        file_content = await fetch_file_content(supabase, file_ids)

        # Combine all content for context
        message_context = []
        if lecture_content:
            message_context.append(lecture_content)
        if chapter_content:
            message_context.append(chapter_content)
        if homework_content:
            message_context.append(homework_content)
        if file_content:
            message_context.append(file_content)

        # Initialize processor and response
        processor = ChatProcessor(
            prompt_type=chat['type'],
            course_title=class_title,
            message_id=message_id,
            question=current_message['bare_question'],
            past_messages=past_messages,
            google_file_ids=google_file_ids
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
            text = re.sub(r'</((LECTURE|CHAPTER|HOMEWORK|FILE))\s+\d+>', r'</\1>', text)
            
            # Handle standalone tags without proper closing
            standalone_tags = re.finditer(r'<(CHAPTER|LECTURE|HOMEWORK|FILE)\s+(\d+)>(?!\s*<(?:SLIDE|PAGE|EXERCISE|PROBLEM))', text)
            for tag in reversed(list(standalone_tags)):
                tag_type, number = tag.groups()
                # Replace with proper opening and closing tags
                start, end = tag.span()
                text = text[:start] + f'<{tag_type} {number}></{tag_type}>' + text[end:]
            
            # Remove any malformed closing tags without matching opening tags
            text = re.sub(r'</(?:SLIDE|LECTURE|CHAPTER|PAGE|PROBLEM|HOMEWORK|EXERCISE|FILE)>', '', text)
            
            # Remove any malformed opening tags without matching closing tags
            tag_patterns = {
                'LECTURE': r'<LECTURE ([^>]+)>(?!(?:.*?</LECTURE>))',
                'CHAPTER': r'<CHAPTER ([^>]+)>(?!(?:.*?</CHAPTER>))',
                'HOMEWORK': r'<HOMEWORK ([^>]+)>(?!(?:.*?</HOMEWORK>))',
                'FILE': r'<FILE ([^>]+)>(?!(?:.*?</FILE>))',
                'SLIDE': r'<SLIDE ([^>]+)>(?!(?:.*?</SLIDE>))',
                'PAGE': r'<PAGE ([^>]+)>(?!(?:.*?</PAGE>))',
                'PROBLEM': r'<PROBLEM ([^>]+)>(?!(?:.*?</PROBLEM>))',
                'EXERCISE': r'<EXERCISE ([^>]+)>(?!(?:.*?</EXERCISE>))',
            }
            
            for pattern in tag_patterns.values():
                text = re.sub(pattern, '', text)
            
            # Remove any remaining valid tags
            cleaned_result = re.sub(r'<(LECTURE|CHAPTER|HOMEWORK|FILE|SLIDE|PAGE|PROBLEM|EXERCISE)[^>]*>', '', text)
            cleaned_result = re.sub(r'</(LECTURE|CHAPTER|HOMEWORK|FILE)(\s[^>]*)?>', '', cleaned_result)  # Updated to handle any content in closing tags
            cleaned_result = re.sub(r'<(?:DOCUMENT|EXERCISE)_(?:LECTURE|CHAPTER|HOMEWORK|FILE)>[^<]+</(?:DOCUMENT|EXERCISE)_(?:LECTURE|CHAPTER|HOMEWORK|FILE)>', '', cleaned_result)
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

            # Extract and remove the figure prompts from the response
            figure_prompts, total_response = processor.extract_figure_prompts(total_response, current_message['response_url'])
            if len(figure_prompts) > 0:
                # call the generate_figures function
                await request.app.state.add_task(
                    process_figures_internally,
                    message_id,
                    class_id,
                    current_message['response_url']
                )

            # Extract and remove the summary prompts from the response
            summary_prompts, total_response = processor.extract_summary_prompts(total_response, current_message['response_url'])
            if len(summary_prompts) > 0:
                # call the generate_summaries function
                await request.app.state.add_task(
                    process_summaries_internally,
                    message_id,
                    class_id,
                    current_message['response_url']
                )

            # Extract and remove the practice problem prompts from the response
            practice_problem_prompts, total_response = processor.extract_practice_problem_prompts(total_response, current_message['response_url'])

            if len(practice_problem_prompts) > 0:
                await request.app.state.add_task(
                    process_questions_internally,
                    message_id,
                    class_id,
                    current_message['response_url']
                )

            # Clean the response and extract document references
            cleaned_result = clean_result(
                current_message['bare_question'],
                message_id,
                total_response,
                all_lectures=all_lectures,
                all_chapters=all_chapters,
                all_homeworks=all_homeworks,
                all_files=all_files,
                all_lecture_documents=all_lecture_documents,
                all_chapter_documents=all_chapter_documents,
                all_chapter_exercises=all_chapter_exercises,
                all_homework_exercises=all_homework_exercises,
                all_file_documents=all_file_documents,
            )
            
            # Final update to the message in Supabase
            supabase.table("messages").update({
                "bare_response": total_response,
                "response": cleaned_result["response"],
                "lecture_references": cleaned_result["lecture_references"],
                "chapter_references": cleaned_result["chapter_references"],
                "chapter_exercise_references": cleaned_result["chapter_exercise_references"],
                "homework_exercise_references": cleaned_result["homework_exercise_references"],
                "file_references": cleaned_result["file_references"],
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
    

@router.post('/figures')
async def process_figures(
    request: Request,
    message_id: str = Form(...),
    class_id: str = Form(...)
):
    """Generate figures for a given message ID."""
    try:

        # Mark figures as generating
        supabase.table("figures").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("message", message_id).execute()

        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        message_response = supabase.table("messages").select("*").eq("id", message_id).execute()
        message = message_response.data[0]

        # Get output formatting rules for this class
        output_rules = await fetch_output_rules(supabase, class_id)

        # get the figures from the figures table
        figures_response = supabase.table("figures").select("*").eq("message", message_id).execute()
        figures = figures_response.data

        if len(figures) == 0:
            print("No figures found for message ID:", message_id)
            prompts = []
        else:
            prompts = [FigurePrompt(
                id=figure['id'],
                additional_info=figure['prompt'],
            ) for figure in figures]

        # Get resource IDs from the message
        lecture_ids = message.get('lectures', []) or []
        chapter_ids = message.get('chapters', []) or []
        homework_ids = message.get('homeworks', []) or []
        file_ids = message.get('files', []) or []

        # Fetch resources and their documents
        lecture_resources = await fetch_lecture_resources(supabase, lecture_ids)
        chapter_resources = await fetch_chapter_resources(supabase, chapter_ids)
        homework_resources = await fetch_homework_resources(supabase, homework_ids)
        file_resources = await fetch_file_resources(supabase, file_ids)

        # Extract the individual components
        all_lectures = lecture_resources.get('lectures', [])
        all_chapters = chapter_resources.get('chapters', [])
        all_homeworks = homework_resources.get('homeworks', [])
        all_files = file_resources.get('files', [])
        # Get documents for each resource type
        all_lecture_documents = lecture_resources.get('documents', [])
        all_chapter_documents = chapter_resources.get('documents', [])
        all_chapter_exercises = chapter_resources.get('exercises', [])
        all_homework_exercises = homework_resources.get('exercises', [])
        all_file_documents = file_resources.get('documents', [])
        # Generate textual content for context
        lecture_content = await fetch_lecture_content(supabase, lecture_ids)
        chapter_content = await fetch_chapter_content(supabase, chapter_ids)
        homework_content = await fetch_homework_content(supabase, homework_ids)
        file_content = await fetch_file_content(supabase, file_ids)
        
        # Combine all content for context
        message_context = []
        if lecture_content:
            message_context.append(lecture_content)
        if chapter_content:
            message_context.append(chapter_content)
        if homework_content:
            message_context.append(homework_content)
        if file_content:
            message_context.append(file_content)

         # initialize the critical instructions
        critical_instructions = get_critical_instructions(output_rules)

        # Initialize the figure processor
        processor = FigureProcessor(class_title, critical_instructions, message_context, all_lectures, all_chapters, all_homeworks, all_files, all_lecture_documents, all_chapter_documents, all_chapter_exercises, all_homework_exercises, all_file_documents) 
        
        # Process the summaries
        try:
            async def on_batch_complete(generated_figure: Figure):
                # Prepare summaries for updating
                figures_to_upsert = []
                print("Generated figure:", generated_figure)
                figures_to_upsert.append({
                    "id": generated_figure["id"],
                    "code": generated_figure["code"],
                    "generation_status": "complete",
                    "generation_error": ""
                })
                print("Figures to upsert:", figures_to_upsert)
                # Update existing topics
                if figures_to_upsert:
                    upsert_response = supabase.table("figures").upsert(figures_to_upsert).execute()
                    print("Upsert response:", upsert_response)

            generated_figures = await processor.process_figures(prompts, message.get('bare_question'), message_id, clean_result, on_batch_complete)

            # print the generated figures
            print("Generated figures:", generated_figures)

            return {"status": "success", "message_id": message_id}
        except Exception as e:
            raise e
        
    except Exception as e:
        print("Error in generate-figures function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })


        # Update figures status to error, if they are not already complete
        supabase.table("figures").update({
            "generation_status": "error",
            "generation_error": str(e),
        }).eq("message", message_id).eq("generation_status", "generating").execute()

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )


@router.post('/summaries')
async def process_summaries(
    request: Request,
    message_id: str = Form(...),
    class_id: str = Form(...)
):
    """Generate summaries for a given message ID."""
    try:

        # Mark summaries as generating
        supabase.table("summaries").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("message", message_id).execute()

        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        message_response = supabase.table("messages").select("*").eq("id", message_id).execute()
        message = message_response.data[0]

        # Get output formatting rules for this class
        output_rules = await fetch_output_rules(supabase, class_id)

        # get the summaries from the summaries table
        summaries_response = supabase.table("summaries").select("*").eq("message", message_id).execute()
        summaries = summaries_response.data

        if len(summaries) == 0:
            print("No summaries found for message ID:", message_id)
            prompts = []
        else:
            prompts = [SummaryPrompt(
                id=summary['id'],
                additional_info=summary['prompt'],
            ) for summary in summaries]

        # Get resource IDs from the message
        lecture_ids = message.get('lectures', []) or []
        chapter_ids = message.get('chapters', []) or []
        homework_ids = message.get('homeworks', []) or []
        file_ids = message.get('files', []) or []
        # Fetch resources and their documents
        lecture_resources = await fetch_lecture_resources(supabase, lecture_ids)
        chapter_resources = await fetch_chapter_resources(supabase, chapter_ids)
        homework_resources = await fetch_homework_resources(supabase, homework_ids)
        file_resources = await fetch_file_resources(supabase, file_ids)
        # Extract the individual components
        all_lectures = lecture_resources.get('lectures', [])
        all_chapters = chapter_resources.get('chapters', [])
        all_homeworks = homework_resources.get('homeworks', [])
        all_files = file_resources.get('files', [])
        # Get documents for each resource type
        all_lecture_documents = lecture_resources.get('documents', [])
        all_chapter_documents = chapter_resources.get('documents', [])
        all_chapter_exercises = chapter_resources.get('exercises', [])
        all_homework_exercises = homework_resources.get('exercises', [])
        all_file_documents = file_resources.get('documents', [])
        # Generate textual content for context
        lecture_content = await fetch_lecture_content(supabase, lecture_ids)
        chapter_content = await fetch_chapter_content(supabase, chapter_ids)
        homework_content = await fetch_homework_content(supabase, homework_ids)
        file_content = await fetch_file_content(supabase, file_ids)
        # Combine all content for context
        message_context = []
        if lecture_content:
            message_context.append(lecture_content)
        if chapter_content:
            message_context.append(chapter_content)
        if homework_content:
            message_context.append(homework_content)
        if file_content:
            message_context.append(file_content)
         # initialize the critical instructions
        critical_instructions = get_critical_instructions(output_rules)

        # Initialize the summary processor
        processor = SummaryProcessor(class_title, critical_instructions, message_context, all_lectures, all_chapters, all_homeworks, all_files, all_lecture_documents, all_chapter_documents, all_chapter_exercises, all_homework_exercises, all_file_documents) 
        
        # Process the summaries
        try:
            async def on_batch_complete(generated_summary: Summary):
                # Prepare summaries for updating
                summaries_to_upsert = []
                print("Generated summary:", generated_summary)
                summaries_to_upsert.append({
                    "id": generated_summary["id"],
                    "preamble": generated_summary["preamble"],
                    "body": generated_summary["content"],
                    "conclusion": generated_summary["conclusion"],
                    "generation_status": "complete",
                    "generation_error": ""
                })
                print("Summaries to upsert:", summaries_to_upsert)
                # Update existing topics
                if summaries_to_upsert:
                    upsert_response = supabase.table("summaries").upsert(summaries_to_upsert).execute()
                    print("Upsert response:", upsert_response)

            generated_summaries = await processor.process_summaries(prompts, message.get('bare_question'), message_id, clean_result, on_batch_complete)

            # print the generated summaries
            print("Generated summaries:", generated_summaries)

            return {"status": "success", "message_id": message_id}
        except Exception as e:
            raise e
        
    except Exception as e:
        print("Error in generate-summaries function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })


        # Update summaries status to error, if they are not already complete
        supabase.table("summaries").update({
            "generation_status": "error",
            "generation_error": str(e),
        }).eq("message", message_id).eq("generation_status", "generating").execute()

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )


@router.post('/questions')
async def process_questions(
    request: Request,
    message_id: str = Form(...),
    class_id: str = Form(...)
):
    """Generate questions for a given message ID."""
    try:

        # Mark questions as generating
        supabase.table("questions").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("message", message_id).neq("generation_status", "complete").execute()

        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        message_response = supabase.table("messages").select("*").eq("id", message_id).execute()
        message = message_response.data[0]

        output_rules = await fetch_output_rules(supabase, class_id)

        # get the practice problems from the practice_problems table
        practice_problems_response = supabase.table("questions").select("*").eq("message", message_id).neq("generation_status", "complete").execute()
        practice_problems = practice_problems_response.data

        if len(practice_problems) == 0:
            print("No practice problems found for message ID:", message_id)
            prompts = []
        else:
            prompts = [QuestionPrompt(
                id=practice_problem.get('id'),
                mcq=not practice_problem.get('frq'),
                multi_part=practice_problem.get('multi') is not None,
                computational=practice_problem.get('computational'),
                additional_info=practice_problem.get('prompt'),
            ) for practice_problem in practice_problems]

        # Get resource IDs from the message
        lecture_ids = message.get('lectures', []) or []
        chapter_ids = message.get('chapters', []) or []
        homework_ids = message.get('homeworks', []) or []
        file_ids = message.get('files', []) or []

        # Fetch resources and their documents
        lecture_resources = await fetch_lecture_resources(supabase, lecture_ids)
        chapter_resources = await fetch_chapter_resources(supabase, chapter_ids)
        homework_resources = await fetch_homework_resources(supabase, homework_ids)
        file_resources = await fetch_file_resources(supabase, file_ids)
        # Extract the individual components
        all_lectures = lecture_resources.get('lectures', [])
        all_chapters = chapter_resources.get('chapters', [])
        all_homeworks = homework_resources.get('homeworks', [])
        all_files = file_resources.get('files', [])
        # Get documents for each resource type
        all_lecture_documents = lecture_resources.get('documents', [])
        all_chapter_documents = chapter_resources.get('documents', [])
        all_chapter_exercises = chapter_resources.get('exercises', [])
        all_homework_exercises = homework_resources.get('exercises', [])
        all_file_documents = file_resources.get('documents', [])
        # Generate textual content for context
        lecture_content = await fetch_lecture_content(supabase, lecture_ids)
        chapter_content = await fetch_chapter_content(supabase, chapter_ids)
        homework_content = await fetch_homework_content(supabase, homework_ids)
        file_content = await fetch_file_content(supabase, file_ids)
        # Combine all content for context
        message_context = []
        if lecture_content:
            message_context.append(lecture_content)
        if chapter_content:
            message_context.append(chapter_content)
        if homework_content:
            message_context.append(homework_content)
        if file_content:
            message_context.append(file_content)

        # initialize the critical instructions
        critical_instructions = get_critical_instructions(output_rules)

        # Initialize the practice problem processor
        processor = ProblemsProcessor(class_title, critical_instructions, message_context, all_lectures, all_chapters, all_homeworks, all_files, all_lecture_documents, all_chapter_documents, all_chapter_exercises, all_homework_exercises, all_file_documents)

        try:
            # Change this function to be async
            async def on_batch_complete(questions: List[List[Union[MCQQuestion, FRQQuestion]]]):
                # Prepare summaries for updating
                questions_to_upsert = []
                for question_group in questions:
                    for question in question_group:
                        if question.get('question_type') == 'mcq':
                            print("MCQ question:", question)
                            questions_to_upsert.append({
                                "id": question['id'],
                                "problem": question['question'],
                                "answers": question['answers'],
                                "options": question['options'],
                                "explanations": question['explanations'],
                                "generation_status": "complete",
                                "generation_error": ""
                            })
                        elif question.get('question_type') == 'frq':
                            print("FRQ question:", question)
                            questions_to_upsert.append({
                                "id": question['id'],
                                "problem": question['question'],
                                "solution": question['solution'],
                                "generation_status": "complete",
                                "generation_error": ""
                            })
                # Update existing topics
                if questions_to_upsert:
                    supabase.table("questions").upsert(questions_to_upsert).execute()
            
            generated_questions = await processor.process_problems(message.get('bare_question'), message_id, prompts, clean_result, on_batch_complete)

            # print the generated questions
            print("Generated questions:", generated_questions)

            return {"status": "success", "message_id": message_id}
        except Exception as e:
            raise e
            

    except Exception as e:
        print("Error in generate-questions function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })

        # Update questions status to error, if they are not already complete
        supabase.table("questions").update({
            "generation_status": "error",
            "generation_error": str(e),
        }).eq("message", message_id).eq("generation_status", "generating").execute()

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )
    
async def process_figures_internally(message_id: str, class_id: str, response_url: str):
    """Helper function to call the figures endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "message_id": message_id,
        "class_id": class_id,
    }

    # Call the endpoint
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{response_url}/generate/figures", data=form_data)
        print(f"Figures processing response: {response.text}")

async def process_summaries_internally(message_id: str, class_id: str, response_url: str):
    """Helper function to call the summaries endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "message_id": message_id,
        "class_id": class_id,
    }
    
    # Call the endpoint
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{response_url}/generate/summaries", data=form_data)
        print(f"Summaries processing response: {response.text}")

async def process_questions_internally(message_id: str, class_id: str, response_url: str):
    """Helper function to call the questions endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "message_id": message_id,
        "class_id": class_id,
    }
    
    # Call the endpoint
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{response_url}/generate/questions", data=form_data)
        print(f"Questions processing response: {response.text}")
        
    