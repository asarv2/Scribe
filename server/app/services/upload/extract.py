import logging
from typing import List, Literal
import os
import fitz
from app.services.upload.models import FileExtractChunk
from app.config import model_manager
from PIL import Image
import io
import torch

logger = logging.getLogger(__name__)

class FileExtractor:
    def __init__(self):
        pass

    def extract_file(self, file_path: str, file_type: Literal['pdf', 'audio', 'video', 'image', 'other']) -> List[FileExtractChunk]:
        try:
            logger.info(f"Extracting content from: {file_path}")
            
            if file_type == 'pdf':
                return self.extract_pdf(file_path)
            elif file_type in ['audio', 'video']:
                return self.extract_audio_or_video(file_path)
            else:
                return self.extract_image_or_other(file_path)
        except Exception as e:
            logger.error(f"Error extracting content: {str(e)}")
            # Return empty list instead of crashing
            return []

    def extract_pdf(self, file_path: str) -> List[FileExtractChunk]:
        chunks = []
        try:
            # Open the PDF file
            pdf_document = fitz.open(file_path)
            
            # Process each page
            for page_num, page in enumerate(pdf_document):
                # Extract text
                text = page.get_text()
                
                # Get page as image
                pix = page.get_pixmap()
                img_data = pix.tobytes()
                
                # Create chunk
                chunk = FileExtractChunk(
                    text=text,
                    page=page_num + 1,  # 1-based page numbering
                    image_data=img_data,
                    type='pdf_page'
                )
                chunks.append(chunk)
                
            pdf_document.close()
        except Exception as e:
            logger.error(f"Error parsing PDF: {e}")
        
        return chunks

    def extract_audio_or_video(self, file_path: str) -> List[FileExtractChunk]:
        chunks = []
        try:
            # Get the Whisper model
            whisper_model = model_manager.get_whisper_model()
            
            # Clear CUDA cache before transcription
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                logger.info("Cleared CUDA cache before transcription")
            
            # Use a try-finally block to ensure CUDA cache is cleared
            try:
                # Transcribe the audio/video with explicit device placement
                result = whisper_model.transcribe(file_path)
                
                # Get the segments from the result
                segments = result.get("segments", [])
                
                # Determine if this is a video file
                is_video = os.path.splitext(file_path)[1].lower() in ['.mp4', '.mov', '.avi', '.mkv', '.webm']
                
                # Merge segments into 30-second chunks
                merged_segments = []
                current_segment = None  # Start with None instead of an empty dict
                
                for segment in segments:
                    # If this is the first segment or if adding this segment would exceed 30 seconds
                    if current_segment is None or segment.get("end", 0) - current_segment["start"] > 30:
                        # If we have text in the current segment, save it
                        if current_segment and current_segment["text"]:
                            merged_segments.append(current_segment)
                        
                        # Start a new segment
                        current_segment = {
                            "text": segment.get("text", "").strip(),
                            "start": segment.get("start", 0),
                            "end": segment.get("end", 0),
                            "words": segment.get("words", [])
                        }
                    else:
                        # Append this segment to the current one
                        current_segment["text"] += " " + segment.get("text", "").strip()
                        current_segment["end"] = segment.get("end", 0)
                        if "words" in segment:
                            current_segment["words"].extend(segment.get("words", []))
                
                # Add the last segment if it has content
                if current_segment and current_segment["text"]:
                    merged_segments.append(current_segment)
                
                # Process each merged segment
                for i, segment in enumerate(merged_segments):
                    start_time = segment["start"]
                    end_time = segment["end"]
                    text = segment["text"].strip()
                    
                    # Extract frame for video segments or generate waveform for audio
                    img_data = None
                    if is_video:
                        try:
                            # Extract frame at the start time of this segment
                            img_data = self._extract_video_frame(file_path, start_time)
                        except Exception as e:
                            logger.error(f"Warning: Could not extract frame at {start_time}s: {e}")
                    else:
                        # For audio files, generate a waveform visualization
                        try:
                            img_data = self._generate_audio_waveform(file_path, start_time, end_time)
                        except Exception as e:
                            logger.error(f"Warning: Could not generate waveform for segment at {start_time}s: {e}")
                    
                    # Create chunk with explicit start_time and end_time
                    chunk = FileExtractChunk(
                        text=text,
                        page=i + 1,  # Use segment number as page
                        start_time=start_time,
                        end_time=end_time,
                        image_data=img_data,
                        type='video_chunk' if is_video else 'audio_chunk'
                    )
                    chunks.append(chunk)
                    
                # If no segments were found, create a single chunk with the full transcript
                if not chunks and result.get("text"):
                    img_data = None
                    if is_video:
                        try:
                            # Extract the first frame for the entire video
                            img_data = self._extract_video_frame(file_path, 0)
                        except Exception as e:
                            logger.error(f"Warning: Could not extract first frame: {e}")
                    else:
                        # For audio files, generate a waveform for the entire file
                        try:
                            duration = result.get("duration", 0)
                            img_data = self._generate_audio_waveform(file_path, 0, duration)
                        except Exception as e:
                            logger.error(f"Warning: Could not generate waveform for audio: {e}")
                        
                    # For a single chunk, set start_time to 0 and end_time to the duration if available
                    duration = result.get("duration", 0)
                    chunk = FileExtractChunk(
                        text=result.get("text", "").strip(),
                        page=1,
                        start_time=0,  # Explicitly set start_time to 0
                        end_time=duration,  # Set end_time to duration
                        image_data=img_data,
                        type='video_chunk' if is_video else 'audio_chunk'
                    )
                    chunks.append(chunk)
            finally:
                # Clear CUDA cache after transcription
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    logger.info("Cleared CUDA cache after transcription")
        
        except Exception as e:
            logger.error(f"Error parsing audio/video: {str(e)}")
            # Return empty list instead of crashing
            return []
        
        return chunks

    def _extract_video_frame(self, video_path: str, timestamp: float) -> bytes:
        """
        Extract a single frame from a video at the specified timestamp.
        
        Args:
            video_path: Path to the video file
            timestamp: Time in seconds to extract the frame from
            
        Returns:
            Binary image data (JPEG format)
        """
        import subprocess
        import tempfile
        
        # Create a temporary file for the extracted frame
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Use ffmpeg to extract a single frame at the specified timestamp
            # -ss before -i for faster seeking
            # -frames:v 1 to extract only one frame
            # -q:v 2 for high quality JPEG (lower number = higher quality, range 1-31)
            cmd = [
                "ffmpeg", 
                "-ss", str(timestamp), 
                "-i", video_path, 
                "-frames:v", "1", 
                "-q:v", "5",  # Medium quality for smaller size
                "-f", "image2", 
                "-y",  # Overwrite output file
                temp_path
            ]
            
            # Run the command with a timeout to prevent hanging
            subprocess.run(cmd, check=True, capture_output=True, timeout=10)
            
            # Read the image data
            with open(temp_path, 'rb') as f:
                img_data = f.read()
            
            return img_data
        
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def _generate_audio_waveform(self, audio_path: str, start_time: float, end_time: float) -> bytes:
        """
        Generate a waveform visualization for an audio segment using PIL instead of matplotlib.
        
        Args:
            audio_path: Path to the audio file
            start_time: Start time in seconds
            end_time: End time in seconds
            
        Returns:
            Binary image data (PNG format)
        """
        import subprocess
        import tempfile
        import numpy as np
        from PIL import Image, ImageDraw, ImageFont
        import io
        
        # Create temporary file for audio segment
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio_file:
            temp_audio_path = temp_audio_file.name
        
        try:
            # Extract the segment using ffmpeg
            duration = end_time - start_time
            if duration <= 0:
                # If duration is invalid, use the whole file
                cmd = [
                    "ffmpeg", "-y", "-i", audio_path, "-ac", "1", temp_audio_path
                ]
            else:
                cmd = [
                    "ffmpeg", "-y", "-ss", str(start_time), "-t", str(duration),
                    "-i", audio_path, "-ac", "1", temp_audio_path
                ]
            
            subprocess.run(cmd, check=True, capture_output=True, timeout=30)
            
            # Read audio data
            import wave
            import contextlib
            
            with contextlib.closing(wave.open(temp_audio_path, 'r')) as f:
                frames = f.getnframes()
                rate = f.getframerate()
                duration = frames / float(rate)
                
                # Read waveform data
                f.rewind()
                audio_data = np.frombuffer(f.readframes(frames), dtype=np.int16)
            
            # Create image for waveform
            width, height = 800, 300
            image = Image.new('RGB', (width, height), color=(0, 0, 0))
            draw = ImageDraw.Draw(image)
            
            # Draw background grid
            for i in range(0, width, 50):
                draw.line([(i, 0), (i, height)], fill=(30, 30, 30), width=1)
            for i in range(0, height, 50):
                draw.line([(0, i), (width, i)], fill=(30, 30, 30), width=1)
            
            # Draw waveform
            # Downsample if there are too many points
            if len(audio_data) > width * 2:
                samples_per_pixel = len(audio_data) // (width * 2)
                audio_data = audio_data[::samples_per_pixel]
            
            # Normalize the audio data to fit in the image
            if len(audio_data) > 0:
                max_amplitude = max(np.abs(audio_data).max(), 1)
                scale_factor = (height - 100) / 2 / max_amplitude
                center_y = height // 2
                
                # Draw the waveform line
                points = []
                for i, sample in enumerate(audio_data):
                    x = int(i * width / len(audio_data))
                    y = center_y - int(sample * scale_factor)
                    if x < width:  # Ensure we don't go out of bounds
                        points.append((x, y))
                
                # Draw the waveform
                if len(points) > 1:
                    draw.line(points, fill=(0, 255, 255), width=1)
            
            # Save image to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            return img_byte_arr.getvalue()
        
        except Exception as e:
            logger.error(f"Error generating audio waveform: {str(e)}")
            # Return a simple placeholder image if waveform generation fails
            return self._generate_placeholder_image("Audio Waveform")
        
        finally:
            # Clean up temporary file
            if os.path.exists(temp_audio_path):
                try:
                    os.unlink(temp_audio_path)
                except:
                    pass

    def extract_image_or_other(self, file_path: str) -> List[FileExtractChunk]:
        try:
            # Check if it's an image file by extension
            image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff']
            file_ext = os.path.splitext(file_path)[1].lower()
            logger.info(f"Processing file: {file_path} with extension: {file_ext}")
            
            # Check if it's a text file
            is_text_file = file_ext == '.txt'
            
            # If no extension, try to determine file type using magic
            is_image = file_ext in image_extensions
            if not file_ext:
                try:
                    import magic
                    mime = magic.Magic(mime=True)
                    mime_type = mime.from_file(file_path)
                    logger.info(f"No extension detected. MIME type: {mime_type}")
                    is_image = mime_type.startswith('image/')
                    is_text_file = mime_type == 'text/plain'
                except Exception as e:
                    logger.error(f"Error detecting MIME type: {e}")
                    # If we can't detect the MIME type, assume it's an image
                    is_image = True
                    logger.info("Assuming file is an image")
            
            logger.info(f"Is image: {is_image}, Is text: {is_text_file}")
            
            if is_image:
                # For images, read the file directly as bytes
                file_size = os.path.getsize(file_path)
                logger.info(f"Reading image file: {file_path}, size: {file_size} bytes")
                
                with open(file_path, 'rb') as f:
                    img_data = f.read()
                
                logger.info(f"Image data read: {len(img_data)} bytes")
                
                # Create a single chunk for the image
                chunk = FileExtractChunk(
                    text="",  # Empty text for images
                    page=1,
                    image_data=img_data,
                    type='image'
                )
                
                logger.info(f"Created image chunk: type={chunk.type}, image_data_size={len(chunk.image_data) if chunk.image_data else 0}")
                return [chunk]
            elif is_text_file:
                # For text files, read the content and create an image of the text
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        text_content = f.read()
                    
                    # Generate an image of the text
                    img_data = self._generate_text_image(text_content, os.path.basename(file_path))
                    
                    # Create a chunk with both text and image
                    chunk = FileExtractChunk(
                        text=text_content,
                        page=1,
                        image_data=img_data,
                        type='text'
                    )
                    return [chunk]
                except Exception as e:
                    logger.error(f"Error processing text file: {str(e)}")
                    # If image generation fails, still return the text
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            text_content = f.read()
                        
                        chunk = FileExtractChunk(
                            text=text_content,
                            page=1,
                            type='text'
                        )
                        return [chunk]
                    except:
                        # If all else fails, return an empty chunk
                        chunk = FileExtractChunk(
                            text="",
                            page=1,
                            type='text'
                        )
                        return [chunk]
            else:
                logger.info("File not detected as image or text, creating 'other' chunk")
                # For other file types, just create an empty chunk
                chunk = FileExtractChunk(
                    text="",
                    page=1,
                    type='other'
                )
                return [chunk]
                
        except Exception as e:
            logger.error(f"Error in extract_image_or_other: {str(e)}")
            # Return an empty chunk in case of error
            chunk = FileExtractChunk(
                text="",
                page=1,
                type='other'
            )
            return [chunk]

    def _generate_text_image(self, text_content: str, filename: str) -> bytes:
        """
        Generate an image of text content on a white background.
        
        Args:
            text_content: The text to render
            filename: The name of the file (for the title)
            
        Returns:
            Binary image data (PNG format)
        """
        import tempfile
        from PIL import Image, ImageDraw, ImageFont
        import textwrap
        
        try:
            # Create a temporary file for the image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Limit text to first 2000 characters to avoid huge images
            if len(text_content) > 2000:
                display_text = text_content[:2000] + "...\n[Text truncated for display]"
            else:
                display_text = text_content
            
            # Create image
            width, height = 800, min(1200, 200 + 20 * display_text.count('\n'))
            image = Image.new('RGB', (width, height), color='white')
            draw = ImageDraw.Draw(image)
            
            # Try to use a standard font, fall back to default if not available
            try:
                body_font = ImageFont.truetype("Arial", 14)
            except:
                body_font = ImageFont.load_default()
            
            # Wrap and draw text
            wrapper = textwrap.TextWrapper(width=80)
            wrapped_text = []
            for line in display_text.split('\n'):
                wrapped_text.extend(wrapper.wrap(line) or [''])
            
            y_position = 80
            for line in wrapped_text:
                draw.text((20, y_position), line, fill='black', font=body_font)
                y_position += 20
                if y_position > height - 20:
                    draw.text((20, y_position), "...", fill='black', font=body_font)
                    break
            
            # Save the image
            image.save(temp_path, format='PNG')
            
            # Read the image data
            with open(temp_path, 'rb') as f:
                img_data = f.read()
            
            # Clean up
            os.unlink(temp_path)
            
            return img_data
        
        except Exception as e:
            logger.error(f"Error generating text image: {str(e)}")
            # Return a simple placeholder image if text rendering fails
            return self._generate_placeholder_image(f"Text File: {filename}")

    def _generate_placeholder_image(self, text: str) -> bytes:
        """
        Generate a simple placeholder image with text.
        
        Args:
            text: Text to display on the placeholder
            
        Returns:
            Binary image data (PNG format)
        """
        import tempfile
        from PIL import Image, ImageDraw, ImageFont
        
        try:
            # Create a temporary file for the image
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Create a simple image
            width, height = 400, 200
            image = Image.new('RGB', (width, height), color='#333333')
            draw = ImageDraw.Draw(image)
            
            # Try to use a standard font, fall back to default if not available
            try:
                font = ImageFont.truetype("Arial", 16)
            except:
                font = ImageFont.load_default()
            
            # Draw text centered
            text_width = draw.textlength(text, font=font)
            text_position = ((width - text_width) // 2, height // 2)
            draw.text(text_position, text, fill='white', font=font)
            
            # Save the image
            image.save(temp_path, format='PNG')
            
            # Read the image data
            with open(temp_path, 'rb') as f:
                img_data = f.read()
            
            # Clean up
            os.unlink(temp_path)
            
            return img_data
        
        except Exception as e:
            logger.error(f"Error generating placeholder image: {str(e)}")
            # If all else fails, return an empty bytes object
            return b''
