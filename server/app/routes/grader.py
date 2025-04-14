from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.grader_service import grade_assignment
import logging

router = APIRouter(prefix="/grader")
logger = logging.getLogger(__name__)

@router.post("/grade")
async def grade_file(
    file: UploadFile = File(...),
    context: str = Form(""),
    base64file: str = Form(None),
    filename: str = Form(None),
    filetype: str = Form(None)
):
    """
    Grade an uploaded assignment file
    
    Args:
        file: The uploaded file
        context: Additional context about the assignment
        base64file: Optional base64-encoded file content (for images/pdfs)
        filename: Original filename for debugging
        filetype: Original MIME type for debugging
    """
    try:
        logger.info(f"Received grading request for file: {file.filename}, type: {file.content_type}")
        logger.info(f"Context provided: {context}")
        
        if filename and filetype:
            logger.info(f"Original file metadata: {filename}, {filetype}")
        
        # Get file content - use base64 for images/pdfs if provided
        file_type = file.content_type or filetype or "application/octet-stream"
        
        # Use base64 content for images/pdfs if provided, otherwise read file
        if base64file and ("image" in file_type or "pdf" in file_type):
            file_content = base64file
            logger.info(f"Using base64 data for {file.filename}")
            # Log a few characters of the base64 content to confirm it's available
            if base64file:
                logger.info(f"Base64 data first 100 chars: {base64file[:100]}...")
        else:
            file_content = await file.read()
            file_size = len(file_content)
            logger.info(f"Reading binary file content for {file.filename}, size: {file_size} bytes")
            
            # Quick check to ensure the file isn't empty
            if file_size == 0:
                raise HTTPException(status_code=400, detail="Empty file was uploaded")
        
        # Process the file with grader service
        result = await grade_assignment(
            file_content=file_content,
            file_type=file_type,
            additional_context=context
        )
        
        logger.info("Grading completed successfully")
        return result
        
    except Exception as e:
        logger.error(f"Error in grade_file endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Check if the grader service is healthy"""
    return {"status": "healthy", "service": "grader"}