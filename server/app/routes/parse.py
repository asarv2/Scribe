from fastapi import APIRouter, UploadFile, File, HTTPException, Form
import tempfile
import os
import torch
from app.config import model_manager
from app.services.parse.models import TranscriptionResponse


router = APIRouter()


@router.post("/syllabus")
async def transcribe_syllabus(
    file_id: str = Form(...)
):
    # TODO: complete this
    # transcribe the syllabus and get a result that can be parsed into the class. Will find the basic information, and create learning outcomes.
    return {"syllabus": file_id}

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
    



