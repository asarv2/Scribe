import os
import subprocess
import logging
import torch  # PyTorch for GPU detection
import shutil
import magic
from .models import FileCompressionResult
import fitz
import time
import concurrent.futures

logger = logging.getLogger(__name__)

class FileCompressor:
    def __init__(self):
        self.mime = magic.Magic(mime=True)
    
    def compress_file(self, input_path: str, output_dir: str, filename: str, 
                     target_width: int = 240, gpu_id: int = 0, 
                     quality: str = "ultrafast") -> FileCompressionResult:
        """
        Compress a file based on its detected MIME type
        
        Args:
            input_path: Path to the input file
            output_dir: Directory to save the compressed file
            filename: Original filename
            target_width: Target width for video compression (0 for original)
            gpu_id: GPU ID to use for video compression
            quality: Quality preset for video compression
            
        Returns:
            FileCompressionResult with path and metadata
        """
        try:
            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)
            
            # Detect MIME type
            mime_type = self.mime.from_file(input_path)
            logger.info(f"Compressing file: {filename} ({mime_type})")
            
            # Determine file type and compression method
            if mime_type.startswith('video/'):
                return self.compress_video_file(input_path, output_dir, filename, 
                                               target_width, gpu_id, quality)
            elif mime_type.startswith('audio/'):
                return self.compress_audio_file(input_path, output_dir, filename)
            elif mime_type == 'application/pdf':
                return self.compress_pdf_file(input_path, output_dir, filename)
            elif mime_type.startswith('image/'):
                return self.compress_image_file(input_path, output_dir, filename)
            else:
                return self.compress_other_file(input_path, output_dir, filename)
                
        except Exception as e:
            logger.error(f"Error compressing file: {str(e)}")
            return self._create_result(input_path)

    def compress_audio_file(self, input_path: str, output_dir: str, filename: str) -> FileCompressionResult:
        """Compress audio to WAV format with high-quality compression"""
        base_filename = os.path.splitext(filename)[0]
        compressed_filename = f"{base_filename}.wav"
        compressed_file_path = os.path.join(output_dir, compressed_filename)
        
        # Check if already compressed
        if os.path.exists(compressed_file_path):
            duration = self.get_media_duration(compressed_file_path)
            if duration > 0:
                logger.info(f"Using existing compressed audio: {compressed_file_path}")
                return self._create_result(compressed_file_path, duration)
        
        # Compress audio to WAV with high-quality PCM compression
        # Use hardware acceleration if available
        hwaccel_args = []
        if torch.cuda.is_available():
            hwaccel_args = ["-hwaccel", "cuda", "-hwaccel_device", "0"]
        
        cmd = [
            "ffmpeg", "-y"
        ] + hwaccel_args + [
            "-i", input_path,
            "-c:a", "pcm_s16le",  # 16-bit PCM audio (standard WAV format)
            "-ar", "44100",       # 44.1kHz sample rate (CD quality)
            compressed_file_path
        ]
        
        logger.info(f"Compressing audio to WAV: {compressed_file_path}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg audio compression error: {result.stderr}")
            return self._create_result(input_path)
        
        # Check compression results
        if os.path.exists(compressed_file_path):
            compressed_size = os.path.getsize(compressed_file_path)
            original_size = os.path.getsize(input_path)
            duration = self.get_media_duration(compressed_file_path)
            
            logger.info(f"Audio compression complete: {compressed_size/(1024*1024):.2f} MB (was {original_size/(1024*1024):.2f} MB)")
            
            # If compression made the file larger by more than 10%, use original
            if compressed_size > original_size * 1.1:
                logger.warning("WAV conversion increased file size significantly, using original")
                return self._create_result(input_path)
            
            return self._create_result(compressed_file_path, duration)
        else:
            logger.error("Compressed audio file not created")
            return self._create_result(input_path)

    def compress_video_file(self, input_path: str, output_dir: str, filename: str, 
                            target_width: int = 0, gpu_id: int = 0, 
                            quality: str = "medium") -> FileCompressionResult:
        """
        Compress a video file using GPU acceleration if available
        
        Args:
            input_path: Path to input video
            output_dir: Directory to save output
            filename: Base filename
            target_width: Target width (0 for no scaling)
            gpu_id: GPU ID to use (0 for first GPU)
            quality: Quality preset ("ultrafast", "low", "medium", "high")
        """
        # For very large files, use parallel processing
        if os.path.getsize(input_path) > 50_000_000:  # 50MB threshold
            compressed_path = self.process_large_video(input_path, output_dir, target_width, quality)
            duration = self.get_media_duration(compressed_path)
            return self._create_result(compressed_path, duration)
        else:
            compressed_path = self.compress_video_to_webm(input_path, output_dir, filename, 
                                                         target_width, gpu_id, quality)
            duration = self.get_media_duration(compressed_path)
            return self._create_result(compressed_path, duration)

    def compress_video_to_webm(self, input_path: str, output_dir: str, filename: str, 
                              target_width: int = 0, gpu_id: int = 0, 
                              quality: str = "medium") -> str:
        """
        Compress a video file to WebM (VP9) or, if an NVIDIA GPU is available,
        to MP4 using NVENC, with real-time progress reporting.
        
        Args:
            input_path: Path to input video
            output_dir: Directory to save output
            filename: Base filename
            target_width: Target width (0 for no scaling, height will be calculated automatically)
            gpu_id: GPU ID to use (0 for first GPU, 1 for second, etc.)
            quality: Quality preset ("ultrafast", "low", "medium", "high")
        """
        os.makedirs(output_dir, exist_ok=True)
        base, _ = os.path.splitext(filename)

        # Detect GPU
        gpu_available = torch.cuda.is_available() and torch.cuda.device_count() > gpu_id
        
        if gpu_available:
            logger.info(f"Using GPU {gpu_id} of {torch.cuda.device_count()} available GPUs")
        else:
            logger.warning(f"GPU {gpu_id} not available. Total GPUs: {torch.cuda.device_count()}")
            gpu_available = False  # Fallback to CPU

        # Scaling filter if target_width is specified
        scale_filter = []
        if target_width > 0:
            # Use standard scale filter instead of scale_npp which may not be available
            scale_filter = [
                "-vf", f"scale={target_width}:-2"  # Standard scaling works with CUDA
            ]
            base = f"{base}_{target_width}p"  # Add resolution to filename
        
        # Quality presets - add "ultrafast" option
        if quality == "ultrafast":
            bitrate = "200k"
            maxrate = "400k"
            bufsize = "800k"
            crf = 51  # Lowest possible quality for maximum speed
        elif quality == "low":
            bitrate = "300k"
            maxrate = "600k"
            bufsize = "1200k"
            crf = 45
        elif quality == "high":
            bitrate = "1M"
            maxrate = "2M"
            bufsize = "4M"
            crf = 35
        else:  # medium
            bitrate = "500k"
            maxrate = "1M"
            bufsize = "2M"
            crf = 40
        
        # Determine codec and container
        if gpu_available:
            out_filename = f"{base}_gpu{gpu_id}.mp4"  # Include GPU ID in filename
            hwaccel_args = ["-hwaccel", "cuda", "-hwaccel_device", str(gpu_id)]
            codec_args = [
                "-c:v", "h264_nvenc", 
                "-gpu", str(gpu_id),       # Specify GPU for NVENC
                "-preset", "p1",           # Fastest preset (p1-p7, p1 is fastest)
                "-tune", "ll",             # Low latency tuning
                "-rc:v", "vbr",            # Variable bitrate for better quality/size balance
                "-b:v", bitrate,           # Bitrate based on quality preset
                "-maxrate", maxrate,       # Max bitrate based on quality preset
                "-bufsize", bufsize,       # Buffer size based on quality preset
                "-g", "999",               # Keyframe interval - fewer keyframes = faster encoding
                "-bf", "0",                # Disable B-frames for faster encoding
                "-refs", "1",              # Use only 1 reference frame (faster)
                "-zerolatency", "1",       # Enable zero latency mode
                "-strict", "experimental", # Allow experimental options
                "-c:a", "copy",            # Copy audio instead of re-encoding
                "-movflags", "+faststart"  # Optimize for web streaming
            ]
            logger.info(f"GPU {gpu_id} detected: using NVDEC+NVENC for H.264 encoding")
        else:
            out_filename = f"{base}_cpu.mp4"  # Changed from WebM to MP4 for better compatibility
            hwaccel_args = []
            codec_args = [
                "-c:v", "libx264",          # Use H.264 instead of VP9 for better compatibility
                "-preset", "veryfast",      # Fast encoding preset
                "-crf", str(crf),           # CRF based on quality preset
                "-c:a", "aac",              # Use AAC audio instead of copy
                "-b:a", "128k"              # Set audio bitrate
            ]
            logger.info("No GPU detected: falling back to libx264 CPU encoding")

        compressed_path = os.path.join(output_dir, out_filename)

        # Skip if already compressed
        if os.path.exists(compressed_path) and self.get_media_duration(compressed_path) > 0:
            logger.info(f"Using existing file: {compressed_path}")
            return compressed_path

        # Get total duration for progress calculation
        total_duration = self.get_media_duration(input_path)

        # Build FFmpeg command with structured progress output
        cmd = [
            "ffmpeg", "-y"
        ] + hwaccel_args + [
            "-i", input_path
        ] + scale_filter + codec_args + [
            "-progress", "pipe:1",
            "-nostats",
            compressed_path
        ]

        logger.info(f"Running FFmpeg: {' '.join(cmd)}")

        # Launch FFmpeg and parse progress
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        percent = 0.0
        last_update_time = time.time()
        
        try:
            for line in proc.stdout:
                if line.startswith("out_time_ms="):
                    out_ms = int(line.strip().split("=", 1)[1])
                    percent = min(out_ms / 1000 / total_duration, 1.0)
                    
                    # Update progress at most once per second
                    current_time = time.time()
                    if current_time - last_update_time >= 1.0:
                        logger.info(f"Progress: {percent*100:5.1f}% (ETA: {(1-percent)*total_duration/60:.1f}m)")
                        last_update_time = current_time
                    
                elif line.startswith("progress=") and line.strip().endswith("end"):
                    logger.info("Progress: 100.0%")
                    break  # Break the loop when FFmpeg signals completion
                
            # Check if process is still running but not producing output
            if proc.poll() is None:
                logger.info("FFmpeg is still running but not producing output. Waiting...")
            
        except Exception as e:
            logger.error(f"Error during progress monitoring: {e}")
        
        proc.wait()
        
        # Check for errors
        if proc.returncode != 0:
            stderr = proc.stderr.read()
            logger.error(f"FFmpeg error: {stderr}")
            return input_path

        # Verify compression
        if os.path.exists(compressed_path):
            orig = os.path.getsize(input_path)
            comp = os.path.getsize(compressed_path)
            logger.info(f"Finished: {comp/1e6:.2f} MB (was {orig/1e6:.2f} MB)")
            if comp > orig * 1.1:
                logger.warning("Output larger than input; reverting")
                return input_path
            return compressed_path

        logger.error("Compression failed; returning original")
        return input_path

    def process_large_video(self, input_path, output_dir, target_width=480, quality="medium"):
        """Process a large video by splitting it and using multiple GPUs in parallel with maximum speed."""
        import tempfile
        import math
        import threading
        
        # Create output directory first
        os.makedirs(output_dir, exist_ok=True)
        
        # Define output path
        output_filename = f"{os.path.splitext(os.path.basename(input_path))[0]}_compressed.mp4"
        output_path = os.path.join(output_dir, output_filename)
        
        # Create temp directory for segments
        with tempfile.TemporaryDirectory() as temp_dir:
            # Get video duration
            duration = self.get_media_duration(input_path)
            
            # Split into extremely small segments for maximum parallelism
            segment_duration = 3.0  # 3 seconds per segment for extreme parallelism
            num_segments = math.ceil(duration / segment_duration)
            
            # Allow up to 2000 segments for very large files
            max_segments = min(num_segments, 2000)
            if max_segments < num_segments:
                segment_duration = duration / max_segments
                num_segments = max_segments
            
            logger.info(f"Splitting video into {num_segments} segments of {segment_duration:.1f}s each")
            
            # Extract segments in parallel with more workers
            segments = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=64) as executor:
                futures = []
                for i in range(num_segments):
                    start_time = i * segment_duration
                    segment_path = os.path.join(temp_dir, f"segment_{i}.mp4")
                    segments.append(segment_path)
                    
                    # Extract segment with hardware acceleration if available, otherwise use regular extraction
                    if torch.cuda.is_available():
                        cmd = [
                            "ffmpeg", "-y", "-hwaccel", "cuda", "-ss", str(start_time), "-i", input_path,
                            "-t", str(segment_duration), "-c", "copy", segment_path
                        ]
                    else:
                        cmd = [
                            "ffmpeg", "-y", "-ss", str(start_time), "-i", input_path,
                            "-t", str(segment_duration), "-c", "copy", segment_path
                        ]
                    futures.append(executor.submit(subprocess.run, cmd, check=True, capture_output=True))
                
                # Wait for all extractions to complete
                for future in concurrent.futures.as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        logger.error(f"Segment extraction failed: {e}")
            
            # Process segments in parallel using a multi-strategy approach
            compressed_segments = []
            num_gpus = max(1, torch.cuda.device_count())  # Ensure at least 1 "GPU" (CPU in this case)
            
            # Use fewer workers on CPU to avoid overloading
            workers_per_gpu = 8 if torch.cuda.is_available() else 4
            total_workers = num_gpus * workers_per_gpu
            
            logger.info(f"Using {num_gpus} {'GPUs' if torch.cuda.is_available() else 'CPU threads'} with {workers_per_gpu} workers per device ({total_workers} total workers)")
            
            # Create a thread-safe result collection
            results_lock = threading.Lock()
            
            # Create a thread-safe counter for progress tracking
            processed_count = 0
            processing_lock = threading.Lock()
            
            def compress_segment_aggressive(segment, temp_dir, segment_name, target_width, gpu_id, quality):
                """Compress a segment using the fastest possible method based on segment index"""
                nonlocal processed_count
                
                segment_index = int(segment_name.split('_')[1].split('.')[0])
                
                try:
                    # Use different strategies based on segment index to maximize throughput
                    if torch.cuda.is_available() and segment_index % 5 == 0:
                        # Every 5th segment: Try NVENC with ultrafast preset
                        try:
                            result = self.compress_video_to_webm(segment, temp_dir, segment_name, target_width, gpu_id, "ultrafast")
                        except Exception as e:
                            logger.debug(f"GPU encoding failed: {e}, falling back to CPU")
                            # If NVENC fails, use ultrafast CPU encoding
                            result = self.compress_video_cpu(segment, temp_dir, segment_name, target_width, "ultrafast")
                    else:
                        # All other segments: Use CPU with ultrafast preset
                        result = self.compress_video_cpu(segment, temp_dir, segment_name, target_width, "ultrafast")
                    
                    # Add to results in a thread-safe way
                    if result and os.path.exists(result):
                        with results_lock:
                            compressed_segments.append(result)
                    
                    # Update progress counter in a thread-safe way
                    with processing_lock:
                        processed_count += 1
                        if processed_count % 10 == 0 or processed_count == len(segments):
                            logger.info(f"Processed {processed_count}/{len(segments)} segments")
                    
                    return result
                except Exception as e:
                    # Just log and continue - we'll accept some failures
                    logger.debug(f"Compression failed for {segment_name}: {e}")
                    with processing_lock:
                        processed_count += 1
                        if processed_count % 10 == 0 or processed_count == len(segments):
                            logger.info(f"Processed {processed_count}/{len(segments)} segments")
                    return None
            
            # Process all segments with maximum parallelism
            with concurrent.futures.ThreadPoolExecutor(max_workers=total_workers) as executor:
                futures = []
                
                # Submit all jobs immediately - don't wait for results
                for i, segment in enumerate(segments):
                    gpu_id = i % max(1, num_gpus)
                    futures.append(executor.submit(
                        compress_segment_aggressive, segment, temp_dir, 
                        os.path.basename(segment), target_width, gpu_id, quality
                    ))
                
                # Wait for all compressions to complete
                for future in concurrent.futures.as_completed(futures):
                    try:
                        future.result()
                    except Exception:
                        # Ignore individual failures - we'll use whatever segments succeeded
                        pass
            
            # Sort segments by index to maintain video order
            compressed_segments.sort(key=lambda x: int(os.path.basename(x).split('_')[1].split('.')[0]))
            
            # Create file list for concatenation
            concat_file = os.path.join(temp_dir, "concat.txt")
            with open(concat_file, "w") as f:
                for segment in compressed_segments:
                    if os.path.exists(segment):
                        abs_path = os.path.abspath(segment)
                        f.write(f"file '{abs_path}'\n")
            
            # Check if we have enough valid segments (at least 50%)
            if len(compressed_segments) < len(segments) * 0.5:
                logger.warning(f"Only {len(compressed_segments)}/{len(segments)} segments were successfully compressed")
                if len(compressed_segments) < 10:  # If we have very few segments, return original
                    logger.error("Too few segments were compressed successfully")
                    return input_path
            
            try:
                # Fast concatenation with copy
                cmd = [
                    "ffmpeg", "-y", "-f", "concat", "-safe", "0", 
                    "-i", concat_file, "-c", "copy", output_path
                ]
                logger.info(f"Concatenating segments: {' '.join(cmd)}")
                subprocess.run(cmd, check=True, capture_output=True)
                return output_path
                
            except subprocess.CalledProcessError:
                # If concatenation fails, try with re-encoding
                try:
                    cmd = [
                        "ffmpeg", "-y", "-f", "concat", "-safe", "0", 
                        "-i", concat_file, 
                        "-c:v", "libx264", "-preset", "ultrafast",
                        "-b:v", "1000k", "-c:a", "copy", output_path
                    ]
                    logger.info(f"Re-encoding concatenation: {' '.join(cmd)}")
                    subprocess.run(cmd, check=True, capture_output=True)
                    return output_path
                except:
                    # If all else fails, return original
                    logger.error("All concatenation attempts failed")
                    return input_path

    def compress_video_cpu(self, input_path: str, output_dir: str, filename: str, 
                          target_width: int = 0, quality: str = "medium") -> str:
        """Fallback CPU-based compression when GPU encoding fails"""
        os.makedirs(output_dir, exist_ok=True)
        base, _ = os.path.splitext(filename)
        compressed_path = os.path.join(output_dir, f"{base}_cpu.mp4")
        
        # Get video duration for progress reporting
        total_duration = self.get_media_duration(input_path)
        if total_duration <= 0:
            total_duration = 10  # Default to 10 seconds if we can't determine duration
        
        # Set quality parameters based on preset
        if quality == "ultrafast":
            cpu_preset = "ultrafast"  # Use ultrafast instead of veryfast for maximum speed
            bitrate = "500k"
        elif quality == "low":
            cpu_preset = "medium"
            bitrate = "800k"
        elif quality == "high":
            cpu_preset = "slow"
            bitrate = "1500k"
        else:  # medium
            cpu_preset = "medium"
            bitrate = "1000k"
        
        # Build scaling filter if needed
        scale_filter = []
        if target_width > 0:
            scale_filter = ["-vf", f"scale={target_width}:-2"]
        
        # Use CPU encoding with libx264 instead of NVENC
        cmd = [
            "ffmpeg", "-y", "-i", input_path
        ]
        
        # Add scaling if needed
        if target_width > 0:
            cmd.extend(["-vf", f"scale={target_width}:-2"])
        
        # Add encoding parameters
        cmd.extend([
            "-c:v", "libx264", "-preset", cpu_preset, "-b:v", bitrate,
            "-c:a", "aac", "-b:a", "128k",
            compressed_path
        ])
        
        # Run with progress monitoring
        logger.debug(f"Running CPU encoding: {' '.join(cmd)}")
        
        # Use subprocess with pipe to monitor progress
        proc = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1
        )
        
        last_update_time = time.time()
        try:
            for line in proc.stderr:
                if "time=" in line:
                    # Extract time information
                    time_parts = line.split("time=")[1].split()[0].split(":")
                    if len(time_parts) == 3:
                        hours, minutes, seconds = time_parts
                        current_time = float(hours) * 3600 + float(minutes) * 60 + float(seconds)
                        percent = min(current_time / total_duration, 1.0)
                        
                        # Update progress at most once per second
                        current_clock = time.time()
                        if current_clock - last_update_time >= 1.0:
                            logger.info(f"Progress: {percent*100:5.1f}% (ETA: {(1-percent)*total_duration/60:.1f}m)")
                            last_update_time = current_clock
            
                # Check for completion
                if "progress=end" in line:
                    logger.info("Progress: 100.0%")
                    break
        except Exception as e:
            logger.error(f"Error during CPU encoding progress monitoring: {e}")
        
        # Wait for process to complete
        proc.wait()
        
        # Check for errors
        if proc.returncode != 0:
            logger.error(f"CPU encoding failed with return code {proc.returncode}")
            return input_path
        
        # Verify compression
        if os.path.exists(compressed_path):
            orig = os.path.getsize(input_path)
            comp = os.path.getsize(compressed_path)
            logger.info(f"CPU encoding finished: {comp/1e6:.2f} MB (was {orig/1e6:.2f} MB)")
            if comp > orig * 1.1:
                logger.warning("CPU output larger than input; reverting")
                return input_path
            return compressed_path
        
        logger.error("CPU compression failed; returning original")
        return input_path

    def compress_pdf_file(self, input_path: str, output_dir: str, filename: str) -> FileCompressionResult:
        """Compress PDF file - placeholder for future implementation"""
        # Get the number of pages in the PDF
        page_count = self.get_pdf_page_count(input_path)
        # For now, just return the original file
        # Could implement PDF compression in the future
        return self._create_result(input_path, file_length=page_count)

    def compress_image_file(self, input_path: str, output_dir: str, filename: str) -> FileCompressionResult:
        """Compress image file - placeholder for future implementation"""
        # For now, just return the original file
        # Could implement image compression in the future
        return self._create_result(input_path, file_length=1)

    def compress_other_file(self, input_path: str, output_dir: str, filename: str) -> FileCompressionResult:
        """Handle other file types - just return the original path"""
        return self._create_result(input_path, file_length=1)

    def get_media_duration(self, file_path: str) -> float:
        """
        Get the duration of a media file in seconds using ffprobe
        
        Args:
            file_path: Path to the media file
        
        Returns:
            Duration in seconds
        """
        duration_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", file_path
        ]
        
        try:
            duration = float(subprocess.check_output(duration_cmd).decode('utf-8').strip())
            return duration
        except Exception as e:
            logger.error(f"Error getting media duration: {str(e)}")
            return 0.0
            
    def _create_result(self, file_path: str, file_length: float = 0.0) -> FileCompressionResult:
        """
        Create a FileCompressionResult object with file metadata
        
        Args:
            file_path: Path to the file
            file_length: Duration of media file in seconds (if applicable)
            
        Returns:
            FileCompressionResult object
        """
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        file_extension = os.path.splitext(file_path)[1].lower().lstrip('.')
        
        return FileCompressionResult(
            file_path=file_path,
            file_length=int(file_length),
            file_size=file_size,
            file_extension=file_extension
        )

    def get_pdf_page_count(self, file_path: str) -> int:
        """
        Get the number of pages in a PDF file
        
        Args:
            file_path: Path to the PDF file
            
        Returns:
            Number of pages in the PDF
        """
        try:
            # using fitz
            with fitz.open(file_path) as pdf_document:
                return len(pdf_document)
        except Exception as e:
            logger.error(f"Error getting PDF page count: {str(e)}")
            return 1  # Default to 1 if we can't determine the page count