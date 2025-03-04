from fastapi import APIRouter, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse
import os
import uuid
import zipfile
import shutil
from datetime import datetime
from app.extensions import COURSES_DIR, supabase

router = APIRouter()


@router.post("/zip")
async def upload_zip(
    file: UploadFile = File(...), 
    course_id: str = Form(...),
    course_descriptor: str = Form(...),
    filename: str = Form(...)
):
    """
    Receive a zip file from D2L, extract it, and save contents to the courses directory.
    
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
    
    # check the classes supabase table to check if the course_id exists
    class_response = supabase.table("classes").select("*").eq("brightspace_course_id", course_id).execute()
    if not class_response.data:
        # we should create a new class in the classes table
        class_response = supabase.table("classes").insert({
            "title": filename,
            "brightspace_course_id": course_id,
            "brightspace_course_descriptor": course_descriptor,
            "created_at": datetime.now().isoformat()
        }).execute()
        class_id = class_response.data[0]["id"]
    else:
        # update the class with the updated_at timestamp
        class_response = supabase.table("classes").update({
            "updated_at": datetime.now().isoformat()
        }).eq("brightspace_course_id", course_id).execute()
        class_id = class_response.data[0]["id"]
    
    # Create the target extraction directory using class_id
    extract_folder = os.path.join(COURSES_DIR, class_id, "base")
    
    # Create zip storage directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_storage_folder = os.path.join(COURSES_DIR, class_id, "zip")
    
    # Ensure all directories exist
    os.makedirs(COURSES_DIR, exist_ok=True)  # Make sure base courses directory exists
    os.makedirs(os.path.join(COURSES_DIR, class_id), exist_ok=True)  # Make sure class directory exists
    os.makedirs(zip_storage_folder, exist_ok=True)  # Make sure zip directory exists
    
    # Remove existing directory contents but keep the directory
    if os.path.exists(extract_folder):
        shutil.rmtree(extract_folder)  # Remove the entire base folder
    
    # Create fresh base directory
    os.makedirs(extract_folder, exist_ok=True)
    
    try:
        # Save the zip file with timestamp
        zip_filename = f"{timestamp}_{filename}"
        zip_path = os.path.join(zip_storage_folder, zip_filename)
        
        # Ensure the file content is at the beginning
        await file.seek(0)
        
        # Save the zip file
        with open(zip_path, "wb") as f:
            f.write(await file.read())
        
        # Verify the zip file exists before extracting
        if not os.path.exists(zip_path):
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": f"Failed to save zip file to {zip_path}"
                }
            )
        
        # Extract the zip file to the base directory
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_folder)
        
        # Return success response with file information
        return {
            "status": "success",
            "original_filename": filename,
            "course_id": course_id,
            "class_id": class_id,
            "upload_time": datetime.now().isoformat(),
            "extracted_to": f"/files/courses/{class_id}/base",
            "zip_stored_at": f"/files/courses/{class_id}/zip/{zip_filename}"
        }
        
    except Exception as e:
        # Log the full error for debugging
        import traceback
        print(f"Error processing zip file: {str(e)}")
        print(traceback.format_exc())
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process zip file: {str(e)}"
            }
        )