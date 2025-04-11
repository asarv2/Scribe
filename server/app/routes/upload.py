import math
import re
import json
from fastapi import APIRouter, File, UploadFile, Form, Request, BackgroundTasks, Response, HTTPException, Body
from fastapi.responses import JSONResponse
import os
import uuid
import zipfile
import shutil
from datetime import datetime
import aiofiles
from app.extensions import COURSES_DIR, supabase
from app.services.upload.syllabus_processor import SyllabusProcessor
from app.services.upload.initial_course_processor import InitialCourseProcessor
from dotenv import load_dotenv

from app.services.upload.textbook_extractor import TextbookExtractor
from app.services.upload.homework_extractor import HomeworkExtractor
from app.services.upload.lecture_extractor import LectureExtractor
from app.services.upload.file_extractor import FileExtractor
from app.services.classify.file_classifier import FileClassifier
from app.routes.download import download_file_from_onedrive
import google.generativeai as genai
import traceback

import logging
import tempfile
from urllib.parse import unquote
import magic



load_dotenv()
router = APIRouter()

logger = logging.getLogger(__name__)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(os.environ.get("DATA_DIR", "/tmp"), "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)

@router.post("/create")
async def create_course(
    request: Request,
    course_id: str = Form(...),
    course_descriptor: str = Form(...),
    syllabus_file: UploadFile = File(None),
    syllabus_filename: str = Form(None),
    profile_id: str = Form(None),
    students: str = Form(None),
    professors: str = Form(None)
):
    """
    Create a new course from syllabus information.
    
    Parameters:
    - course_id: Course ID from Brightspace
    - course_descriptor: Course descriptor from Brightspace
    - syllabus_file: Optional syllabus file
    - syllabus_filename: Optional syllabus filename
    - profile_id: Profile ID
    - students: Students emails in JSON format
    - professors: Professors emails in JSON format
    Returns:
    - JSON with course information
    """
    # Debug logging
    print(f"Received course creation request:")
    print(f"- Course ID: {course_id}")
    print(f"- Syllabus: {syllabus_filename if syllabus_file else 'None'}")
    
    if not course_id:
        return JSONResponse(
            status_code=400,
            content={"error": "No course_id provided"}
        )
    
    # Create timestamp for file naming
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    # check the classes supabase table to check if the course_id exists
    class_response = supabase.table("classes").select("*").eq("brightspace_course_id", course_id).eq("deleted", False).eq("active", True).execute()
    
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
                "course_title": course_descriptor,
                "course_description": "",
                "instructor": "",
                "term": ""
            }
    
    if not class_response.data:
        # we should create a new class in the classes table
        insert_data = {
            "title": course_info.get("course_title", course_descriptor),
            "brightspace_course_id": course_id,
            "brightspace_course_descriptor": course_descriptor,
            "created_at": datetime.now().isoformat(),
        }
        
        # Add additional course info if available
        if course_info:
            insert_data["class_code"] = course_info.get("course_code", "")
            insert_data["course_description"] = course_info.get("course_description", "")

            course_time = course_info.get("course_time", "")
            if course_time:
                try:
                    insert_data["download_time"] = course_time.strftime("%H:%M:%S")
                except (ValueError, TypeError):
                    print(f"Warning: Could not parse course time: {course_time}")
            # insert_data["instructor"] = course_info.get("instructor", "")
            # insert_data["term"] = course_info.get("term", "")

        # parse the students and professors
        students = json.loads(students)
        professors = json.loads(professors)

        # add the students and professors to the class
        insert_data["students"] = students
        insert_data["professors"] = professors
        
        class_response = supabase.table("classes").insert(insert_data).execute()
        class_id = class_response.data[0]["id"]

        # update all of these accounts in supabase, to add the class_id to their classes
        all_emails = students + professors

        # get the profiles from supabase
        profile_response = supabase.table("profiles").select("*").in_("email", all_emails).execute()

        # bulk upsert the profile
        profile_insert_data = []
        for profile in profile_response.data:
            profile_insert_data.append({
                "id": profile["id"],
                "classes": list(set(profile["classes"]).union([class_id]))
            })
        supabase.table("profiles").upsert(profile_insert_data).execute()
    else:
        # update the class with the updated_at timestamp
        class_response = supabase.table("classes").update({
            "updated_at": datetime.now().isoformat()
        }).eq("brightspace_course_id", course_id).execute()
        class_id = class_response.data[0]["id"]

    # get the profile
    profile_response = supabase.table("profiles").select("*").eq("id", profile_id).execute()
    if not profile_response.data:
        return JSONResponse(
            status_code=400,
            content={"error": "Profile not found"}
        )

    # update the profile with the class_id if they are a professor
    if (profile_response.data[0]["professor"]):
        supabase.table("profiles").update({
            "classes": list(set(profile_response.data[0]["classes"]).union([class_id]))
        }).eq("id", profile_id).execute()
    
    # Create the target extraction directory using class_id
    extract_folder = os.path.join(COURSES_DIR, class_id, "base")
    
    # Create zip storage directory with timestamp
    zip_storage_folder = os.path.join(COURSES_DIR, class_id, "zip")
    
    # Ensure all directories exist
    os.makedirs(COURSES_DIR, exist_ok=True)  # Make sure base courses directory exists
    os.makedirs(os.path.join(COURSES_DIR, class_id), exist_ok=True)  # Make sure class directory exists
    os.makedirs(zip_storage_folder, exist_ok=True)  # Make sure zip directory exists
    
    # Create fresh base directory if it doesn't exist
    os.makedirs(extract_folder, exist_ok=True)
    
    result = {
        "status": "success",
        "course_id": course_id,
        "class_id": class_id,
        "created_at": datetime.now().isoformat()
    }

    # Save the syllabus file if provided
    if syllabus_file and syllabus_filename:
        syllabus_path = os.path.join(extract_folder, syllabus_filename)
        await syllabus_file.seek(0)
        with open(syllabus_path, "wb") as f:
            f.write(await syllabus_file.read())
            
        # Add syllabus info to the result
        result["syllabus_stored_at"] = f"/files/courses/{class_id}/base/{syllabus_filename}"
    
    return result

