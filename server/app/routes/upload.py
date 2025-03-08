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

load_dotenv()
router = APIRouter()


@router.post("/course")
async def upload_course(
    request: Request,
    file: UploadFile = File(...), 
    course_id: str = Form(...),
    course_descriptor: str = Form(...),
    filename: str = Form(...),
    syllabus_file: UploadFile = File(None),
    syllabus_filename: str = Form(None),
    response_url: str = Form(None),
    profile_id: str = Form(None)
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
    - response_url: Optional response url for the course
    - profile_id: Profile ID
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

    # Save the syllabus file
    if syllabus_file and syllabus_filename:
        syllabus_path = os.path.join(extract_folder, syllabus_filename)
        await syllabus_file.seek(0)
        with open(syllabus_path, "wb") as f:
            f.write(await syllabus_file.read())
            
        # Add syllabus info to the result
        result["syllabus_stored_at"] = f"/files/courses/{class_id}/base/{syllabus_filename}"
    
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
        
        # Process the course files to categorize them
        try:
            api_key = os.getenv("GEMINI_API_KEY")
            course_processor = InitialCourseProcessor(api_key, extract_folder, class_id)
            course_organization = course_processor.process_course()
            
            # Add organization info to the result
            result["course_organization"] = course_organization
            
            # Get the list of new files
            new_files = course_organization.get("new_files", [])
            
            # Process each categorized file only if it's new
            # Process lectures
            for lecture_path in course_organization.get("categories", {}).get("lectures", []):
                # Fix the path if needed
                base_name = os.path.basename(extract_folder)
                if lecture_path.startswith(base_name):
                    lecture_path = lecture_path[len(base_name):].lstrip('/')
                
                full_path = os.path.join(extract_folder, lecture_path)

                # make sure the file is a pdf
                if not full_path.endswith('.pdf'):
                    continue

                if os.path.exists(full_path) and full_path in new_files:
                    print(f"Processing new lecture: {full_path}")
                    # Add to task queue instead of background tasks
                    await request.app.state.add_task(
                        process_lecture_internally,
                        full_path,
                        class_id,
                        response_url
                    )
            
            # Process textbooks/readings
            for reading_path in course_organization.get("categories", {}).get("readings", []):
                # Fix the path if needed
                base_name = os.path.basename(extract_folder)
                if reading_path.startswith(base_name):
                    reading_path = reading_path[len(base_name):].lstrip('/')
                
                full_path = os.path.join(extract_folder, reading_path)
                # make sure the file is a pdf
                if not full_path.endswith('.pdf'):
                    continue

                if os.path.exists(full_path) and full_path in new_files:
                    print(f"Processing new reading: {full_path}")
                    # Add to task queue
                    await request.app.state.add_task(
                        process_textbook_internally,
                        full_path,
                        class_id,
                        response_url
                    )
            
            # Process assignments/homework
            for assignment_path in course_organization.get("categories", {}).get("assignments", []):
                # Fix the path if needed
                base_name = os.path.basename(extract_folder)
                if assignment_path.startswith(base_name):
                    assignment_path = assignment_path[len(base_name):].lstrip('/')
                
                full_path = os.path.join(extract_folder, assignment_path)
                # make sure the file is a pdf, .txt or .docx
                if not full_path.endswith('.pdf') and not full_path.endswith('.txt') and not full_path.endswith('.docx'):
                    continue

                if os.path.exists(full_path) and full_path in new_files:
                    print(f"Processing new assignment: {full_path}")
                    # Add to task queue
                    await request.app.state.add_task(
                        process_homework_internally,
                        full_path,
                        class_id,
                        response_url
                    )
        
        except Exception as e:
            print(f"Error categorizing course files: {str(e)}")
            # Continue even if categorization fails

        
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

@router.post("/lecture")
async def process_lecture(
    request: Request,
    file: UploadFile = File(None),
    file_path: str = Form(None),
    class_id: str = Form(...),
    title: str = Form(None),
    response_url: str = Form(None)
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
    response_url: str = Form(None)
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
    response_url: str = Form(None)
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

# Helper functions for internal processing
async def process_lecture_internally(file_path: str, class_id: str, response_url: str):
    """Helper function to call the lecture endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "file_path": file_path,
        "class_id": class_id,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url
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


async def process_textbook_internally(file_path: str, class_id: str, response_url: str):
    """Helper function to call the textbook endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "file_path": file_path,
        "class_id": class_id,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url
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


async def process_homework_internally(file_path: str, class_id: str, response_url: str):
    """Helper function to call the homework endpoint internally."""
    import httpx
    
    # Prepare form data
    form_data = {
        "file_path": file_path,
        "class_id": class_id,
        "title": os.path.splitext(os.path.basename(file_path))[0],
        "response_url": response_url
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