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
            self.model = whisper.load_model("base").to(self.device)
        
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
            elif self.file_type == 'video' or self.file_type == 'video_audio':
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

    def _extract_audio_content(self) -> List[Dict[str, Any]]:
        """Extract and transcribe content from audio file in 30-second chunks"""
        try:
            # Load audio file
            audio = AudioSegment.from_file(self.file_path)
            
            # Split into 30-second chunks
            chunk_length_ms = 30 * 1000  # 30 seconds
            chunks = []
            
            for i, start_ms in enumerate(range(0, len(audio), chunk_length_ms)):
                chunk = audio[start_ms:start_ms + chunk_length_ms]
                
                # Create a temporary file for this chunk
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_audio:
                    chunk.export(temp_audio.name, format="wav")
                    temp_audio.flush()
                    
                    # Load and transcribe the audio chunk
                    audio_data = whisper.load_audio(temp_audio.name)
                    result = self.model.transcribe(audio_data)
                    transcription = result["text"]
                    
                    # Create a waveform image for visualization
                    chunk_array = chunk.get_array_of_samples()
                    # Simple downsampling for visualization
                    downsampled = chunk_array[::1000] if len(chunk_array) > 1000 else chunk_array
                    
                    # Create a simple waveform image
                    img_width, img_height = 800, 200
                    img = Image.new('RGB', (img_width, img_height), color='white')
                    
                    # Draw the waveform
                    from PIL import ImageDraw
                    draw = ImageDraw.Draw(img)
                    
                    # Scale the values to fit in the image
                    max_amplitude = max(abs(min(downsampled)), abs(max(downsampled))) if downsampled else 1
                    scale_factor = (img_height / 2) / max_amplitude if max_amplitude > 0 else 1
                    
                    # Draw the waveform line
                    points = []
                    for j, sample in enumerate(downsampled):
                        x = int(j * img_width / len(downsampled))
                        y = int(img_height / 2 - sample * scale_factor)
                        points.append((x, y))
                    
                    if len(points) > 1:
                        draw.line(points, fill='blue', width=1)
                    
                    # Convert to bytes
                    img_byte_arr = io.BytesIO()
                    img.save(img_byte_arr, format='PNG')
                    img_bytes = img_byte_arr.getvalue()
                    
                    start_time = start_ms / 1000  # Convert to seconds
                    end_time = min((start_ms + chunk_length_ms) / 1000, len(audio) / 1000)
                    
                    chunks.append({
                        'chunk_num': i + 1,
                        'text': transcription,
                        'image': img_bytes,
                        'start_time': start_time,
                        'end_time': end_time,
                        'type': 'audio_chunk'
                    })
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error processing audio file: {str(e)}")
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

    def _extract_video_content(self) -> List[Dict[str, Any]]:
        """Extract audio from video and process it, capturing frames at 30-second intervals"""
        try:
            # Create a temporary file for the extracted audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
                temp_audio_path = temp_audio.name
            
            # Extract audio from video using ffmpeg via pydub
            video = AudioSegment.from_file(self.file_path)
            video.export(temp_audio_path, format="wav")
            
            # Open the video file to extract frames
            cap = cv2.VideoCapture(self.file_path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps <= 0:
                fps = 30  # Default to 30 fps if we can't determine it
            
            # Process the audio
            audio = AudioSegment.from_file(temp_audio_path)
            chunk_length_ms = 30 * 1000  # 30 seconds
            chunks = []
            
            for i, start_ms in enumerate(range(0, len(audio), chunk_length_ms)):
                chunk = audio[start_ms:start_ms + chunk_length_ms]
                
                # Create a temporary file for this chunk
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_chunk:
                    chunk.export(temp_chunk.name, format="wav")
                    temp_chunk.flush()
                    
                    # Load and transcribe the audio chunk
                    audio_data = whisper.load_audio(temp_chunk.name)
                    result = self.model.transcribe(audio_data)
                    transcription = result["text"]
                
                # Extract a frame at this timestamp
                frame_position = int(start_ms / 1000 * fps)
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_position)
                ret, frame = cap.read()
                
                if ret:
                    # Convert frame to PNG image
                    _, img_encoded = cv2.imencode('.png', frame)
                    img_bytes = img_encoded.tobytes()
                else:
                    # If frame extraction fails, create a blank image
                    img = Image.new('RGB', (640, 360), color='black')
                    img_byte_arr = io.BytesIO()
                    img.save(img_byte_arr, format='PNG')
                    img_bytes = img_byte_arr.getvalue()
                
                start_time = start_ms / 1000  # Convert to seconds
                end_time = min((start_ms + chunk_length_ms) / 1000, len(audio) / 1000)
                
                chunks.append({
                    'chunk_num': i + 1,
                    'text': transcription,
                    'image': img_bytes,
                    'start_time': start_time,
                    'end_time': end_time,
                    'type': 'video_chunk',
                })
            
            # Clean up
            cap.release()
            os.unlink(temp_audio_path)
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error processing video file: {str(e)}")
            raise

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
                document_data = {
                    'file': file_id,
                    'text': item.get('text', ''),
                    'processed': False
                }
                
                # Add type-specific fields
                if item['type'] == 'pdf_page':
                    document_data['page'] = item['page']
                elif item['type'] in ['audio_chunk', 'video_chunk']:
                    # For audio/video chunks, we'll store the timing info in the description
                    # since there's no dedicated field for start/end times
                    document_data['page'] = item['chunk_num']  # Use page for chunk number
                
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

            # Update file status
            supabase.table("files").update({
                "parse_status": "complete",
                "parse_error": None
            }).eq("id", file_id).execute()

        except Exception as e:
            logger.error(f"Error uploading to Supabase: {str(e)}")
            # Update file status to error
            supabase.table("files").update({
                "parse_status": "error",
                "parse_error": str(e)
            }).eq("id", file_id).execute()
            raise