@router.post("/content")
async def upload_content(
    request: Request,
    file: UploadFile = File(...), 
    class_id: str = Form(...),
    filename: str = Form(...),
    response_url: str = Form(None),
    profile_id: str = Form(None),
    download_id: str = Form(None),
    start_parse: bool = Form(False)
):
    """
    Receive course content files from D2L, extract content zip, and process files.
    
    Parameters:
    - file: The uploaded ZIP file from D2L containing course content
    - class_id: Class ID
    - filename: Original filename from D2L
    - response_url: Optional response url for the course
    - profile_id: Profile ID
    - download_id: ID of the download record in the database
    - start_parse: Whether to start parsing the course content
    Returns:
    - JSON with file information and storage paths
    """
    # Debug logging
    print(f"Received course content upload request:")
    print(f"- Content File: {file.filename}")
    print(f"- Class ID: {class_id}")
    print(f"- Filename: {filename}")
    print(f"- Download ID: {download_id}")
    
    # Update download status to 'received' if download_id is provided
    if download_id:
        try:
            supabase.table("downloads").update({
                "status": "received",
                "updated_at": datetime.now().isoformat()
            }).eq("id", download_id).execute()
        except Exception as e:
            print(f"Error updating download status: {str(e)}")
    
    if not class_id:
        return JSONResponse(
            status_code=400,
            content={"error": "No class_id provided"}
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
    
    # Get class information
    class_response = supabase.table("classes").select("*").eq("id", class_id).execute()
    if not class_response.data:
        return JSONResponse(
            status_code=400,
            content={"error": "Class not found"}
        )

    class_data = class_response.data[0] or {}
    lecture_enabled = class_data.get('lecture_enabled', False)
    textbook_enabled = class_data.get('textbook_enabled', False)
    homework_enabled = class_data.get('homework_enabled', False)

    # Update the class with the updated_at timestamp
    supabase.table("classes").update({
        "updated_at": datetime.now().isoformat()
    }).eq("id", class_id).execute()
    
    # Create the class directory
    class_dir = os.path.join(COURSES_DIR, class_id)
    
    # Create download-specific directory if download_id is provided
    if download_id:
        # Create download directory structure
        download_dir = os.path.join(class_dir, download_id)
        extract_folder = os.path.join(download_dir, "base")
    else:
        # Fallback to old structure if no download_id
        download_dir = class_dir
        extract_folder = os.path.join(class_dir, "base")
    
    # Ensure all directories exist
    os.makedirs(COURSES_DIR, exist_ok=True)  # Make sure base courses directory exists
    os.makedirs(class_dir, exist_ok=True)  # Make sure class directory exists
    os.makedirs(download_dir, exist_ok=True)  # Make sure download directory exists
    
    # Remove existing directory contents but keep the directory
    if os.path.exists(extract_folder):
        shutil.rmtree(extract_folder)  # Remove the entire base folder
    
    # Create fresh base directory
    os.makedirs(extract_folder, exist_ok=True)
    
    # Save the zip file at the root of the download directory
    zip_filename = f"download_{timestamp}.zip"
    zip_path = os.path.join(download_dir, zip_filename)
    
    result = {
        "status": "success",
        "original_filename": filename,
        "class_id": class_id,
        "download_id": download_id,
        "upload_time": datetime.now().isoformat(),
        "extracted_to": f"/files/courses/{class_id}/{download_id if download_id else ''}/base",
        "zip_stored_at": f"/files/courses/{class_id}/{download_id if download_id else ''}/{zip_filename}"
    }
    
    try:
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
        
        # Get previous download information to compare files
        previous_files = []
        if download_id:
            try:
                # Find the most recent previous download for this class
                previous_downloads = supabase.table("downloads").select("*").eq("class", class_id).order("updated_at", desc=True).limit(10).execute()
                
                for prev_download in previous_downloads.data:
                    # Skip the current download
                    if prev_download["id"] == download_id:
                        continue
                    
                    # Check if this download has file_list data
                    if prev_download.get("file_list"):
                        previous_files = prev_download.get("file_list", [])
                        print(f"Found previous download with {len(previous_files)} files")
                        break
            except Exception as e:
                print(f"Error retrieving previous downloads: {str(e)}")
        
        # Check for Table of Contents.html and extract file list
        toc_path = os.path.join(extract_folder, "Table of Contents.html")
        current_files = []
        
        if os.path.exists(toc_path):
            try:
                with open(toc_path, 'r', encoding='utf-8') as f:
                    toc_content = f.read()
                
                # Extract file links from the Table of Contents
                file_links = re.findall(r'href="([^"]+)"', toc_content)
                current_files = [link for link in file_links if link]
                
                # Store the Table of Contents content in Supabase for reference
                if download_id:
                    supabase.table("downloads").update({
                        "file_list": current_files,
                        "toc_content": toc_content
                    }).eq("id", download_id).execute()
                
                print(f"Extracted {len(current_files)} files from Table of Contents")
            except Exception as e:
                print(f"Error processing Table of Contents: {str(e)}")
        
        # Determine new files by comparing with previous download
        new_files = []
        if previous_files:
            new_files = [f for f in current_files if f not in previous_files]
            print(f"Detected {len(new_files)} new files compared to previous download")
        else:
            # If no previous download data, treat all files as new
            new_files = current_files
            print(f"No previous download data found, treating all {len(new_files)} files as new")
        
        # Process the course files to categorize them
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            course_processor = InitialCourseProcessor(api_key, extract_folder, class_id)
            course_organization = course_processor.process_course()
            
            # Override the new_files list with our more accurate TOC-based list
            course_organization["new_files"] = new_files
            
            # Add organization info to the result
            result["course_organization"] = course_organization
            
            # Process each categorized file only if it's new
            # Process lectures
            for lecture_path in course_organization.get("categories", {}).get("lectures", []):
                # Fix the path if needed
                base_name = os.path.basename(extract_folder)
                if lecture_path.startswith(base_name):
                    lecture_path = lecture_path[len(base_name):].lstrip('/')
                
                full_path = os.path.join(extract_folder, lecture_path)
                filename_only = os.path.basename(full_path)

                # make sure the file is a pdf
                if not full_path.endswith('.pdf'):
                    continue

                # Check if this file is in the new_files list
                if os.path.exists(full_path) and filename_only in new_files and lecture_enabled:
                    print(f"Processing new lecture: {full_path}")
                    # Add to task queue instead of background tasks
                    await request.app.state.add_task(
                        process_lecture_internally,
                        request,
                        full_path,
                        class_id,
                        response_url,
                        True,
                        start_parse
                    )
                else:
                    print(f"Skipping already processed lecture: {filename_only}")
            
            # Process textbooks/readings
            for reading_path in course_organization.get("categories", {}).get("readings", []):
                # Fix the path if needed
                base_name = os.path.basename(extract_folder)
                if reading_path.startswith(base_name):
                    reading_path = reading_path[len(base_name):].lstrip('/')
                
                full_path = os.path.join(extract_folder, reading_path)
                filename_only = os.path.basename(full_path)
                
                # make sure the file is a pdf
                if not full_path.endswith('.pdf'):
                    continue

                # Check if this file is in the new_files list
                if os.path.exists(full_path) and filename_only in new_files and textbook_enabled:
                    print(f"Processing new reading: {full_path}")
                    # Add to task queue
                    await request.app.state.add_task(
                        process_textbook_internally,
                        request,
                        full_path,
                        class_id,
                        response_url,
                        True,
                        start_parse
                    )
                else:
                    print(f"Skipping already processed reading: {filename_only}")
            
            # Process assignments/homework
            for assignment_path in course_organization.get("categories", {}).get("assignments", []):
                # Fix the path if needed
                base_name = os.path.basename(extract_folder)
                if assignment_path.startswith(base_name):
                    assignment_path = assignment_path[len(base_name):].lstrip('/')
                
                full_path = os.path.join(extract_folder, assignment_path)
                filename_only = os.path.basename(full_path)
                
                # make sure the file is a pdf, .txt or .docx
                if not full_path.endswith('.pdf') and not full_path.endswith('.txt'):
                    continue

                # Check if this file is in the new_files list
                if os.path.exists(full_path) and filename_only in new_files and homework_enabled:
                    print(f"Processing new assignment: {full_path}")
                    # Add to task queue
                    await request.app.state.add_task(
                        process_homework_internally,
                        request,
                        full_path,
                        class_id,
                        response_url,
                        True,
                        start_parse
                    )
                else:
                    print(f"Skipping already processed assignment: {filename_only}")
            
            # Update download status to 'completed' after all processing is done
            if download_id:
                try:
                    supabase.table("downloads").update({
                        "status": "completed",
                        "updated_at": datetime.now().isoformat(),
                        "processed_files": len(new_files),
                        "total_files": len(current_files)
                    }).eq("id", download_id).execute()
                except Exception as e:
                    print(f"Error updating download status: {str(e)}")
        
        except Exception as e:
            print(f"Error categorizing course files: {str(e)}")
            # Update download status to reflect error in categorization
            if download_id:
                try:
                    supabase.table("downloads").update({
                        "status": "error",
                        "error_message": f"Error categorizing files: {str(e)}",
                        "updated_at": datetime.now().isoformat()
                    }).eq("id", download_id).execute()
                except Exception as db_e:
                    print(f"Error updating download status: {str(db_e)}")
        
        # Return success response with file information
        return result
        
    except Exception as e:
        # Log the full error for debugging
        import traceback
        print(f"Error processing course files: {str(e)}")
        print(traceback.format_exc())
        
        # Update download status to reflect error
        if download_id:
            try:
                supabase.table("downloads").update({
                    "status": "error",
                    "error_message": f"Failed to process course files: {str(e)}",
                    "updated_at": datetime.now().isoformat()
                }).eq("id", download_id).execute()
            except Exception as db_e:
                print(f"Error updating download status: {str(db_e)}")
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process course files: {str(e)}"
            }
        )



