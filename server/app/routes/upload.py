from fastapi import APIRouter, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse
import os
import uuid
from datetime import datetime
from app.extensions import COURSES_DIR

router = APIRouter()


@router.post("/zip")
async def upload_zip(
    file: UploadFile = File(...), 
    course_id: str = Form(...),
    filename: str = Form(...)
):
    """
    Receive a zip file from D2L and save it to the courses directory.
    
    Parameters:
    - file: The uploaded ZIP file from D2L
    - course_id: Course ID from Brightspace
    - filename: Original filename from D2L
    
    Returns:
    - JSON with file information and storage path
    """
    # Debug logging
    print(f"Received upload request:")
    print(f"- File: {file.filename}")
    print(f"- Course ID: {course_id}")
    print(f"- Filename: {filename}")
    
    # Validate inputs
    if not file:
        return JSONResponse(
            status_code=400,
            content={"error": "No file provided"}
        )
    
    if not course_id:
        return JSONResponse(
            status_code=400,
            content={"error": "No course_id provided"}
        )
        
    if not filename:
        return JSONResponse(
            status_code=400,
            content={"error": "No filename provided"}
        )
    
    # Validate file type
    if not filename.endswith('.zip'):
        return JSONResponse(
            status_code=400,
            content={"error": "File must be a ZIP archive"}
        )
    
    # Create a unique filename while preserving the original name
    base_name = os.path.splitext(filename)[0]
    unique_filename = f"{base_name}_{uuid.uuid4()}.zip"
    
    # Create a folder structure: courses/[course_id]/downloads/[date]
    today = datetime.now().strftime("%Y-%m-%d")
    folder_path = os.path.join(COURSES_DIR, course_id, "downloads", today)
    os.makedirs(folder_path, exist_ok=True)
    
    try:
        # Save the file
        file_path = os.path.join(folder_path, unique_filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        # Return success response with file information
        return {
            "status": "success",
            "original_filename": filename,
            "stored_filename": unique_filename,
            "course_id": course_id,
            "upload_time": datetime.now().isoformat(),
            "file_path": f"/files/courses/{course_id}/downloads/{today}/{unique_filename}"
        }
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to save file: {str(e)}"
            }
        )

@router.post("/course")
async def upload_course(file: UploadFile = File(...), course_id: str = Form(None)):
    """
    Receive course files uploaded from the Chrome extension.
    
    Parameters:
    - file: The uploaded file (syllabus or other course document)
    - course_id: Optional course ID from Brightspace
    
    Returns:
    - JSON with file information and storage path
    """
    # Create a unique filename to prevent collisions
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create a folder structure based on course id and date
    today = datetime.now().strftime("%Y-%m-%d")
    folder_path = os.path.join(COURSES_DIR, course_id, today)
    os.makedirs(folder_path, exist_ok=True)
    
    # Save the file
    file_path = os.path.join(folder_path, unique_filename)
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    # Return file information
    return {
        "filename": file.filename,
        "stored_filename": unique_filename,
        "course_id": course_id,
        "upload_time": datetime.now().isoformat(),
        "file_path": f"/files/courses/{course_id}/{today}/{unique_filename}"
    }

@router.post("/brightspace-data")
async def receive_brightspace_data(request: Request):
    """
    Receive data from the Brightspace extension without a file.
    This endpoint can be used for logging or tracking extension activity.
    """
    data = await request.json()

    print("Received data from Brightspace extension")
    print("Data: ", data)
    
    # Log or process the data as needed
    # For example, you might store this in a database
    
    return {
        "status": "success",
        "message": "Data received",
        "timestamp": datetime.now().isoformat()
    }