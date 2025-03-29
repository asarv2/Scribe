import os
import re
import fitz  # PyMuPDF
from typing import Dict, Any, List, Tuple, Optional
import json
import logging
import tempfile
from supabase import create_client, ClientOptions, Client
from dotenv import load_dotenv
import whisper
import torch
from pydub import AudioSegment
import mimetypes
from PIL import Image
import io
import cv2  # For video frame extraction
from app.config import model_manager, MODEL_REGISTRY
import google.generativeai as genai
import concurrent.futures
import threading
from app.services.base_processor import BaseProcessor, Message

load_dotenv()

logger = logging.getLogger(__name__)

class FileExtractor:
    def __init__(self, file_path: str):
        """Initialize processor with a file path
        
        Args:
            file_path: Path to the file
        """
        self.file_path = file_path
        self.file_type = self._determine_file_type()
        
        # Initialize whisper model for audio files
        if self.file_type in ['audio', 'video', 'video_audio']:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device for audio processing: {self.device}")
            # We'll get models as needed for concurrent processing
        
        logger.info(f"Initialized FileExtractor for file: {file_path} (type: {self.file_type})")

    def _determine_file_type(self) -> str:
        """Determine the type of file based on extension or content"""
        mime_type, _ = mimetypes.guess_type(self.file_path)
        
        if mime_type:
            if mime_type.startswith('audio/'):
                return 'audio'
            elif mime_type.startswith('video/'):
                return 'video'
            elif mime_type.startswith('image/'):
                return 'image'
            elif mime_type == 'application/pdf':
                return 'pdf'
        
        # Fallback to extension check
        ext = os.path.splitext(self.file_path)[1].lower()
        if ext in ['.pdf']:
            return 'pdf'
        elif ext in ['.mp3', '.wav', '.ogg', '.flac', '.m4a']:
            return 'audio'
        elif ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
            return 'video'
        elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']:
            return 'image'
        
        return 'unknown'

    def extract_file_content(self) -> List[Dict[str, Any]]:
        """Extract content from file based on its type
        
        Returns:
            List[Dict[str, Any]]: List of dictionaries containing extracted content
        """
        try:
            if self.file_type == 'pdf':
                return self._extract_pdf_content()
            elif self.file_type == 'audio':
                return self._extract_audio_content()
            elif self.file_type == 'image':
                return self._extract_image_content()
            elif self.file_type == 'video':
                return self._extract_video_content()
            else:
                logger.warning(f"Unsupported file type: {self.file_type}")
                return []
                
        except Exception as e:
            logger.error(f"Error extracting content: {str(e)}")
            raise

    def _extract_pdf_content(self) -> List[Dict[str, Any]]:
        """Extract text and image data from PDF file"""
        pdf_document = fitz.open(self.file_path)
        page_count = len(pdf_document)
        
        pages_content = []
        for page_num in range(page_count):
            page = pdf_document[page_num]
            page_text = page.get_text()
            
            # Render page to image
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
            img_bytes = pix.tobytes("png")
            
            pages_content.append({
                'page': page_num + 1,  # Match the database field name
                'text': page_text,
                'image': img_bytes,
                'type': 'pdf_page'
            })
        
        # Clean up
        pdf_document.close()
        return pages_content

    def _process_audio_chunk(self, chunk_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single audio chunk with Whisper
        
        Args:
            chunk_data: Dictionary containing chunk information
            
        Returns:
            Dict with processed chunk data including transcription
        """
        try:
            chunk = chunk_data['audio_segment']
            chunk_num = chunk_data['chunk_num']
            start_ms = chunk_data['start_ms']
            chunk_length_ms = chunk_data['chunk_length_ms']
            
            # Get a Whisper model from the pool
            model = model_manager.get_whisper_model(chunk_num % len(MODEL_REGISTRY["whisper_models"]) 
                                                   if MODEL_REGISTRY["whisper_models"] else None)
            
            # Create a temporary file for this chunk
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                temp_path = temp_audio.name
            
            # Export the chunk to the temporary file
            chunk.export(temp_path, format="wav")
            
            # Load and transcribe the audio chunk
            try:
                audio_data = whisper.load_audio(temp_path)
                
                # Set appropriate options based on device
                fp16 = torch.cuda.is_available()
                
                # Transcribe with appropriate options
                result = model.transcribe(
                    audio_data, 
                    fp16=fp16,
                    language="en"  # You can make this configurable if needed
                )
                transcription = result["text"]
            except Exception as e:
                logger.error(f"Error transcribing chunk {chunk_num}: {str(e)}")
                transcription = f"[Transcription error: {str(e)}]"
            finally:
                # Clean up the temporary file
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    logger.error(f"Error removing temporary file: {str(e)}")
            
            # Calculate start and end times in seconds
            start_time = start_ms / 1000
            end_time = min((start_ms + chunk_length_ms) / 1000, start_time + 30)  # Cap at 30 seconds
            
            return {
                'type': 'audio_chunk',
                'chunk_num': chunk_num,
                'text': transcription,
                'start_time': start_time,
                'end_time': end_time
            }
        except Exception as e:
            logger.error(f"Error processing audio chunk {chunk_data.get('chunk_num', 'unknown')}: {str(e)}")
            return {
                'type': 'audio_chunk',
                'chunk_num': chunk_data.get('chunk_num', 0),
                'text': f"[Processing error: {str(e)}]",
                'start_time': chunk_data.get('start_ms', 0) / 1000,
                'end_time': (chunk_data.get('start_ms', 0) + chunk_data.get('chunk_length_ms', 30000)) / 1000
            }

    def _extract_audio_content(self) -> List[Dict[str, Any]]:
        """Extract and transcribe content from audio file in 30-second chunks using concurrent processing"""
        try:
            # Load audio file
            audio = AudioSegment.from_file(self.file_path)
            
            # Split into 30-second chunks
            chunk_length_ms = 30 * 1000  # 30 seconds
            chunk_data_list = []
            
            for i, start_ms in enumerate(range(0, len(audio), chunk_length_ms)):
                chunk = audio[start_ms:start_ms + chunk_length_ms]
                chunk_data_list.append({
                    'audio_segment': chunk,
                    'chunk_num': i + 1,
                    'start_ms': start_ms,
                    'chunk_length_ms': chunk_length_ms
                })
            
            # Determine how many concurrent tasks to run
            available_models = len(MODEL_REGISTRY["whisper_models"]) if MODEL_REGISTRY["whisper_initialized"] else 1
            max_workers = min(available_models, len(chunk_data_list))
            
            logger.info(f"Processing {len(chunk_data_list)} audio chunks with {max_workers} concurrent workers")
            
            # Process chunks concurrently
            processed_chunks = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_chunk = {executor.submit(self._process_audio_chunk, chunk_data): chunk_data 
                                  for chunk_data in chunk_data_list}
                
                for future in concurrent.futures.as_completed(future_to_chunk):
                    chunk_data = future_to_chunk[future]
                    try:
                        processed_chunk = future.result()
                        processed_chunks.append(processed_chunk)
                    except Exception as e:
                        logger.error(f"Error processing chunk {chunk_data['chunk_num']}: {str(e)}")
            
            # Sort chunks by chunk number to maintain order
            processed_chunks.sort(key=lambda x: x['chunk_num'])
            
            return processed_chunks
            
        except Exception as e:
            logger.error(f"Error processing audio file: {str(e)}")
            raise

    def _process_video_frame(self, frame_position: int, cap) -> bytes:
        """Extract a frame from the video at the specified position"""
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_position)
        ret, frame = cap.read()
        
        if ret:
            # Convert frame to PNG image
            _, img_encoded = cv2.imencode('.png', frame)
            return img_encoded.tobytes()
        else:
            # If frame extraction fails, create a blank image
            img = Image.new('RGB', (640, 360), color='black')
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            return img_byte_arr.getvalue()

    def _process_video_chunk(self, chunk_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single video chunk with Whisper and extract frame
        
        Args:
            chunk_data: Dictionary containing chunk information
            
        Returns:
            Dict with processed chunk data including transcription and frame
        """
        chunk = chunk_data['audio_segment']
        chunk_num = chunk_data['chunk_num']
        start_ms = chunk_data['start_ms']
        chunk_length_ms = chunk_data['chunk_length_ms']
        cap = chunk_data['cap']
        fps = chunk_data['fps']
        
        # Get a Whisper model from the pool
        model = model_manager.get_whisper_model(chunk_num % len(MODEL_REGISTRY["whisper_models"]) 
                                               if MODEL_REGISTRY["whisper_models"] else None)
        
        # Create a temporary file for this chunk
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_audio:
            chunk.export(temp_audio.name, format="wav")
            temp_audio.flush()
            
            # Load and transcribe the audio chunk
            audio_data = whisper.load_audio(temp_audio.name)
            result = model.transcribe(audio_data)
            transcription = result["text"]
        
        # Extract a frame at this timestamp
        frame_position = int(start_ms / 1000 * fps)
        img_bytes = self._process_video_frame(frame_position, cap)
        
        start_time = start_ms / 1000  # Convert to seconds
        end_time = min((start_ms + chunk_length_ms) / 1000, (start_ms + len(chunk)) / 1000)
        
        return {
            'chunk_num': chunk_num,
            'text': transcription,
            'image': img_bytes,
            'start_time': start_time,
            'end_time': end_time,
            'type': 'video_chunk',
        }

    def _extract_video_content(self) -> List[Dict[str, Any]]:
        """Extract audio from video and process it concurrently, capturing frames at 30-second intervals"""
        try:
            # Create a temporary file for the extracted audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                temp_audio_path = temp_audio.name
            
            # Extract audio from video using ffmpeg via pydub
            logger.info(f"Extracting audio from video file: {self.file_path}")
            video = AudioSegment.from_file(self.file_path)
            video.export(temp_audio_path, format="wav")
            
            # Open the video file to extract frames
            logger.info("Opening video file to extract frames")
            cap = cv2.VideoCapture(self.file_path)
            if not cap.isOpened():
                logger.error("Failed to open video file with OpenCV")
                raise ValueError("Failed to open video file")
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps <= 0:
                fps = 30  # Default to 30 fps if we can't determine it
            
            # Process the audio
            logger.info("Processing audio from video")
            audio = AudioSegment.from_file(temp_audio_path)
            chunk_length_ms = 30 * 1000  # 30 seconds
            chunk_data_list = []
            
            for i, start_ms in enumerate(range(0, len(audio), chunk_length_ms)):
                chunk = audio[start_ms:start_ms + chunk_length_ms]
                chunk_data_list.append({
                    'audio_segment': chunk,
                    'chunk_num': i + 1,
                    'start_ms': start_ms,
                    'chunk_length_ms': chunk_length_ms,
                    'cap': cap,  # Pass the video capture object
                    'fps': fps
                })
            
            # Determine processing approach based on available resources
            is_cpu_only = not torch.cuda.is_available()
            available_models = len(MODEL_REGISTRY["whisper_models"]) if MODEL_REGISTRY["whisper_initialized"] else 1
            
            # Use sequential processing for CPU-only environments with 1 model
            if is_cpu_only and available_models <= 1:
                logger.info("Using sequential processing for CPU-only environment")
                processed_chunks = []
                for chunk_data in chunk_data_list:
                    try:
                        logger.info(f"Processing video chunk {chunk_data['chunk_num']}/{len(chunk_data_list)}")
                        processed_chunk = self._process_video_chunk(chunk_data)
                        processed_chunks.append(processed_chunk)
                        logger.info(f"Finished processing chunk {chunk_data['chunk_num']}")
                    except Exception as e:
                        logger.error(f"Error processing chunk {chunk_data['chunk_num']}: {str(e)}")
            else:
                # Use concurrent processing for GPU or multiple CPU models
                max_workers = min(available_models, len(chunk_data_list))
                logger.info(f"Processing {len(chunk_data_list)} video chunks with {max_workers} concurrent workers")
                
                # Process chunks concurrently
                processed_chunks = []
                
                # Create a lock for the video capture object since it's not thread-safe
                cap_lock = threading.Lock()
                
                # Modify the _process_video_frame function to use the lock
                def _process_video_frame_with_lock(frame_position: int, cap) -> bytes:
                    with cap_lock:
                        return self._process_video_frame(frame_position, cap)
                
                # Replace the method temporarily
                original_process_frame = self._process_video_frame
                self._process_video_frame = _process_video_frame_with_lock
                
                with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
                    future_to_chunk = {executor.submit(self._process_video_chunk, chunk_data): chunk_data 
                                      for chunk_data in chunk_data_list}
                    
                    for future in concurrent.futures.as_completed(future_to_chunk):
                        chunk_data = future_to_chunk[future]
                        try:
                            processed_chunk = future.result()
                            processed_chunks.append(processed_chunk)
                            logger.info(f"Finished processing chunk {chunk_data['chunk_num']}")
                        except Exception as e:
                            logger.error(f"Error processing chunk {chunk_data['chunk_num']}: {str(e)}")
                
                # Restore the original method
                self._process_video_frame = original_process_frame
            
            # Sort chunks by chunk number to maintain order
            processed_chunks.sort(key=lambda x: x['chunk_num'])
            
            # Clean up
            cap.release()
            os.unlink(temp_audio_path)
            
            return processed_chunks
            
        except Exception as e:
            logger.error(f"Error processing video file: {str(e)}")
            raise

    def _extract_image_content(self) -> List[Dict[str, Any]]:
        """Extract content from image file"""
        try:
            with open(self.file_path, 'rb') as f:
                img_bytes = f.read()
            
            # You could add OCR here if needed to extract text from images
            # For now, we'll just return the image
            return [{
                'page': 1,  # Match the database field name
                'text': '',  # No text extraction for now
                'image': img_bytes,
                'type': 'image'
            }]
        except Exception as e:
            logger.error(f"Error processing image file: {str(e)}")
            raise

    async def generate_video_title(self, transcriptions: List[str], file_id: str) -> str:
        """Generate a title for a video file based on its transcriptions
        
        Args:
            transcriptions: List of transcription texts from video chunks
            file_id: ID of the file
            
        Returns:
            str: Generated title for the video
        """
        try:
            # Combine all transcriptions, limiting to first 2000 chars to avoid token limits
            combined_text = " ".join(transcriptions)
            if len(combined_text) > 2000:
                combined_text = combined_text[:2000] + "..."
                
            system_prompt = (
                "You are an expert at identifying the title of a video."
                "Given the transcription of a video, "
                "you will identify a descriptive title. "
                "The title should be a single sentence that captures the essence of the video content. "
                "You should output a single <TITLE>x</TITLE> tag, where x is the title of the video. "
                "CRITICAL: Make sure to keep the title short and concise, it should be under 10 words. "
                "It should be in Title Case and capture the main topic of the video."
                "Here is an example of a good title: <TITLE>Help With Precalculus</TITLE>"
            )

            prompt = (
                "Here is the transcription from a video. Please generate an appropriate title:\n\n"
                f"{combined_text}\n\n"
                "OUTPUT:\n"
            )

            # Create a temporary BaseProcessor to use its robust_generate method
            processor = BaseProcessor()
            
            message = Message(content=[
                {"type": "text", "text": prompt},
            ])

            response = await processor.robust_generate(system_prompt, message, "gemini-2.0-flash")
            print("TITLE RESPONSE: ", response)
            
            # Extract title from response
            title_match = re.search(r'<TITLE>(.*?)</TITLE>', response)
            if title_match:
                return title_match.group(1).strip()
            else:
                logger.warning(f"No title found in response: {response}")
                return ""
                
        except Exception as e:
            logger.error(f"Error generating video title: {str(e)}")
            return ""

    def upload_to_supabase(self, content_items: List[Dict[str, Any]], class_id: str, file_id: str, supabase: Client):
        """Upload extracted content to Supabase
        
        Args:
            content_items: List of dictionaries containing extracted content
            class_id: ID of the class
            file_id: ID of the file
            supabase: Supabase client
        """
        try:
            # Upload each content item to the documents table and store images
            for item in content_items:
                if item['type'] == 'pdf_page':
                    document_data = {
                        'page': item['page'],
                        'file': file_id,
                        'text': item.get('text', ''),
                        'processed': False
                    }
                elif item['type'] in ['audio_chunk', 'video_chunk']:
                    # For audio/video chunks, upload the chunk to Gemini
                    chunk_file_name = None
                    if 'image' in item and item['image']:
                        # Create a temporary file for this chunk
                        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_chunk:
                            temp_chunk_path = temp_chunk.name
                        
                        # Extract the chunk from the original file
                        original_audio = AudioSegment.from_file(self.file_path)
                        start_ms = int(item['start_time'] * 1000)
                        end_ms = int(item['end_time'] * 1000)
                        chunk = original_audio[start_ms:end_ms]
                        chunk.export(temp_chunk_path, format="wav")
                        
                        # Upload to Gemini
                        try:
                            mime_type = "audio/wav"
                            if item['type'] == 'video_chunk':
                                mime_type = "video/mp4"  # Adjust if needed
                                
                            with open(temp_chunk_path, "rb") as f:
                                media_file = genai.upload_file(f, mime_type=mime_type)
                                chunk_file_name = media_file.name
                                
                            # Clean up temp file
                            os.unlink(temp_chunk_path)
                        except Exception as e:
                            logger.error(f"Error uploading chunk to Gemini: {str(e)}")
                    
                    document_data = {
                        'page': item['chunk_num'],
                        'file': file_id,
                        'text': item.get('text', ''),
                        'processed': False,
                        'start_time': item['start_time'],
                        'end_time': item['end_time'],
                        'file_name': chunk_file_name if chunk_file_name else ""
                    }
                elif item['type'] == 'image':
                    document_data = {
                        'page': 1,
                        'file': file_id,
                        'text': '',
                        'processed': False
                    }
                else:
                    logger.warning(f"Unsupported content type: {item['type']}")
                    continue
                
                # Insert document record
                document_response = supabase.table('documents').insert(document_data).execute()
                document_id = document_response.data[0]['id']
                
                # Upload image to Supabase storage
                if 'image' in item and item['image']:
                    storage_path = f"{class_id}/{file_id}/{document_id}.png"
                    supabase.storage.from_("files").upload(
                        path=storage_path,
                        file=item['image'],
                        file_options={"content-type": "image/png"}
                    )

        except Exception as e:
            logger.error(f"Error uploading to Supabase: {str(e)}")
            # Update file status to error
            supabase.table("files").update({
                "parse_status": "error",
                "parse_error": str(e)
            }).eq("id", file_id).execute()
            raise