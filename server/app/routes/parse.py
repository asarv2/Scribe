from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import traceback
from app.extensions import supabase
from app.services.parse.lecture_processor import LectureProcessor
from app.services.parse.textbook_processor import TextbookProcessor
from datetime import datetime
from app.services.parse.homework_processor import HomeworkProcessor
from app.services.parse.file_processor import FileProcessor
import tempfile
import os
from app.config import model_manager
import torch

router = APIRouter()

# Define request models

class TranscriptionResponse(BaseModel):
    text: str
    language: str = None
    segments: list = None

class ParseRequest(BaseModel):
    lecture_id: str | None = None
    textbook_id: str | None = None
    chapter_id: str | None = None
    homework_id: str | None = None
    file_id: str | None = None

@router.post('/lecture')
async def parse_lecture(request: ParseRequest):
    """Parse a lecture and return the documents."""
    try:
        print("Starting parse-lecture function...")
        lecture_id = request.lecture_id
        print("Request params:", {"lecture_id": lecture_id})

        # Update lecture status to parsing
        supabase.table("lectures").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()

        # Get lecture info
        lecture_response = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
        num_pages = lecture_response.data.get('pages')
        class_id = lecture_response.data.get('class')
        print("Lecture query response:", lecture_response)

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        private_mode = class_response.data.get('privacy')
        print("Class query response:", class_response)

        # Get existing documents
        documents_response = supabase.table("documents").select("*").eq("lecture", lecture_id).execute()
        documents = documents_response.data
        if not documents:
            raise HTTPException(status_code=404, detail="No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        # print("Documents to process:", documents_to_process)

        # Create new instance of LectureProcessor
        lecture_processor = LectureProcessor(class_title)
        print("LectureProcessor created")

        # Process all documents at once with dynamic batching
        all_results = []
        
        # Get images and audio from supabase
        images = []
        text_contents = []
        
        try:
            for doc in documents_to_process:
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

                text_contents.append(doc.get("text", ""))

        except Exception as error:
            print("Error in image download process:", error)
            raise error

        print("Total images downloaded:", len(images))

        # Prepare documents for processing
        processed_documents = [
            {
                "page": doc["page"],
                "image": img,
                "text": text_content,
            }
            for doc, img, text_content in zip(documents_to_process, images, text_contents)
        ]
        # print("Processed documents:", processed_documents)

        # Process all slides with dynamic batching
        print("Starting lecture processing with dynamic batching...")
        
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
            after_generate,
            private_mode
        )
        print("Lecture processing complete, results:", results)

        # Convert CleanedResponse objects to dictionaries
        serializable_results = [
            {
                "page": result.page,
                "description": result.description,
            }
            for result in results
        ]
        all_results = serializable_results

        print("All results:", all_results)

        # Update lecture status to complete
        supabase.table("lectures").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", lecture_id).execute()

        return {"results": all_results}

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

        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })

@router.post('/textbook')
async def parse_textbook(request: ParseRequest):
    """Parse a textbook and return the documents."""
    try:
        print("Starting parse-textbook function...")
        textbook_id = request.textbook_id
        chapter_id = request.chapter_id
        print("Request params:", {"textbook_id": textbook_id, "chapter_id": chapter_id})

        # Update textbook status to parsing
        supabase.table("textbooks").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", textbook_id).execute()

        # Get textbook info
        textbook_response = supabase.table("textbooks").select("*").eq("id", textbook_id).single().execute()
        num_pages = textbook_response.data.get('pages')
        textbook_title = textbook_response.data.get('title')
        class_id = textbook_response.data.get('class')
        print("Textbook query response:", textbook_response)

        # get the chapter info
        chapter_title = "General"
        if chapter_id is not None:
            chapter_response = supabase.table("chapters").select("*").eq("id", chapter_id).single().execute()
            chapter_title = chapter_response.data.get('title')
            print("Chapter query response:", chapter_response)

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        if chapter_id is not None:
            # Get existing documents, for the chapter (required)
            documents_response = supabase.table("documents").select("*").eq("textbook", textbook_id).eq("chapter", chapter_id).execute()
            documents = documents_response.data
            if not documents:
                raise HTTPException(status_code=404, detail="No documents found")
        else:
            # Get existing documents, for the textbook (required)
            documents_response = supabase.table("documents").select("*").eq("textbook", textbook_id).execute()
            documents = documents_response.data
            if not documents:
                raise HTTPException(status_code=404, detail="No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print("Documents to process:", documents_to_process)

        # Create new instance of TextbookProcessor
        textbook_processor = TextbookProcessor(class_title)
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
            # print("Processed documents:", processed_documents)

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
                textbook_title,
                chapter_title,
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

        return {"results": batch_results}

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

        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })
    
