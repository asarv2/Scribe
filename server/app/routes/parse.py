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

from app.services.parse.audio_processor import AudioProcessor

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

            # Get images from supabase
            images = []
            
            try:
                for doc in batch:
                    # Download image
                    image_path = f"{class_id}/{lecture_id}/{doc['id']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    try:
                        response = supabase.storage.from_("lectures").download(image_path)
                    except Exception as e:
                        print(f"Error downloading image {doc['page']}: {e}")
                        continue
                    
                    if not response:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {doc['page']}")

            except Exception as error:
                print("Error in image download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                }
                for doc, img in zip(batch, images)
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
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()
                
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
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)

        print("Batch results:", batch_results)

        # Update lecture status to complete
        supabase.table("lectures").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", lecture_id).execute()

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

            # Get images from supabase
            images = []
            
            try:
                for doc in batch:
                    # Download image - Updated path structure to match lectures
                    image_path = f"{class_id}/{textbook_id}/{doc['id']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    try:
                        response = supabase.storage.from_("textbooks").download(image_path)
                    except Exception as e:
                        print(f"Error downloading image {doc['page']}: {e}")
                        continue
                    
                    if not response:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {doc['page']}")

            except Exception as error:
                print("Error in image download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                }
                for doc, img in zip(batch, images)
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
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()

                
                print("Document inserted:", result.description)

            results = await textbook_processor.process_pages(
                class_title,
                num_pages,
                processed_documents,
                after_generate
            )
            print("Textbook processing for batch complete, results:", results)

            # Convert CleanedResponse objects to dictionaries (matching lecture format)
            serializable_results = [
                {
                    "page": result.page,
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)

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

        # Create new instance of VideoProcessor
        audio_processor = AudioProcessor()
        print("AudioProcessor created")

        # Process in batches
        batch_size = 7
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images from supabase
            images = []
            transcripts = []
            
            try:
                for doc in batch:
                    # Download image
                    image_path = f"{class_id}/{lecture_id}/{doc['id']}.png"
                    print(f"Trying to download: {image_path}")

                    try:
                        response = supabase.storage.from_("lectures").download(image_path)
                    except Exception as e:
                        print(f"Error downloading image {doc['page']}: {e}")
                        continue
                    
                    if not response:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {doc['page']}")

                     # audio path
                    audio_path = f"{class_id}/{lecture_id}/{doc['id']}.wav"
                    print(f"Trying to download: {audio_path}")

                    try:
                        response = supabase.storage.from_("lectures").download(audio_path)
                    except Exception as e:
                        print(f"Error downloading audio {doc['page']}: {e}")
                        continue

                    if not response:
                        print(f"No data received for audio {doc['page']}")
                        continue

                    transcript = audio_processor.transcribe(response)
                    print(f"Transcript: {transcript}")
                    transcripts.append(transcript)
                    print(f"Successfully downloaded audio {doc['page']}")

            except Exception as error:
                print("Error in image download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": transcript,
                }
                for doc, img, transcript in zip(batch, images, transcripts)
            ]
            # print("Processed documents:", processed_documents)

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
                    "description": result.description,
                    "text": result.text,
                    "processed": True
                }).eq("id", document_id).execute()
                
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
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)

        print("Batch results:", batch_results)

        # Update lecture status to complete
        supabase.table("lectures").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", lecture_id).execute()

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

