import os
from flask import Blueprint, request, jsonify
from datetime import datetime
import traceback
from typing import Dict, List, Any
from app.services.condense.terms_processor import TermsProcessor
from app.services.condense.groups_processor import GroupsProcessor
from app.extensions import supabase

batch_bp = Blueprint('batch', __name__)

@batch_bp.route('/process', methods=['POST'])
async def batch_topics(class_id=None, lecture_id=None):
    """
    Batch topics and return the documents.
    """
    try:
        print("Starting batch-topics function...")
        if class_id is None or lecture_id is None:
            # If parameters aren't passed directly, get them from request
            data = request.get_json()
            class_id = data.get('class_id')
            lecture_id = data.get('lecture_id')
        
        print("Request params:", {"class_id": class_id, "lecture_id": lecture_id})

        # Update status to batching
        supabase.table("lectures").update({
            "parse_status": "batching",
            "parse_error": None
        }).eq("id", lecture_id).execute()

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description, map"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        class_description = class_response.data.get('course_description')
        class_map = class_response.data.get('map')
        print("Class response:", class_response)

        # Get lecture name
        lecture_response = supabase.table("lectures").select("name").eq(
            "id", lecture_id
        ).single().execute()
        lecture_name = lecture_response.data.get('name')
        print("Lecture name:", lecture_name)

        # Get documents
        documents_response = supabase.table("documents").select("*").eq(
            "lecture", lecture_id
        ).execute()
        documents = documents_response.data
        print("Documents query response:", documents_response)

        # Get figures
        figures_response = supabase.table("figures").select("*").in_(
            "document", [doc.get('id') for doc in documents]
        ).execute()
        all_figures = figures_response.data
        figures_dict: Dict[str, List[Dict]] = {}
        
        for figure in all_figures:
            document = next((doc for doc in documents if doc['id'] == figure['document']), None)
            if document:
                page_key = str(document['page'])
                if page_key not in figures_dict:
                    figures_dict[page_key] = []
                figures_dict[page_key].append(figure)
        
        print("Figures dict:", figures_dict)

        # Format lecture content
        lecture_content = "\n\n".join(
            "SLIDE " + str(doc['page']) + "\n" +
            "<LATEX>" + doc.get('latex', '') + "</LATEX>" + "\n" +
            "".join(
                "<FIGURE [" +
                ", ".join(map(str, [
                    fig['y_min'], fig['x_min'], 
                    fig['y_max'], fig['x_max']
                ])) +
                "]> " + fig['description'] + "</FIGURE>"
                for fig in figures_dict.get(str(doc['page']), [])
            ) + "\n" +
            "<DESCRIPTION>" + doc.get('description', '') + "</DESCRIPTION>"
            for doc in documents
        )

        lectures_processed = {
            lecture_name: {
                "figures": figures_dict,
                "content": lecture_content
            }
        }

        # Create new instance of TermsProcessor
        terms_processor = TermsProcessor(class_title, lectures_processed)
        print("TermsProcessor created")

        # Process the terms
        print("Starting terms processing...")
        terms_results = await terms_processor.process_terms()
        print("Terms processing complete, results:", terms_results)

        # Get all lectures for this class
        lectures_response = supabase.table("lectures").select("*").eq(
            "class", class_id
        ).execute()
        lectures = lectures_response.data
        lecture_mapping = {
            lecture['name']: {
                "id": lecture['id']
            }
            for lecture in lectures
        }
        print("Lectures mapping:", lecture_mapping)

        # Get previous terms if class map exists
        previous_terms = []
        if class_map:
            previous_terms_response = supabase.table("topics").select("*").eq(
                "map", class_map
            ).neq("type", "group").execute()
            previous_terms = previous_terms_response.data
        print("Previous terms:", previous_terms)

        # Process previous terms
        previous_terms_dict = {}
        for term in previous_terms:
            term_type = "Key Terms"
            if term['type'] == "term":
                term_type = "Key Terms"
            elif term['type'] == "problem":
                term_type = "Problem Types"
            elif term['type'] == "algorithm":
                term_type = "Algorithm Solutions"

            mapped_lectures = {}
            for lecture_id in term.get('lectures', []):
                lecture = next((l for l in lectures if l['id'] == lecture_id), None)
                if lecture:
                    mapped_lectures[lecture['name']] = list(range(1, lecture['pages'] + 1))

            previous_terms_dict[term['title'].lower()] = {
                "term": term['title'],
                "definition": term['content'],
                "lectures": mapped_lectures,
                "type": term_type,
                "figures": term.get('figures', [])
            }

        # Combine terms
        all_terms = {**previous_terms_dict, **terms_results}
        print("All terms:", all_terms)

        # Process groups
        print("Starting groups processing...")
        groups_processor = GroupsProcessor(
            all_terms,
            class_title,
            class_description,
            depth=1,
            max_depth=2
        )
        groups_results = await groups_processor.process_groups()
        print("Groups processing complete, results:", groups_results)

        # Format topics for database
        topics = groups_processor.reformat_topics(lecture_mapping, class_id)
        print("Topics:", topics)

        # Insert topics into database
        topics_response = supabase.table("topics").insert(topics).execute()
        topics_inserted = topics_response.data
        print("Topics inserted:", topics_inserted)

        # Update class map
        if topics_inserted:
            supabase.table("classes").update({
                "map": topics_inserted[0]['map']
            }).eq("id", class_id).execute()

        # Update lecture status to complete
        lecture_response = supabase.table("lectures").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", lecture_id).execute()
        print("Lecture response:", lecture_response)

        return jsonify({"topics": topics}), 200

    except Exception as error:
        print("Error in batch-topics function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })
        
        # Update lecture status to error
        supabase.table("lectures").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", lecture_id).execute()

        return jsonify({
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        }), 500