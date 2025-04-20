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
import google.generativeai as genai
import concurrent.futures
import threading
from app.extensions import FILES_DIR, gemini_client
import magic
import shutil
from agents import Runner, Agent, OpenAIChatCompletionsModel
from app.config import model_manager
from app.services.upload.prompts import get_video_prompt

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
        
        # Initialize device for audio/video processing
        if self.file_type in ['audio', 'video']:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Using device for audio processing: {self.device}")
        
        logger.info(f"Initialized FileExtractor for file: {file_path} (type: {self.file_type})")

        video_system_prompt = get_video_prompt()

        # creating video agent for title generation
        self.video_agent = Agent(
            name="Video Agent",
            instructions=video_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
        )

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
                return self._extract_video_audio_content()
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

    def _process_audio_chunk(self, chunk_num: int, start_time: float, end_time: float, chunk_file_path: str) -> Dict[str, Any]:
        """Process an audio chunk and extract transcription"""
        try:
            # Transcribe the audio chunk
            transcription = self._transcribe_audio(chunk_file_path)
            
            # Generate a simple waveform image for the audio
            img_bytes = self._generate_audio_waveform(chunk_file_path)
            
            return {
                'chunk_num': chunk_num,
                'text': transcription,
                'image': img_bytes,
                'start_time': start_time,
                'end_time': end_time,
                'type': 'audio_chunk',
                'chunk_file_path': chunk_file_path  # Include the path to the chunk file
            }
        except Exception as e:
            logger.error(f"Error processing audio chunk {chunk_num}: {str(e)}")
            return {
                'chunk_num': chunk_num,
                'text': f"[Processing error: {str(e)}]",
                'image': None,
                'start_time': start_time,
                'end_time': end_time,
                'type': 'audio_chunk',
                'chunk_file_path': chunk_file_path  # Include the path even in error case
            }

    def _extract_audio_content(self) -> List[Dict[str, Any]]:
        """Extract and transcribe content from audio file"""
        try:
            # For audio files, we'll process the entire file as one chunk
            # This method will be called either for small audio files or for individual chunks
            
            # Process the audio file
            chunk_num = 1  # Default chunk number
            start_time = 0
            
            # Get audio duration
            audio = AudioSegment.from_file(self.file_path)
            end_time = len(audio) / 1000  # Convert to seconds
            
            # Process the audio chunk
            processed_chunk = self._process_audio_chunk(chunk_num, start_time, end_time, self.file_path)
            
            return [processed_chunk]
            
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

    def _process_video_chunk(self, chunk_num: int, start_time: float, end_time: float, chunk_file_path: str) -> Dict[str, Any]:
        """Process a video chunk and extract frames and transcription"""
        try:
            # Open the video file
            cap = cv2.VideoCapture(chunk_file_path)
            
            # Extract a frame from the beginning of the chunk
            cap.set(cv2.CAP_PROP_POS_MSEC, 0)  # Set to beginning of chunk
            success, frame = cap.read()
            
            if not success:
                logger.warning(f"Could not read frame from video chunk {chunk_num}")
                img_bytes = None
            else:
                # Convert frame to PNG image
                img_bytes = self._frame_to_png(frame)
            
            cap.release()
            
            # Transcribe the audio from the chunk
            transcription = self._transcribe_audio(chunk_file_path)
            
            return {
                'chunk_num': chunk_num,
                'text': transcription,
                'image': img_bytes,
                'start_time': start_time,
                'end_time': end_time,
                'type': 'video_chunk',
                'chunk_file_path': chunk_file_path  # Include the path to the chunk file
            }
        except Exception as e:
            logger.error(f"Error processing video chunk {chunk_num}: {str(e)}")
            return {
                'chunk_num': chunk_num,
                'text': f"[Processing error: {str(e)}]",
                'image': None,
                'start_time': start_time,
                'end_time': end_time,
                'type': 'video_chunk',
                'chunk_file_path': chunk_file_path  # Include the path even in error case
            }

    def _extract_video_audio_content(self) -> List[Dict[str, Any]]:
        """Extract content from video file including audio transcription and frames"""
        try:
            # For video files, we'll process the entire file as one chunk
            # This method will be called either for small video files or for individual chunks
            
            # Extract video metadata
            cap = cv2.VideoCapture(self.file_path)
            if not cap.isOpened():
                raise ValueError("Failed to open video file")
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration_ms = int((frame_count / fps) * 1000) if fps > 0 else 0
            
            # Process the video chunk
            chunk_num = 1  # Default chunk number
            start_time = 0
            end_time = duration_ms / 1000  # Convert to seconds
            
            processed_chunk = self._process_video_chunk(chunk_num, start_time, end_time, self.file_path)
            
            # Clean up
            cap.release()
            
            return [processed_chunk]
            
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

            prompt = (
                "Here is the transcription from a video. Please generate an appropriate title:\n\n"
                f"{combined_text}\n\n"
                "OUTPUT:\n"
            )

            response = await Runner.run(self.video_agent, prompt)
            
            return response.strip()
        except Exception as e:
            logger.error(f"Error generating video title: {str(e)}")
            return ""

    def upload_to_supabase(self, item: Dict[str, Any], class_id: str, file_id: str, supabase: Client):
        """Upload extracted content to Supabase"""
        try:
            # get file response from supabase
            file_response = supabase.table("files").select("*").eq("id", file_id).execute()
            file_data = file_response.data[0]
            
            # Initialize google_file_id as None
            google_file_id = None
            
            # Upload the specific item to Gemini based on its type
            try:
                # Determine what to upload to Gemini based on item type
                upload_file = None
                mime_type = None
                
                if item['type'] == 'pdf_page' and 'image' in item and item['image']:
                    upload_file = item['image']
                    mime_type = "image/png"
                    log_msg = f"Uploading PDF page {item['page']} image to Gemini"
                
                elif item['type'] in ['audio_chunk', 'video_chunk'] and 'chunk_file_path' in item:
                    if os.path.exists(item['chunk_file_path']):
                        upload_file = item['chunk_file_path']
                        mime = magic.Magic(mime=True)
                        mime_type = mime.from_file(upload_file)
                        log_msg = f"Uploading {item['type']} chunk {item['chunk_num']} to Gemini: {mime_type}"
                
                elif item['type'] == 'image' and 'image' in item and item['image']:
                    upload_file = item['image']
                    mime_type = "image/png"
                    log_msg = "Uploading image to Gemini"
                
                # Perform the upload if we have a file to upload
                if upload_file and mime_type:
                    logger.info(log_msg)
                    
                    # Handle file path vs bytes
                    if isinstance(upload_file, str) and os.path.exists(upload_file):
                        with open(upload_file, 'rb') as f:
                            media_file = genai.upload_file(f, mime_type=mime_type)
                    else:
                        # Assume it's already bytes. Need to convert to io.BytesIO
                        media_file = genai.upload_file(io.BytesIO(upload_file), mime_type=mime_type)
                    
                    google_file_id = media_file.name
                    # removing the files/ prefix
                    formatted_google_file_id = google_file_id.split("/")[-1]
                    logger.info(f"Successfully uploaded to Gemini: {formatted_google_file_id}")
                
            except Exception as e:
                logger.error(f"Error uploading item to Gemini: {str(e)}")
                # Create debug directory and log error
                debug_dir = os.path.join(FILES_DIR, "debug", file_id)
                os.makedirs(debug_dir, exist_ok=True)
                with open(os.path.join(debug_dir, "item_upload_error.txt"), 'w') as err_file:
                    err_file.write(f"Error: {str(e)}\n")
                    import traceback
                    err_file.write(traceback.format_exc())
            
            # Upload the item to the documents table and store images
            if item['type'] == 'pdf_page':
                document_data = {
                    'page': item['page'],
                    'file': file_id,
                    'text': item.get('text', ''),
                    'processed': file_data.get('content_type', 'other') == 'textbook', # we mark the textbook as processed
                    'google_file_id': formatted_google_file_id
                }
            elif item['type'] in ['audio_chunk', 'video_chunk']:
                document_data = {
                    'page': item['chunk_num'],
                    'file': file_id,
                    'text': item.get('text', ''),
                    'processed': False,
                    'start_time': item['start_time'],
                    'end_time': item['end_time'],
                    'google_file_id': formatted_google_file_id
                }
            elif item['type'] == 'image':
                document_data = {
                    'page': 1,
                    'file': file_id,
                    'text': '',
                    'processed': file_data.get('content_type', 'other') == 'textbook', # we mark the textbook as processed
                    'google_file_id': formatted_google_file_id
                }
            else:
                logger.warning(f"Unsupported content type: {item['type']}")

            document_data['class'] = class_id
            
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