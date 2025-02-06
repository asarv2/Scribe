from flask import Blueprint, request, jsonify
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, TypedDict
from app.extensions import supabase
from app.services.problems.problems_processor import (
    QuestionPrompt,
    MCQQuestion,
    FRQQuestion,
    ProblemsProcessor
)
import uuid
from app.services.chat.chat_processor import ChatProcessor, ChatMessage

generate_bp = Blueprint('generate', __name__)

class ProblemRequest(TypedDict):
    class_id: str
    generation_id: str
    additional_instructions: str

class ChatRequest(TypedDict):
    generation_id: str

@generate_bp.route('/problems', methods=['POST'])
async def generate_problems():
    """Generate problems for lectures or topics."""
    try:
        print("Starting generate-problems function...")
        data: ProblemRequest = request.get_json()
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
        print("Class response:", class_response)

        # Get all lectures
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = lectures_response.data or []
        print("Lectures:", all_lectures)

        # Get all textbooks 
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).execute()
        all_textbooks = textbooks_response.data or []
        print("Textbooks:", all_textbooks)

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
        print("Documents:", all_documents)

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

        return jsonify({"problems": questions}), 200

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

        return jsonify({
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        }), 500
    

@generate_bp.route('/chat', methods=['POST'])
async def generate_chat():
    """Generate chat for a class."""
    try:
        print("Starting generate-chat function...")
        data: ChatRequest = request.get_json()
        generation_id = data.get('generation_id')

        generation_response = supabase.table("generations").select("*").eq("id", generation_id).single().execute()
        generation = generation_response.data
        class_id = generation.get('class')

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description, map"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class response:", class_response)

        # Get all lectures
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = lectures_response.data or []
        print("Lectures:", all_lectures)

        # Get all textbooks
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).execute()
        all_textbooks = textbooks_response.data or []
        print("Textbooks:", all_textbooks)

        messages_prompts_raw = supabase.table("messages").select("*").eq("generation", generation_id).execute().data
        messages_prompts: List[QuestionPrompt] = []
        for prompt in messages_prompts_raw:
            messages_prompts.append({
                "id": prompt.get('id'),
                "question": prompt.get('question'),
                "references": prompt.get('references')
            })
        print("Messages prompts:", messages_prompts)
        references: Dict[str, List[str]] = {prompt.get('id'): prompt.get('references') for prompt in messages_prompts}
        all_documents: Dict[str, List[Any]] = {}
        for prompt_id, reference in references.items():
            documents_response = supabase.table("documents").select("*").in_("id", reference).execute()
            all_documents[prompt_id] = documents_response.data or []
        print("Documents:", all_documents)

        messages_data: Dict[str, List[str]] = {}
        for prompt in messages_prompts:
            prompt_id = prompt.get('id')
            messages_data[prompt_id] = []
            documents = all_documents.get(prompt_id)
            for doc in documents:
                if (doc.get('lecture') is not None):
                    page = str(doc.get('page'))
                    lecture_name = next((l.get('name') for l in all_lectures if l.get('id') == doc.get('lecture')), None)
                    content = f"LECTURE {lecture_name} SLIDE {page}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                    messages_data[prompt_id].append(content)
                elif (doc.get('textbook') is not None):
                    page = str(doc.get('page'))
                    textbook_name = next((t.get('title') for t in all_textbooks if t.get('id') == doc.get('textbook')), None)
                    content = f"TEXTBOOK {textbook_name} PAGE {page}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                    messages_data[prompt_id].append(content)

        async def on_batch_complete(messages: List[ChatMessage]):
            print("Generated messages for batch:", messages)

            messages_data = []
            for message in messages:
                message_id = message.get('id')
                documents = all_documents.get(message_id, [])
                document_ids = [doc.get('id') for doc in documents]
                
                messages_data.append({
                    "id": message_id,
                    "question": message.get('question'),
                    "response": message.get('response'),
                    "documents": document_ids
                })

            # Update messages
            for message_data in messages_data:
                supabase.table("messages").update({
                    "response": message_data["response"],
                    "documents": message_data["documents"]
                }).eq("id", message_data["id"]).execute()

            # Update progress
            progress = min(0.9, len(messages) / len(messages_prompts))
            supabase.table("generations").update({
                "progress": progress
            }).eq("id", generation_id).execute()

        # Generate responses
        processor = ChatProcessor(
            course_title=class_title,
            items=messages_data,
        )
        print("Processor created")
        
        messages = await processor.process_messages(
            message_prompts=messages_prompts,
            on_batch_complete=on_batch_complete
        )
        print("Messages:", messages)

        if not messages:
            raise ValueError("No messages generated")

        # Update generation status to complete
        supabase.table("generations").update({
            "generation_status": "complete",
            "progress": 1,
            "generation_error": None
        }).eq("id", generation_id).execute()

        return jsonify({"messages": messages}), 200

    except Exception as error:
        print("Error in generate-chat function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })
        
        # Update generation status to error
        supabase.table("generations").update({
            "generation_status": "error",
            "generation_error": str(error)
        }).eq("id", generation_id).execute()

        return jsonify({
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        }), 500
        

        
        



