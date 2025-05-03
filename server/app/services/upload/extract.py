import logging
from typing import List, Literal
import os
import fitz
from app.services.upload.models import FileExtractChunk
from app.config import model_manager
from PIL import Image
import io
import torch
import shutil
from pathlib import Path
from app.extensions import CHUNKS_DIR
import subprocess
import numpy as np

PERSIST_ROOT = Path(CHUNKS_DIR)

logger = logging.getLogger(__name__)

class FileExtractor:
    def __init__(self):
        pass

    def extract_file(self, file_path: str, file_type: Literal['pdf', 'audio', 'video', 'image', 'other'], progress_callback=None) -> List[FileExtractChunk]:
        try:
            logger.info(f"Extracting content from: {file_path}")
            
            if file_type == 'pdf':
                return self.extract_pdf(file_path, progress_callback)
            elif file_type in ['audio', 'video']:
                return self.extract_audio_or_video(file_path, progress_callback )
            else:
                return self.extract_image_or_other(file_path, progress_callback)
        except Exception as e:
            logger.error(f"Error extracting content: {str(e)}")
            # Return empty list instead of crashing
            return []

    def extract_pdf(self, file_path: str, progress_callback=None) -> List[FileExtractChunk]:
        chunks = []
        try:
            pdf = fitz.open(file_path)
            total = len(pdf)
            if progress_callback:
                progress_callback(5.0, "analyzing", f"Analyzing {total} pages")

            # render at 300 dpi
            dpi = 300
            scale = dpi / 72
            mat = fitz.Matrix(scale, scale)

            for i, page in enumerate(pdf):
                text = page.get_text()
                pix  = page.get_pixmap(matrix=mat, alpha=False, colorspace=fitz.csRGB)
                img_data = pix.tobytes("png")

                chunks.append(FileExtractChunk(
                    text=text,
                    page=i+1,
                    image_data=img_data,
                    type='pdf_page'
                ))

                if progress_callback:
                    prog = 5.0 + ((i+1)/total)*90.0
                    progress_callback(prog, "processing", f"Page {i+1}/{total}")

            pdf.close()
            if progress_callback:
                progress_callback(100.0, "complete", f"Extracted {len(chunks)} pages")
        except Exception as e:
            if progress_callback:
                progress_callback(0.0, "error", f"Error: {e}")
        return chunks

    def extract_audio_or_video(self, file_path: str, progress_callback=None) -> List[FileExtractChunk]:
        chunks = []
        try:
            # Determine if this is a video file
            is_video = os.path.splitext(file_path)[1].lower() in ['.mp4', '.mov', '.avi', '.mkv', '.webm']
            
            # Create a temporary directory for the chunks
            import tempfile
            import subprocess
            import shutil
            
            # Create persistent directory BEFORE processing any chunks
            permanent_chunk_dir = PERSIST_ROOT / Path(file_path).stem
            permanent_chunk_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created persistent directory: {permanent_chunk_dir}")
            
            with tempfile.TemporaryDirectory() as temp_dir:
                try:
                    # Get file duration using ffprobe
                    duration_cmd = [
                        "ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", file_path
                    ]
                    duration = float(subprocess.check_output(duration_cmd).decode().strip())
                    logger.info(f"File duration: {duration:.2f} seconds")
                    
                    # Report initial progress
                    if progress_callback:
                        progress_callback(5.0, "analyzing", f"Analyzing {duration:.1f} second {'video' if is_video else 'audio'}")
                    
                    # Calculate number of 30-second chunks
                    chunk_duration = 30.0
                    num_chunks = max(1, int(duration / chunk_duration) + (1 if duration % chunk_duration > 0 else 0))
                    logger.info(f"Splitting into {num_chunks} chunks of {chunk_duration}s each")
                    
                    # Get the Whisper model
                    whisper_model = model_manager.get_whisper_model()
                    
                    # Process each chunk
                    for i in range(num_chunks):
                        start_time = i * chunk_duration
                        end_time = min((i + 1) * chunk_duration, duration)
                        
                        # Update progress - splitting phase (5-15%)
                        if progress_callback:
                            progress = 5.0 + (i / num_chunks * 10.0)
                            progress_callback(progress, "splitting", f"Splitting chunk {i+1}/{num_chunks}")
                        
                        # Create a path for this chunk
                        chunk_filename = f"chunk_{i:03d}.{'mp4' if is_video else 'wav'}"
                        permanent_chunk_path = permanent_chunk_dir / chunk_filename
                        
                        try:
                            # Extract the chunk using ffmpeg directly to permanent path
                            if is_video:
                                cmd = [
                                    "ffmpeg", "-y", "-ss", str(start_time), "-t", str(end_time - start_time),
                                    "-i", file_path, "-c:v", "libx264", "-c:a", "aac", "-strict", "experimental",
                                    "-b:a", "128k", "-movflags", "+faststart", str(permanent_chunk_path)
                                ]
                            else:
                                cmd = [
                                    "ffmpeg", "-y", "-ss", str(start_time), "-t", str(end_time - start_time),
                                    "-i", file_path, "-ac", "1", "-ar", "16000", str(permanent_chunk_path)
                                ]
                            
                            # Write directly to the permanent path
                            subprocess.run(cmd, check=True, capture_output=True, timeout=120)  # Increased timeout
                            logger.info(f"Created chunk directly at permanent path: {permanent_chunk_path}")
                            
                            # Verify the file exists and has content
                            if os.path.exists(permanent_chunk_path) and os.path.getsize(permanent_chunk_path) > 0:
                                logger.info(f"Verified chunk file exists: {permanent_chunk_path} ({os.path.getsize(permanent_chunk_path)} bytes)")
                            else:
                                logger.error(f"Chunk file missing or empty: {permanent_chunk_path}")
                                
                            # Update progress - transcription phase (15-85%)
                            if progress_callback:
                                progress = 15.0 + (i / num_chunks * 70.0)
                                progress_callback(progress, "transcribing", f"Transcribing chunk {i+1}/{num_chunks}")
                            
                            # Clear CUDA cache before transcription
                            if torch.cuda.is_available():
                                torch.cuda.empty_cache()
                                logger.info(f"Cleared CUDA cache before transcribing chunk {i+1}/{num_chunks}")
                            
                            # Transcribe from the permanent path
                            result = whisper_model.transcribe(str(permanent_chunk_path))
                            text = result.get("text", "").strip()
                            
                            # Generate preview image for this chunk
                            img_data = None
                            if is_video:
                                img_data = self._extract_video_frame(str(permanent_chunk_path), 0)
                            
                            # Create a chunk with the transcription and paths
                            chunk = FileExtractChunk(
                                text=text,
                                page=i + 1,
                                start_time=start_time,
                                end_time=end_time,
                                image_data=img_data,
                                type='video_chunk' if is_video else 'audio_chunk',
                                video_chunk_path=str(permanent_chunk_path) if is_video else None,
                                audio_chunk_path=str(permanent_chunk_path) if not is_video else None
                            )
                            chunks.append(chunk)
                            
                        except Exception as e:
                            logger.error(f"Error processing chunk {i+1}/{num_chunks}: {str(e)}")
                    
                    # Final progress update
                    if progress_callback:
                        progress_callback(100.0, "complete", f"Extracted {len(chunks)} chunks")
                    
                except Exception as e:
                    logger.error(f"Error in chunked processing: {str(e)}")
                    # Create a fallback chunk with error information
                    chunk = FileExtractChunk(
                        text=f"Error processing file: {str(e)}",
                        page=1,
                        start_time=0,
                        end_time=0,
                        type='video_chunk' if is_video else 'audio_chunk'
                    )
                    chunks.append(chunk)
                    
                    # Error progress update
                    if progress_callback:
                        progress_callback(0.0, "error", f"Error: {str(e)}")
        
        except Exception as e:
            logger.error(f"Error in extract_audio_or_video: {str(e)}")
            # Create a minimal error chunk
            chunk = FileExtractChunk(
                text=f"Transcription failed. Error: {str(e)}",
                page=1,
                type='error'
            )
            chunks.append(chunk)
            
            # Error progress update
            if progress_callback:
                progress_callback(0.0, "error", f"Error: {str(e)}")
        
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

    def _write_audio_slice(
        self,
        src: str,
        start: float,
        end: float,
        dest_dir: Path,
        index: int
    ) -> Path:
        """
        Cut a [start,end) slice out of *src* (WAV/MP3/etc.)
        and write it to *dest_dir* as WAV (16-kHz mono).
        """
        dest_dir.mkdir(parents=True, exist_ok=True)
        out_path = dest_dir / f"chunk_{index:03d}.wav"

        duration = max(end - start, 0.01)
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start), "-t", str(duration),
            "-i", src,
            "-ac", "1", "-ar", "16000",     # ASR-friendly WAV
            out_path.as_posix()
        ]
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        return out_path

    def _write_video_slice(
        self,
        src: str,
        start: float,
        end: float,
        dest_dir: Path,
        index: int
    ) -> Path:
        """
        Cut a [start,end) slice out of *src* and write it to *dest_dir*.
        Returns the Path of the created file.
        """
        dest_dir.mkdir(parents=True, exist_ok=True)
        out_path = dest_dir / f"chunk_{index:03d}.mp4"

        duration = max(end - start, 0.01)   # ffmpeg needs >0
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start), "-t", str(duration),
            "-i", src,
            "-c", "copy",                    # copy streams, no re-encode
            str(out_path)
        ]
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        return out_path

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

    def extract_image_or_other(self, file_path: str, progress_callback=None) -> List[FileExtractChunk]:
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
                
                if progress_callback:
                    progress_callback(100.0, "complete", f"Extracted {len(img_data)} bytes")
                
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
                    
                    if progress_callback:
                        progress_callback(100.0, "complete", f"Extracted {len(img_data)} bytes")
                    
                    # Create a chunk with both text and image
                    chunk = FileExtractChunk(
                        text=text_content,
                        page=1,
                        image_data=img_data,
                        type='text'
                    )
                    
                    logger.info(f"Created text chunk: type={chunk.type}, image_data_size={len(chunk.image_data) if chunk.image_data else 0}")
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
                        logger.info(f"Created text chunk: type={chunk.type}, image_data_size={len(chunk.image_data) if chunk.image_data else 0}")
                        return [chunk]
                    except:
                        # If all else fails, return an empty chunk
                        chunk = FileExtractChunk(
                            text="",
                            page=1,
                            type='text'
                        )
                        logger.info(f"Created text chunk: type={chunk.type}, image_data_size={len(chunk.image_data) if chunk.image_data else 0}")
                        return [chunk]
            else:
                logger.info("File not detected as image or text, creating 'other' chunk")
                # For other file types, just create an empty chunk
                chunk = FileExtractChunk(
                    text="",
                    page=1,
                    type='other'
                )
                logger.info(f"Created other chunk: type={chunk.type}, image_data_size={len(chunk.image_data) if chunk.image_data else 0}")
                return [chunk]
                
        except Exception as e:
            logger.error(f"Error in extract_image_or_other: {str(e)}")
            # Return an empty chunk in case of error
            chunk = FileExtractChunk(
                text="",
                page=1,
                type='other'
            )
            logger.info(f"Created other chunk: type={chunk.type}, image_data_size={len(chunk.image_data) if chunk.image_data else 0}")
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

            os.unlink(temp_path) # delete temp file
            
            return img_data
        
        except Exception as e:
            logger.error(f"Error generating placeholder image: {str(e)}")
            # If all else fails, return an empty bytes object
            return b''
