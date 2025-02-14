from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, Optional
from pydantic import BaseModel
from app.extensions import supabase
from app.services.problems.problems_processor import (
    QuestionPrompt,
    MCQQuestion,
    FRQQuestion,
    ProblemsProcessor
)
import uuid
from app.services.chat.chat_processor import ChatProcessor, ChatMessage
import json
import asyncio

router = APIRouter()

# Define request models
class ProblemRequest(BaseModel):
    class_id: str
    generation_id: str
    additional_instructions: Optional[str] = None

class ChatRequest(BaseModel):
    generation_id: str

@router.post('/problems')
async def generate_problems(request: ProblemRequest):
    """Generate problems for a class."""
    try:
        print("Starting generate-problems function...")
        data: ProblemRequest = request.dict()
        class_id = data.get('class_id')
        generation_id = data.get('generation_id')

        generation_response = supabase.table("generations").select("*").eq("id", generation_id).single().execute()
        generation = generation_response.data
        generation_additional_info = generation.get('additional_info')

        print("Request params:", {
            "class_id": class_id,
            "generation_id": generation_id,
        })

        # Update generation status to generating
        supabase.table("generations").update({
            "generation_status": "generating",
            "generation_error": None
        }).eq("id", generation_id).execute()

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description, map"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get all lectures
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = lectures_response.data or []
        # print("Lectures:", all_lectures)

        # Get all textbooks 
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).execute()
        all_textbooks = textbooks_response.data or []
        # print("Textbooks:", all_textbooks)

        question_prompts_raw = supabase.table("questions").select("*").eq("generation", generation_id).execute().data
        question_prompts: List[QuestionPrompt] = []
        for prompt in question_prompts_raw:
            question_prompts.append({
                "id": prompt.get('id'),
                "mcq": prompt.get('mcq'),
                "multi_part": prompt.get('multipart') is not None,
                "computational": not prompt.get('conceptual'),
                "additional_info": prompt.get('additional_info') + generation_additional_info,
                "references": prompt.get('references')
            })
        print("Question prompts:", question_prompts)
        references: Dict[str, List[str]] = {prompt.get('id'): prompt.get('references') for prompt in question_prompts}
        all_documents: Dict[str, List[Any]] = {}
        for prompt_id, reference in references.items():
            documents_response = supabase.table("documents").select("*").in_("id", reference).execute()
            all_documents[prompt_id] = documents_response.data or []
        # print("Documents:", all_documents)

        question_data: Dict[str, List[str]] = {}
        for prompt in question_prompts:
            prompt_id = prompt.get('id')
            question_data[prompt_id] = []
            documents = all_documents.get(prompt_id)
            for doc in documents:
                if (doc.get('lecture') is not None):
                    page = str(doc.get('page'))
                    lecture_name = next((l.get('name') for l in all_lectures if l.get('id') == doc.get('lecture')), None)
                    content = f"LECTURE {lecture_name} SLIDE {page}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                    question_data[prompt_id].append(content)
                elif (doc.get('textbook') is not None):
                    page = str(doc.get('page'))
                    textbook_name = next((t.get('title') for t in all_textbooks if t.get('id') == doc.get('textbook')), None)
                    content = f"TEXTBOOK {textbook_name} PAGE {page}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                    question_data[prompt_id].append(content)

        async def on_batch_complete(questions: List[List[Union[MCQQuestion, FRQQuestion]]]):
            print("Generated questions for batch:", questions)
            
            problems_data = []
            for question_group in questions: 
                for question in question_group:
                    question_id = question.get('id')
                    question_document_ids = [doc.get('id') for doc in documents]
                    
                    if isinstance(question, dict) and "options" in question:
                        # MCQ Question
                        correct_answer = next((opt for opt, is_correct in question["answers"].items() if is_correct), None)
                        question_data = {
                            "question": question["question"],
                            "option_a": question["options"]["A"],
                            "option_b": question["options"]["B"],
                            "option_c": question["options"]["C"],
                            "option_d": question["options"]["D"],
                            "option_e": question["options"]["E"],
                            "solution": correct_answer,
                            "explanation_a": question["explanations"]["A"],
                            "explanation_b": question["explanations"]["B"],
                            "explanation_c": question["explanations"]["C"],
                            "explanation_d": question["explanations"]["D"],
                            "explanation_e": question["explanations"]["E"],
                            "references": question_document_ids
                        }
                    else:
                        # FRQ Question
                        question_data = {
                            "question": question["question"],
                            "solution": question["solution"],
                            "references": question_document_ids
                        }
                    
                    problems_data.append(question_data)

            # Insert questions
            questions_response = supabase.table("questions").update(problems_data).eq("id", question_id).execute()
            print("Questions response:", questions_response)

            # Update progress
            progress = min(0.9, len(questions) / len(question_prompts))
            supabase.table("generations").update({
                "progress": progress
            }).eq("id", generation_id).execute()

        # Generate questions
        questions: List[List[Union[MCQQuestion, FRQQuestion]]] = []

        processor = ProblemsProcessor(
            course_title=class_title,
            items=question_data,
        )
        print("Processor created")
        questions = await processor.process_problems(
            question_prompts=question_prompts,
            on_batch_complete=on_batch_complete
        )
        print("Questions:", questions)

        if not questions:
            raise ValueError("No problems generated")

        # Update generation status to complete
        supabase.table("generations").update({
            "generation_status": "complete",
            "progress": 1,
            "generation_error": None
        }).eq("id", generation_id).execute()

        return {"problems": questions}, 200

    except Exception as error:
        print("Error in generate-problems function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })
        
        # Update generation status to error
        supabase.table("generations").update({
            "generation_status": "error",
            "generation_error": str(error)
        }).eq("id", generation_id).execute()

        raise HTTPException(status_code=500, detail=str(error))
    

@router.post('/chat')
async def generate_chat(request: ChatRequest):
    """Generate chat for a class with streaming support."""
    try:
        print("Starting generate-chat function...")
        generation_id = request.generation_id

        generation_response = supabase.table("generations").select("*").eq("id", generation_id).single().execute()
        generation = generation_response.data
        class_id = generation.get('class')

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description, map"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get all lectures
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = lectures_response.data or []
        # print("Lectures:", all_lectures)

        # Get all textbooks
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).execute()
        all_textbooks = textbooks_response.data or []
        # print("Textbooks:", all_textbooks)

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase.table("messages").select("*").order("created_at", desc=True).eq("generation", generation_id).execute()
        messages = messages_response.data

        # Get the first message (the one we need to process)
        current_message = messages[0]
        
        # Format past messages for context
        past_messages = [(msg['id'], msg['question'], msg.get('response', '')) for msg in messages[:-1]]

        # Get documents for the current message
        current_documents_response = supabase.table("documents").select("*").in_("id", current_message.get('references', [])).execute()
        current_documents = current_documents_response.data or []

        # Format the context for the current message
        message_context = []
        for doc in current_documents:
            if doc.get('lecture') is not None:
                lecture_name = next((l.get('name') for l in all_lectures if l.get('id') == doc.get('lecture')), None)
                content = f"LECTURE {lecture_name} SLIDE {doc.get('page')}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                message_context.append(content)
            elif doc.get('textbook') is not None:
                textbook_name = next((t.get('title') for t in all_textbooks if t.get('id') == doc.get('textbook')), None)
                content = f"TEXTBOOK {textbook_name} PAGE {doc.get('page')}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                message_context.append(content)

        async def stream_generator():
            try:
                processor = ChatProcessor(
                    course_title=class_title,
                    message_id=current_message['id'],
                    question=current_message['question'],
                    documents_context="\n".join(message_context),
                    past_messages=past_messages
                )

                total_response = ""
                chunk_count = 0
                estimated_total_chunks = 100  # Heuristic: assume ~100 chunks per response

                async def stream_callback(chunk: str):
                    nonlocal total_response, chunk_count
                    total_response += chunk
                    chunk_count += 1
                    
                    # Update progress based on chunks (max 90% until complete)
                    progress = min(0.9, chunk_count / estimated_total_chunks)
                    supabase.table("generations").update({
                        "progress": progress
                    }).eq("id", generation_id).execute()
                    
                    # Return the chunk as a string, not a dict
                    return chunk

                async for chunk in processor.process_message(
                    complete_context="\n".join(message_context),
                    all_lectures=all_lectures,
                    all_textbooks=all_textbooks,
                    all_documents=current_documents,
                    stream_callback=stream_callback
                ):
                    # Properly format the chunk as a SSE message
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n".encode('utf-8')

                # Clean the response and extract document references
                cleaned_result = processor.clean_result(
                    total_response,
                    all_lectures,
                    all_textbooks,
                    current_documents
                )

                # Update the message in Supabase with the complete response
                supabase.table("messages").update({
                    "response": cleaned_result['response'],
                    "documents": cleaned_result['documents']
                }).eq("id", current_message['id']).execute()

                # Send completion event
                yield f"data: {json.dumps({'done': True})}\n\n".encode('utf-8')

                # Update generation status to complete
                supabase.table("generations").update({
                    "generation_status": "complete",
                    "progress": 1,
                    "generation_error": None
                }).eq("id", generation_id).execute()

            except Exception as error:
                error_data = {
                    "error": str(error),
                    "stack": traceback.format_exc(),
                    "name": type(error).__name__
                }
                yield f"data: {json.dumps({'error': error_data})}\n\n".encode('utf-8')
                
                # Update generation status to error
                supabase.table("generations").update({
                    "generation_status": "error",
                    "generation_error": str(error)
                }).eq("id", generation_id).execute()

        return StreamingResponse(
            stream_generator(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )

    except Exception as error:
        print("Error in generate-chat function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(error),
                "stack": traceback.format_exc(),
                "name": type(error).__name__
            }
        )
        

        
        



