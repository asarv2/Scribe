from fastapi import APIRouter, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse
import os
import uuid
import zipfile
import shutil
from datetime import datetime
from app.extensions import COURSES_DIR, supabase
from app.services.upload.syllabus_processor import SyllabusProcessor
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()


@router.post("/course")
async def upload_course(
    file: UploadFile = File(...), 
    course_id: str = Form(...),
    course_descriptor: str = Form(...),
    filename: str = Form(...),
    syllabus_file: UploadFile = File(None),
    syllabus_filename: str = Form(None)
):
    """
    Receive course files from D2L, extract content zip, and save syllabus if provided.
    
    Parameters:
    - file: The uploaded ZIP file from D2L containing course content
    - course_id: Course ID from Brightspace
    - course_descriptor: Course descriptor from Brightspace
    - filename: Original filename from D2L
    - syllabus_file: Optional syllabus file
    - syllabus_filename: Optional syllabus filename
    
    Returns:
    - JSON with file information and storage paths
    """
    # Debug logging
    print(f"Received course upload request:")
    print(f"- Content File: {file.filename}")
    print(f"- Course ID: {course_id}")
    print(f"- Filename: {filename}")
    print(f"- Syllabus: {syllabus_filename if syllabus_file else 'None'}")
    
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
    
    # Create timestamp for file naming
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # check the classes supabase table to check if the course_id exists
    class_response = supabase.table("classes").select("*").eq("brightspace_course_id", course_id).execute()
    
    # Process syllabus if provided and course doesn't exist
    course_info = {}
    if not class_response.data and syllabus_file and syllabus_filename:
        try:
            # Create a temporary file to process the syllabus
            temp_syllabus_path = f"/tmp/{timestamp}_{syllabus_filename}"
            await syllabus_file.seek(0)
            
            with open(temp_syllabus_path, "wb") as f:
                f.write(await syllabus_file.read())
            
            # Process the syllabus to extract course information
            api_key = os.getenv("GEMINI_API_KEY")
            syllabus_processor = SyllabusProcessor(api_key, temp_syllabus_path)
            course_info = syllabus_processor.process()
            
            # Clean up the temporary file
            os.remove(temp_syllabus_path)
            
            print(f"Extracted course info: {course_info}")
        except Exception as e:
            print(f"Error processing syllabus: {str(e)}")
            # Continue with default values if syllabus processing fails
            course_info = {
                "course_code": "",
                "course_title": filename,
                "course_description": "",
                "instructor": "",
                "term": ""
            }
    
    if not class_response.data:
        # we should create a new class in the classes table
        insert_data = {
            "title": course_info.get("course_title", filename),
            "brightspace_course_id": course_id,
            "brightspace_course_descriptor": course_descriptor,
            "created_at": datetime.now().isoformat()
        }
        
        # Add additional course info if available
        if course_info:
            insert_data["class_code"] = course_info.get("course_code", "")
            insert_data["course_description"] = course_info.get("course_description", "")
            # insert_data["instructor"] = course_info.get("instructor", "")
            # insert_data["term"] = course_info.get("term", "")
        
        class_response = supabase.table("classes").insert(insert_data).execute()
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
    zip_storage_folder = os.path.join(COURSES_DIR, class_id, "zip")
    
    # Create syllabus directory
    syllabus_folder = os.path.join(COURSES_DIR, class_id, "syllabus")
    
    # Ensure all directories exist
    os.makedirs(COURSES_DIR, exist_ok=True)  # Make sure base courses directory exists
    os.makedirs(os.path.join(COURSES_DIR, class_id), exist_ok=True)  # Make sure class directory exists
    os.makedirs(zip_storage_folder, exist_ok=True)  # Make sure zip directory exists
    os.makedirs(syllabus_folder, exist_ok=True)  # Make sure syllabus directory exists
    
    # Remove existing directory contents but keep the directory
    if os.path.exists(extract_folder):
        shutil.rmtree(extract_folder)  # Remove the entire base folder
    
    # Create fresh base directory
    os.makedirs(extract_folder, exist_ok=True)
    
    result = {
        "status": "success",
        "original_filename": filename,
        "course_id": course_id,
        "class_id": class_id,
        "upload_time": datetime.now().isoformat(),
        "extracted_to": f"/files/courses/{class_id}/base",
        "zip_stored_at": f"/files/courses/{class_id}/zip/{timestamp}_{filename}"
    }
    
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
        
        # Process syllabus file if provided
        if syllabus_file and syllabus_filename:
            # Save the syllabus file
            syllabus_path = os.path.join(syllabus_folder, f"{timestamp}_{syllabus_filename}")
            await syllabus_file.seek(0)
            
            with open(syllabus_path, "wb") as f:
                f.write(await syllabus_file.read())
                
            # Add syllabus info to the result
            result["syllabus_stored_at"] = f"/files/courses/{class_id}/syllabus/{timestamp}_{syllabus_filename}"
        
        # Return success response with file information
        return result
        
    except Exception as e:
        # Log the full error for debugging
        import traceback
        print(f"Error processing course files: {str(e)}")
        print(traceback.format_exc())
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process course files: {str(e)}"
            }
        )