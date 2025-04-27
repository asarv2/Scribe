from typing import List, Optional, Tuple
import google.generativeai as genai
from google.generativeai.types import File
import datetime
import logging
from dateutil import parser
import os
import traceback
import time

logger = logging.getLogger(__name__)

class GoogleFiles:
    def __init__(self, file_ids: List[str], document_ids: List[str], supabase_client):
        """
        Initialize GoogleFiles with file IDs and fetch all necessary data from Supabase
        
        Args:
            file_ids: List[str] - The IDs of the files to process
            document_ids: List[str] - The IDs of the documents to process
            supabase_client - The Supabase client for database and storage operations
        """
        self.supabase = supabase_client
        
        # Fetch file data from Supabase
        self.files_data = self._fetch_files_data(file_ids)
        self.documents_data = self._fetch_documents_data(document_ids)
    
    def _fetch_files_data(self, file_ids: List[str]) -> List[dict]:
        """Fetch file data from Supabase for the given file IDs"""
        try:
            if not file_ids:
                return []

            # Get file information
            files_response = self.supabase.table("files").select(
                "id", "class", "type", "extension"
            ).in_("id", file_ids).execute()
            
            if not files_response.data:
                logger.warning(f"No files found for IDs: {file_ids}")
                return []
            
            files_data = []
            
            # For each file, get the Google file information
            google_response = self.supabase.table("google").select(
                "file", "google_id", "expires_at"
            ).in_("file", file_ids).eq("deleted", False).order("created_at", desc=True).limit(1).execute()
            
            if google_response.data and len(google_response.data) > 0:
                for google_file in google_response.data:
                    file_id = google_file.get("file")
                    google_id = google_file.get("google_id")
                    expires_at = google_file.get("expires_at")
                    
                    file_data = next((f for f in files_response.data if f["id"] == file_id), None)
                    
                    if file_data:
                        files_data.append({
                            "file_id": file_data["id"],
                            "class_id": file_data["class"],
                            "extension": file_data["extension"],
                            "google_id": google_id,
                            "expires_at": expires_at
            })
            
            return files_data
            
        except Exception as e:
            logger.error(f"Error fetching file data: {str(e)}")
            return []
    
    def _fetch_documents_data(self, document_ids: List[str]) -> List[dict]:
        """Fetch document data from Supabase for the given document IDs"""
        try:
            if not document_ids:
                logger.info("No document IDs provided")
                return []

            # Get document information
            documents_response = self.supabase.table("documents").select(
                "id", "class", "file", "extension"
            ).in_("id", document_ids).execute()
            
            if not documents_response.data:
                logger.warning(f"No documents found for IDs: {document_ids}")
                return []
            
            documents_data = []
            
            google_response = self.supabase.table("google").select(
                "document", "google_id", "expires_at"
            ).in_("document", document_ids).eq("deleted", False).order("created_at", desc=True).limit(1).execute()

            for document_id in document_ids:
                google_document = next((f for f in google_response.data if f["document"] == document_id), None)
                document_data = next((f for f in documents_response.data if f["id"] == document_id), None)
                
                if document_data:
                    document_id = document_data["id"]
                    file_id = document_data["file"]
                    class_id = document_data["class"]
                    extension = document_data["extension"]

                    if google_document:
                        google_id = google_document.get("google_id")
                        expires_at = google_document.get("expires_at")
                        documents_data.append({
                            "file_id": file_id,
                            "document_id": document_id,
                            "class_id": class_id,
                            "google_id": google_id,
                            "expires_at": expires_at,
                            "extension": extension
                        })
                    else:
                        documents_data.append({
                            "file_id": file_id,
                            "document_id": document_id,
                            "class_id": class_id,
                            "google_id": None,
                            "expires_at": None,
                            "extension": extension
                        })
            
            return documents_data

        except Exception as e:
            logger.error(f"Error fetching document data: {str(e)}")
            logger.error(traceback.format_exc())
            return []
    
    def get_files(self) -> List[str]:
        """Get all files, re-uploading any that have expired"""
        google_file_ids = []
        now = datetime.datetime.now(datetime.timezone.utc)
        
        for file_data in self.files_data:
            file_id = file_data["file_id"]
            google_id = file_data["google_id"]
            expires_at = file_data["expires_at"]
            
            # Check if the file has expired or doesn't have a Google ID
            is_expired = False
            if not google_id:
                is_expired = True
            elif expires_at:
                try:
                    expiration_time = parser.parse(expires_at)
                    # give an hour grace period
                    is_expired = now >= expiration_time - datetime.timedelta(hours=1)
                except Exception as e:
                    logger.error(f"Error parsing expiration time: {str(e)}")
                    is_expired = True  # Assume expired if we can't parse the date
            
            if is_expired:
                logger.info(f"File {file_id} has expired or needs uploading. Uploading from Supabase.")
                if google_id:
                    # Mark the existing Google file as deleted
                    self._mark_google_file_as_deleted(file_id)
                
                # Upload from Supabase
                new_file = self._upload_file_from_supabase(
                    file_id, 
                    file_data["class_id"], 
                    file_data["extension"]
                )
                if new_file:
                    # Add the new Google file ID to the list
                    google_file_ids.append(new_file.name)
            else:
                google_file_ids.append(google_id)
        return google_file_ids
    

    def get_documents(self) -> List[str]:
        """Get all documents, re-uploading any that have expired"""
        google_document_ids = []
        now = datetime.datetime.now(datetime.timezone.utc)
        
        for document_data in self.documents_data:
            file_id = document_data["file_id"]
            class_id = document_data["class_id"]
            document_id = document_data["document_id"]
            google_id = document_data["google_id"]
            expires_at = document_data["expires_at"]
            extension = document_data["extension"]
            
            # Check if the document has expired or doesn't have a Google ID
            is_expired = False
            if not google_id:
                logger.info(f"Document {document_id} has no Google ID, needs upload")
                is_expired = True
            elif expires_at:
                try:
                    expiration_time = parser.parse(expires_at)
                    # give an hour grace period
                    is_expired = now >= expiration_time - datetime.timedelta(hours=1)
                except Exception as e:
                    logger.error(f"Error parsing expiration time: {str(e)}")
                    is_expired = True  # Assume expired if we can't parse the date
            
            if is_expired:
                if google_id:
                    # Mark the existing Google file as deleted
                    self._mark_google_file_as_deleted(document_id, is_document=True)
                
                
                # Upload from Supabase
                new_file = self._upload_document_from_supabase(
                    file_id, 
                    document_id,
                    class_id, 
                    extension
                )
                
                if new_file:
                    # Add the new Google file ID to the list
                    google_document_ids.append(new_file.name)
                else:
                    logger.error(f"Failed to upload document {document_id} to Google")
            else:
                google_document_ids.append(google_id)
        
        return google_document_ids
        

    def _mark_google_file_as_deleted(self, id_value: str, is_document: bool = False) -> None:
        """Mark Google file or document entries as deleted in the database"""
        try:
            if is_document:
                self.supabase.table("google").update(
                    {"deleted": True}
                ).eq("document", id_value).execute()
            else:
                self.supabase.table("google").update(
                    {"deleted": True}
                ).eq("file", id_value).execute()
        except Exception as e:
            logger.error(f"Error marking Google entries as deleted: {str(e)}")


    def _upload_document_from_supabase(self, file_id: str, document_id: str, class_id: str, extension: str) -> Optional[File]:
        """Upload document from Supabase to Google"""
        try:
            # Create a temporary directory if it doesn't exist
            temp_dir = os.path.join(os.getcwd(), "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            # Create the file_id subdirectory
            file_dir = os.path.join(temp_dir, file_id)
            os.makedirs(file_dir, exist_ok=True)
            
            # Construct the storage path
            storage_path = f"{class_id}/{file_id}/{document_id}.{extension}"
            local_path = os.path.join(temp_dir, f"{file_id}/{document_id}.{extension}")
            
            # Download the file from Supabase
            try:
                res = self.supabase.storage.from_("files").download(storage_path)
                
                with open(local_path, 'wb+') as f:
                    f.write(res)
                
                # Check if file exists and has content
                file_size = os.path.getsize(local_path)
                if file_size == 0:
                    logger.error("Downloaded file is empty!")
                    
            except Exception as download_error:
                logger.error(f"Error downloading file: {str(download_error)}")
                logger.error(traceback.format_exc())
                return None
            
            # Determine MIME type based on extension
            mime_type = self._get_mime_type(extension)
            
            # Upload to Google
            try:
                with open(local_path, 'rb') as f:
                    media_file = genai.upload_file(f, mime_type=mime_type)
                    
                # Wait for the file to become active
                media_file = self._wait_for_file_activation(media_file)
                if not media_file:
                    logger.error(f"File {document_id} failed to activate within timeout period")
                    return None
                
            except Exception as upload_error:
                logger.error(f"Error uploading to Google: {str(upload_error)}")
                logger.error(traceback.format_exc())
                return None
            
            # Extract file ID and expiration from response
            google_file_id = media_file.name
            expires_at = media_file.expiration_time
            
            # Save to the google table
            try:
                insert_response = self.supabase.table("google").insert({
                    "document": document_id,
                    "google_id": google_file_id,
                    "expires_at": expires_at.isoformat()
                }).execute()
            except Exception as db_error:
                logger.error(f"Error saving to database: {str(db_error)}")
                logger.error(traceback.format_exc())
            
            # Clean up the temporary file
            try:
                os.remove(local_path)
            except Exception as cleanup_error:
                logger.error(f"Error cleaning up file: {str(cleanup_error)}")
            
            return media_file
            
        except Exception as e:
            logger.error(f"Error in _upload_document_from_supabase: {str(e)}")
            logger.error(traceback.format_exc())
            return None
    
    def _upload_file_from_supabase(self, file_id: str, class_id: str, extension: str) -> Optional[File]:
        """
        Download file from Supabase and upload to Google
        
        Args:
            file_id: The file ID
            class_id: The class ID
            extension: The file extension
            
        Returns:
            The new Google File object or None if failed
        """
        try:
            # Create a temporary directory if it doesn't exist
            temp_dir = os.path.join(os.getcwd(), "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            # Construct the storage path
            storage_path = f"{class_id}/{file_id}.{extension}"
            local_path = os.path.join(temp_dir, f"{file_id}.{extension}")
            
            # Download the file from Supabase
            with open(local_path, 'wb+') as f:
                res = self.supabase.storage.from_("files").download(storage_path)
                f.write(res)
            
            # Determine MIME type based on extension
            mime_type = self._get_mime_type(extension)
            
            # Upload to Google
            with open(local_path, 'rb') as f:
                media_file = genai.upload_file(f, mime_type=mime_type)
                
            # Wait for the file to become active
            media_file = self._wait_for_file_activation(media_file)
            if not media_file:
                logger.error(f"File {file_id} failed to activate within timeout period")
                return None
            
            # Extract file ID and expiration from response
            google_file_id = media_file.name
            expires_at = media_file.expiration_time
            
            # Save to the google table
            self.supabase.table("google").insert({
                "file": file_id,
                "google_id": google_file_id,
                "expires_at": expires_at.isoformat()
            }).execute()
            
            # Clean up the temporary file
            os.remove(local_path)
            
            return media_file
            
        except Exception as e:
            logger.error(f"Error uploading file to Google: {str(e)}")
            return None
    
    def _get_mime_type(self, extension: str) -> str:
        """Determine MIME type based on file extension"""
        # Make sure extension has a leading dot
        if not extension.startswith('.'):
            extension = f".{extension}"
        
        extension = extension.lower()
        mime_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.txt': 'text/plain',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }
        
        mime_type = mime_types.get(extension, 'application/octet-stream')
        return mime_type

    def _wait_for_file_activation(self, file: File, max_attempts: int = 10, base_delay: float = 0.5) -> Optional[File]:
        """
        Poll until the Google file becomes active
        
        Args:
            file: The Google File object
            max_attempts: Maximum number of polling attempts
            base_delay: Base delay for exponential backoff in seconds
            
        Returns:
            The active File object or None if activation failed
        """
        import time
        
        file_id = file.name
        logger.info(f"Waiting for Google file {file_id} to become active...")
        
        for attempt in range(max_attempts):
            try:
                # Calculate backoff with exponential increase
                backoff = base_delay * (2 ** attempt)
                
                # Check if the file is active by getting its details
                file_info = genai.get_file(file_id)
                
                # Check for FAILED state first to abort early
                if hasattr(file_info, 'state'):
                    if file_info.state == 'FAILED' or getattr(file_info.state, 'name', '') == 'FAILED':
                        logger.error(f"Google file {file_id} failed to process")
                        return None
                    
                    # Check for ACTIVE state
                    if file_info.state == 'ACTIVE' or getattr(file_info.state, 'name', '') == 'ACTIVE':
                        logger.info(f"Google file {file_id} is now active (attempt {attempt+1})")
                        return file_info
                    
                    # Still processing
                    logger.info(f"Google file {file_id} not yet active, current state: {getattr(file_info.state, 'name', str(file_info.state))} (attempt {attempt+1})")
                else:
                    logger.warning(f"Google file {file_id} has no state attribute (attempt {attempt+1})")
                
                # Wait with exponential backoff before next attempt
                logger.info(f"Waiting {backoff:.2f}s before next check...")
                time.sleep(backoff)
                
            except Exception as e:
                logger.warning(f"Error checking file status: {str(e)} (attempt {attempt+1})")
                # Still use backoff on errors
                time.sleep(backoff)
        
        logger.error(f"Google file {file_id} failed to become active after {max_attempts} attempts")
        return None