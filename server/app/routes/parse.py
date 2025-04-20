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
        trace_id = file_data.get('trace')
        profile_id = file_data.get('profile')
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

        async def update_trace_id(file_id: str, trace_id: str):
            supabase.table("files").update({
                "trace": trace_id
            }).eq("id", file_id).execute()

        async def update_file_usage(file_id: str, profile_id: str, input_tokens: int, output_tokens: int):
            supabase.table("usage").insert({
                "file": file_id,
                "profile": profile_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }).execute()
        
        # Initialize file processor
        processor = FileProcessor(
            course_title=class_title,
            file_title=file_title,
            file_type=file_type,
            file_id=file_id,
            profile_id=profile_id,
            trace_id=trace_id,
            update_trace_id=update_trace_id,
            update_file_usage=update_file_usage
        )
        
        # Process in batches
        batch_size = 15
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print(f"Processing batch {i//batch_size + 1}: {len(batch)} documents")
            
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
            
            # Process the batch - no need to download images anymore
            print("Starting file processing...")
            results = await processor.process_documents(
                batch,  # Pass the documents directly with their google_file_id
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

