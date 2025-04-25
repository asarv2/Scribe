import os
from pathlib import Path
from typing import List, Tuple
import logging
from dotenv import load_dotenv
import torch
from datetime import datetime
import asyncio

from app.services.upload.compress import FileCompressor
from app.services.upload.save import FileSaver
from app.services.upload.extract import FileExtractor
from app.config import model_manager
from app.services.upload.models import FileExtractChunk

from pathlib import Path
from app.extensions import CHUNKS_DIR
PERSIST_ROOT = Path(CHUNKS_DIR)
import shutil


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
            # Store the current file ID for progress callbacks
            self.current_file_id = file_id

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
            
            # Create persistent directory for this file early
            persist_dir = PERSIST_ROOT / Path(file_path).stem
            persist_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created persistent directory: {persist_dir}")
            
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
            total_chunks = len(results)
            for i, result in enumerate(results):
                logger.info(f"Saving document {i+1}/{total_chunks}: type={result.type}, has_image={bool(result.image_data)}")
                
                # Verify paths exist before saving
                if result.video_chunk_path and not os.path.exists(result.video_chunk_path):
                    logger.error(f"Video chunk path does not exist: {result.video_chunk_path}")
                if result.audio_chunk_path and not os.path.exists(result.audio_chunk_path):
                    logger.error(f"Audio chunk path does not exist: {result.audio_chunk_path}")
                
                # Create a document-specific progress callback that scales within the overall process
                # Processing stage is from 80-90% of overall progress
                def document_progress_callback(progress, stage, message):
                    if self.current_file_id == file_id:  # Only update if we're still processing the same file
                        # Scale progress to fit within the processing stage (80-90%)
                        overall_progress = 80.0 + (progress / 100.0 * 10.0 / total_chunks) + (i / total_chunks * 10.0)
                        self.saver.save_file_metadata(file_id, {
                            "processing_progress": overall_progress,
                        })
                        logger.info(f"Document processing progress: {overall_progress:.1f}% - {stage} {message}")
                
                doc_id = self.saver.save_document(class_id, file_id, result, progress_callback=document_progress_callback)
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
        finally:
            # Only remove the persistent chunks if processing was successful
            try:
                persist_dir = PERSIST_ROOT / Path(compressed_file_path).stem
                if os.path.exists(persist_dir):
                    # Don't delete immediately - wait until after documents are saved
                    # Only uncomment this if you're sure you want to delete the chunks
                    # shutil.rmtree(persist_dir, ignore_errors=True)
                    logger.info(f"Note: Keeping persistent chunks at: {persist_dir}")
                else:
                    logger.warning(f"Persistent directory not found: {persist_dir}")
            except Exception as e:
                logger.warning(f"Could not handle {persist_dir}: {e}")
            # Clear the current file ID
            self.current_file_id = None

    async def _extract_file_content(self, file_path: str, file_type: str) -> List[FileExtractChunk]:
        """Isolate extraction in a separate method to better manage CUDA resources"""
        # Track the highest progress value to prevent regression
        self.current_extraction_progress = 0.0
        
        # Define a progress callback that updates the file metadata
        def extraction_progress_callback(progress: float, status: str, message: str):
            # Only update if the new progress is higher than the current progress
            logger.info(f"Extraction progress: {progress:.1f}% - {status} {message}")
            # Exception: allow updates when status is "error"
            if progress > self.current_extraction_progress or status == "error":
                self.current_extraction_progress = progress if status != "error" else self.current_extraction_progress
                self.saver.save_file_metadata(self.current_file_id, {
                    "extraction_progress": self.current_extraction_progress,
                })
        
        # For audio/video files that need special handling
        if file_type in ['audio', 'video']:
            logger.info("Running audio/video extraction with CUDA safeguards")
            
            # Create a semaphore to ensure only one CUDA operation runs at a time
            # This is a global semaphore to coordinate across all requests
            if not hasattr(FileProcessor, '_cuda_semaphore'):
                FileProcessor._cuda_semaphore = asyncio.Semaphore(1)
            
            try:
                if torch.cuda.is_available():
                    # Acquire the semaphore to ensure exclusive GPU access
                    async with FileProcessor._cuda_semaphore:
                        logger.info("Acquired CUDA semaphore for transcription")
                        try:
                            # Use a subprocess for complete isolation instead of a thread
                            # This ensures a clean CUDA context
                            return await self._run_whisper_in_subprocess(file_path, file_type, extraction_progress_callback)
                        except Exception as e:
                            logger.error(f"GPU transcription failed: {str(e)}, falling back to CPU")
                            return await self._extract_with_cpu_fallback(file_path, file_type, extraction_progress_callback)
                        finally:
                            logger.info("Released CUDA semaphore after transcription")
                else:
                    # No GPU available, use CPU directly
                    return await asyncio.to_thread(self.extractor.extract_file, file_path, file_type, extraction_progress_callback)
            except Exception as e:
                logger.error(f"All transcription attempts failed: {str(e)}")
                # Update progress to error state
                extraction_progress_callback(0.0, "error", f"Transcription failed: {str(e)}")
                # Return a minimal error chunk if all attempts fail
                is_video = os.path.splitext(file_path)[1].lower() in ['.mp4', '.mov', '.avi', '.mkv', '.webm']
                return [FileExtractChunk(
                    text=f"Transcription failed after multiple attempts. Error: {str(e)}",
                    page=1,
                    type='video_chunk' if is_video else 'audio_chunk'
                )]
        else:
            # For other file types, we can use a separate thread as before
            return await asyncio.to_thread(self.extractor.extract_file, file_path, file_type, extraction_progress_callback)

    async def _run_whisper_in_subprocess(self, file_path: str, file_type: str, progress_callback=None) -> List[FileExtractChunk]:
        """Run Whisper in the main process with proper CUDA handling"""
        logger.info("Running Whisper transcription in main process")
        
        # Clear CUDA cache before transcription
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("Cleared CUDA cache before transcription")
        
        try:
            # Set a timeout for the extraction process
            return await asyncio.wait_for(
                # Run directly in the main process, not in a thread
                # This avoids CUDA context issues
                self._run_extraction_directly(file_path, file_type, progress_callback),
                timeout=300  # 5 minute timeout
            )
        except asyncio.TimeoutError:
            logger.error("Whisper transcription timed out")
            if progress_callback:
                progress_callback(self.current_extraction_progress, "error", "Transcription timed out after 5 minutes")
            raise
        finally:
            # Clear CUDA cache after transcription
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache after transcription")

    async def _run_extraction_directly(self, file_path: str, file_type: str, progress_callback=None) -> List[FileExtractChunk]:
        """Run extraction directly in the main process"""
        # This runs in the main process, not in a separate thread
        # We use asyncio.to_thread for CPU-bound work but keep CUDA ops in main thread
        
        # Initial progress update - only if we're still at 0%
        if progress_callback and self.current_extraction_progress < 10.0:
            progress_callback(10.0, "preparing", "Preparing for transcription")
        
        # Get the model in the main thread
        model = model_manager.get_whisper_model()
        
        # For video files, extract frames in a separate thread
        is_video = file_type == 'video'
        img_data = None
        
        if is_video:
            try:
                # Update progress - only if we're below this threshold
                if progress_callback and self.current_extraction_progress < 15.0:
                    progress_callback(15.0, "extracting_frame", "Extracting video frame")
                    
                # Extract frame in a separate thread (CPU operation)
                img_data = await asyncio.to_thread(
                    self.extractor._extract_video_frame, file_path, 0
                )
            except Exception as e:
                logger.error(f"Could not extract video frame: {str(e)}")
        
        # Update progress before transcription - only if we're below this threshold
        if progress_callback and self.current_extraction_progress < 20.0:
            progress_callback(20.0, "transcribing", "Starting transcription")
        
        # Transcribe directly in the main thread (GPU operation)
        # This is the critical part that needs to stay in the main thread
        result = model.transcribe(file_path)
        
        # Update progress after transcription - only if we're below this threshold
        if progress_callback and self.current_extraction_progress < 80.0:
            progress_callback(80.0, "processing", "Processing transcription results")
        
        # Process the result
        segments = result.get("segments", [])
        chunks = []
        
        # Process segments into chunks (CPU operation, can be done in main thread)
        if segments:
            # Merge segments into 30-second chunks
            merged_segments = []
            current_segment = None
            
            for segment in segments:
                if current_segment is None or segment.get("end", 0) - current_segment["start"] > 30:
                    if current_segment and current_segment["text"]:
                        merged_segments.append(current_segment)
                    
                    current_segment = {
                        "text": segment.get("text", "").strip(),
                        "start": segment.get("start", 0),
                        "end": segment.get("end", 0),
                    }
                else:
                    current_segment["text"] += " " + segment.get("text", "").strip()
                    current_segment["end"] = segment.get("end", 0)
            
            # Add the last segment if it has content
            if current_segment and current_segment["text"]:
                merged_segments.append(current_segment)
            
            # Create chunks from merged segments
            for i, segment in enumerate(merged_segments):
                # For video, try to extract a frame at this timestamp
                segment_img_data = img_data
                if is_video and i > 0:
                    try:
                        # Try to get a frame at this segment's timestamp
                        timestamp = segment["start"]
                        segment_img_data = await asyncio.to_thread(
                            self.extractor._extract_video_frame, file_path, timestamp
                        )
                    except Exception as e:
                        logger.error(f"Could not extract frame at {timestamp}s: {str(e)}")
                
                chunk = FileExtractChunk(
                    text=segment["text"],
                    page=i+1,
                    start_time=segment["start"],
                    end_time=segment["end"],
                    image_data=segment_img_data,
                    type='video_chunk' if is_video else 'audio_chunk'
                )
                chunks.append(chunk)
        else:
            # No segments, create a single chunk with the full transcription
            chunk = FileExtractChunk(
                text=result.get("text", "").strip(),
                page=1,
                start_time=0,
                end_time=result.get("duration", 0),
                image_data=img_data,
                type='video_chunk' if is_video else 'audio_chunk'
            )
            chunks.append(chunk)
        
        # Final progress update - only if we're below 100%
        if progress_callback and self.current_extraction_progress < 100.0:
            progress_callback(100.0, "complete", f"Transcription complete: {len(chunks)} segments")
        
        return chunks

    async def _extract_with_cpu_fallback(self, file_path: str, file_type: str, progress_callback=None) -> List[FileExtractChunk]:
        """Fallback to CPU-only extraction when GPU fails"""
        logger.info("Attempting CPU-only transcription fallback")
        
        # Initial progress update - don't go backwards
        if progress_callback and self.current_extraction_progress < 10.0:
            progress_callback(10.0, "cpu_fallback", "Attempting CPU-only transcription")
        
        # Import here to avoid circular imports
        import whisper
        import tempfile
        import shutil
        
        # Create a temporary directory for this operation
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                # Force CPU device
                os.environ["CUDA_VISIBLE_DEVICES"] = ""
                
                # Load a CPU-only model (use tiny model for speed)
                cpu_model = whisper.load_model("tiny", device="cpu")
                
                # Transcribe directly with the CPU model
                result = cpu_model.transcribe(file_path)
                
                # Create a simple chunk with just the text
                is_video = os.path.splitext(file_path)[1].lower() in ['.mp4', '.mov', '.avi', '.mkv', '.webm']
                
                # Try to get a frame if it's a video
                img_data = None
                if is_video:
                    try:
                        img_data = self.extractor._extract_video_frame(file_path, 0)
                    except Exception as e:
                        logger.error(f"Could not extract frame in CPU fallback: {str(e)}")
                
                # Final progress update - only if we're below 100%
                if progress_callback and self.current_extraction_progress < 100.0:
                    progress_callback(100.0, "complete", "CPU transcription complete")
                
                # Create and return a single chunk with the transcription
                return [FileExtractChunk(
                    text=result.get("text", "CPU fallback transcription (limited quality)"),
                    page=1,
                    start_time=0,
                    end_time=result.get("duration", 0),
                    image_data=img_data,
                    type='video_chunk' if is_video else 'audio_chunk'
                )]
            except Exception as e:
                logger.error(f"CPU fallback transcription failed: {str(e)}")
                # Return a minimal error chunk
                is_video = os.path.splitext(file_path)[1].lower() in ['.mp4', '.mov', '.avi', '.mkv', '.webm']
                return [FileExtractChunk(
                    text=f"Transcription failed. Error: {str(e)}",
                    page=1,
                    type='video_chunk' if is_video else 'audio_chunk'
                )]
            finally:
                # Restore GPU visibility
                if torch.cuda.is_available():
                    os.environ.pop("CUDA_VISIBLE_DEVICES", None)

                # Final progress update
                if progress_callback:
                    progress_callback(100.0, "complete", "CPU transcription complete")