@router.post("/lecture")
async def process_lecture(
    request: Request,
    file: UploadFile = File(None),
    file_path: str = Form(None),
    class_id: str = Form(...),
    lecture_id: str = Form(...),
    start_parse: bool = Form(False)
):
    """
    Process a lecture file - can be called with either an uploaded file or a file path.
    Supports multiple file types: pdf, audio, video, image, and other.
    
    Parameters:
    - file: The uploaded lecture file (optional)
    - file_path: Path to an existing lecture file (optional)
    - class_id: Class ID
    - lecture_id: Lecture ID
    Returns:
    - JSON with processing information
    """
    try:
        # Validate that either file or file_path is provided
        if not file and not file_path:
            return JSONResponse(
                status_code=400,
                content={"error": "Either file or file_path must be provided"}
            )
        
        # Determine filename
        if file:
            filename = file.filename
        else:
            filename = os.path.basename(file_path)

        # get lecture from supabase
        lecture_response = supabase.table("lectures").select("*").eq("id", lecture_id).execute()
        lecture = lecture_response.data[0]


        # get file type from lecture
        response_url = lecture.get("response_url")
        file_type = lecture.get("type")

        # Determine file length
        file_length = 1
        if file_type in ["audio", "video"]:
            try:
                from pydub import AudioSegment
                
                # Make sure we have a valid file to read
                if file:
                    # Create a temporary file to store the uploaded content
                    with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                        temp_path = temp_file.name
                        await file.seek(0)  # Ensure we're at the start of the file
                        content = await file.read()
                        temp_file.write(content)
                        
                    # Get the length from the temporary file
                    media = AudioSegment.from_file(temp_path)
                    file_length = len(media) / 1000  # Convert to seconds
                    os.unlink(temp_path)  # Clean up the temporary file
                elif file_path and os.path.exists(file_path):
                    # Get the length from the existing file path
                    media = AudioSegment.from_file(file_path)
                    file_length = len(media) / 1000  # Convert to seconds
                else:
                    logger.warning("Neither file object nor valid file path available for length detection")
                    file_length = 0
                    
                # Find how many 30 second chunks (rounded up)
                file_length = max(1, math.ceil(file_length / 30))
            except Exception as e:
                logger.warning(f"Could not determine media length: {str(e)}")
                file_length = 1
        else:
            file_length = 1
        
        # update lecture in supabase
        supabase.table("lectures").update({
            "pages": file_length,
        }).eq("id", lecture_id).execute()
        
        # Create lecture directory
        lecture_dir = os.path.join(COURSES_DIR, class_id, "lectures", lecture_id)
        os.makedirs(lecture_dir, exist_ok=True)
        
        # Determine file path and save if needed
        if not file_path:
            # This is an external upload
            # Save the uploaded file
            file_path = os.path.join(lecture_dir, filename)
            await file.seek(0)
            
            async with aiofiles.open(file_path, "wb") as f:
                content = await file.read()
                await f.write(content)
        else:
            # This is an internal call with an existing file
            # Copy the file to the lecture directory
            destination_path = os.path.join(lecture_dir, filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, destination_path)
            file_path = destination_path
        
        # Update lecture status to extracting
        supabase.table("lectures").update({
            "parse_status": "extracting",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()
        
        # Process based on file type
        if file_type == "pdf":
            # Use existing PDF extraction logic
            processor = LectureExtractor(file_path)
            pages_content, page_count = processor.extract_pdf_content()
            
            # Update the status and page count
            supabase.table("lectures").update({
                "parse_status": "uploading",
                "pages": page_count,
                "parse_error": None,
                "last_parse_attempt": datetime.now().isoformat()
            }).eq("id", lecture_id).execute()
            
            processor.upload_to_supabase(pages_content, class_id, lecture_id, supabase)
        else:
            # Use FileExtractor for non-PDF files
            processor = FileExtractor(file_path)
            file_content = processor.extract_file_content()
            
            # Update the status
            supabase.table("lectures").update({
                "parse_status": "uploading",
                "parse_error": None,
                "last_parse_attempt": datetime.now().isoformat()
            }).eq("id", lecture_id).execute()
            
            processor.upload_to_supabase(file_content, class_id, lecture_id, supabase)
            
            # Generate title for video files that start with "video-"
            if file_type == "video" and filename.lower().startswith("video-"):
                # Collect all transcriptions
                transcriptions = [item.get('text', '') for item in file_content if item.get('type') == 'video_chunk']
                
                if transcriptions:
                    # Generate title
                    title = await processor.generate_video_title(transcriptions, lecture_id)
                    
                    if title:
                        # Update lecture title in database
                        supabase.table("lectures").update({
                            "name": title
                        }).eq("id", lecture_id).execute()
        
        if start_parse:
            # Process the lecture file using the task queue
            await request.app.state.add_task(parse_lecture_internally, lecture_id, response_url)
        
        return {
            "status": "success",
            "message": "Lecture file received and processing started",
            "lecture_id": lecture_id,
            "file_path": file_path,
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing lecture: {str(e)}")
        print(traceback.format_exc())

        # update the status of the lecture in the database
        supabase.table("lectures").update({
            "parse_status": "error",
            "parse_error": str(e),
        }).eq("id", lecture_id).execute()
            
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process lecture: {str(e)}"
            }
        )

@router.post("/textbook")
async def process_textbook(
    request: Request,
    file: UploadFile = File(None),
    file_path: str = Form(None),
    class_id: str = Form(...),
    textbook_id: str = Form(...),
    start_parse: bool = Form(False)
):
    """
    Process a textbook/reading file - can be called with either an uploaded file or a file path.
    
    Parameters:
    - file: The uploaded textbook file (optional)
    - file_path: Path to an existing textbook file (optional)
    - class_id: Class ID
    - title: Optional title for the textbook
    
    Returns:
    - JSON with processing information
    """
    try:
        # Validate that either file or file_path is provided
        if not file and not file_path:
            return JSONResponse(
                status_code=400,
                content={"error": "Either file or file_path must be provided"}
            )
        
        # get textbook from supabase
        textbook_response = supabase.table("textbooks").select("*").eq("id", textbook_id).execute()
        textbook = textbook_response.data[0]

        # get response url from textbook
        response_url = textbook.get("response_url")
        
        # Create textbook directory
        textbook_dir = os.path.join(COURSES_DIR, class_id, "textbooks", textbook_id)
        os.makedirs(textbook_dir, exist_ok=True)
        
        # Determine file path and save if needed
        if not file_path:
            # This is an external upload
            filename = file.filename
            
            # Save the uploaded file
            file_path = os.path.join(textbook_dir, filename)
            await file.seek(0)
            
            async with aiofiles.open(file_path, "wb") as f:
                content = await file.read()
                await f.write(content)
        else:
            # This is an internal call with an existing file
            # Copy the file to the textbook directory
            filename = os.path.basename(file_path)
            destination_path = os.path.join(textbook_dir, filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, destination_path)
            file_path = destination_path

        # extracing necessary content from the textbook
        api_key = os.getenv("GEMINI_API_KEY")
        processor = TextbookExtractor(file_path, api_key)

        # update the status of the textbook in the database
        supabase.table("textbooks").update({
            "parse_status": "extracting",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", textbook_id).execute()

        # Process textbook and get ID
        processor.extract_exercises()

        processor.create_combined_textbook_json()
        pages, chapters_id, exercises_id = processor.upload_to_supabase(textbook_id, supabase)

        # update the status of the textbook in the database
        supabase.table("textbooks").update({
            "parse_status": "uploading",
            "pages": pages,
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", textbook_id).execute()
        
        # Upload images
        processor.create_documents_and_upload_textbook_images(class_id, textbook_id, supabase)
        processor.upload_exercise_images(class_id, textbook_id, chapters_id, exercises_id, supabase)
        
        if start_parse:
            # Process the textbook file using the task queue
            await request.app.state.add_task(parse_textbook_internally, textbook_id, response_url)
        
        return {
            "status": "success",
            "message": "Textbook file received and processing started",
            "textbook_id": textbook_id,
            "file_path": file_path
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing textbook: {str(e)}")
        print(traceback.format_exc())

        if textbook_id:
            # update the status of the textbook in the database
            supabase.table("textbooks").update({
                "parse_status": "error",
                "parse_error": str(e),
            }).eq("id", textbook_id).execute()
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process textbook: {str(e)}"
            }
        )

@router.post("/homework")
async def process_homework(
    request: Request,
    file: UploadFile = File(None),
    file_path: str = Form(None),
    class_id: str = Form(...),
    homework_id: str = Form(...),
    start_parse: bool = Form(False)
):
    """
    Process a homework/assignment file - can be called with either an uploaded file or a file path.
    
    Parameters:
    - file: The uploaded homework file (optional)
    - file_path: Path to an existing homework file (optional)
    - class_id: Class ID
    - title: Optional title for the homework
    - response_url: Optional response url for the homework
    
    Returns:
    - JSON with processing information
    """
    try:
        # Validate that either file or file_path is provided
        if not file and not file_path:
            return JSONResponse(
                status_code=400,
                content={"error": "Either file or file_path must be provided"}
            )
        
        # get homework from supabase
        homework_response = supabase.table("homeworks").select("*").eq("id", homework_id).execute()
        homework = homework_response.data[0]

        # get response url from homework
        response_url = homework.get("response_url")
        
        # Create homework directory
        homework_dir = os.path.join(COURSES_DIR, class_id, "homeworks", homework_id)
        os.makedirs(homework_dir, exist_ok=True)
        
        # Determine file path and save if needed
        if not file_path:
            # This is an external upload
            filename = file.filename
            
            # Save the uploaded file
            file_path = os.path.join(homework_dir, filename)
            await file.seek(0)
            
            async with aiofiles.open(file_path, "wb") as f:
                content = await file.read()
                await f.write(content)
        else:
            # This is an internal call with an existing file
            # Copy the file to the homework directory
            filename = os.path.basename(file_path)
            destination_path = os.path.join(homework_dir, filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, destination_path)
            file_path = destination_path


        # extracing necessary content from the textbook
        api_key = os.getenv("GEMINI_API_KEY")
        processor = HomeworkExtractor(homework_dir, api_key)

        # update the status of the homework in the database
        supabase.table("homeworks").update({
            "parse_status": "extracting",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", homework_id).execute()


        # get the textbook info
        raw_textbook_info = supabase.table("textbooks").select("*").eq("class", class_id).execute().data
        textbook_info = "\n".join(f"{t['textbook_number']}. {t['title']}" for t in raw_textbook_info)
        
        # Process all homework files
        homework_data = processor._process_single_homework(file_path, textbook_info)
        print(f"Processed {len(homework_data)} homework assignments")

        # update the status of the homework in the database
        supabase.table("homeworks").update({
            "parse_status": "uploading",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", homework_id).execute()
        
        # Upload to Supabase. Need to handle page labels if we have a textbook. Leaving this for now.
        processor.upload_to_supabase(class_id, homework_id, homework_data, supabase)
        
        if start_parse:
            # Process the homework file using the task queue
            await request.app.state.add_task(parse_homework_internally, homework_id, response_url)
        
        return {
            "status": "success",
            "message": "Homework file received and processing started",
            "homework_id": homework_id,
            "file_path": file_path
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing homework: {str(e)}")
        print(traceback.format_exc())

        # update the status of the homework in the database
        supabase.table("homeworks").update({
            "parse_status": "error",
            "parse_error": str(e),
        }).eq("id", homework_id).execute()

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process homework: {str(e)}"
            }
        )


@router.post("/file")
async def process_file(
    request: Request,
    file: UploadFile = File(None),
    file_path: str = Form(None),
    class_id: str = Form(...),
    file_id: str = Form(...),
    start_parse: bool = Form(False),
    upload_dir: str = Form(None)
):
    """
    Process a file - can be called with either an uploaded file or a file path.
    Supports multiple file types: pdf, audio, video, image, and other.
    
    Parameters:
    - file: The uploaded file (optional)
    - file_path: Path to an existing file (optional)
    - class_id: Class ID
    - file_id: File ID
    - title: Optional title for the file
    - response_url: Optional response url for the file
    - start_parse: Whether to start parsing the file
    - file_type_category: Type of file (video, audio, pdf, etc.)
    - file_size: Size of the file in bytes
    - upload_dir: Directory where the file was uploaded (for TUS uploads)

    Returns:
    - JSON with processing information
    """
    try:
        # Validate that either file or file_path is provided
        if not file and not file_path:
            return JSONResponse(
                status_code=400,
                content={"error": "Either file or file_path must be provided"}
            )
        
        # Determine filename and file directory
        if file:
            filename = file.filename
            # Create file directory
            file_dir = os.path.join(COURSES_DIR, class_id, "files", file_id)
            os.makedirs(file_dir, exist_ok=True)
            
            # Save the uploaded file
            final_file_path = os.path.join(file_dir, filename)
            await file.seek(0)
            
            async with aiofiles.open(final_file_path, "wb") as f:
                content = await file.read()
                await f.write(content)
        else:
            filename = os.path.basename(file_path)
            file_dir = os.path.join(COURSES_DIR, class_id, "files", file_id)
            os.makedirs(file_dir, exist_ok=True)
            
            # Copy the file to the file directory
            final_file_path = os.path.join(file_dir, filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(final_file_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, final_file_path)

        # get file from supabase
        file_response = supabase.table("files").select("*").eq("id", file_id).execute()
        file_data = file_response.data[0]

        # get file type from file
        file_type_category = file_data.get("type")
        file_size = file_data.get("file_size")
        response_url = file_data.get("response_url")

        
        # set the status of the file in the database to processing (brief to calculate the length of the file)
        supabase.table("files").update({
            "parse_status": "processing",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", file_id).execute()

        # Check if this is a large video file that needs to be split
        file_size_mb = file_size / (1024 * 1024)  # Convert to MB
        is_large_video = file_type_category == "video" and file_size_mb > 100

        if is_large_video:
            logger.info(f"Large video file detected ({file_size_mb:.2f} MB). Processing in chunks.")
            
            # Create a directory for chunks
            chunks_dir = os.path.join(file_dir, "chunks")
            os.makedirs(chunks_dir, exist_ok=True)
            
            # Use ffmpeg to split the video into chunks
            import subprocess
            import math  # Add this import here too
            
            # Get video duration using ffprobe
            duration_cmd = [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", final_file_path
            ]
            
            try:
                duration = float(subprocess.check_output(duration_cmd).decode('utf-8').strip())
                
                # Calculate number of chunks needed (aim for ~90MB chunks to be safe)
                target_chunk_size_mb = 90
                num_chunks = math.ceil(file_size_mb / target_chunk_size_mb)
                chunk_duration = duration / num_chunks
                
                logger.info(f"Processing {duration:.2f}s video in {num_chunks} chunks of ~{chunk_duration:.2f}s each")
                
                # Create chunks
                chunk_files = []
                for i in range(num_chunks):
                    start_time = i * chunk_duration
                    chunk_filename = f"chunk_{i+1:03d}_{os.path.splitext(filename)[0]}.mp4"
                    chunk_path = os.path.join(chunks_dir, chunk_filename)
                    
                    # Use ffmpeg to extract chunk with copy codec (fast)
                    cmd = [
                        "ffmpeg", "-y", "-i", final_file_path,
                        "-ss", str(start_time),
                        "-t", str(chunk_duration),
                        "-map", "0:v:0",  # Map only the first video stream
                        "-map", "0:a:0",  # Map only the first audio stream
                        "-c", "copy",     # Copy the selected streams
                        "-strict", "unofficial",  # Allow unofficial features (for Dolby Vision)
                        "-avoid_negative_ts", "1",  # Avoid negative timestamps
                        chunk_path
                    ]
                    
                    subprocess.run(cmd, check=True)
                    chunk_files.append(chunk_path)
                
                # Update the length of the file
                file_length = max(1, math.ceil(duration / 30))  # Convert to 30-second chunks
                supabase.table("files").update({
                    "parse_status": "extracting",
                    "parse_error": "",
                    "last_parse_attempt": datetime.now().isoformat(),
                    "length": file_length,
                }).eq("id", file_id).execute()
                
                # Process each chunk and collect content
                all_content = []
                gemini_file_names = []
                
                for i, chunk_path in enumerate(chunk_files):
                    try:
                        logger.info(f"Processing chunk {i+1}/{len(chunk_files)}")
                        
                        # Process this chunk
                        processor = FileExtractor(chunk_path)
                        chunk_content = processor.extract_file_content()
                        
                        # Adjust chunk numbers to be sequential across all chunks
                        base_chunk_num = i * 30  # Assuming ~30 chunks per segment
                        for item in chunk_content:
                            if item['type'] == 'video_chunk':
                                item['chunk_num'] += base_chunk_num
                            # Upload content to supabase
                            processor.upload_to_supabase(item, class_id, file_id, supabase)
                        
                        # Upload to Gemini and collect file name
                        try:
                            # Get MIME type
                            mime = magic.Magic(mime=True)
                            detected_mime = mime.from_file(chunk_path)
                            
                            # Upload chunk to Gemini
                            with open(chunk_path, "rb") as f:
                                logger.info(f"Uploading chunk {i+1} to Gemini: {detected_mime}")
                                media_file = genai.upload_file(f, mime_type=detected_mime)
                                gemini_file_names.append(media_file.name)
                                
                                # update supabase with the new file names
                                supabase.table("files").update({
                                    "file_names": gemini_file_names,  # Store all Gemini file names
                                }).eq("id", file_id).execute()

                                logger.info(f"Successfully uploaded chunk {i+1} to Gemini: {media_file.name}")
                        except Exception as e:
                            logger.error(f"Error uploading chunk {i+1} to Gemini: {str(e)}")
                        
                    except Exception as chunk_e:
                        logger.error(f"Error processing chunk {i+1}: {str(chunk_e)}")
                
                # Generate title for video files that start with "video-"
                if filename.lower().startswith("video-"):
                    # Collect all transcriptions
                    transcriptions = [item.get('text', '') for item in all_content if item.get('type') == 'video_chunk']
                    
                    if transcriptions:
                        # Generate title
                        title = await processor.generate_video_title(transcriptions, file_id)
                        
                        if title:
                            # Update file title in database
                            supabase.table("files").update({
                                "title": title
                            }).eq("id", file_id).execute()
                
                # Process the file using the task queue if requested
                if start_parse:
                    await request.app.state.add_task(parse_file_internally, file_id, response_url)
                
                # Clean up the tus upload directory if it was provided
                if upload_dir and os.path.exists(upload_dir):
                    shutil.rmtree(upload_dir)
                
                return {
                    "status": "success",
                    "message": f"Large video file processed in {len(chunk_files)} chunks",
                    "file_id": file_id,
                    "file_path": final_file_path,
                    "file_type": file_type_category
                }
                
            except Exception as split_e:
                logger.error(f"Error processing video in chunks: {str(split_e)}")
                # Fall back to processing the whole file
                logger.info("Falling back to processing the entire file")
                is_large_video = False
        
        # If not a large video or splitting failed, process normally
        if not is_large_video:
            # Determine file length for audio/video files
            file_length = 1
            if file_type_category in ["audio", "video"]:
                try:
                    from pydub import AudioSegment
                    import math  # Add this import here to fix the scope issue
                    
                    # Get the length from the file
                    media = AudioSegment.from_file(final_file_path)
                    file_length = len(media) / 1000  # Convert to seconds
                    
                    # Find how many 30 second chunks (rounded up)
                    file_length = max(1, math.ceil(file_length / 30))
                except Exception as e:
                    logger.warning(f"Could not determine media length: {str(e)}")
                    file_length = 1
            
            # Update file status to extracting and set correct length
            supabase.table("files").update({
                "parse_status": "extracting",
                "parse_error": "",
                "length": file_length,
                "last_parse_attempt": datetime.now().isoformat()
            }).eq("id", file_id).execute()
            
            # Initialize file extractor
            processor = FileExtractor(final_file_path)
            
            # Extract content from the file
            file_content = processor.extract_file_content()
            
            # Upload to Gemini if this is a video file
            gemini_file_names = []
            if file_type_category == "video":
                try:
                    # Get MIME type
                    mime = magic.Magic(mime=True)
                    detected_mime = mime.from_file(final_file_path)
                    
                    # Upload video to Gemini
                    with open(final_file_path, "rb") as f:
                        logger.info(f"Uploading video to Gemini: {detected_mime}")
                        media_file = genai.upload_file(f, mime_type=detected_mime)
                        gemini_file_names.append(media_file.name)
                        logger.info(f"Successfully uploaded video to Gemini: {media_file.name}")
                        
                        # Store the Gemini file name in Supabase
                        supabase.table("files").update({
                            "file_names": gemini_file_names
                        }).eq("id", file_id).execute()
                except Exception as e:
                    logger.error(f"Error uploading video to Gemini: {str(e)}")
            
            # Update file status to uploading
            supabase.table("files").update({
                "parse_status": "uploading",
                "parse_error": "",
                "last_parse_attempt": datetime.now().isoformat()
            }).eq("id", file_id).execute()
            
            # Upload content to Supabase
            for item in file_content:
                processor.upload_to_supabase(item, class_id, file_id, supabase)
            
            # Generate title for video files that start with "video-"
            if file_type_category == "video" and filename.lower().startswith("video-"):
                # Collect all transcriptions
                transcriptions = [item.get('text', '') for item in file_content if item.get('type') == 'video_chunk']
                
                if transcriptions:
                    # Generate title
                    title = await processor.generate_video_title(transcriptions, file_id)
                    
                    if title:
                        # Update file title in database
                        supabase.table("files").update({
                            "title": title
                        }).eq("id", file_id).execute()
        
            # Process the file using the task queue if requested
            if start_parse:
                await request.app.state.add_task(parse_file_internally, file_id, response_url)
            
        
        # Clean up the tus upload directory if it was provided
        if upload_dir and os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
        
        return {
            "status": "success",
            "message": "File received and processing started",
            "file_id": file_id,
            "file_path": final_file_path,
            "file_type": file_type_category
        }
        
    except Exception as e:
        import traceback
        logger.error(f"Error finalizing upload: {str(e)}")
        logger.error(traceback.format_exc())
        # Update file status to error
        supabase.table("files").update({
            "parse_status": "error",
            "parse_error": str(e),
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", file_id).execute()

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process file: {str(e)}"
            }
        )
    

# Helper functions for internal processing
async def process_lecture_internally(request: Request, file_path: str, class_id: str, response_url: str, start_upload: bool, start_parse: bool):
    """Helper function to call the lecture endpoint internally."""

    # get existing lectures to find the note_number
    lectures_response = supabase.table("lectures").select("*").eq("class", class_id).eq("deleted", False).execute()
    existing_lectures = lectures_response.data
    note_number = len(existing_lectures) + 1

    # get the filename
    filename = os.path.splitext(os.path.basename(file_path))[0]
    
    # Determine file type based on extension
    file_type = "other"
    ext = os.path.splitext(filename)[1].lower()
    print(f"File type: {ext}")
    print(f"File name: {filename}")
    
    if ext in ['.pdf']:
        file_type = "pdf"
    elif ext in ['.mp3', '.wav', '.ogg', '.flac', '.m4a']:
        file_type = "audio"
    elif ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
        file_type = "video"
    elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
        file_type = "image"

    
    # drop ext on filename for title
    filename_for_title = os.path.splitext(filename)[0]

    # create new lecture in supabase
    lecture_response = supabase.table("lectures").insert({
        "class": class_id,
        "response_url": response_url,
        "name": filename_for_title,
        "note_number": note_number,
        "type": file_type,
    }).execute()

    # get the lecture id from the response
    lecture_id = lecture_response.data[0]['id']
    
    if start_upload:
        await request.app.state.add_task(process_lecture, request, None, file_path, class_id, response_url, start_upload, start_parse)

    # return the lecture id
    return lecture_id

async def parse_lecture_internally(lecture_id: str, response_url: str):
    """Helper function to call the lecture endpoint internally."""
    import httpx
    
    # Prepare JSON data instead of form data
    json_data = {
        "lecture_id": lecture_id
    }

    # Call the endpoint with JSON data
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{response_url}/parse/lecture", 
            json=json_data,  # Use json parameter instead of data
            headers={"Content-Type": "application/json"}
        )
        print(f"Lecture parsing response: {response.text}")


async def process_textbook_internally(request: Request, file_path: str, class_id: str, response_url: str, start_upload: bool, start_parse: bool):
    """Helper function to call the textbook endpoint internally."""

    # get existing textbooks to find the textbook_number
    textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).eq("deleted", False).execute()
    existing_textbooks = textbooks_response.data
    textbook_number = len(existing_textbooks) + 1

    # get the filename
    filename = os.path.splitext(os.path.basename(file_path))[0]

    # get supabase format without extension
    title = os.path.splitext(filename)[0]

    # insert textbook in supabase
    textbook_response = supabase.table("textbooks").insert({
        "class": class_id,
        "title": title,
        "textbook_number": textbook_number,
        "response_url": response_url
    }).execute()

    # get the textbook id from the response
    textbook_id = textbook_response.data[0]['id']

    
    if start_upload:
        await request.app.state.add_task(process_textbook, request, None, file_path, class_id, response_url, start_upload, start_parse)

    return textbook_id

async def parse_textbook_internally(textbook_id: str, response_url: str):
    """Helper function to call the textbook endpoint internally."""
    import httpx
    
    # Prepare JSON data instead of form data
    json_data = {
        "textbook_id": textbook_id
    }

    # Call the endpoint with JSON data
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{response_url}/parse/textbook", 
            json=json_data,  # Use json parameter instead of data
            headers={"Content-Type": "application/json"}
        )
        print(f"Textbook parsing response: {response.text}")


async def process_homework_internally(request: Request, file_path: str, class_id: str, response_url: str, start_upload: bool, start_parse: bool):
    """Helper function to call the homework endpoint internally."""

    # get existing homeworks to find the homework_number
    homeworks_response = supabase.table("homeworks").select("*").eq("class", class_id).eq("deleted", False).execute()
    existing_homeworks = homeworks_response.data
    homework_number = len(existing_homeworks) + 1

    # get the filename
    filename = os.path.splitext(os.path.basename(file_path))[0]

    # get supabase format without extension
    title = os.path.splitext(filename)[0]

    # update homework in supabase
    homework_response = supabase.table("homeworks").insert({
        "class": class_id,
        "title": title,
        "homework_number": homework_number,
        "response_url": response_url
    }).execute()

    # get the homework id from the response
    homework_id = homework_response.data[0]['id']
    
    if start_upload:
        await request.app.state.add_task(process_homework, request, None, file_path, class_id, response_url, start_upload, start_parse)

    return homework_id

async def parse_homework_internally(homework_id: str, response_url: str):
    """Helper function to call the homework endpoint internally."""
    import httpx
    
    # Prepare JSON data instead of form data
    json_data = {
        "homework_id": homework_id
    }

    # Call the endpoint with JSON data
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{response_url}/parse/homework", 
            json=json_data,  # Use json parameter instead of data
            headers={"Content-Type": "application/json"}
        )
        print(f"Homework parsing response: {response.text}")

async def process_file_internally(request: Request, file_path: str, class_id: str, response_url: str, start_upload: bool, start_parse: bool):
    """Helper function to call the file endpoint internally."""
    
    # Get file type based on extension
    filename = os.path.basename(file_path)
    ext = os.path.splitext(filename)[1].lower()
    file_type_category = "other"
    
    if ext in ['.pdf']:
        file_type_category = "pdf"
    elif ext in ['.mp3', '.wav', '.ogg', '.flac', '.m4a']:
        file_type_category = "audio"
    elif ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
        file_type_category = "video"
    elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
        file_type_category = "image"
    
    # Get file size
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    
    # create file from supabase
    file_response = supabase.table("files").insert({
        "class": class_id,
        "type": file_type_category,
        "file_size": file_size,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url
    }).execute()

    # get the file id from the response
    file_id = file_response.data[0]['id']
    

    if start_upload:
        await request.app.state.add_task(process_file, request, None, file_path, class_id, response_url, start_upload, start_parse)

    return file_id

async def parse_file_internally(file_id: str, response_url: str):
    """Helper function to call the file endpoint internally."""
    import httpx
    
    # Prepare form data
    json_data = {
        "file_id": file_id
    }

    # Call the endpoint with JSON data
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{response_url}/parse/file", 
            json=json_data,  # Use json parameter instead of data
            headers={"Content-Type": "application/json"}
        )
        print(f"File parsing response: {response.text}")

@router.options("/tus")
async def tus_options(request: Request):
    """Handle OPTIONS request for tus protocol"""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload,creation-defer-length",
            "Tus-Max-Size": "1073741824",  # 1GB max file size
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Upload-Defer-Length, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Upload-Defer-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )

@router.post("/tus")
async def tus_creation(request: Request):
    """Handle POST request for tus protocol - create upload"""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})
    
    # Get upload length or check for deferred length
    upload_length = request.headers.get("Upload-Length")
    upload_defer_length = request.headers.get("Upload-Defer-Length")
    
    # Either Upload-Length or Upload-Defer-Length must be present
    if not upload_length and not upload_defer_length:
        return Response(status_code=400, content="Missing Upload-Length header")
    
    # If using deferred length, it must be "1"
    if upload_defer_length and upload_defer_length != "1":
        return Response(status_code=400, content="Invalid Upload-Defer-Length header")
    
    # Parse metadata
    metadata = {}
    if "Upload-Metadata" in request.headers:
        for kv in request.headers["Upload-Metadata"].split(","):
            if " " in kv:
                k, v = kv.strip().split(" ", 1)
                import base64
                metadata[k] = base64.b64decode(v).decode("utf-8")
    
    # Generate upload ID
    upload_id = str(uuid.uuid4())
    
    # Create upload directory
    upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save metadata
    with open(os.path.join(upload_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f)
    
    # Create empty file
    with open(os.path.join(upload_dir, "file"), "wb") as f:
        pass
    
    # Save upload info (length or deferred)
    with open(os.path.join(upload_dir, "info"), "w") as f:
        if upload_length:
            f.write(f"length:{upload_length}\noffset:0")
        else:
            f.write(f"deferred:true\noffset:0")
    
    # Use the base URL from metadata if available, otherwise use request.base_url
    base_url = metadata.get("baseUrl", "")
    if not base_url:
        # Fallback to using headers
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "http")
        forwarded_host = request.headers.get("X-Forwarded-Host", request.headers.get("Host", "localhost:8000"))
        base_url = f"{forwarded_proto}://{forwarded_host}"
    
    if not base_url.endswith('/'):
        base_url += '/'
    
    # Make sure we're not using localhost with https
    if "localhost" in base_url and base_url.startswith("https"):
        base_url = base_url.replace("https://", "http://")
    
    location = f"{base_url}upload/tus/{upload_id}"
    print(f"LOCATION: {location}")
    
    # Handle creation-with-upload if Content-Length > 0
    if request.headers.get("Content-Length", "0") != "0":
        # Read the first chunk
        chunk = await request.body()
        
        # Write to file
        with open(os.path.join(upload_dir, "file"), "wb") as f:
            f.write(chunk)
        
        # Update offset
        offset = len(chunk)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write(f"length:{upload_length}\noffset:{offset}")
        
        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(offset),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            }
        )
    
    return Response(
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )

