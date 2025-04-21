from typing import List, Optional
import google.generativeai as genai
from google.generativeai.types import File
import datetime
import logging
from dateutil import parser
import os

logger = logging.getLogger(__name__)

class GoogleFiles:
    def __init__(self, file_ids: List[str], supabase_client):
        """
        Initialize GoogleFiles with file IDs and fetch all necessary data from Supabase
        
        Args:
            file_ids: List[str] - The IDs of the files to process
            supabase_client - The Supabase client for database and storage operations
        """
        self.supabase = supabase_client
        
        # Fetch file data from Supabase
        self.files_data = self._fetch_files_data(file_ids)
    
    def _fetch_files_data(self, file_ids: List[str]) -> List[dict]:
        """Fetch file data from Supabase for the given file IDs"""
        try:
            # Get file information
            files_response = self.supabase.table("files").select(
                "id", "class", "type", "extension"
            ).in_("id", file_ids).execute()
            
            if not files_response.data:
                logger.error(f"No files found for IDs: {file_ids}")
                return []
            
            files_data = []
            
            # For each file, get the Google file information
            for file in files_response.data:
                google_response = self.supabase.table("google").select(
                    "google_id", "expires_at"
                ).eq("file", file["id"]).eq("deleted", False).order("created_at", desc=True).limit(1).execute()
                
                google_id = None
                expires_at = None
                
                if google_response.data and len(google_response.data) > 0:
                    google_id = google_response.data[0].get("google_id")
                    expires_at = google_response.data[0].get("expires_at")
                
                files_data.append({
                    "file_id": file["id"],
                    "class_id": file["class"],
                    "extension": file["extension"] or self._get_default_extension(file["type"]),
                    "google_id": google_id,
                    "expires_at": expires_at
                })
            
            return files_data
            
        except Exception as e:
            logger.error(f"Error fetching file data: {str(e)}")
            return []
    
    def _get_default_extension(self, file_type: str) -> str:
        """Get default extension based on file type"""
        type_to_extension = {
            "pdf": ".pdf",
            "image": ".jpg",
            "audio": ".mp3",
            "video": ".mp4",
            "document": ".docx"
        }
        return type_to_extension.get(file_type, "")
    
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
                new_file = self._upload_from_supabase(
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
    
    def _mark_google_file_as_deleted(self, file_id: str) -> None:
        """Mark Google file entries as deleted in the database"""
        try:
            self.supabase.table("google").update(
                {"deleted": True}
            ).eq("file", file_id).execute()
            logger.info(f"Marked Google files for file_id {file_id} as deleted")
        except Exception as e:
            logger.error(f"Error marking Google files as deleted: {str(e)}")
    
    def _upload_from_supabase(self, file_id: str, class_id: str, extension: str) -> Optional[File]:
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
            storage_path = f"{class_id}/{file_id}{extension}"
            local_path = os.path.join(temp_dir, f"{file_id}{extension}")
            
            # Download the file from Supabase
            logger.info(f"Downloading file from Supabase: {storage_path}")
            with open(local_path, 'wb+') as f:
                res = self.supabase.storage.from_("files").download(storage_path)
                f.write(res)
            
            # Determine MIME type based on extension
            mime_type = self._get_mime_type(extension)
            
            # Upload to Google
            logger.info(f"Uploading file to Google: {local_path} ({mime_type})")
            with open(local_path, 'rb') as f:
                media_file = genai.upload_file(f, mime_type=mime_type)
            
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
        return mime_types.get(extension, 'application/octet-stream')