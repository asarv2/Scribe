import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, Optional
from pydantic import BaseModel
from app.extensions import supabase
from app.services.chat.chat_processor import ChatProcessor, ChatMessage
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

        chat_response = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        chat = chat_response.data
        class_id = chat.get('class')
        
        # Check if this is a teacher chat by examining the name
        is_teacher_chat = False
        teacher_option = None
        if chat.get('name') and '[T:' in chat.get('name'):
            match = re.search(r'\[T:([a-z]+)\]', chat.get('name'))
            if match:
                is_teacher_chat = True
                teacher_option = match.group(1)

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get all lectures
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).order("note_number", desc=False).execute()
        all_lectures = lectures_response.data or []

        # Get all textbooks
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).order("textbook_number", desc=False).execute()
        all_textbooks = textbooks_response.data or []

        # Get all chapters
        chapters_response = supabase.table("chapters").select("*").in_("textbook", [t.get('id') for t in all_textbooks]).order("chapter_number", desc=False).execute()
        all_chapters = chapters_response.data or []

        # Get all subchapters
        subchapters_response = supabase.table("subchapters").select("*").in_("chapter", [c.get('id') for c in all_chapters]).order("subchapter_number", desc=False).execute()
        all_subchapters = subchapters_response.data or []

        # Get all exercises
        exercises_response = supabase.table("exercises").select("*").in_("chapter", [c.get('id') for c in all_chapters]).order("exercise_number", desc=False).execute()
        all_exercises = exercises_response.data or []

        # Get all homeworks
        homeworks_response = supabase.table("homeworks").select("*").eq("class", class_id).order("homework_number", desc=False).execute()
        all_homeworks = homeworks_response.data or []

        # get all problems
        problems_response = supabase.table("problems").select("*").in_("homework", [h.get('id') for h in all_homeworks]).order("problem_number", desc=False).execute()
        all_problems = problems_response.data or []

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase.table("messages").select("*").order("created_at", desc=False).eq("chat", chat_id).execute()
        messages = messages_response.data

        # Get the first message (the one we need to process)
        current_message = next((msg for msg in messages if msg['id'] == message_id), None)
        
        # Format past messages for context
        past_messages = [(msg['id'], msg['bare_question'], msg.get('bare_response', '')) for msg in messages if msg['id'] != message_id]

        # Get documents for the current message
        current_documents_response = supabase.table("documents").select("*").in_("id", current_message.get('documents', [])).order("page", desc=False).execute()
        current_documents = current_documents_response.data or []

        # Get all exercises for the current message
        current_exercises_response = supabase.table("exercises").select("*").in_("id", current_message.get('exercises', [])).order("exercise_number", desc=False).execute()
        current_exercises = current_exercises_response.data or []

        # Get all problems for the current message
        current_problems_response = supabase.table("problems").select("*").in_("id", current_message.get('problems', [])).order("problem_number", desc=False).execute()
        current_problems = current_problems_response.data or []

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
            if (doc.get('subchapter') is not None):
                subchapter_name = next((str(s.get('subchapter_number')) + ": " + s.get('title') for s in all_subchapters if s.get('id') == doc.get('subchapter')), None)
                content += f"SUBCHAPTER {subchapter_name}\n"
            if (doc.get('homework') is not None):
                # First get the basic homework info
                homework = next((h for h in all_homeworks if h.get('id') == doc.get('homework')), None)
                if homework:
                    # Sanitize additional info to be on one line
                    additional_info = homework.get('additional_info', '').replace('\n', ' ').strip()
                    content += f"HOMEWORK {homework.get('homework_number')}: {homework.get('title')}, WITH INFO: {additional_info}\n"
                    
                    # Find problems for this homework that are on this page
                    homework_problems = [p for p in all_problems 
                                      if p.get('homework') == homework.get('id')
                                      and p.get('exercise') is not None]
                    
                    for problem in homework_problems:
                        problem_exercise = next((e for e in all_exercises 
                                              if e.get('id') == problem.get('exercise')), None)
                        
                        # Only show problems whose exercises are on this page
                        if (problem_exercise and 
                            problem_exercise.get('start_page') <= doc.get('page') and 
                            problem_exercise.get('end_page') >= doc.get('page')):
                            
                            content += f"\tPROBLEM {problem.get('problem_number')}: {problem.get('additional_info', '')}"
                            if problem_exercise:
                                content += f" (Exercise: {problem_exercise.get('title')})"
                            content += "\n"
            
            # Add main content and description last
            if doc.get('text') is not None and doc.get('text') != "":
                content += f"\nContent: {doc.get('text')}\n"
            if doc.get('description') is not None and doc.get('description') != "":
                content += f"\nDescription: {doc.get('description')}\n"
            
            message_context.append(content)


        def get_answerable_problems_string(
            answerable_problem_ids: List[str],
            all_problems: List[Dict],
            all_exercises: List[Dict],
            all_chapters: List[Dict],
            all_subchapters: List[Dict],
            all_homeworks: List[Dict]
        ) -> str | None:
            """
            Generates a string listing all problems that the LLM can provide answers for.
            
            Args:
                answerable_problem_ids: List of problem IDs that are answer-enabled
                all_problems: List of all problems from the database
                all_exercises: List of all exercises from the database
                all_chapters: List of all chapters from the database
                all_subchapters: List of all subchapters from the database
                all_homeworks: List of all homeworks from the database
                
            Returns:
                A formatted string listing the answerable problems with their context info
            """
            if not answerable_problem_ids:
                return ""
            
            # Get the answerable problems
            answerable_problems = [p for p in all_problems if p.get('id') in answerable_problem_ids]
            
            # Build formatted string of answerable problems
            problem_strings = []
            for problem in answerable_problems:
                # Get the associated exercise
                exercise = next((e for e in all_exercises if e.get('id') == problem.get('exercise')), None)
                if exercise and exercise.get('chapter'):
                    # Get the chapter info
                    chapter = next((c for c in all_chapters if c.get('id') == exercise.get('chapter')), None)
                    if chapter:
                        # Get the subchapter info
                        subchapter = next((s for s in all_subchapters if s.get('chapter') == chapter.get('id')), None)
                        # Get the homework info
                        homework = next((h for h in all_homeworks if h.get('id') == problem.get('homework')), None)
                        
                        problem_string = f"Chapter {chapter.get('chapter_number')} - {chapter.get('title')}"
                        
                        if subchapter:
                            problem_string += f", Subchapter {subchapter.get('subchapter_number')}: {subchapter.get('title')}"
                        
                        if homework:
                            problem_string += f", Homework {homework.get('homework_number')}"
                        
                        problem_string += f", Problem {problem.get('problem_number')}: {exercise.get('title')}"
                        
                        problem_strings.append(problem_string)
            
            if not problem_strings:
                return None
                
            return (
                "Here are the problems that you can provide answers for:\n"
                f"{', '.join(problem_strings)}\n"
            )


        def get_exercise_info(exercise: dict) -> str:
            exercise_chapter_textbook_id = next((c.get('textbook') for c in all_chapters if c.get('id') == exercise.get('chapter')), None)
            exercise_textbook_number = next((t.get('textbook_number') for t in all_textbooks if exercise_chapter_textbook_id == t.get('id')), None)
            exercise_name = next((e.get('title') for e in all_exercises if e.get('id') == exercise.get('exercise')), None)
            return f"EXERCISE: {exercise_name} ON TEXTBOOK {exercise_textbook_number} START PAGE: {exercise.get('start_page')} END PAGE: {exercise.get('end_page')}\n"

        # add additional information to the message context.
        for exercise in current_exercises:
            if (exercise.get('exercise') is not None):
                message_context.append(get_exercise_info(exercise))

        for problem in current_problems:
            if (problem.get('problem') is not None):
                problem_number = next((p.get('problem_number') for p in all_problems if p.get('id') == problem.get('problem')), None)
                problem_homework_id = next((h.get('id') for h in all_homeworks if h.get('id') == problem.get('homework')), None)
                problem_homework_number = next((h.get('homework_number') for h in all_homeworks if h.get('id') == problem_homework_id), None)
                problem_exercise = next((e for e in all_exercises if e.get('id') == problem.get('exercise')), None)
                exercise_info = "" if problem_exercise is None else " AND " + get_exercise_info(problem_exercise)
                message_context.append(f"PROBLEM: {problem_number} ON HOMEWORK {problem_homework_number} WITH INFO: {problem.get('additional_info')}{exercise_info}\n")

        processor = ChatProcessor(
            prompt_type=chat['type'],
            course_title=class_title,
            message_id=message_id,
            question=current_message['bare_question'],
            past_messages=past_messages,
            answerable_problems_string=get_answerable_problems_string(
                [p.get('id') for p in current_problems if p.get('answer_enabled')],
                all_problems,
                all_exercises,
                all_chapters,
                all_subchapters,
                all_homeworks
            ),
            chat_id=chat_id  # Pass chat_id to the processor
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

            # Remove the entire title section (tags and content)
            text = re.sub(r'<TITLE>[^<]+</TITLE>', '', text)
            
            # Remove any malformed closing tags without matching opening tags
            text = re.sub(r'</(?:SLIDE|LECTURE|TEXTBOOK|PAGE|TITLE)>', '', text)

            
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

            if cleaned_result.get('title') is not None:
                supabase.table("chats").update({
                    "name": cleaned_result['title']
                }).eq("id", chat_id).execute()

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






