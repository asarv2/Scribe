import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
import tempfile
import os
import torch
from app.config import model_manager
from app.services.parse.parse_models import TranscriptionResponse
from app.services.parse.parse import FileParser
from app.extensions import get_supabase

router = APIRouter()

logger = logging.getLogger(__name__)


@router.post("/syllabus")
async def parse_syllabus(class_id: str = Form(...)):
    supabase_client = get_supabase()

    # getting the class in supabase
    class_result = (
        supabase_client.table("classes")
        .select("*")
        .eq("id", class_id)
        .execute()
    )
    if not class_result.data:
        raise HTTPException(status_code=404, detail="Class not found")
    class_data = class_result.data[0]

    # save non-empty data, so we know what to update
    prev_class_name = class_data.get("title")
    prev_class_code = class_data.get("class_code")
    prev_class_description = class_data.get("course_description")
    syllabus_file_id = class_data.get("syllabus")

    if syllabus_file_id is None:
        raise HTTPException(status_code=400, detail="No syllabus file found")

    # get existing outcomes
    outcomes_result = (
        supabase_client.table("outcomes")
        .select("*")
        .eq("class", class_id)
        .execute()
    )
    outcomes = outcomes_result.data
    prev_outcomes = [outcome.get("title") for outcome in outcomes]

    # getting the google file in supabase
    google_file_result = (
        supabase_client.table("google_files")
        .select("*")
        .eq("file", syllabus_file_id)
        .execute()
    )
    google_file_data = google_file_result.data
    
    if len(google_file_data) == 0:
        raise HTTPException(status_code=404, detail="Google file not found")
    google_file_id = google_file_data[0].get("google_id")

    file_parser = FileParser(supabase_client, class_id, syllabus_file_id)

    (
        class_name,
        class_code,
        class_description,
        outcomes,
    ) = await file_parser.parse_syllabus(
        google_file_id,
        prev_class_name,
        prev_class_code,
        prev_class_description,
        prev_outcomes,
    )

    logger.info(
        f"Parsed syllabus for class {class_id}: {class_name}, {class_code}, {class_description}, {', '.join(outcomes)}"
    )

    raise HTTPException(status_code=200, detail="Syllabus parsed successfully")


@router.post("/audio", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(None),
    task: str = "transcribe",  # Can be "transcribe" or "translate"
):
    if audio_file is None:
        raise HTTPException(status_code=400, detail="No audio file provided")
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
    valid_extensions = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm"]
    file_ext = os.path.splitext(audio_file.filename)[1].lower()

    if file_ext not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Supported formats: {', '.join(valid_extensions)}",
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
            fp16=torch.cuda.is_available(),  # Use fp16 if on GPU
        )

        # Clean up the temporary file
        os.unlink(temp_file_path)

        # Return the transcription result
        return TranscriptionResponse(
            text=result["text"],
            language=result.get("language"),
            segments=[
                {"id": s["id"], "start": s["start"], "end": s["end"], "text": s["text"]}
                for s in result.get("segments", [])
            ],
        )

    except Exception as e:
        # Clean up temp file if it exists
        if "temp_file_path" in locals():
            try:
                os.unlink(temp_file_path)
            except Exception as temp_e:
                logger.error(f"Error cleaning up temp file: {str(temp_e)}")

        raise e
