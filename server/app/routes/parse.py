from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import traceback
from app.extensions import supabase
from datetime import datetime
from app.services.parse.main import FileProcessor
import tempfile
import os
import torch
from app.config import model_manager
router = APIRouter()

# Define request models

class TranscriptionResponse(BaseModel):
    text: str
    language: str = None
    segments: list = None

class ParseRequest(BaseModel):
    file_id: str | None = None

@router.post('/file')
async def parse_file(request: ParseRequest):
    """Parse a file and return the documents."""
    try:
        print("Starting parse-file function...")
        file_id = request.file_id

        # Update file status to parsing
        supabase.table("files").update({
            "parse_status": "parsing",
            "parse_error": "",
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
        file_names = file_data.get('file_names', [])
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
            file_type=file_type,
        )
        
        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}: {len(batch)} documents")
            
            # Get images from supabase only for PDF and image files
            images = []
            
            if file_type in ['pdf', 'image']:
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
                    "end_time": doc.get("end_time"),
                }
                
                # Add image if available (only for PDF and image files)
                if file_type in ['pdf', 'image'] and j < len(images) and images[j]:
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
                file_names,
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
            "parse_error": ""
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

        whisper_model = model_manager.get_whisper_model()
        
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

