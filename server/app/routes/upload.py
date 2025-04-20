import math
import re
import json
from typing import Union, Literal
from fastapi import APIRouter, File, UploadFile, Form, Request, BackgroundTasks, Response, HTTPException, Body
from fastapi.responses import JSONResponse
import os
import uuid
import zipfile
import shutil
from datetime import datetime
import aiofiles
from app.extensions import COURSES_DIR, supabase
from dotenv import load_dotenv

from app.services.upload.main import FileExtractor
import google.generativeai as genai
import traceback

from app.routes.parse import parse_file, ParseRequest

import logging
import tempfile
from urllib.parse import unquote
import magic

from app.services.upload.compress import compress_video_to_webm, split_media_into_chunks

load_dotenv()
router = APIRouter()

logger = logging.getLogger(__name__)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(os.environ.get("DATA_DIR", "/tmp"), "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)

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
    - start_parse: Whether to start parsing the file
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
            
            # Only copy if source and destination are different
            if os.path.abspath(file_path) != os.path.abspath(final_file_path):
                shutil.copy2(file_path, final_file_path)
            # If they're the same file, no need to copy

        # get file from supabase
        file_response = supabase.table("files").select("*").eq("id", file_id).execute()
        file_data = file_response.data[0]

        # get file type from file
        file_type_category = file_data.get("type")
        file_size = file_data.get("file_size")

        # set the status of the file in the database to processing
        supabase.table("files").update({
            "parse_status": "processing",
            "parse_error": "",
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", file_id).execute()

        # For video files, compress to webm first if needed
        compressed_file_path = final_file_path
        if file_type_category == "video":
            compressed_dir = os.path.join(file_dir, "compressed")
            compressed_file_path = compress_video_to_webm(final_file_path, compressed_dir, filename)
            final_file_path = compressed_file_path

        # Check if this is a large media file that needs to be split (>100MB)
        file_size_mb = os.path.getsize(final_file_path) / (1024 * 1024)  # Convert to MB
        is_large_media = (file_type_category in ["video", "audio"]) and file_size_mb > 100

        # Determine file length and process content
        file_length = 1
        file_content = []
        
        if is_large_media:
            logger.info(f"Large {file_type_category} file detected ({file_size_mb:.2f} MB). Processing in chunks.")
            
            # Create a directory for chunks
            chunks_dir = os.path.join(file_dir, "chunks")
            
            try:
                # Split the file into chunks
                chunk_files, file_length = split_media_into_chunks(
                    final_file_path, 
                    chunks_dir, 
                    filename, 
                    file_type_category,
                    file_size_mb
                )
                
                # Update the length of the file
                supabase.table("files").update({
                    "parse_status": "extracting",
                    "parse_error": "",
                    "last_parse_attempt": datetime.now().isoformat(),
                    "length": file_length,
                }).eq("id", file_id).execute()
                
                # Process each chunk
                all_content = []
                base_chunk_num = 0
                
                for i, chunk_path in enumerate(chunk_files):
                    try:
                        logger.info(f"Processing chunk {i+1}/{len(chunk_files)}")
                        
                        # Process this chunk
                        processor = FileExtractor(chunk_path)
                        
                        # Extract content from the chunk
                        chunk_content = processor.extract_file_content()
                        
                        # Ensure each chunk has the correct metadata
                        for item in chunk_content:
                            if item['type'] in ['video_chunk', 'audio_chunk']:
                                # Ensure chunk_file_path is set
                                item['chunk_file_path'] = chunk_path
                                # Set sequential chunk number
                                item['chunk_num'] = i + 1
                        
                        # Upload content to supabase
                        for item in chunk_content:
                            processor.upload_to_supabase(item, class_id, file_id, supabase)
                        
                        all_content.extend(chunk_content)
                        
                    except Exception as chunk_e:
                        logger.error(f"Error processing chunk {i+1}: {str(chunk_e)}")
                        # Continue with next chunk instead of failing completely
                
                # Generate title for video files that start with "video-"
                if file_type_category == "video" and filename.lower().startswith("video-"):
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
                    parse_request = ParseRequest(file_id=file_id)
                    await request.app.state.add_task(parse_file, parse_request)
                
                # Clean up the tus upload directory if it was provided
                if upload_dir and os.path.exists(upload_dir):
                    shutil.rmtree(upload_dir)
                
                return {
                    "status": "success",
                    "message": f"Large {file_type_category} file processed in {len(chunk_files)} chunks",
                    "file_id": file_id,
                    "file_path": final_file_path,
                    "file_type": file_type_category
                }
                
            except Exception as split_e:
                logger.error(f"Error processing {file_type_category} in chunks: {str(split_e)}")
                # Fall back to processing the whole file
                logger.info("Falling back to processing the entire file")
                is_large_media = False
        
        # If not a large media file or splitting failed, process normally
        if not is_large_media:
            # Determine file length for different file types
            if file_type_category in ["audio", "video"]:
                try:
                    from pydub import AudioSegment
                    
                    # Get the length from the file
                    media = AudioSegment.from_file(final_file_path)
                    duration_seconds = len(media) / 1000  # Convert to seconds
                    
                    # For non-large files, we'll just have one chunk
                    file_length = 1
                except Exception as e:
                    logger.warning(f"Could not determine media length: {str(e)}")
                    file_length = 1
            elif file_type_category == "pdf":
                try:
                    import fitz  # PyMuPDF
                    
                    # Open the PDF and get page count
                    with fitz.open(final_file_path) as pdf_document:
                        file_length = len(pdf_document)
                        logger.info(f"PDF has {file_length} pages")
                except Exception as e:
                    logger.warning(f"Could not determine PDF page count: {str(e)}")
                    file_length = 1
            # For other file types, keep default length of 1
            
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
                parse_request = ParseRequest(file_id=file_id)
                await request.app.state.add_task(parse_file, parse_request)
        
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
        class_id = metadata.get("classId")
        start_parse = metadata.get("startParse", "false").lower() == "true"
        
        if not class_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing required metadata (classId or profileId)"}
            )
        
        # Update file record in Supabase
        supabase.table("files").update({
            "parse_status": "uploading",
        }).eq("id", file_id).execute()
        
        # Create file directory
        file_dir = os.path.join(COURSES_DIR, class_id, "files", file_id)
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
            file_id=file_id,
            start_parse=start_parse,
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