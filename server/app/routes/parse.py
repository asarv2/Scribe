import math
from flask import Blueprint, request, jsonify, current_app, url_for
from app.extensions import supabase
from app.services.parse.lecture_processor import LectureProcessor
from app.services.parse.textbook_processor import TextbookProcessor
from app.services.parse.video_processor import VideoProcessor
import os
from datetime import datetime
import traceback
import json
from app.extensions import app
import requests
import asyncio
from app.routes.batch import batch_topics  # Import the function directly

parse_bp = Blueprint('parse', __name__)

@parse_bp.route('/lecture', methods=['POST'])
async def parse_lecture():
    """
    Parse a lecture and return the documents.
    """
    try:
        print("Starting parse-lecture function...")
        data = request.get_json()
        class_id = data.get('class_id')
        lecture_id = data.get('lecture_id')
        handwritten = data.get('handwritten')
        
        print("Request params:", {"class_id": class_id, "lecture_id": lecture_id, "handwritten": handwritten})

        # Update lecture status to parsing
        supabase.table("lectures").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get lecture info
        lecture_response = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
        num_pages = lecture_response.data.get('pages')
        print("Lecture query response:", lecture_response)

        # Get existing documents
        documents_response = supabase.table("documents").select("*").eq("lecture", lecture_id).execute()
        documents = documents_response.data
        if not documents:
            raise Exception("No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print("Documents to process:", documents_to_process)

        # Create new instance of LectureProcessor
        lecture_processor = LectureProcessor(class_title, handwritten)
        print("LectureProcessor created")

        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images and figures from supabase
            images = []
            figures = []
            
            try:
                for doc in batch:
                    # Download image
                    image_path = f"{class_id}/{lecture_id}/{doc['id']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    response = supabase.storage.from_("lectures").download(image_path)
                    
                    if not response:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {doc['page']}")

                    # Get figures
                    figures_response = supabase.table("figures").select("*").eq("document", doc['id']).execute()
                    figures_data = figures_response.data
                    if not figures_data:
                        print(f"No figures found for document {doc['id']}")
                        figures.append([])
                        continue

                    formatted_figures = [
                        {
                            "bbox": [
                                float(fig['y_min']), 
                                float(fig['x_min']), 
                                float(fig['y_max']), 
                                float(fig['x_max'])
                            ],
                            "description": str(fig['description'])
                        }
                        for fig in figures_data
                    ]
                    figures.append(formatted_figures)

            except Exception as error:
                print("Error in image/figures download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                    "image_bboxes": figs
                }
                for doc, img, figs in zip(batch, images, figures)
            ]
            print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting lecture processing...")
            
            async def after_generate(result):
                # Find document ID
                document_id = next(
                    (doc['id'] for doc in documents if doc['page'] == result.page),
                    None
                )
                if not document_id:
                    raise Exception(f"Document not found for page {result.page}")

                # Update document
                supabase.table("documents").update({
                    "latex": result.latex,
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()

                # Insert new figures
                figures_data = [
                    {
                        "y_min": figure.bbox[0],
                        "x_min": figure.bbox[1],
                        "y_max": figure.bbox[2],
                        "x_max": figure.bbox[3],
                        "description": figure.description,
                        "document": document_id
                    }
                    for figure in result.figures
                ]
                
                if figures_data:
                    supabase.table("figures").insert(figures_data).execute()
                
                print("Document inserted:", result.description)

            results = await lecture_processor.process_slides(
                class_title,
                num_pages,
                processed_documents,
                after_generate
            )
            print("Lecture processing for batch complete, results:", results)

            # Convert CleanedResponse objects to dictionaries
            serializable_results = [
                {
                    "page": result.page,
                    "latex": result.latex,
                    "description": result.description,
                    "figures": [
                        {
                            "bbox": figure.bbox,
                            "description": figure.description
                        }
                        for figure in result.figures
                    ]
                }
                for result in results
            ]
            batch_results.append(serializable_results)

        print("Batch results:", batch_results)

        # Make HTTP request to batch endpoint
        try:
            request_body = {
                "class_id": class_id,
                "lecture_id": lecture_id
            }
            
            # Use url_for to generate the URL (more maintainable)
            batch_url = url_for('batch.batch_topics', _external=True)
            
            # Make the request
            response = requests.post(batch_url, json=request_body)
            
            if response.status_code != 200:
                print("Warning: Batch processing request failed:", response.json())
            else:
                print("Batch-topics processing initiated")
            
            return jsonify({"results": batch_results}), 200

        except Exception as batch_error:
            print("Error calling batch-topics:", {
                "name": type(batch_error).__name__,
                "message": str(batch_error),
                "stack": traceback.format_exc(),
            })
            
            return jsonify({"results": batch_results}), 200

    except Exception as error:
        print("Error in parse-lecture function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
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
    
@parse_bp.route('/textbook', methods=['POST'])
async def parse_textbook():
    """
    Parse a textbook and return the documents.
    """
    try:
        print("Starting parse-textbook function...")
        data = request.get_json()
        class_id = data.get('class_id')
        textbook_id = data.get('textbook_id')
        handwritten = data.get('handwritten')
        
        print("Request params:", {"class_id": class_id, "textbook_id": textbook_id, "handwritten": handwritten})

        # Update textbook status to parsing
        supabase.table("textbooks").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", textbook_id).execute()

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get textbook info
        textbook_response = supabase.table("textbooks").select("*").eq("id", textbook_id).single().execute()
        num_pages = textbook_response.data.get('pages')
        print("Textbook query response:", textbook_response)

        # Get existing documents
        documents_response = supabase.table("documents").select("*").eq("textbook", textbook_id).execute()
        documents = documents_response.data
        if not documents:
            raise Exception("No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print("Documents to process:", documents_to_process)

        # Create new instance of TextbookProcessor
        textbook_processor = TextbookProcessor(class_title, handwritten)
        print("TextbookProcessor created")

        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images and figures from supabase
            images = []
            figures = []
            
            try:
                for doc in batch:
                    # Download image
                    image_path = f"{class_id}/textbooks/{textbook_id}/images/{doc['page']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    response = supabase.storage.from_("slides").download(image_path)
                    
                    if not response.data:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response.data)
                    print(f"Successfully downloaded image {doc['page']}")

                    # Get figures
                    figures_response = supabase.table("figures").select("*").eq("document", doc['id']).execute()
                    figures_data = figures_response.data
                    if not figures_data:
                        print(f"No figures found for document {doc['id']}")
                        figures.append([])
                        continue

                    formatted_figures = [
                        {
                            "bbox": [
                                float(fig['y_min']), 
                                float(fig['x_min']), 
                                float(fig['y_max']), 
                                float(fig['x_max'])
                            ],
                            "description": str(fig['description'])
                        }
                        for fig in figures_data
                    ]
                    figures.append(formatted_figures)

            except Exception as error:
                print("Error in image/figures download process:", error)
                raise error

            print("Total images downloaded:", len(images))
            print("Images query response:", images)

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                    "image_bboxes": figs
                }
                for doc, img, figs in zip(batch, images, figures)
            ]
            print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting textbook processing...")
            
            async def after_generate(result):
                # Find document ID
                document_id = next(
                    (doc['id'] for doc in documents if doc['page'] == result.page),
                    None
                )
                if not document_id:
                    raise Exception(f"Document not found for page {result.page}")

                # Update document
                supabase.table("documents").update({
                    "latex": result.latex,
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()

                # Insert new figures
                figures_data = [
                    {
                        "y_min": figure.bbox[0],
                        "x_min": figure.bbox[1],
                        "y_max": figure.bbox[2],
                        "x_max": figure.bbox[3],
                        "description": figure.description,
                        "document": document_id
                    }
                    for figure in result.figures
                ]
                
                if figures_data:
                    supabase.table("figures").insert(figures_data).execute()
                
                print("Document inserted:", result.description)

            results = await textbook_processor.process_pages(
                class_title,
                num_pages,
                processed_documents,
                after_generate
            )
            print("Textbook processing for batch complete, results:", results)
            batch_results.append(results)

        print("Batch results:", batch_results)

        # Update textbook status to complete
        supabase.table("textbooks").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", textbook_id).execute()

        return jsonify({"results": batch_results}), 200

    except Exception as error:
        print("Error in parse-textbook function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update textbook status to error
        supabase.table("textbooks").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", textbook_id).execute()

        return jsonify({
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        }), 500

@parse_bp.route('/video', methods=['POST'])
async def parse_video():
    """
    Parse a video and return the documents.
    """
    try:
        print("Starting parse-video function...")
        data = request.get_json()
        video_path = data.get('video_path')
        lecture_id = data.get('lecture_id')

        print("Request params:", {"video_path": video_path, "lecture_id": lecture_id})

        if not video_path or not lecture_id:
            return jsonify({'error': 'Missing required parameters'}), 400

        # Get lecture and class info
        lecture = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute().data
        class_data = supabase.table("classes").select("*").eq("id", lecture['class']).single().execute().data
        
        video_processor = VideoProcessor(class_data['title'], lecture['name'], video_path)
        print("VideoProcessor created")
        async def after_generate(transcript: str, description: str, page: int, photo_bytes: bytes):
            """Callback function to save documents and images"""
            document = supabase.table("documents").insert({
                "text": transcript,
                "description": description,
                "page": page,
                "lecture": lecture_id
            }).execute()
            document_id = document.data[0]['id']
            print(f"Document inserted: {document_id}")

            # Upload image to supabase
            supabase.storage.from_("lectures").upload(
                f"{class_data['id']}/{lecture_id}/{document_id}.png",
                photo_bytes
            )
            print(f"Image uploaded to supabase: {class_data['id']}/{lecture_id}/{document_id}.png")
        # Process video and handle results
        await video_processor.process_video(after_generate)

        # make HTTP request to parse-lecture endpoint
        try:
            request_body = {
                "class_id": class_data["id"],
                "lecture_id": lecture_id,
                "handwritten": True
            }
            
            # Use url_for to generate the URL (more maintainable)
            parse_lecture_url = url_for('parse.parse_lecture', _external=True)
            
            # Make the request
            parse_lecture_response = requests.post(parse_lecture_url, json=request_body)
            
            if parse_lecture_response.status_code != 200:
                print("Warning: Parse-lecture processing request failed:", parse_lecture_response.json())
            else:
                print("Parse-lecture processing initiated")
            
            return jsonify({"results": parse_lecture_response.json()}), 200

        except Exception as parse_lecture_error:
            print("Error calling parse-lecture:", {
                "name": type(parse_lecture_error).__name__,
                "message": str(parse_lecture_error),
                "stack": traceback.format_exc(),
            })
            
            return jsonify({"results": parse_lecture_response.json()}), 200

    except Exception as e:
        print(f"Error in parse_video: {str(e)}")
        # Update lecture status to failed
        if lecture_id:
            supabase.table("lectures").update({
                "parse_status": "error",
                "parse_error": str(e)
            }).eq("id", lecture_id).execute()
        return jsonify({'error': str(e)}), 500

