from flask import Blueprint, request, jsonify
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, TypedDict
from app.extensions import supabase
from app.services.summary.lecture_summary_processor import LectureSummaryProcessor
from app.services.summary.topic_summary_processor import TopicSummaryProcessor
from app.services.summary.base_summary_processor import Summary, SummaryContent, Figure
from app.services.problems.lecture_problems_processor import LectureProblemsProcessor
from app.services.problems.topic_problems_processor import TopicProblemsProcessor
from app.services.problems.base_problems_processor import (
    MCQQuestion,
    FRQQuestion,
    ProblemsContent,
    QuestionType
)
import uuid

generate_bp = Blueprint('generate', __name__)

class ProblemRequest(TypedDict):
    class_id: str
    generation_id: str
    additional_instructions: str

@generate_bp.route('/summary', methods=['POST'])
async def generate_summary():
    """
    Generate a summary for lectures or topics.
    """
    try:
        print("Starting generate-summary function...")
        data = request.get_json()
        class_id = data.get('class_id')
        generation_id = data.get('generation_id')
        
        print("Request params:", {"class_id": class_id, "generation_id": generation_id})

        # Update generation status to generating
        supabase.table("generations").update({
            "generation_status": "generating",
            "generation_error": None
        }).eq("id", generation_id).execute()

        # Get class info
        class_response = supabase.table("classes").select("title, course_description, map").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class response:", class_response)

        # Get generation info
        generation_response = supabase.table("generations").select("*").eq("id", generation_id).single().execute()
        generation_lectures = generation_response.data.get('lectures', [])
        generation_topics = generation_response.data.get('topics', [])
        print("Generation response:", generation_response)

        # Get all lectures
        all_lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = all_lectures_response.data or []
        print("All Lectures:", all_lectures)

        lectures = generation_lectures
        names: List[str] = []

        if generation_topics:
            # Handle topics
            topics_response = supabase.table("topics").select("*").in_("id", generation_topics).execute()
            topics = topics_response.data or []
            print("Topics:", topics)
            
            # Get unique lectures from topics
            lectures = list(set([lecture for topic in topics for lecture in topic.get('lectures', [])]))
            names = [topic.get('title') for topic in topics]
        elif generation_lectures:
            # Handle lectures
            names = [lecture.get('name') for lecture in all_lectures if lecture.get('id') in generation_lectures]

        # Get documents
        documents_response = supabase.table("documents").select("*").in_("lecture", lectures).execute()
        documents = documents_response.data or []
        print("Documents:", documents)

        # Get figures
        figures_response = supabase.table("figures").select("*").in_("document", [doc.get('id') for doc in documents]).execute()
        figures = figures_response.data or []
        print("Figures:", figures)

        # Process lectures content
        lectures_processed: Dict[str, SummaryContent] = {}
        for lecture_id in lectures:
            lecture = next((l for l in all_lectures if l.get('id') == lecture_id), None)
            if not lecture:
                continue

            # Process figures for this lecture
            lecture_figures = [f for f in figures if f.get('document') == lecture_id]
            figures_dict: Dict[str, List[Figure]] = {}
            
            for figure in lecture_figures:
                doc = next((d for d in documents if d.get('id') == figure.get('document')), None)
                if doc:
                    page = str(doc.get('page'))
                    if page not in figures_dict:
                        figures_dict[page] = []
                    figures_dict[page].append({
                        'bbox': [figure.get('y_min'), figure.get('x_min'), figure.get('y_max'), figure.get('x_max')],
                        'description': figure.get('description', '')
                    })

            # Build lecture content
            lecture_docs = [d for d in documents if d.get('lecture') == lecture_id]
            lecture_content = []
            for doc in lecture_docs:
                page = str(doc.get('page'))
                content = f"SLIDE {page}\n<LATEX>{doc.get('latex')}</LATEX>\n"
                
                # Add figures
                if page in figures_dict:
                    for figure in figures_dict[page]:
                        content += f"<FIGURE [{', '.join(map(str, figure['bbox']))}]> {figure['description']}</FIGURE>"
                
                content += f"\n<DESCRIPTION>{doc.get('description')}</DESCRIPTION>"
                lecture_content.append(content)

            final_content = f"LECTURE NAME: {lecture.get('name')} | LECTURE NUMBER: {lecture.get('note_number')}\n"
            final_content += "\n\n".join(lecture_content) + "\n\n"
            
            lectures_processed[lecture_id] = {
                'figures': figures_dict,
                'content': final_content
            }

        # Combine all content
        content: SummaryContent = {
            'figures': {},
            'content': ''
        }
        for lecture_content in lectures_processed.values():
            content['figures'].update(lecture_content['figures'])
            content['content'] += lecture_content['content']

        # Set up batch processing
        num_batches = 2  # Can be calculated dynamically later

        async def on_batch_complete(batch_number: int, summary: Summary):
            print("Generated summary for batch:", summary)
            progress = min(0.9, batch_number / num_batches)
            supabase.table("generations").update({
                "progress": progress
            }).eq("id", generation_id).execute()

        # Generate summary
        summary: Summary = {
            'preamble': '',
            'content': '',
            'conclusion': '',
            'slides': {}
        }

        if generation_lectures:
            processor = LectureSummaryProcessor(
                course_title=class_title,
                lecture_names=names,
                lectures=content
            )
            summary = await processor.process_summary(all_lectures, num_batches, on_batch_complete)
            print("Lecture summary:", summary)
        elif generation_topics:
            processor = TopicSummaryProcessor(
                course_title=class_title,
                topic_names=names,
                topics=content
            )
            summary = await processor.process_summary(all_lectures, num_batches, on_batch_complete)
            print("Topic summary:", summary)

        if not summary['content']:
            raise ValueError("No summary generated")

        # Save summary
        summary_response = supabase.table("summaries").insert({
            "preamble": summary['preamble'],
            "content": summary['content'],
            "conclusion": summary['conclusion'],
            "generation": generation_id,
            "documents": [doc.get('id') for doc in documents]
        }).execute()
        print("Summary response:", summary_response)

        # Update generation status to complete
        supabase.table("generations").update({
            "generation_status": "complete",
            "generation_error": None
        }).eq("id", generation_id).execute()

        return jsonify(summary), 200

    except Exception as error:
        print("Error in generate-summary function:", {
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

@generate_bp.route('/problems', methods=['POST'])
async def generate_problems():
    """Generate problems for lectures or topics."""
    try:
        print("Starting generate-problems function...")
        data: ProblemRequest = request.get_json()
        class_id = data.get('class_id')
        generation_id = data.get('generation_id')
        additional_instructions = data.get('additional_instructions')

        print("Request params:", {
            "class_id": class_id,
            "generation_id": generation_id,
            "additional_instructions": additional_instructions
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

        # Get generation info
        generation_response = supabase.table("generations").select("*").eq("id", generation_id).single().execute()
        generation_data = generation_response.data
        generation_lectures = generation_data.get('lectures', [])
        generation_topics = generation_data.get('topics', [])
        generation_questions = generation_data.get('num_questions', 0)
        generation_conceptual = generation_data.get('conceptual', False)
        generation_single = generation_data.get('single', False)
        generation_question_type = QuestionType.MCQ if generation_data.get('mcq') else QuestionType.FRQ

        lectures = generation_lectures
        names: List[str] = []

        # Get all lectures
        all_lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = [{
            'id': lecture.get('id'),
            'name': lecture.get('name'),
            'note_number': lecture.get('note_number')
        } for lecture in (all_lectures_response.data or [])]
        print("All Lectures:", all_lectures)

        if generation_topics:
            # Handle topics
            topics_response = supabase.table("topics").select("*").in_("id", generation_topics).execute()
            topics = topics_response.data or []
            print("Topics:", topics)
            lectures = list(set([lecture for topic in topics for lecture in topic.get('lectures', [])]))
            names = [topic.get('title') for topic in topics]
        elif generation_lectures:
            names = [lecture.get('name') for lecture in all_lectures if lecture.get('id') in generation_lectures]

        # Get documents and figures
        documents_response = supabase.table("documents").select("*").in_("lecture", lectures).execute()
        documents = documents_response.data or []
        print("Documents:", documents)

        figures_response = supabase.table("figures").select("*").in_("document", [doc.get('id') for doc in documents]).execute()
        figures = figures_response.data or []
        print("Figures:", figures)

        # Process lectures content
        lectures_processed: Dict[str, Dict] = {}
        for lecture_id in lectures:
            lecture = next((l for l in all_lectures if l.get('id') == lecture_id), None)
            if not lecture:
                continue

            lecture_figures = [f for f in figures if f.get('document') == lecture_id]
            figures_dict: Dict[str, List[Figure]] = {}

            for figure in lecture_figures:
                doc = next((d for d in documents if d.get('id') == figure.get('document')), None)
                if doc:
                    page = str(doc.get('page'))
                    if page not in figures_dict:
                        figures_dict[page] = []
                    figures_dict[page].append({
                        'bbox': [figure.get('y_min'), figure.get('x_min'), figure.get('y_max'), figure.get('x_max')],
                        'description': figure.get('description', '')
                    })

            # Build lecture content
            lecture_content = []
            for doc in [d for d in documents if d.get('lecture') == lecture_id]:
                page = str(doc.get('page'))
                content = f"SLIDE {page}\n<LATEX>{doc.get('latex')}</LATEX>\n"
                
                if page in figures_dict:
                    for figure in figures_dict[page]:
                        bbox_str = ", ".join(map(str, figure['bbox']))
                        content += f"<FIGURE [{bbox_str}]> {figure['description']}</FIGURE>"
                
                content += f"\n<DESCRIPTION>{doc.get('description')}</DESCRIPTION>"
                lecture_content.append(content)

            final_content = f"LECTURE NAME: {lecture.get('name')} | LECTURE NUMBER: {lecture.get('note_number')}\n"
            final_content += "\n\n".join(lecture_content) + "\n\n"
            
            lectures_processed[lecture_id] = {
                'figures': figures_dict,
                'content': final_content
            }

        # Combine all content
        content: ProblemsContent = {
            'figures': {},
            'content': ''
        }
        for lecture_data in lectures_processed.values():
            content['figures'].update(lecture_data['figures'])
            content['content'] += lecture_data['content']

        # Set batch size based on question type
        batch_size = 2 if generation_single else 1

        async def on_batch_complete(questions: List[List[Union[MCQQuestion, FRQQuestion]]]):
            print("Generated questions for batch:", questions)
            
            problems_data = []
            for question_group in questions:
                multi_part_uuid = str(uuid.uuid4()) if len(question_group) > 1 else None
                
                for question in question_group:
                    question_document_ids = [doc.get('id') for doc in documents]
                    
                    if isinstance(question, dict) and "options" in question:
                        # MCQ Question
                        correct_answer = next((opt for opt, is_correct in question["answers"].items() if is_correct), None)
                        question_data = {
                            "question": question["question"],
                            "mcq": True,
                            "conceptual": "conceptual" in question.get("tags", []),
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
                            "generation": generation_id,
                            "documents": question_document_ids
                        }
                    else:
                        # FRQ Question
                        question_data = {
                            "question": question["question"],
                            "mcq": False,
                            "conceptual": "conceptual" in question.get("tags", []),
                            "solution": question["solution"],
                            "generation": generation_id,
                            "documents": question_document_ids
                        }
                    
                    if multi_part_uuid:
                        question_data["multipart"] = multi_part_uuid
                    
                    problems_data.append(question_data)

            # Insert questions
            questions_response = supabase.table("questions").insert(problems_data).execute()
            print("Questions response:", questions_response)

            # Handle rubrics for FRQ questions
            if generation_question_type == QuestionType.FRQ:
                rubrics_data = []
                for question_info in questions_response.data or []:
                    question_id = question_info.get('id')
                    question_text = question_info.get('question')
                    
                    question_data = next((q for group in questions for q in group 
                                       if q["question"] == question_text), None)
                    
                    if question_data and "rubric" in question_data:
                        for rubric_item in question_data["rubric"]:
                            rubrics_data.append({
                                "question": question_id,
                                "points": rubric_item["points"],
                                "content": rubric_item["content"],
                                "standard": rubric_item["standard"]
                            })

                if rubrics_data:
                    rubrics_response = supabase.table("rubrics").insert(rubrics_data).execute()
                    print("Rubrics response:", rubrics_response)

            # Update progress
            progress = min(0.9, len(questions) / generation_questions)
            supabase.table("generations").update({
                "progress": progress
            }).eq("id", generation_id).execute()

        # Generate questions
        questions: List[List[Union[MCQQuestion, FRQQuestion]]] = []
        
        if generation_lectures:
            processor = LectureProblemsProcessor(
                course_title=class_title,
                lecture_names=names,
                lectures=content,
                question_type=generation_question_type,
                additional_instructions=additional_instructions
            )
            print("Lecture problems processor created")
            questions = await processor.process_problems(
                num_questions=generation_questions,
                conceptual_ratio=1 if generation_conceptual else 0,
                single_part_ratio=1 if generation_single else 0,
                all_lectures=all_lectures,
                batch_size=batch_size,
                on_batch_complete=on_batch_complete
            )
            print("Lecture problems:", questions)
            
        elif generation_topics:
            processor = TopicProblemsProcessor(
                course_title=class_title,
                topic_names=names,
                topics=content,
                question_type=generation_question_type,
                additional_instructions=additional_instructions
            )
            print("Topic problems processor created")
            questions = await processor.process_problems(
                num_questions=generation_questions,
                conceptual_ratio=1 if generation_conceptual else 0,
                single_part_ratio=1 if generation_single else 0,
                all_lectures=all_lectures,
                batch_size=batch_size,
                on_batch_complete=on_batch_complete
            )
            print("Topic problems:", questions)

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