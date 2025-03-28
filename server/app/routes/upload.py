import math
import re
import json
from fastapi import APIRouter, File, UploadFile, Form, Request, BackgroundTasks
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

import logging

load_dotenv()
router = APIRouter()

logger = logging.getLogger(__name__)

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
                if os.path.exists(full_path) and filename_only in new_files:
                    print(f"Processing new lecture: {full_path}")
                    # Add to task queue instead of background tasks
                    await request.app.state.add_task(
                        process_lecture_internally,
                        full_path,
                        class_id,
                        response_url,
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
                if os.path.exists(full_path) and filename_only in new_files:
                    print(f"Processing new reading: {full_path}")
                    # Add to task queue
                    await request.app.state.add_task(
                        process_textbook_internally,
                        full_path,
                        class_id,
                        response_url,
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
                if os.path.exists(full_path) and filename_only in new_files:
                    print(f"Processing new assignment: {full_path}")
                    # Add to task queue
                    await request.app.state.add_task(
                        process_homework_internally,
                        full_path,
                        class_id,
                        response_url,
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
    title: str = Form(None),
    response_url: str = Form(None),
    start_parse: bool = Form(False)
):
    """
    Process a lecture file - can be called with either an uploaded file or a file path.
    
    Parameters:
    - file: The uploaded lecture file (optional)
    - file_path: Path to an existing lecture file (optional)
    - class_id: Class ID
    - title: Optional title for the lecture
    - response_url: Optional response url for the lecture

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
        

        # get exisiting lectures to find the note_number
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        existing_lectures = lectures_response.data
        note_number = len(existing_lectures) + 1
        
        # create lecture in supabase
        lecture_response = supabase.table("lectures").insert({
            "class": class_id,
            "name": title or os.path.splitext(filename)[0],
            "note_number": note_number,
            "response_url": response_url or ""
        }).execute()

        # Get the ID of the newly created lecture
        lecture_id = lecture_response.data[0]["id"]
        
        # Create lecture directory
        lecture_dir = os.path.join(COURSES_DIR, class_id, "lectures", lecture_id)
        os.makedirs(lecture_dir, exist_ok=True)
        
        # Determine file path and save if needed
        if not file_path:
            # This is an external upload
            filename = file.filename
            
            # Save the uploaded file
            file_path = os.path.join(lecture_dir, filename)
            await file.seek(0)
            
            async with aiofiles.open(file_path, "wb") as f:
                content = await file.read()
                await f.write(content)
        else:
            # This is an internal call with an existing file
            # Copy the file to the lecture directory
            filename = os.path.basename(file_path)
            destination_path = os.path.join(lecture_dir, filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, destination_path)
            file_path = destination_path
        
        # extracing necessary content from the lecture
        processor = LectureExtractor(file_path)

        # update the status of the lecture in the database
        supabase.table("lectures").update({
            "parse_status": "extracting",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()

        # Process lecture and get ID
        pages_content, page_count = processor.extract_pdf_content()
        # update the status of the lecture in the database
        supabase.table("lectures").update({
            "parse_status": "uploading",
            "pages": page_count,
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()

        processor.upload_to_supabase(pages_content, class_id, lecture_id, supabase)
        
        if start_parse:
            # Process the lecture file using the task queue
            await request.app.state.add_task(parse_lecture_internally, lecture_id, response_url)
        
        return {
            "status": "success",
            "message": "Lecture file received and processing started",
            "lecture_id": lecture_id,
            "file_path": file_path
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing lecture: {str(e)}")
        print(traceback.format_exc())

        if lecture_id:
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
    title: str = Form(None),
    response_url: str = Form(None),
    start_parse: bool = Form(False)
):
    """
    Process a textbook/reading file - can be called with either an uploaded file or a file path.
    
    Parameters:
    - file: The uploaded textbook file (optional)
    - file_path: Path to an existing textbook file (optional)
    - class_id: Class ID
    - title: Optional title for the textbook
    - response_url: Optional response url for the textbook
    
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
        
        # get existing textbooks to find the textbook_number
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).execute()
        existing_textbooks = textbooks_response.data
        textbook_number = len(existing_textbooks) + 1

        # create textbook in supabase
        textbook_response = supabase.table("textbooks").insert({
            "class": class_id,
            "title": title or os.path.splitext(filename)[0],
            "textbook_number": textbook_number,
            "response_url": response_url or ""
        }).execute()

        # get the id of the newly created textbook
        textbook_id = textbook_response.data[0]["id"]
        
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
    title: str = Form(None),
    response_url: str = Form(None),
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
        
        # get existing homeworks to find the homework_number
        homeworks_response = supabase.table("homeworks").select("*").eq("class", class_id).execute()
        existing_homeworks = homeworks_response.data
        homework_number = len(existing_homeworks) + 1

        # create homework in supabase
        homework_response = supabase.table("homeworks").insert({
            "class": class_id,
            "title": title or os.path.splitext(filename)[0],
            "homework_number": homework_number,
            "response_url": response_url or ""
        }).execute()
        
        # get the id of the newly created homework
        homework_id = homework_response.data[0]["id"]
        
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

        if homework_id:
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
    profile_id: str = Form(...),
    response_url: str = Form(None),
    start_parse: bool = Form(False)
):
    """
    Process a file - can be called with either an uploaded file or a file path.
    """
    file_id = None
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
            
        # Determine file type based on extension
        file_type = "other"
        ext = os.path.splitext(filename)[1].lower()
        
        if ext in ['.pdf']:
            file_type = "pdf"
        elif ext in ['.mp3', '.wav', '.ogg', '.flac', '.m4a']:
            file_type = "audio"
        elif ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
            file_type = "video"
        elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
            file_type = "image"

        # Determine file length
        file_length = 1
        if file_type in ["audio", "video"]:
            try:
                from pydub import AudioSegment
                media = AudioSegment.from_file(file_path)
                file_length = len(media) / 1000  # Convert to seconds
                # find how many 30 second chunks (rounded up)
                file_length = math.ceil(file_length / 30)
            except Exception as e:
                logger.warning(f"Could not determine media length: {str(e)}")
        else:
            file_length = 1

        # Create file record in supabase
        file_response = supabase.table("files").insert({
            "class": class_id,
            "title": filename,
            "profile": profile_id,
            "type": file_type,
            "length": file_length,
            "parse_status": "idle",
            "response_url": response_url or ""
        }).execute()
        
        # get the id of the newly created file
        file_id = file_response.data[0]["id"]
        
        # Create file directory
        file_dir = os.path.join(COURSES_DIR, class_id, "files", file_id)
        os.makedirs(file_dir, exist_ok=True)
        
        # Determine file path and save if needed
        if not file_path:
            # This is an external upload
            # Save the uploaded file
            file_path = os.path.join(file_dir, filename)
            await file.seek(0)
            
            async with aiofiles.open(file_path, "wb") as f:
                content = await file.read()
                await f.write(content)
        else:
            # This is an internal call with an existing file
            # Copy the file to the file directory
            destination_path = os.path.join(file_dir, filename)
            
            # Create directory if it doesn't exist
            os.makedirs(os.path.dirname(destination_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, destination_path)
            file_path = destination_path
        
        # Update file status to extracting
        supabase.table("files").update({
            "parse_status": "extracting",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", file_id).execute()
        
        # Initialize file extractor
        processor = FileExtractor(file_path)
        
        # Extract content from the file
        file_content = processor.extract_file_content()
        
        # Update file status to uploading
        supabase.table("files").update({
            "parse_status": "uploading",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", file_id).execute()
        
        # Upload content to Supabase
        processor.upload_to_supabase(file_content, class_id, file_id, supabase)
        
        # Process the file using the task queue if response_url is provided
        if start_parse:
            await request.app.state.add_task(parse_file_internally, file_id, response_url)
        
        return {
            "status": "success",
            "message": "File received and processing started",
            "file_id": file_id,
            "file_path": file_path,
            "file_type": file_type
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing file: {str(e)}")
        print(traceback.format_exc())

        if file_id:
            # update the status of the file in the database
            supabase.table("files").update({
                "parse_status": "error",
                "parse_error": str(e),
            }).eq("id", file_id).execute()
        
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to process file: {str(e)}"
            }
        )
    
    


# Helper functions for internal processing
async def process_lecture_internally(file_path: str, class_id: str, response_url: str, start_parse: bool):
    """Helper function to call the lecture endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "file_path": file_path,
        "class_id": class_id,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url,
        "start_parse": start_parse
    }
    
    # Call the endpoint
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{response_url}/upload/lecture", data=form_data)
        print(f"Lecture processing response: {response.text}")

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


async def process_textbook_internally(file_path: str, class_id: str, response_url: str, start_parse: bool):
    """Helper function to call the textbook endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "file_path": file_path,
        "class_id": class_id,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url,
        "start_parse": start_parse
    }
    
    # Call the endpoint
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{response_url}/upload/textbook", data=form_data)
        print(f"Textbook processing response: {response.text}")

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


async def process_homework_internally(file_path: str, class_id: str, response_url: str, start_parse: bool):
    """Helper function to call the homework endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "file_path": file_path,
        "class_id": class_id,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url,
        "start_parse": start_parse
    }
    
    # Call the endpoint
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{response_url}/upload/homework", data=form_data)
        print(f"Homework processing response: {response.text}")

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