@router.head("/tus/{upload_id}")
async def tus_head(upload_id: str, request: Request):
    """Handle HEAD request for tus protocol - get upload info"""
    upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)
    
    if not os.path.exists(upload_dir):
        return Response(status_code=404)
    
    # Read info file
    with open(os.path.join(upload_dir, "info"), "r") as f:
        info = {}
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v
    
    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": info.get("offset", "0"),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Upload-Defer-Length, Location",
    }
    
    # Add either Upload-Length or Upload-Defer-Length
    if "deferred" in info and info["deferred"] == "true":
        headers["Upload-Defer-Length"] = "1"
    else:
        headers["Upload-Length"] = info.get("length", "0")
    
    return Response(headers=headers)

@router.patch("/tus/{upload_id}")
async def tus_patch(upload_id: str, request: Request):
    """Handle PATCH request for tus protocol - upload chunk"""
    upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)
    
    if not os.path.exists(upload_dir):
        return Response(status_code=404)
    
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})
    
    # Check content type
    if request.headers.get("Content-Type") != "application/offset+octet-stream":
        return Response(status_code=415)
    
    # Read info file
    with open(os.path.join(upload_dir, "info"), "r") as f:
        info = {}
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v
    
    # Check offset
    if request.headers.get("Upload-Offset") != info.get("offset"):
        return Response(status_code=409)
    
    # Read chunk
    chunk = await request.body()
    
    # Append to file
    with open(os.path.join(upload_dir, "file"), "ab") as f:
        f.write(chunk)
    
    # Update offset
    new_offset = int(info.get("offset", "0")) + len(chunk)
    
    # Check for Upload-Length header in case of deferred length
    upload_length = request.headers.get("Upload-Length")
    
    # If this was a deferred upload and we now have the length, update it
    if "deferred" in info and info["deferred"] == "true" and upload_length:
        info["length"] = upload_length
        info.pop("deferred", None)  # Remove the deferred flag
    
    # Update offset and possibly length
    with open(os.path.join(upload_dir, "info"), "w") as f:
        if "deferred" in info and info["deferred"] == "true":
            f.write(f"deferred:true\noffset:{new_offset}")
        else:
            f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")
    
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )

