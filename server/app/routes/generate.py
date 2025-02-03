from flask import Blueprint, request, jsonify
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, TypedDict
from app.extensions import supabase
from app.services.problems.problems_processor import (
    ProblemsContent,
    QuestionPrompt,
    MCQQuestion,
    FRQQuestion,
    ProblemsProcessor
)
import uuid

generate_bp = Blueprint('generate', __name__)

class ProblemRequest(TypedDict):
    class_id: str
    generation_id: str
    additional_instructions: str

@generate_bp.route('/problems', methods=['POST'])
async def generate_problems():
    """Generate problems for lectures or topics."""
    try:
        print("Starting generate-problems function...")
        data: ProblemRequest = request.get_json()
        class_id = data.get('class_id')
        generation_id = data.get('generation_id')

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

        question_prompts_raw = supabase.table("questions").select("*").eq("generation", generation_id).execute().data
        question_prompts: List[QuestionPrompt] = []
        for prompt in question_prompts_raw:
            question_prompts.append({
                "id": prompt.get('id'),
                "mcq": prompt.get('mcq'),
                "multi_part": prompt.get('multipart') is not None,
                "computational": not prompt.get('conceptual'),
                "additional_info": prompt.get('additional_info'),
                "topics": prompt.get('topics'),
                "lectures": prompt.get('lectures')
            })
        print("Question prompts:", question_prompts)

        names: List[str] = []

        # Get all lectures
        all_lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = [{
            'id': lecture.get('id'),
            'name': lecture.get('name'),
            'note_number': lecture.get('note_number')
        } for lecture in (all_lectures_response.data or [])]
        print("All Lectures:", all_lectures)

        # Get all topics
        all_topics_response = supabase.table("topics").select("*").eq("class", class_id).execute()
        all_topics = all_topics_response.data or []
        print("All Topics:", all_topics)

        lecture_names = []
        topic_names = []
        lecture_ids = {}

        for question_prompt in question_prompts:
            # getting lecture names and topic names
            question_topics = [topic for topic in all_topics if topic.get('id') in question_prompt.get('topics')]
            question_lectures = [lecture for lecture in all_lectures if lecture.get('id') in question_prompt.get('lectures')]
            lecture_names.append([lecture.get('name') for lecture in question_lectures])
            topic_names.append([topic.get('title') for topic in question_topics])

            # adding lecture ids for topics and lectures
            lecture_ids[question_prompt.get('id')] = [topic.get('lectures') for topic in question_topics]
            lecture_ids[question_prompt.get('id')] = [lecture.get('id') for lecture in question_lectures]

        print("Lecture names:", lecture_names)
        print("Topic names:", topic_names)
        print("Lecture IDs:", lecture_ids)

        # Get documents
        lecture_ids_flattened = [lecture_id for lecture_ids in lecture_ids.values() for lecture_id in lecture_ids]
        documents_response = supabase.table("documents").select("*").in_("lecture", lecture_ids_flattened).execute()
        documents = documents_response.data or []
        print("Documents:", documents)

        # Process lectures content
        question_lectures_processed: Dict[str, Dict] = {}
        for question_id, question_lecture_ids in lecture_ids.items():
            lectures_processed: Dict[str, Dict] = {}
            for lecture_id in question_lecture_ids:
                lecture = next((l for l in all_lectures if l.get('id') == lecture_id), None)
                if not lecture:
                    continue

                # Build lecture content
                lecture_content = []
                for doc in [d for d in documents if d.get('lecture') == lecture_id]:
                    page = str(doc.get('page'))
                    content = f"SLIDE {page}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                    lecture_content.append(content)

                final_content = f"LECTURE NAME: {lecture.get('name')} | LECTURE NUMBER: {lecture.get('note_number')}\n"
                final_content += "\n\n".join(lecture_content) + "\n\n"
                
                lectures_processed[lecture_id] = {
                    'content': final_content
                }

            # Combine all content
            content: ProblemsContent = {
                'content': ''
            }
            for lecture_data in lectures_processed.values():
                content['content'] += lecture_data['content']
            
            question_lectures_processed[question_id] = content

        print("Question lectures processed:", question_lectures_processed)

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
                            "documents": question_document_ids
                        }
                    else:
                        # FRQ Question
                        question_data = {
                            "question": question["question"],
                            "solution": question["solution"],
                            "documents": question_document_ids
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
            names=names,
            items=question_lectures_processed,
        )
        print("Processor created")
        questions = await processor.process_problems(
            question_prompts=question_prompts,
            all_lectures=all_lectures,
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