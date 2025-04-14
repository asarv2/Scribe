from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.grader_service import grade_assignment
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/grade")
async def grade_file(
    file: UploadFile = File(...),
    context: str = Form(""),
    base64file: str = Form(None)
):
    """
    Grade an uploaded assignment file
    
    Args:
        file: The uploaded file
        context: Additional context about the assignment
        base64file: Optional base64-encoded file content (for images)
        
    Returns:
        Grading results with scores and feedback
    """
    try:
        # Get file content - use base64 for images if provided
        file_type = file.content_type or "application/octet-stream"
        
        # Use base64 content for images if provided, otherwise read file
        if base64file and "image" in file_type:
            file_content = base64file
            logger.info(f"Using base64 image data for {file.filename}")
        else:
            file_content = await file.read()
            logger.info(f"Reading file content for {file.filename}")
        
        # Process the file with grader service
        result = await grade_assignment(
            file_content=file_content,
            file_type=file_type,
            additional_context=context
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in grade_file endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