@router.options("/tus/{upload_id}")
async def tus_options_upload_id(upload_id: str, request: Request):
    """Handle OPTIONS request for specific upload"""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload,creation-defer-length",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Upload-Defer-Length, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Upload-Defer-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )

@router.post("/tus/finalize")
async def finalize_upload(request: Request):
    """Finalize an upload and process the file"""
    try:
        # Parse request body
        body = await request.json()
        file_id = body.get("fileId")
        
        if not file_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing fileId parameter"}
            )
        
        # Find the upload directory
        upload_dir = None
        for dir_name in os.listdir(TUS_UPLOADS_DIR):
            metadata_path = os.path.join(TUS_UPLOADS_DIR, dir_name, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                    if metadata.get("fileId") == file_id:
                        upload_dir = os.path.join(TUS_UPLOADS_DIR, dir_name)
                        break
        
        if not upload_dir:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": f"Upload with fileId {file_id} not found"}
            )
        
        # Check if file exists and has content
        file_path = os.path.join(upload_dir, "file")
        if not os.path.exists(file_path):
            logger.error(f"Upload file is missing: {file_path}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Upload file is missing"}
            )
        
        # Check file size and content
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            logger.error(f"Upload file is empty: {file_path}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Upload file is empty"}
            )
        
        # Debug: Check file content type
        mime = magic.Magic(mime=True)
        detected_mime = mime.from_file(file_path)
        logger.info(f"File {file_id} detected MIME type: {detected_mime}, size: {file_size} bytes")
        
        # Read first few bytes to check format
        with open(file_path, 'rb') as f:
            header = f.read(16)
            hex_header = ' '.join(f'{b:02x}' for b in header)
            logger.info(f"File header: {hex_header}")
        
        # Read metadata
        with open(os.path.join(upload_dir, "metadata.json"), "r") as f:
            metadata = json.load(f)
        
        # Extract necessary metadata
        filename = metadata.get("filename", f"file-{file_id}")
        file_type = metadata.get("filetype", "application/octet-stream")
        class_id = metadata.get("classId")
        profile_id = metadata.get("profileId")
        response_url = metadata.get("responseUrl", "")
        start_parse = metadata.get("startParse", "false").lower() == "true"
        
        if not class_id or not profile_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing required metadata (classId or profileId)"}
            )
        
        # Determine file type category
        if file_type.startswith("image/"):
            file_type_category = "image"
        elif file_type.startswith("audio/"):
            file_type_category = "audio"
        elif file_type.startswith("video/"):
            file_type_category = "video"
        elif file_type.startswith("application/pdf"):
            file_type_category = "pdf"
        elif file_type.startswith("text/"):
            file_type_category = "text"
        else:
            file_type_category = "other"
        
        # Create a clean filename for Supabase
        filename_for_supabase = os.path.basename(filename)
        
        # Get next file number for this class
        result = supabase.table("files").select("file_number").eq("class", class_id).order("file_number", desc=True).limit(1).execute()
        file_number = 1
        if result.data and len(result.data) > 0:
            file_number = result.data[0].get("file_number", 0) + 1
        
        # Create file record in Supabase
        result = supabase.table("files").insert({
            "class": class_id,
            "title": filename_for_supabase,
            "profile": profile_id,
            "type": file_type_category,
            "length": 1,  # Will update this later for audio/video
            "parse_status": "uploading",
            "response_url": response_url,
            "file_number": file_number
        }).execute()

        # set the new file id from supabase
        db_file_id = result.data[0].get("id")
        
        # Create file directory
        file_dir = os.path.join(COURSES_DIR, class_id, "files", db_file_id)
        os.makedirs(file_dir, exist_ok=True)
        
        # Move the uploaded file to its final destination
        final_file_path = os.path.join(file_dir, filename)
        shutil.copy2(os.path.join(upload_dir, "file"), final_file_path)
        
        # Process the file using the new process_file endpoint
        response = await process_file(
            request=request,
            file=None,  # No direct file upload
            file_path=final_file_path,  # Use the path to the uploaded file
            class_id=class_id,
            file_id=db_file_id,
            title=filename_for_supabase.split('.')[0],  # Use filename without extension as title
            response_url=response_url,
            start_parse=start_parse,
            file_type_category=file_type_category,
            file_size=file_size,
            upload_dir=upload_dir  # Pass the upload_dir for cleanup
        )
        
        return response
        
    except Exception as e:
        import traceback
        logger.error(f"Error finalizing upload: {str(e)}")
        logger.error(traceback.format_exc())
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process file: {str(e)}"
            }
        )
    