@router.post('/homework')
async def parse_homework(request: ParseRequest):
    """Parse a homework and return the documents."""
    try:
        print("Starting parse-homework function...")
        homework_id = request.homework_id
        print("Request params:", {"homework_id": homework_id})

        # Update homework status to parsing
        supabase.table("homeworks").update({
            "parse_status": "parsing",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", homework_id).execute()

        # Get homework info
        homework_response = supabase.table("homeworks").select("*").eq("id", homework_id).single().execute()
        class_id = homework_response.data.get('class')
        print("Homework query response:", homework_response)

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get existing exercises
        exercises_response = supabase.table("exercises").select("*").eq("homework", homework_id).execute()
        exercises = exercises_response.data
        # if not exercises:
        #     raise HTTPException(status_code=404, detail="No exercises found")
        

        # get unprocessed exercises, by checking if the description is not empty
        unprocessed_exercises = [exercise for exercise in exercises if exercise.get("description") is not None]
        print("Unprocessed exercises:", unprocessed_exercises)

        # Create new instance of HomeworkProcessor
        homework_processor = HomeworkProcessor(class_title)
        print("HomeworkProcessor created")

        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(unprocessed_exercises), batch_size):
            batch = unprocessed_exercises[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images from supabase
            images = []
            text_contents = []
            
            try:
                for exercise in batch:
                    # Download image
                    if (exercise.get("chapter") is not None):
                        # find chapter in supabase
                        chapter_response = supabase.table("chapters").select("*").eq("id", exercise.get("chapter")).execute()
                        chapter = chapter_response.data[0]
                        image_path = f"{class_id}/{chapter.get('textbook')}/{exercise.get('id')}.png"
                        try:
                            response = supabase.storage.from_("textbooks").download(image_path)
                        except Exception as e:  
                            print(f"Error downloading image {exercise['title']}: {e}")
                            continue
                    else:
                        # we know this is a homework exercise
                        image_path = f"{class_id}/{exercise.get('id')}.png"
                        try:
                            response = supabase.storage.from_("exercises").download(image_path)
                        except Exception as e:  
                            print(f"Error downloading image {exercise['title']}: {e}")
                            continue
                    
                    print(f"Trying to download: {image_path}")
                    

                    
                    if not response:
                        print(f"No data received for image {exercise['title']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {exercise['title']}")
                    exercise_title = exercise.get("title", "")
                    exercise_info = exercise.get("info", "")
                    exercise_given = exercise.get("given", "")
                    exercise_text = exercise.get("text", "")
                    full_text = f"TITLE: {exercise_title}\nINFO: {exercise_info}\nGIVEN: {exercise_given}\nTEXT: {exercise_text}"
                    text_contents.append(full_text)

            except Exception as error:
                print("Error in image download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "exercise_id": exercise.get("id"),
                    "problem": str(exercise.get("problem_number", "")) + ". " + str(exercise.get("problem_part_number", "")),
                    "image": img,
                    "text": text_content,
                }
                for exercise, img, text_content in zip(batch, images, text_contents)
            ]
            # print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting homework processing...")
            
            async def after_generate(result):

                # Update document
                supabase.table("exercises").update({
                    "description": result.description,
                }).eq("id", result.exercise_id).execute()
                
                print("Exercise updated:", result.description)

            results = await homework_processor.process_homework_problems(
                class_title,
                processed_documents,
                after_generate
            )
            print("Homework processing for batch complete, results:", results)

            # Convert CleanedResponse objects to dictionaries
            serializable_results = [
                {
                    "problem": result.problem,
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)

        print("Batch results:", batch_results)

        # Update homework status to complete
        supabase.table("homeworks").update({
            "parse_status": "complete",
            "parse_error": ""
        }).eq("id", homework_id).execute()

        return {"results": batch_results}

    except Exception as error:
        print("Error in parse-homework function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update homework status to error
        supabase.table("homeworks").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", homework_id).execute()

        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })

@router.post('/file')
async def parse_file(request: ParseRequest):
    """Parse a file and return the documents."""
    try:
        print("Starting parse-file function...")
        file_id = request.file_id

        # Update file status to parsing
        supabase.table("files").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", file_id).execute()

        # Get file info
        file_response = supabase.table("files").select("*").eq("id", file_id).single().execute()
        file_data = file_response.data
        
        if not file_data:
            raise HTTPException(status_code=404, detail=f"File with ID {file_id} not found")
            
        file_title = file_data.get('title')
        file_type = file_data.get('type')
        class_id = file_data.get('class')
        print(f"File query response: {file_title}, type: {file_type}")

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class title:", class_title)
        
        # Get documents for this file
        documents_response = supabase.table("documents").select("*").eq("file", file_id).order("page").execute()
        documents = documents_response.data
        print(f"Found {len(documents)} documents to process")
        
        if not documents:
            return {"status": "success", "message": "No documents found for this file"}
        
        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print(f"Documents to process: {len(documents_to_process)}")
        
        # Initialize file processor
        processor = FileProcessor(
            course_title=class_title,
            file_title=file_title,
            file_type=file_type
        )
        
        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}: {len(batch)} documents")
            
            # Get images from supabase for file types that have images
            images = []
            
            if file_type in ['pdf', 'image', 'video', 'video_audio']:
                try:
                    for doc in batch:
                        # Download image
                        image_path = f"{class_id}/{file_id}/{doc['id']}.png"
                        print(f"Trying to download: {image_path}")
                        
                        try:
                            response = supabase.storage.from_("files").download(image_path)
                        except Exception as e:
                            print(f"Error downloading image for document {doc['id']}: {e}")
                            images.append(None)
                            continue
                        
                        if not response:
                            print(f"No data received for image {doc['id']}")
                            images.append(None)
                            continue

                        images.append(response)
                        print(f"Successfully downloaded image for document {doc['id']}")

                except Exception as error:
                    print("Error in image download process:", error)
                    raise error
                
                print("Total images downloaded:", len(images))
            
            # Prepare documents for processing
            processed_documents = []
            for j, doc in enumerate(batch):
                doc_data = {
                    "id": doc["id"],
                    "page": doc["page"],
                    "text": doc.get("text", ""),
                    "start_time": doc.get("start_time"),
                    "end_time": doc.get("end_time")
                }
                
                # Add image if available
                if file_type in ['pdf', 'image', 'video', 'video_audio'] and j < len(images) and images[j]:
                    doc_data["image"] = images[j]
                
                processed_documents.append(doc_data)
            
            # Define callback function for after each document is processed
            async def after_generate(result):
                # Find document ID based on page number
                document_id = next(
                    (doc['id'] for doc in batch if doc['page'] == result.page),
                    None
                )
                if not document_id:
                    print(f"Document not found for page {result.page}")
                    return

                # Update document
                supabase.table("documents").update({
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()
                
                print(f"Document {document_id} updated")
            
            # Process the batch
            print("Starting file processing...")
            results = await processor.process_documents(
                processed_documents,
                after_generate
            )
            
            # Convert results to serializable format
            serializable_results = [
                {
                    "page": result.page,
                    "description": result.description,
                }
                for result in results
            ]
            batch_results.append(serializable_results)
        
        # Update file status to complete
        supabase.table("files").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", file_id).execute()
        
        return {
            "status": "success", 
            "message": f"Successfully processed {len(documents_to_process)} documents",
            "results": batch_results
        }

    except Exception as error:
        print("Error in parse-file function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update file status to error
        if 'file_id' in locals():
            supabase.table("files").update({
                "parse_status": "error",
                "parse_error": str(error)
            }).eq("id", file_id).execute()
        
        raise HTTPException(status_code=500, detail={
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        })


@router.post('/audio', response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    task: str = "transcribe"  # Can be "transcribe" or "translate"
):
    """
    Transcribe or translate audio from a streaming upload.
    
    Args:
        audio_file: The audio file to transcribe
        task: Either "transcribe" (default) or "translate" to English
    
    Returns:
        TranscriptionResponse with the transcribed text
    """
    if not audio_file.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    
    # Check file extension
    valid_extensions = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm']
    file_ext = os.path.splitext(audio_file.filename)[1].lower()

    if file_ext not in valid_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Supported formats: {', '.join(valid_extensions)}"
        )
    
    try:
        # Create a temporary file to store the uploaded audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            # Read the uploaded file in chunks and write to the temp file
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Get the Whisper model from our model manager
        whisper_model = model_manager._get_whisper_model()
        
        # Process with Whisper
        # The model handles various audio formats automatically
        result = whisper_model.transcribe(
            temp_file_path,
            task=task,
            fp16=torch.cuda.is_available()  # Use fp16 if on GPU
        )

        # Clean up the temporary file
        os.unlink(temp_file_path)
        
        # Return the transcription result
        return TranscriptionResponse(
            text=result["text"],
            language=result.get("language"),
            segments=[{
                "id": s["id"],
                "start": s["start"],
                "end": s["end"],
                "text": s["text"]
            } for s in result.get("segments", [])]
        )
        
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_file_path' in locals():
            try:
                os.unlink(temp_file_path)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")

