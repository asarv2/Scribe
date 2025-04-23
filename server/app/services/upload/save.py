import os
import logging
import io
import json
import magic
from typing import Dict, Any, List, Literal
from datetime import datetime
import google.generativeai as genai

from app.services.upload.models import FileExtractChunk

logger = logging.getLogger(__name__)

class FileSaver:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.mime = magic.Magic(mime=True)
    
    def save_file_metadata(self, file_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Save file metadata to database
        
        Args:
            file_id: File ID
            metadata: Dictionary with metadata to save
            
        Returns:
            Updated file data
        """
        try:
            # Update file record in database
            response = self.supabase.table("files").update(metadata).eq("id", file_id).execute()
            
            if response.data:
                logger.info(f"Updated file metadata for {file_id}")
                return response.data[0]
            else:
                logger.error(f"Failed to update file metadata for {file_id}")
                return {}
                
        except Exception as e:
            logger.error(f"Error saving file metadata: {str(e)}")
            return {}
    
    def save_document(self, class_id: str, file_id: str, extract_chunk: FileExtractChunk) -> str:
        """
        Save a document to database and storage
        
        Args:
            class_id: Class ID
            file_id: File ID
            extract_chunk: FileExtractChunk to save
            
        Returns:
            Document ID
        """
        try:
            logger.info(f"Saving document: type={extract_chunk.type}, has_image={bool(extract_chunk.image_data)}, start_time={extract_chunk.start_time}, end_time={extract_chunk.end_time}")
            
            # construct document data, depending on the type of file
            if extract_chunk.type == 'pdf_page':
                document_data = {
                    "file": file_id,
                    "text": extract_chunk.text,
                    "page": extract_chunk.page,
                    "class": class_id,
                    "extension": "png"
                }
            elif extract_chunk.type == 'audio_chunk':
                # Ensure start_time and end_time are always included for audio/video
                document_data = {
                    "file": file_id,
                    "text": extract_chunk.text,
                    "page": extract_chunk.page,
                    "start_time": extract_chunk.start_time if extract_chunk.start_time is not None else 0,
                    "end_time": extract_chunk.end_time if extract_chunk.end_time is not None else 0,
                    "class": class_id,
                    "extension": "wav" # we upload audio chunks as wav, and also save the waveform image as a png
                }
            elif extract_chunk.type == 'video_chunk':
                document_data = {
                    "file": file_id,
                    "text": extract_chunk.text,
                    "page": extract_chunk.page,
                    "start_time": extract_chunk.start_time if extract_chunk.start_time is not None else 0,
                    "end_time": extract_chunk.end_time if extract_chunk.end_time is not None else 0,
                    "class": class_id,
                    "extension": "mp4" # we upload video chunks as mp4 and also save preview images as png
                }
            elif extract_chunk.type == 'image':
                document_data = {
                    "file": file_id,
                    "text": extract_chunk.text or "",
                    "page": extract_chunk.page or 1,
                    "class": class_id,
                    "extension": "png"
                }
                logger.info("Processing image document")
            elif extract_chunk.type == 'text':
                document_data = {
                    "file": file_id,
                    "text": extract_chunk.text or "",
                    "page": extract_chunk.page or 1,
                    "class": class_id,
                    "extension": "png" # we upload text images as png
                }
            else:
                document_data = {
                    "file": file_id,
                    "text": extract_chunk.text or "",
                    "page": extract_chunk.page or 1,
                    "class": class_id,
                    "extension": "png" # we upload other files as png
                }

            # Insert document record
            logger.info(f"Inserting document record for file {file_id}: {document_data}")
            document_response = self.supabase.table('documents').insert(document_data).execute()
            
            if not document_response.data:
                logger.error(f"Failed to insert document for file {file_id}")
                return None
                
            document_id = document_response.data[0]['id']
            logger.info(f"Document record created: {document_id}")
            
            # Handle different types of media to upload
            if extract_chunk.image_data:
                # Upload image to storage if provided
                storage_path = f"{class_id}/{file_id}/{document_id}.png"
                logger.info(f"Uploading image ({len(extract_chunk.image_data)} bytes) to {storage_path}")
                
                try:
                    upload_result = self.supabase.storage.from_("files").upload(
                        path=storage_path,
                        file=extract_chunk.image_data,
                        file_options={"content-type": "image/png"}
                    )
                    logger.info(f"Image upload successful: {upload_result}")
                except Exception as upload_error:
                    logger.error(f"Image upload failed: {str(upload_error)}")
            else:
                logger.warning(f"No image provided for document {document_id}")
            
            # Upload video chunk if provided
            if extract_chunk.video_chunk_path and os.path.exists(extract_chunk.video_chunk_path):
                storage_path = f"{class_id}/{file_id}/{document_id}.mp4"
                logger.info(f"Uploading video chunk from {extract_chunk.video_chunk_path} to {storage_path}")
                
                try:
                    with open(extract_chunk.video_chunk_path, 'rb') as f:
                        upload_result = self.supabase.storage.from_("files").upload(
                            path=storage_path,
                            file=f,
                            file_options={"content-type": "video/mp4"}
                        )
                    logger.info(f"Video chunk upload successful: {upload_result}")
                except Exception as upload_error:
                    logger.error(f"Video chunk upload failed: {str(upload_error)}")
            else:
                logger.warning(f"No video chunk provided for document {document_id}")
            
            # Upload audio chunk if provided
            if extract_chunk.audio_chunk_path and os.path.exists(extract_chunk.audio_chunk_path):
                storage_path = f"{class_id}/{file_id}/{document_id}.wav"
                logger.info(f"Uploading audio chunk from {extract_chunk.audio_chunk_path} to {storage_path}")
                
                try:
                    with open(extract_chunk.audio_chunk_path, 'rb') as f:
                        upload_result = self.supabase.storage.from_("files").upload(
                            path=storage_path,
                            file=f,
                            file_options={"content-type": "audio/wav"}
                        )
                    logger.info(f"Audio chunk upload successful: {upload_result}")
                except Exception as upload_error:
                    logger.error(f"Audio chunk upload failed: {str(upload_error)}")
            else:
                logger.warning(f"No audio chunk provided for document {document_id}")
            
            return document_id
            
        except Exception as e:
            logger.error(f"Error saving document: {str(e)}")
            return None
    
    def save_file_to_gemini(self, file_id: str, file_path: str) -> str:
        """
        Upload a file to Gemini API
        
        Args:
            file_id: File ID
            file_path: Path to the file
            
        Returns:
            Gemini file ID or None if failed
        """
        try:
            # Detect MIME type if not provided
            mime_type = self.mime.from_file(file_path)
            
            logger.info(f"Uploading to Gemini: {file_path} ({mime_type})")
            
            # Upload file to Gemini
            with open(file_path, 'rb') as f:
                media_file = genai.upload_file(f, mime_type=mime_type)
            
            # Extract file ID from response
            google_file_id = media_file.name
            expires_at = media_file.expiration_time
            
            # saving in the google table
            self.supabase.table("google").insert({
                "file": file_id,
                "google_id": google_file_id,
                "expires_at": expires_at.isoformat()
            }).execute()
            
        except Exception as e:
            logger.error(f"Error uploading to Gemini: {str(e)}")
            return None
        
    def save_file_to_supabase(self, class_id: str, file_id: str, file_path: str) -> str:
        """
        Save a file to Supabase storage using S3 protocol
        
        Args:
            class_id: Class ID
            file_id: File ID
            file_path: Path to the file
            file_type: Type of file (pdf, audio, video, image, other)
            
        Returns:
            Storage path if successful, None if failed
        """
        try:
            # Detect MIME type if not provided
            mime_type = self.mime.from_file(file_path)
            
            # Get file extension from path
            _, file_extension = os.path.splitext(file_path)
            
            # For text files, ensure we use .txt extension
            if mime_type == 'text/plain' and file_extension.lower() != '.txt':
                file_extension = '.txt'
            
            # Create storage path
            storage_path = f"{class_id}/{file_id}{file_extension}"
            logger.info(f"Uploading file to Supabase storage: {storage_path} ({mime_type})")
            
            # Get file size to determine upload method
            file_size = os.path.getsize(file_path)
            
            # For smaller files (< 100MB), use standard upload
            if file_size < 100 * 1024 * 1024:  # 100MB threshold
                with open(file_path, 'rb') as f:
                    upload_result = self.supabase.storage.from_("files").upload(
                        path=storage_path,
                        file=f,
                        file_options={"content-type": mime_type}
                    )
                logger.info(f"Standard upload successful: {upload_result}")
            else:
                # For larger files, use the multipart upload via the storage API
                # The Supabase client handles multipart uploads automatically for large files
                with open(file_path, 'rb') as f:
                    upload_result = self.supabase.storage.from_("files").upload(
                        path=storage_path,
                        file=f,
                        file_options={
                            "content-type": mime_type,
                            "x-upsert": "true"  # Overwrite if exists
                        }
                    )
                logger.info(f"Multipart upload successful: {upload_result}")
            
            return storage_path
            
        except Exception as e:
            logger.error(f"Error uploading file to Supabase storage: {str(e)}")
            return None