@router.post("/onedrive")
async def upload_onedrive(
    request: Request,
    class_id: str = Form(...),
    onedrive_id: str = Form(...),
    files: str = Form(...),  # JSON string of file IDs or [fileId, category] pairs
    response_url: str = Form(...),
    only_active: bool = Form(True),
    start_upload: bool = Form(True),
    start_parse: bool = Form(False)
):
    try:
        # Get the class data
        class_data = supabase.table("classes").select("*").eq("id", class_id).execute()
        class_title = class_data.data[0]["title"]
        
        # Parse the files input - handle both formats
        files_data = json.loads(files)
        
        # Determine if we have simple file IDs or [fileId, category] pairs
        if files_data and isinstance(files_data, list):
            if isinstance(files_data[0], list) or isinstance(files_data[0], tuple):
                # Format is [[fileId, category], ...]
                file_category_pairs = files_data
                file_ids = [pair[0] for pair in file_category_pairs]
            else:
                # Format is [fileId, fileId, ...]
                file_ids = files_data
                file_category_pairs = [(file_id, None) for file_id in file_ids]
        else:
            # Single file ID as string
            file_ids = [files_data]
            file_category_pairs = [(files_data, None)]
            
        # Get all onedrive files for this class
        all_onedrive_files_response = supabase.table("onedrive_files").select("*").eq("class", class_id).execute()
        all_onedrive_files = all_onedrive_files_response.data

        # create mapping from onedrive_file_id to item_id
        onedrive_file_id_to_item_id = {f["id"]: f["item"] for f in all_onedrive_files}
        
        if only_active:
            all_onedrive_files = [f for f in all_onedrive_files if f.get("active", True)]
            
        # Create a mapping of file IDs to their database records
        file_map = {f["id"]: f for f in all_onedrive_files}
        
        # Initialize category lists
        lecture_files = []
        textbook_files = []
        homework_files = []
        other_files = []
        unclassified_files = []

        lectures_to_deactivate = []
        textbooks_to_deactivate = []
        homework_to_deactivate = []
        files_to_deactivate = []
        
        # Process files with explicit categories
        for file_id, category in file_category_pairs:
            if file_id not in file_map:
                continue
                
            if category == "lecture":
                if file_map[file_id]["lecture"] is None:
                    lecture_files.append(file_id)
                # deactivate the other sections
                textbooks_to_deactivate.append(file_map[file_id]["textbook"])
                homework_to_deactivate.append(file_map[file_id]["homework"])
                files_to_deactivate.append(file_map[file_id]["file"])
            elif category == "textbook":
                if file_map[file_id]["textbook"] is None:
                    textbook_files.append(file_id)
                # deactivate the other sections
                lectures_to_deactivate.append(file_map[file_id]["lecture"])
                homework_to_deactivate.append(file_map[file_id]["homework"])
                files_to_deactivate.append(file_map[file_id]["file"])
            elif category == "homework":
                if file_map[file_id]["homework"] is None:
                    homework_files.append(file_id)
                # deactivate the other sections
                lectures_to_deactivate.append(file_map[file_id]["lecture"])
                textbooks_to_deactivate.append(file_map[file_id]["textbook"])
                files_to_deactivate.append(file_map[file_id]["file"])
                
            elif category == "file":
                if file_map[file_id]["file"] is None:
                    other_files.append(file_id)
                # deactivate the other sections
                lectures_to_deactivate.append(file_map[file_id]["lecture"])
                textbooks_to_deactivate.append(file_map[file_id]["textbook"])
                homework_to_deactivate.append(file_map[file_id]["homework"])
                
            else:
                unclassified_files.append(file_id)
                
        # Classify unclassified files if needed
        if unclassified_files:
            # Create a file classifier
            file_classifier = FileClassifier()
            
            # Get file metadata for classification
            unclassified_file_data = [file_map[f_id] for f_id in unclassified_files if f_id in file_map]
            
            # Using agents SDK to classify files
            classified_lecture_files, classified_textbook_files, classified_homework_files, classified_other_files = await file_classifier.classify_files(class_title, unclassified_file_data)
            
            # Add the classified files to the lists
            lecture_files.extend(classified_lecture_files)
            textbook_files.extend(classified_textbook_files)
            homework_files.extend(classified_homework_files)
            other_files.extend(classified_other_files)

            # deactivate the other sections
            for file_id in classified_lecture_files:
                textbooks_to_deactivate.append(file_map[file_id]["textbook"])
                homework_to_deactivate.append(file_map[file_id]["homework"])
                files_to_deactivate.append(file_map[file_id]["file"])
            for file_id in classified_textbook_files:
                lectures_to_deactivate.append(file_map[file_id]["lecture"])
                homework_to_deactivate.append(file_map[file_id]["homework"])
                files_to_deactivate.append(file_map[file_id]["file"])
            for file_id in classified_homework_files:
                lectures_to_deactivate.append(file_map[file_id]["lecture"])
                textbooks_to_deactivate.append(file_map[file_id]["textbook"])
                files_to_deactivate.append(file_map[file_id]["file"])
            for file_id in classified_other_files:
                lectures_to_deactivate.append(file_map[file_id]["lecture"])
                textbooks_to_deactivate.append(file_map[file_id]["textbook"])
                homework_to_deactivate.append(file_map[file_id]["homework"])


                # filter out none and duplicates
        lectures_to_deactivate = list(set(lectures_to_deactivate) - {None})
        textbooks_to_deactivate = list(set(textbooks_to_deactivate) - {None})
        homework_to_deactivate = list(set(homework_to_deactivate) - {None})
        files_to_deactivate = list(set(files_to_deactivate) - {None})
        print(f"lectures_to_deactivate: {lectures_to_deactivate}")
        print(f"textbooks_to_deactivate: {textbooks_to_deactivate}")
        print(f"homework_to_deactivate: {homework_to_deactivate}")
        print(f"files_to_deactivate: {files_to_deactivate}")

        # deactivate lectures
        if lectures_to_deactivate:
            supabase.table("lectures").update({"active": False}).in_("id", lectures_to_deactivate).execute()
        # deactivate textbooks
        if textbooks_to_deactivate:
            supabase.table("textbooks").update({"active": False}).in_("id", textbooks_to_deactivate).execute()
        # deactivate homework
        if homework_to_deactivate:
            supabase.table("homework").update({"active": False}).in_("id", homework_to_deactivate).execute()
        # deactivate files
        if files_to_deactivate:
            supabase.table("files").update({"active": False}).in_("id", files_to_deactivate).execute()
            
        # Process files by category
        updates = []  # tuple of updates for supabase
            
        # Process lectures
        for onedrive_file_id in lecture_files:
            # find the onedrive entry from all_onedrive_files
            onedrive_entry = next((f for f in all_onedrive_files if f["id"] == onedrive_file_id), None)
            if start_upload:
                # Download the file from OneDrive
                local_file_path, original_filename = await download_file_from_onedrive(onedrive_id, onedrive_file_id)
                lecture_id = await process_lecture_internally(request, local_file_path, class_id, response_url, start_upload, start_parse)
            else:
                # call the download endpoint asynchronously
                await request.app.state.add_task(download_file_from_onedrive, onedrive_id, onedrive_file_id)
                lecture_id = await process_lecture_internally(request, onedrive_entry["name"], class_id, response_url, False, False)
            updates.append({"id": onedrive_file_id, "lecture": lecture_id, "class": class_id, "item": onedrive_file_id_to_item_id[onedrive_file_id]})
        
        # Similar processing for other categories...
        for onedrive_file_id in textbook_files:
            # find the onedrive entry from all_onedrive_files
            onedrive_entry = next((f for f in all_onedrive_files if f["id"] == onedrive_file_id), None)
            if start_upload:
                local_file_path, original_filename = await download_file_from_onedrive(onedrive_id, onedrive_file_id)
                textbook_id = await process_textbook_internally(request, local_file_path, class_id, response_url, start_upload, start_parse)
            else:
                # call the download endpoint asynchronously
                await request.app.state.add_task(download_file_from_onedrive, onedrive_id, onedrive_file_id)
                textbook_id = await process_textbook_internally(request, onedrive_entry["name"], class_id, response_url, False, False)
            updates.append({"id": onedrive_file_id, "textbook": textbook_id, "class": class_id, "item": onedrive_file_id_to_item_id[onedrive_file_id]})
        
        for onedrive_file_id in homework_files:
            # find the onedrive entry from all_onedrive_files
            onedrive_entry = next((f for f in all_onedrive_files if f["id"] == onedrive_file_id), None)
            if start_upload:
                local_file_path, original_filename = await download_file_from_onedrive(onedrive_id, onedrive_file_id)
                homework_id = await process_homework_internally(request, local_file_path, class_id, response_url, start_upload, start_parse, onedrive_file_id)
            else:
                # call the download endpoint asynchronously
                await request.app.state.add_task(download_file_from_onedrive, onedrive_id, onedrive_file_id)
                homework_id = await process_homework_internally(request, onedrive_entry["name"], class_id, response_url, False, False)
            updates.append({"id": onedrive_file_id, "homework": homework_id, "class": class_id, "item": onedrive_file_id_to_item_id[onedrive_file_id]})
            
        for onedrive_file_id in other_files:
            # find the onedrive entry from all_onedrive_files
            onedrive_entry = next((f for f in all_onedrive_files if f["id"] == onedrive_file_id), None)
            if start_upload:
                local_file_path, original_filename = await download_file_from_onedrive(onedrive_id, onedrive_file_id)
                file_id = await process_file_internally(request, local_file_path, class_id, response_url, start_upload, start_parse, onedrive_file_id)
            else:
                # call the download endpoint asynchronously
                await request.app.state.add_task(download_file_from_onedrive, onedrive_id, onedrive_file_id)
                file_id = await process_file_internally(request, onedrive_entry["name"], class_id, response_url, False, False)
            updates.append({"id": onedrive_file_id, "file": file_id, "class": class_id, "item": onedrive_file_id_to_item_id[onedrive_file_id]})

        # Update the onedrive files in supabase
        if updates:
            supabase.table("onedrive_files").upsert(updates).execute()

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Files classified successfully"
            }
        )
    except Exception as e:
        print("Error in classify function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to classify files: {str(e)}"
            }
        )