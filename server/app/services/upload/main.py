import os
import fitz  # PyMuPDF
from typing import Dict, Any, List, Tuple, Optional
import logging
from dotenv import load_dotenv
import whisper
import torch
from PIL import Image, ImageDraw
import io
import cv2  # For video frame extraction
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.services.upload.compress import FileCompressor
from app.services.upload.save import FileSaver
from app.services.upload.extract import FileExtractor
from app.config import model_manager
from app.services.upload.models import FileExtractChunk

load_dotenv()

logger = logging.getLogger(__name__)

class FileProcessor:
    def __init__(self, supabase_client):
        """Initialize the file processor
        
        Args:
            supabase_client: Supabase client instance
        """
        self.supabase = supabase_client
        self.compressor = FileCompressor()
        self.extractor = FileExtractor()
        self.saver = FileSaver(supabase_client)
        
        # Initialize device for audio/video processing
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device for audio/video processing: {self.device}")
        
        # We'll use the centralized whisper model instead of loading our own
        self.whisper_model = None  # No longer needed, will use model_manager
    
    async def process_uploaded_file(self, file_path: str, filename: str, class_id: str, 
                                   file_id: str) -> Tuple[bool, str]:
        """
        Process an uploaded file
        
        Args:
            file_path: Path to the uploaded file
            filename: Original filename
            class_id: Class ID
            file_id: File ID
            
        Returns:
            Tuple[bool, str] with processing results. First element is a boolean indicating success or failure, second element is a string with the error message if the first element is False.
        """
        try:
            # Update file status to processing
            logger.info(f"Starting to process file: {filename} (ID: {file_id}, Type: {os.path.splitext(filename)[1]})")
            self.saver.save_file_metadata(file_id, {
                "parse_status": "compressing",
                "parse_error": "",
                "last_parse_attempt": datetime.now().isoformat()
            })

            # Clear CUDA cache before starting
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache before processing")
            
            # Get file info from database
            file_response = self.supabase.table("files").select("*").eq("id", file_id).execute()
            if not file_response.data:
                raise ValueError(f"File {file_id} not found in database")
            
            file_data = file_response.data[0]
            file_type = file_data.get("type")
            logger.info(f"File type from database: {file_type}")
            
            # Compress the file
            compressed_dir = os.path.join(os.path.dirname(file_path), "compressed")
            logger.info(f"Compressing file: {file_path} -> {compressed_dir}")
            
            # Define a progress callback function
            def compression_progress_callback(progress: float, stage: str, message: str = ""):
                logger.info(f"Compression progress: {progress:.1f}% - {stage} {message}")
                # Update file metadata with compression progress
                self.saver.save_file_metadata(file_id, {
                    "compression_progress": progress,
                })
            
            compression_result = self.compressor.compress_file(
                file_path, 
                compressed_dir, 
                filename,
                target_width=240,  # Default to 240p for videos
                quality="ultrafast",  # Use ultrafast quality preset
                progress_callback=compression_progress_callback  # Add progress callback
            )

            # update metadata from compression result
            logger.info(f"Compression result: path={compression_result.file_path}, size={compression_result.file_size}, length={compression_result.file_length}")
            self.saver.save_file_metadata(file_id, {
                "length": compression_result.file_length,
                "file_size": compression_result.file_size,
                "extension": compression_result.file_extension
            })

            compressed_file_path = compression_result.file_path

            # update metadata from compression result
            self.saver.save_file_metadata(file_id, {
                "parse_status": "extracting",
                "parse_error": "",
                "last_parse_attempt": datetime.now().isoformat()
            })

            # Clear CUDA cache again before extraction
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache before extraction")

            # Process tasks sequentially to avoid CUDA issues
            # First extract and save documents (this uses the Whisper model)
            logger.info(f"Extracting content from: {compressed_file_path}")
            
            # Isolate Whisper model usage in a separate function call
            # This helps prevent CUDA context issues
            results = await self._extract_file_content(compressed_file_path, file_type)
            
            logger.info(f"Extraction complete: {len(results)} chunks extracted")

            # Clear CUDA cache after extraction
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache after extraction")
            
            # Save each chunk as a document
            for i, result in enumerate(results):
                logger.info(f"Saving document {i+1}/{len(results)}: type={result.type}, has_image={bool(result.image_data)}")
                doc_id = self.saver.save_document(class_id, file_id, result)
                if doc_id:
                    logger.info(f"Document saved successfully: {doc_id}")
                else:
                    logger.warning(f"Failed to save document {i+1}")

            # update metadata from extraction result
            self.saver.save_file_metadata(file_id, {
                "last_parse_attempt": datetime.now().isoformat(),
                "parse_status": "processing",
                "parse_error": ""
            })
            
            # Now run the non-CUDA tasks concurrently
            async def run_non_cuda_tasks():
                gemini_task = asyncio.create_task(asyncio.to_thread(
                    self.saver.save_file_to_gemini, file_id, compressed_file_path))
                supabase_task = asyncio.create_task(asyncio.to_thread(
                    self.saver.save_file_to_supabase, class_id, file_id, compressed_file_path))
                
                results = await asyncio.gather(gemini_task, supabase_task, return_exceptions=True)
                
                # Check for exceptions
                task_names = ["Gemini upload", "Supabase upload"]
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"Error in {task_names[i]} task: {str(result)}")
                        raise result
                
                return results
            
            # Run non-CUDA tasks
            await run_non_cuda_tasks()
            
            # Update file status to complete
            self.saver.save_file_metadata(file_id, {
                "parse_status": "complete",
                "last_parse_attempt": datetime.now().isoformat(),
                "parse_error": ""
            })
            
            logger.info(f"File processing complete: {filename}")
            # Return results
            return True, "File processed successfully"
            
        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            
            # Update file status to error
            self.saver.save_file_metadata(file_id, {
                "parse_status": "error",
                "parse_error": str(e),
                "last_parse_attempt": datetime.now().isoformat()
            })
            
            # Return error
            return False, f"Error processing file: {str(e)}"

    async def _extract_file_content(self, file_path: str, file_type: str) -> List[FileExtractChunk]:
        """Isolate extraction in a separate method to better manage CUDA resources"""
        # For audio/video files that need CUDA, run directly in the main process
        if file_type in ['audio', 'video'] and torch.cuda.is_available():
            logger.info("Running audio/video extraction directly in main process to avoid CUDA issues")
            return self.extractor.extract_file(file_path, file_type)
        else:
            # For other file types, we can use a separate thread
            return await asyncio.to_thread(self.extractor.extract_file, file_path, file_type)