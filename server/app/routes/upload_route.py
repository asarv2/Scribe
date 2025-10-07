import json
from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
import os
import uuid
import shutil
from app.extensions import get_supabase
from dotenv import load_dotenv

import logging
import magic

from app.services.upload.upload import FileProcessor

load_dotenv()
router = APIRouter()

logger = logging.getLogger(__name__)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(os.environ.get("DATA_DIR", "/tmp"), "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)


@router.options("/tus")
async def tus_options(request: Request):
    """Handle OPTIONS request for tus protocol"""
    return Response(
        status_code=204,
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload,parallel-upload",
            "Tus-Max-Size": "1073741824",  # 1GB max file size
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS, DELETE",
            "Access-Control-Allow-Headers": "*, Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type, Upload-Concat, Authorization, Content-Length",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location, Tus-Version, Tus-Extension, Tus-Max-Size",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post("/tus")
async def tus_creation(request: Request):
    """Handle POST request for tus protocol - create upload"""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Get upload length - required, no more deferred length
    upload_length = request.headers.get("Upload-Length")

    # Upload-Length must be present
    if not upload_length:
        return Response(status_code=400, content="Missing Upload-Length header")

    # Check for parallel upload
    is_partial = False
    is_final = False
    upload_concat = request.headers.get("Upload-Concat", "")

    if upload_concat.startswith("partial"):
        is_partial = True
    elif upload_concat.startswith("final"):
        is_final = True
        # Extract partial upload URLs
        partial_urls = upload_concat.replace("final;", "").split(" ")

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

    # Save upload info
    with open(os.path.join(upload_dir, "info"), "w") as f:
        f.write(f"length:{upload_length}\noffset:0")
        if is_partial:
            f.write("\npartial:true")
        elif is_final:
            f.write("\nfinal:true")
            # Save partial URLs
            with open(os.path.join(upload_dir, "partial_urls"), "w") as pf:
                pf.write("\n".join(partial_urls))

    # Use the base URL from metadata if available, otherwise use request.base_url
    base_url = metadata.get("baseUrl", "")
    if not base_url:
        # Fallback to using headers
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "http")
        forwarded_host = request.headers.get(
            "X-Forwarded-Host", request.headers.get("Host", "localhost:8000")
        )
        base_url = f"{forwarded_proto}://{forwarded_host}"

    if not base_url.endswith("/"):
        base_url += "/"

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
            if is_partial:
                f.write("\npartial:true")
            elif is_final:
                f.write("\nfinal:true")

        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(offset),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            },
        )

    return Response(
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        },
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
        status_code=204,
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload,parallel-upload",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "HEAD, PATCH, OPTIONS, DELETE",
            "Access-Control-Allow-Headers": "*, Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type, Upload-Concat, Authorization, Content-Length",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location, Tus-Version, Tus-Extension, Upload-Defer-Length",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post("/tus/finalize")
async def finalize_upload(request: Request):
    """Finalize an upload and process the file"""
    try:
        supabase_client = get_supabase()
        # Parse request body
        body = await request.json()
        file_id = body.get("fileId")

        if not file_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing fileId parameter"},
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
                content={
                    "status": "error",
                    "message": f"Upload with fileId {file_id} not found",
                },
            )

        # Check if this is a final upload that needs to be concatenated
        info_path = os.path.join(upload_dir, "info")
        is_final = False
        if os.path.exists(info_path):
            with open(info_path, "r") as f:
                for line in f:
                    if line.strip() == "final:true":
                        is_final = True
                        break

        file_path = os.path.join(upload_dir, "file")

        # If this is a final upload, concatenate the partial uploads
        if is_final:
            partial_urls_path = os.path.join(upload_dir, "partial_urls")
            if os.path.exists(partial_urls_path):
                with open(partial_urls_path, "r") as f:
                    partial_urls = f.read().strip().split("\n")

                # Extract upload IDs from URLs
                partial_ids = []
                for url in partial_urls:
                    parts = url.strip().split("/")
                    if parts:
                        partial_ids.append(parts[-1])

                # Concatenate partial files
                with open(file_path, "wb") as outfile:
                    for partial_id in partial_ids:
                        partial_path = os.path.join(TUS_UPLOADS_DIR, partial_id, "file")
                        if os.path.exists(partial_path):
                            with open(partial_path, "rb") as infile:
                                outfile.write(infile.read())

        # Check if file exists and has content
        if not os.path.exists(file_path):
            logger.error(f"Upload file is missing: {file_path}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Upload file is missing"},
            )

        # Check file size and content
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            logger.error(f"Upload file is empty: {file_path}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Upload file is empty"},
            )

        # Debug: Check file content type
        mime = magic.Magic(mime=True)
        detected_mime = mime.from_file(file_path)
        logger.info(
            f"File {file_id} detected MIME type: {detected_mime}, size: {file_size} bytes"
        )

        # Read metadata
        with open(os.path.join(upload_dir, "metadata.json"), "r") as f:
            metadata = json.load(f)

        # Extract necessary metadata
        filename = metadata.get("filename", f"file-{file_id}")
        class_id = metadata.get("classId")

        if not class_id:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Missing required metadata (classId)",
                },
            )

        # Initialize the FileProcessor
        file_processor = FileProcessor(supabase_client)

        # Process the uploaded file
        result, message = await file_processor.process_uploaded_file(
            file_path=file_path,
            filename=filename,
            class_id=class_id,
            file_id=file_id,
        )

        # Clean up the TUS upload directory
        try:
            shutil.rmtree(upload_dir)
            logger.info(f"Cleaned up TUS upload directory: {upload_dir}")
        except Exception as cleanup_error:
            logger.warning(
                f"Failed to clean up TUS upload directory: {str(cleanup_error)}"
            )

        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": message, "result": result},
        )

    except Exception as e:
        import traceback

        logger.error(f"Error finalizing upload: {str(e)}")
        logger.error(traceback.format_exc())

        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to process file: {str(e)}"},
        )
