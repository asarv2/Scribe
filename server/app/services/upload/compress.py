# app/services/upload/compress.py
import os
import mimetypes
import subprocess
import time
import concurrent.futures
import logging
import torch
import magic
import fitz  # type: ignore
from pathlib import Path
from typing import Literal
from filelock import FileLock  # <── new ❶
from .upload_models import FileCompressionResult
from subprocess import TimeoutExpired, CalledProcessError

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Global LibreOffice lock so only one conversion runs per container
# (re-use the same file name as FileExtractor to avoid two independent locks).
_OFFICE_LOCK_PATH = Path("/tmp/libreoffice-convert.lock")
_OFFICE_LOCK = FileLock(str(_OFFICE_LOCK_PATH), timeout=180)  # 3 min
# ──────────────────────────────────────────────────────────────────────────────


class FileCompressor:
    def __init__(self):
        self.mime = magic.Magic(mime=True)

    # ────────────────────────────────────────────────────────────────────────
    # NEW helper ─ DOCX / PPTX ➜ PDF  (runs before any other compression)
    # ────────────────────────────────────────────────────────────────────────
    def _convert_office_to_pdf(
        self,
        input_path: str,
        output_dir: str,
        progress_callback=None,
        timeout: int = 600,
    ) -> str | None:  # pragma: no cover
        """
        Convert DOCX or PPTX to PDF using LibreOffice headless (soffice).
        Returns the path of the produced PDF or None on failure.
        """

        input_path_obj = Path(input_path)
        output_dir_obj = Path(output_dir)
        output_dir_obj.mkdir(parents=True, exist_ok=True)
        pdf_path = output_dir_obj / f"{input_path_obj.stem}.pdf"

        # reuse existing PDF
        if pdf_path.exists() and pdf_path.stat().st_size > 0:
            logger.info("Using cached PDF: %s", pdf_path)
            return str(pdf_path)

        if progress_callback:
            progress_callback(5.0, "converting", "Waiting for LibreOffice lock")

        try:
            with _OFFICE_LOCK:
                if progress_callback:
                    progress_callback(10.0, "converting", "LibreOffice lock acquired")

                cmd = [
                    "soffice",
                    "--headless",
                    "--nologo",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--convert-to",
                    "pdf:writer_pdf_Export",
                    "--outdir",
                    str(output_dir_obj),
                    str(input_path_obj),
                ]
                logger.info("Running conversion command: %s", " ".join(cmd))

                proc = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=timeout,
                    check=False,
                )

                if proc.returncode != 0:
                    stderr = proc.stderr.decode(errors="ignore").strip()
                    raise CalledProcessError(
                        proc.returncode, cmd, output=proc.stdout, stderr=stderr
                    )

                # verify output
                if not (pdf_path.exists() and pdf_path.stat().st_size > 0):
                    raise RuntimeError("soffice produced no output PDF")

                if progress_callback:
                    progress_callback(20.0, "converted", "Office file converted → PDF")
                return str(pdf_path)

        except TimeoutExpired:
            logger.error("LibreOffice conversion timed out for %s", input_path_obj)
        except CalledProcessError as e:
            logger.error("soffice conversion failed: %s", e.stderr or e)
        except Exception as e:
            logger.error("Office-to-PDF conversion error: %s", e)

        if progress_callback:
            progress_callback(0.0, "error", "Office conversion failed")
        return None

    # ────────────────────────────────────────────────────────────────────────

    # ────────────────────────────────────────────────────────────────────────
    # PUBLIC ENTRY POINT
    # ────────────────────────────────────────────────────────────────────────

    def compress_file(
        self,
        input_path: str,
        output_dir: str,
        filename: str,
        *,
        target_width: int = 240,
        gpu_id: int = 0,
        quality: str = "ultrafast",
        progress_callback=None,
    ) -> FileCompressionResult:
        try:
            os.makedirs(output_dir, exist_ok=True)

            # ── MIME sniffing (don't trust extension) ─────────────────────────
            mime_type = self.mime.from_file(input_path)
            logger.info("Compressing %s (%s)", filename, mime_type)
            if progress_callback:
                progress_callback(0.0, "start", f"Detected MIME: {mime_type}")

            # ── NEW ❷  :  pre-convert Office files here ───────────────────────
            if mime_type in (
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ):
                pdf_path = self._convert_office_to_pdf(
                    input_path, output_dir, progress_callback
                )
                if pdf_path:
                    # After conversion we simply fall through to the normal PDF path
                    input_path = pdf_path
                    filename = os.path.basename(pdf_path)
                    mime_type = "application/pdf"
                else:
                    # failed: treat like "other"
                    mime_type = "application/octet-stream"

            # ── Choose compression branch ─────────────────────────────────────
            if mime_type.startswith("video/"):
                return self.compress_video_file(
                    input_path,
                    output_dir,
                    filename,
                    target_width,
                    gpu_id,
                    quality,
                    progress_callback,
                )

            elif mime_type.startswith("audio/"):
                return self.compress_audio_file(
                    input_path, output_dir, filename, progress_callback
                )

            elif mime_type == "application/pdf":
                return self.compress_pdf_file(
                    input_path, output_dir, filename, progress_callback
                )

            elif mime_type.startswith("image/"):
                return self.compress_image_file(
                    input_path, output_dir, filename, progress_callback
                )

            # Fallback – nothing to do
            if progress_callback:
                progress_callback(100.0, "complete", "No compression needed")
            return self.compress_other_file(input_path, output_dir, filename)

        except Exception as e:
            logger.error(f"Error compressing file: {str(e)}")
            if progress_callback:
                progress_callback(0.0, "error", str(e))
            return self._create_result(input_path)

    def compress_audio_file(
        self, input_path: str, output_dir: str, filename: str, progress_callback=None
    ) -> FileCompressionResult:  # pragma: no cover
        """Compress audio to WAV format with high-quality compression"""
        base_filename = os.path.splitext(filename)[0]
        compressed_filename = f"{base_filename}.wav"
        compressed_file_path = os.path.join(output_dir, compressed_filename)

        # Check if already compressed
        if os.path.exists(compressed_file_path):
            duration = self.get_media_duration(compressed_file_path)
            if duration > 0:
                logger.info(f"Using existing compressed audio: {compressed_file_path}")
                if progress_callback:
                    progress_callback(
                        100.0, "complete", "Using existing compressed file"
                    )
                return self._create_result(
                    compressed_file_path, duration, file_type="audio"
                )

        # Report progress
        if progress_callback:
            progress_callback(10.0, "preparing", "Setting up audio compression")

        # Compress audio to WAV with high-quality PCM compression
        # Use hardware acceleration if available
        hwaccel_args = []
        if torch.cuda.is_available():
            hwaccel_args = ["-hwaccel", "cuda", "-hwaccel_device", "0"]

        cmd = (
            ["ffmpeg", "-y"]
            + hwaccel_args
            + [
                "-i",
                input_path,
                "-c:a",
                "pcm_s16le",  # 16-bit PCM audio (standard WAV format)
                "-ar",
                "44100",  # 44.1kHz sample rate (CD quality)
                compressed_file_path,
            ]
        )

        logger.info(f"Compressing audio to WAV: {compressed_file_path}")
        if progress_callback:
            progress_callback(20.0, "compressing", "Converting audio to WAV format")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"FFmpeg audio compression error: {result.stderr}")
            if progress_callback:
                progress_callback(0.0, "error", "Audio compression failed")
            return self._create_result(input_path, file_type="audio")

        # Check compression results
        if os.path.exists(compressed_file_path):
            compressed_size = os.path.getsize(compressed_file_path)
            original_size = os.path.getsize(input_path)
            duration = self.get_media_duration(compressed_file_path)

            logger.info(
                f"Audio compression complete: {compressed_size / (1024 * 1024):.2f} MB (was {original_size / (1024 * 1024):.2f} MB)"
            )

            # If compression made the file larger by more than 10%, use original
            if compressed_size > original_size * 1.1:
                logger.warning(
                    "WAV conversion increased file size significantly, using original"
                )
                if progress_callback:
                    progress_callback(
                        100.0,
                        "complete",
                        "Using original file (compressed version was larger)",
                    )
                return self._create_result(input_path, file_type="audio")

            if progress_callback:
                progress_callback(
                    100.0,
                    "complete",
                    f"Audio compressed: {compressed_size / (1024 * 1024):.2f} MB",
                )
            return self._create_result(
                compressed_file_path, duration, file_type="audio"
            )
        else:
            logger.error("Compressed audio file not created")
            if progress_callback:
                progress_callback(0.0, "error", "Compressed file not created")
            return self._create_result(input_path, file_type="audio")

    def compress_video_file(
        self,
        input_path: str,
        output_dir: str,
        filename: str,
        target_width: int = 0,
        gpu_id: int = 0,
        quality: str = "medium",
        progress_callback=None,
    ) -> FileCompressionResult:  # pragma: no cover
        """
        Compress a video file using GPU acceleration if available

        Args:
            input_path: Path to input video
            output_dir: Directory to save output
            filename: Base filename
            target_width: Target width (0 for no scaling)
            gpu_id: GPU ID to use (0 for first GPU)
            quality: Quality preset ("ultrafast", "low", "medium", "high")
            progress_callback: Optional callback for progress updates
        """
        # For very large files, use parallel processing
        if os.path.getsize(input_path) > 50_000_000:  # 50MB threshold
            if progress_callback:
                progress_callback(
                    5.0,
                    "analyzing",
                    "Large video detected, preparing for parallel processing",
                )

            compressed_path = self.process_large_video(
                input_path, output_dir, target_width, quality, progress_callback
            )
            duration = self.get_media_duration(compressed_path)

            if progress_callback:
                progress_callback(100.0, "complete", "Large video compression complete")

            return self._create_result(compressed_path, duration, file_type="video")
        else:
            if progress_callback:
                progress_callback(5.0, "analyzing", "Standard video detected")

            compressed_path = self.compress_video_to_webm(
                input_path,
                output_dir,
                filename,
                target_width,
                gpu_id,
                quality,
                progress_callback,
            )
            duration = self.get_media_duration(compressed_path)

            if progress_callback:
                progress_callback(100.0, "complete", "Video compression complete")

            return self._create_result(compressed_path, duration, file_type="video")

    def compress_video_to_webm(
        self,
        input_path: str,
        output_dir: str,
        filename: str,
        target_width: int = 0,
        gpu_id: int = 0,
        quality: str = "medium",
        progress_callback=None,
    ) -> str:  # pragma: no cover
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
            progress_callback: Optional callback for progress updates
        """
        os.makedirs(output_dir, exist_ok=True)
        base, _ = os.path.splitext(filename)

        # Detect GPU
        gpu_available = torch.cuda.is_available() and torch.cuda.device_count() > gpu_id

        if gpu_available:
            logger.info(
                f"Using GPU {gpu_id} of {torch.cuda.device_count()} available GPUs"
            )
            if progress_callback:
                progress_callback(10.0, "preparing", f"Using GPU {gpu_id} for encoding")
        else:
            logger.warning(
                f"GPU {gpu_id} not available. Total GPUs: {torch.cuda.device_count()}"
            )
            if progress_callback:
                progress_callback(
                    10.0, "preparing", "Using CPU for encoding (no GPU available)"
                )
            gpu_available = False  # Fallback to CPU

        # Scaling filter if target_width is specified
        scale_filter = []

        # Modify scale_filter to include format conversion to 8-bit
        if target_width > 0:
            scale_filter = [
                "-vf",
                f"scale={target_width}:-2,format=yuv420p",  # Add format=yuv420p to convert to 8-bit
            ]
        else:
            scale_filter = ["-vf", "format=yuv420p"]  # Add even if no scaling

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
                "-c:v",
                "h264_nvenc",
                "-gpu",
                str(gpu_id),  # Specify GPU for NVENC
                "-preset",
                "p1",  # Fastest preset (p1-p7, p1 is fastest)
                "-tune",
                "ll",  # Low latency tuning
                "-rc:v",
                "vbr",  # Variable bitrate for better quality/size balance
                "-b:v",
                bitrate,  # Bitrate based on quality preset
                "-maxrate",
                maxrate,  # Max bitrate based on quality preset
                "-bufsize",
                bufsize,  # Buffer size based on quality preset
                "-g",
                "999",  # Keyframe interval - fewer keyframes = faster encoding
                "-bf",
                "0",  # Disable B-frames for faster encoding
                "-refs",
                "1",  # Use only 1 reference frame (faster)
                "-zerolatency",
                "1",  # Enable zero latency mode
                "-strict",
                "experimental",  # Allow experimental options
                "-c:a",
                "copy",  # Copy audio instead of re-encoding
                "-movflags",
                "+faststart",  # Optimize for web streaming
            ]
            logger.info(f"GPU {gpu_id} detected: using NVDEC+NVENC for H.264 encoding")
        else:
            out_filename = (
                f"{base}_cpu.mp4"  # Changed from WebM to MP4 for better compatibility
            )
            hwaccel_args = []
            codec_args = [
                "-c:v",
                "libx264",  # Use H.264 instead of VP9 for better compatibility
                "-preset",
                "veryfast",  # Fast encoding preset
                "-crf",
                str(crf),  # CRF based on quality preset
                "-c:a",
                "aac",  # Use AAC audio instead of copy
                "-b:a",
                "128k",  # Set audio bitrate
            ]
            logger.info("No GPU detected: falling back to libx264 CPU encoding")

        compressed_path = os.path.join(output_dir, out_filename)

        # Skip if already compressed
        if (
            os.path.exists(compressed_path)
            and self.get_media_duration(compressed_path) > 0
        ):
            logger.info(f"Using existing file: {compressed_path}")
            return compressed_path

        # Get total duration for progress calculation
        total_duration = self.get_media_duration(input_path)
        if total_duration <= 0:
            total_duration = (
                10.0  # Default to 10 seconds if we can't determine duration
            )

        # Build FFmpeg command with structured progress output
        cmd = (
            ["ffmpeg", "-y"]
            + hwaccel_args
            + ["-i", input_path]
            + scale_filter
            + codec_args
            + ["-progress", "pipe:1", "-nostats", compressed_path]
        )

        logger.info(f"Running FFmpeg: {' '.join(cmd)}")
        if progress_callback:
            progress_callback(20.0, "encoding", "Starting video encoding")

        # Launch FFmpeg and parse progress
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1
        )
        percent = 0.0
        last_update_time = time.time()
        last_callback_time = time.time()

        try:
            if proc.stdout:
                for line in proc.stdout:
                    if line.startswith("out_time_ms="):
                        out_ms = int(line.strip().split("=", 1)[1])
                        if total_duration:
                            percent = min(out_ms / 1000 / total_duration, 1.0)

                            # Update progress at most once per second
                            current_time = time.time()
                            if current_time - last_update_time >= 1.0:
                                logger.info(
                                    f"Progress: {percent * 100:5.1f}% (ETA: {(1 - percent) * total_duration / 60:.1f}m)"
                                )
                                last_update_time = current_time

                            # Call progress callback at most once every 3 seconds to avoid overwhelming the system
                            if (
                                progress_callback
                                and current_time - last_callback_time >= 3.0
                            ):
                                # Scale percent from 0-1 to 20-90 (reserving 0-20 for setup and 90-100 for finalization)
                                callback_percent = 20.0 + (percent * 70.0)
                                progress_callback(
                                    callback_percent,
                                    "encoding",
                                    f"{percent * 100:.1f}% (ETA: {(1 - percent) * total_duration / 60:.1f}m)",
                                )
                                last_callback_time = current_time

                    elif line.startswith("progress=") and line.strip().endswith("end"):
                        logger.info("Progress: 100.0%")
                        if progress_callback:
                            progress_callback(
                                90.0, "finalizing", "Encoding complete, finalizing file"
                            )
                        break  # Break the loop when FFmpeg signals completion

            # Check if process is still running but not producing output
            if proc.poll() is None:
                logger.info(
                    "FFmpeg is still running but not producing output. Waiting..."
                )

        except Exception as e:
            logger.error(f"Error during progress monitoring: {e}")

        proc.wait()

        # Check for errors
        if proc.returncode != 0:
            stderr = ""
            if proc.stderr:
                stderr = proc.stderr.read()
            logger.error(f"FFmpeg error: {stderr}")
            if progress_callback:
                progress_callback(0.0, "error", "Video encoding failed")
            return input_path

        # Verify compression
        if os.path.exists(compressed_path):
            orig = os.path.getsize(input_path)
            comp = os.path.getsize(compressed_path)
            logger.info(f"Finished: {comp / 1e6:.2f} MB (was {orig / 1e6:.2f} MB)")
            if comp > orig * 1.1:
                logger.warning("Output larger than input; reverting")
                if progress_callback:
                    progress_callback(
                        100.0,
                        "complete",
                        "Using original file (compressed version was larger)",
                    )
                return input_path

            if progress_callback:
                progress_callback(
                    100.0,
                    "complete",
                    f"Video compressed: {comp / 1e6:.2f} MB (was {orig / 1e6:.2f} MB)",
                )
            return compressed_path

        logger.error("Compression failed; returning original")
        if progress_callback:
            progress_callback(0.0, "error", "Compression failed")
        return input_path

    def process_large_video(
        self,
        input_path,
        output_dir,
        target_width=480,
        quality="medium",
        progress_callback=None,
    ):  # pragma: no cover
        """Process a large video by splitting it and using multiple GPUs in parallel with maximum speed."""
        import tempfile
        import math
        import threading

        # Create output directory first
        os.makedirs(output_dir, exist_ok=True)

        # Define output path
        output_filename = (
            f"{os.path.splitext(os.path.basename(input_path))[0]}_compressed.mp4"
        )
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

            logger.info(
                f"Splitting video into {num_segments} segments of {segment_duration:.1f}s each"
            )
            if progress_callback:
                progress_callback(
                    10.0, "splitting", f"Splitting video into {num_segments} segments"
                )

            num_gpus = max(1, torch.cuda.device_count())
            workers_per_gpu = 8 if torch.cuda.is_available() else 4
            total_workers = num_gpus * workers_per_gpu
            max_workers = min(
                total_workers, num_segments
            )  # <-- move here, after total_workers

            logger.info(
                f"Using {num_gpus} {'GPUs' if torch.cuda.is_available() else 'CPU threads'} with {workers_per_gpu} workers per device ({total_workers} total workers)"
            )

            # Extract segments in parallel with more workers
            segments = []
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=max_workers
            ) as executor:
                futures = []
                for i in range(num_segments):
                    start_time = i * segment_duration
                    segment_path = os.path.join(temp_dir, f"segment_{i}.mp4")
                    segments.append(segment_path)

                    # Extract segment with hardware acceleration if available, otherwise use regular extraction
                    if torch.cuda.is_available():
                        cmd = [
                            "ffmpeg",
                            "-y",
                            "-hwaccel",
                            "cuda",
                            "-ss",
                            str(start_time),
                            "-i",
                            input_path,
                            "-t",
                            str(segment_duration),
                            "-c",
                            "copy",
                            segment_path,
                        ]
                    else:
                        cmd = [
                            "ffmpeg",
                            "-y",
                            "-ss",
                            str(start_time),
                            "-i",
                            input_path,
                            "-t",
                            str(segment_duration),
                            "-c",
                            "copy",
                            segment_path,
                        ]
                    futures.append(
                        executor.submit(
                            subprocess.run, cmd, check=True, capture_output=True
                        )
                    )

                # Wait for all extractions to complete with progress updates
                completed = 0
                for future in concurrent.futures.as_completed(futures):
                    try:
                        future.result()
                        completed += 1
                        if (
                            progress_callback
                            and completed % max(1, num_segments // 10) == 0
                        ):
                            # Scale progress from 10-30%
                            progress = 10.0 + (completed / num_segments * 20.0)
                            progress_callback(
                                progress,
                                "splitting",
                                f"Split {completed}/{num_segments} segments",
                            )
                    except Exception as e:
                        logger.error(f"Segment extraction failed: {e}")

            if progress_callback:
                progress_callback(
                    30.0, "compressing", "Starting parallel compression of segments"
                )

            # Process segments in parallel using a multi-strategy approach
            compressed_segments = []

            # Create a thread-safe result collection
            results_lock = threading.Lock()

            # Create a thread-safe counter for progress tracking
            processed_count = 0
            processing_lock = threading.Lock()

            def compress_segment_aggressive(
                segment, temp_dir, segment_name, target_width, gpu_id, quality
            ):
                """Compress a segment using the fastest possible method based on segment index"""
                nonlocal processed_count

                segment_index = int(segment_name.split("_")[1].split(".")[0])

                try:
                    # Use different strategies based on segment index to maximize throughput
                    if torch.cuda.is_available() and segment_index % 5 == 0:
                        # Every 5th segment: Try NVENC with ultrafast preset
                        try:
                            result = self.compress_video_to_webm(
                                segment,
                                temp_dir,
                                segment_name,
                                target_width,
                                gpu_id,
                                "ultrafast",
                            )
                        except Exception as e:
                            logger.debug(
                                f"GPU encoding failed: {e}, falling back to CPU"
                            )
                            # If NVENC fails, use ultrafast CPU encoding
                            result = self.compress_video_cpu(
                                segment,
                                temp_dir,
                                segment_name,
                                target_width,
                                "ultrafast",
                            )
                    else:
                        # All other segments: Use CPU with ultrafast preset
                        result = self.compress_video_cpu(
                            segment, temp_dir, segment_name, target_width, "ultrafast"
                        )

                    # Add to results in a thread-safe way
                    if result and os.path.exists(result):
                        with results_lock:
                            compressed_segments.append(result)

                    # Update progress counter in a thread-safe way
                    with processing_lock:
                        processed_count += 1
                        if processed_count % 10 == 0 or processed_count == len(
                            segments
                        ):
                            logger.info(
                                f"Processed {processed_count}/{len(segments)} segments"
                            )

                            # Update progress callback if provided (scale from 30-80%)
                            if progress_callback:
                                progress = 30.0 + (
                                    processed_count / len(segments) * 50.0
                                )
                                progress_callback(
                                    progress,
                                    "compressing",
                                    f"Compressed {processed_count}/{len(segments)} segments",
                                )

                    return result
                except Exception as e:
                    # Just log and continue - we'll accept some failures
                    logger.debug(f"Compression failed for {segment_name}: {e}")
                    with processing_lock:
                        processed_count += 1
                        if processed_count % 10 == 0 or processed_count == len(
                            segments
                        ):
                            logger.info(
                                f"Processed {processed_count}/{len(segments)} segments"
                            )

                            # Update progress callback if provided
                            if progress_callback:
                                progress = 30.0 + (
                                    processed_count / len(segments) * 50.0
                                )
                                progress_callback(
                                    progress,
                                    "compressing",
                                    f"Compressed {processed_count}/{len(segments)} segments",
                                )
                    return None

            # Process all segments with maximum parallelism
            with concurrent.futures.ThreadPoolExecutor(
                max_workers=total_workers
            ) as executor:
                futures = []

                # Submit all jobs immediately - don't wait for results
                for i, segment in enumerate(segments):
                    gpu_id = i % max(1, num_gpus)
                    futures.append(
                        executor.submit(
                            compress_segment_aggressive,
                            segment,
                            temp_dir,
                            os.path.basename(segment),
                            target_width,
                            gpu_id,
                            quality,
                        )
                    )

                # Wait for all compressions to complete
                for future in concurrent.futures.as_completed(futures):
                    try:
                        future.result()
                    except Exception:
                        # Ignore individual failures - we'll use whatever segments succeeded
                        pass

            # Sort segments by index to maintain video order
            compressed_segments.sort(
                key=lambda x: int(os.path.basename(x).split("_")[1].split(".")[0])
            )

            # Create file list for concatenation
            concat_file = os.path.join(temp_dir, "concat.txt")
            with open(concat_file, "w") as f:
                for segment in compressed_segments:
                    if os.path.exists(segment):
                        abs_path = os.path.abspath(segment)
                        f.write(f"file '{abs_path}'\n")

            # Check if we have enough valid segments (at least 50%)
            if len(compressed_segments) < len(segments) * 0.5:
                logger.warning(
                    f"Only {len(compressed_segments)}/{len(segments)} segments were successfully compressed"
                )
                if (
                    len(compressed_segments) < 10
                ):  # If we have very few segments, return original
                    logger.error("Too few segments were compressed successfully")
                    if progress_callback:
                        progress_callback(
                            0.0,
                            "error",
                            "Too few segments were compressed successfully",
                        )
                    return input_path

            if progress_callback:
                progress_callback(80.0, "merging", "Merging compressed segments")

            try:
                # Fast concatenation with copy
                cmd = [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    concat_file,
                    "-c",
                    "copy",
                    output_path,
                ]
                logger.info(f"Concatenating segments: {' '.join(cmd)}")
                subprocess.run(cmd, check=True, capture_output=True)

                if progress_callback:
                    progress_callback(95.0, "finalizing", "Finalizing compressed video")

                return output_path

            except subprocess.CalledProcessError:
                # If concatenation fails, try with re-encoding
                try:
                    if progress_callback:
                        progress_callback(
                            85.0,
                            "merging",
                            "First merge attempt failed, trying with re-encoding",
                        )

                    cmd = [
                        "ffmpeg",
                        "-y",
                        "-f",
                        "concat",
                        "-safe",
                        "0",
                        "-i",
                        concat_file,
                        "-c:v",
                        "libx264",
                        "-preset",
                        "ultrafast",
                        "-b:v",
                        "1000k",
                        "-c:a",
                        "copy",
                        output_path,
                    ]
                    logger.info(f"Re-encoding concatenation: {' '.join(cmd)}")
                    subprocess.run(cmd, check=True, capture_output=True)

                    if progress_callback:
                        progress_callback(
                            95.0, "finalizing", "Finalizing compressed video"
                        )

                    return output_path
                except Exception as e:
                    # If all else fails, return original
                    logger.error(f"All concatenation attempts failed: {e}")
                    if progress_callback:
                        progress_callback(
                            0.0, "error", "Failed to merge video segments"
                        )
                    return input_path

    def compress_video_cpu(
        self,
        input_path: str,
        output_dir: str,
        filename: str,
        target_width: int = 0,
        quality: str = "medium",
    ) -> str:  # pragma: no cover
        """Fallback CPU-based compression when GPU encoding fails"""
        os.makedirs(output_dir, exist_ok=True)
        base, _ = os.path.splitext(filename)
        compressed_path = os.path.join(output_dir, f"{base}_cpu.mp4")

        # Get video duration for progress reporting
        total_duration = self.get_media_duration(input_path)
        if total_duration <= 0:
            total_duration = (
                10.0  # Default to 10 seconds if we can't determine duration
            )

        # Set quality parameters based on preset
        if quality == "ultrafast":
            cpu_preset = (
                "ultrafast"  # Use ultrafast instead of veryfast for maximum speed
            )
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

        # Use CPU encoding with libx264 instead of NVENC
        cmd = ["ffmpeg", "-y", "-i", input_path]

        # Add scaling if needed
        if target_width > 0:
            cmd.extend(["-vf", f"scale={target_width}:-2"])

        # Add encoding parameters
        cmd.extend(
            [
                "-c:v",
                "libx264",
                "-preset",
                cpu_preset,
                "-b:v",
                bitrate,
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                compressed_path,
            ]
        )

        # Run with progress monitoring
        logger.debug(f"Running CPU encoding: {' '.join(cmd)}")

        # Use subprocess with pipe to monitor progress
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            bufsize=1,
        )

        last_update_time = time.time()
        try:
            if proc.stderr:
                for line in proc.stderr:
                    if "time=" in line:
                        # Extract time information
                        time_parts = line.split("time=")[1].split()[0].split(":")
                        if len(time_parts) == 3:
                            hours, minutes, seconds = time_parts
                            current_time = (
                                float(hours) * 3600
                                + float(minutes) * 60
                                + float(seconds)
                            )
                            percent = min(current_time / total_duration, 1.0)

                            # Update progress at most once per second
                            current_clock = time.time()
                            if current_clock - last_update_time >= 1.0:
                                logger.info(
                                    f"Progress: {percent * 100:5.1f}% (ETA: {(1 - percent) * total_duration / 60:.1f}m)"
                                )
                                last_update_time = current_clock

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
            logger.info(
                f"CPU encoding finished: {comp / 1e6:.2f} MB (was {orig / 1e6:.2f} MB)"
            )
            if comp > orig * 1.1:
                logger.warning("CPU output larger than input; reverting")
                return input_path
            return compressed_path

        logger.error("CPU compression failed; returning original")
        return input_path

    def compress_pdf_file(
        self, input_path: str, output_dir: str, filename: str, progress_callback=None
    ) -> FileCompressionResult:
        """Compress PDF file - placeholder for future implementation"""
        # Get the number of pages in the PDF
        if progress_callback:
            progress_callback(10.0, "analyzing", "Analyzing PDF document")

        page_count = self.get_pdf_page_count(input_path)

        if progress_callback:
            progress_callback(
                100.0, "complete", f"PDF processing complete ({page_count} pages)"
            )

        # For now, just return the original file
        # Could implement PDF compression in the future
        return self._create_result(
            input_path, file_length=page_count, file_type="pdf"
        )  # in case we convert from docx/pptx

    def compress_image_file(
        self, input_path: str, output_dir: str, filename: str, progress_callback=None
    ) -> FileCompressionResult:
        """Compress image file - placeholder for future implementation"""
        # For now, just return the original file
        if progress_callback:
            progress_callback(50.0, "processing", "Processing image")
            progress_callback(100.0, "complete", "Image processing complete")

        # Could implement image compression in the future
        return self._create_result(input_path, file_length=1, file_type="image")

    def compress_other_file(
        self, input_path: str, output_dir: str, filename: str
    ) -> FileCompressionResult:
        """Handle other file types - just return the original path"""
        return self._create_result(input_path, file_length=1, file_type="other")

    def get_media_duration(self, file_path: str) -> float:  # pragma: no cover
        """
        Get the duration of a media file in seconds using ffprobe

        Args:
            file_path: Path to the media file

        Returns:
            Duration in seconds
        """
        duration_cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            file_path,
        ]

        try:
            duration = float(
                subprocess.check_output(duration_cmd).decode("utf-8").strip()
            )
            return duration
        except Exception as e:
            logger.error(f"Error getting media duration: {str(e)}")
            return 0.0

    def _create_result(
        self,
        file_path: str,
        file_length: float = 0.0,
        file_type: Literal["pdf", "audio", "video", "image", "other"] | None = None,
    ) -> FileCompressionResult:
        """
        Create a FileCompressionResult object with file metadata

        Args:
            file_path: Path to the file
            file_length: Duration of media file in seconds (if applicable)

        Returns:
            FileCompressionResult object
        """
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        # Extract extension and handle cases where it might be missing
        file_extension = os.path.splitext(file_path)[1].lower().lstrip(".")

        # If extension is empty, try to determine it from MIME type
        if not file_extension and os.path.exists(file_path):
            try:
                # First try using magic to get MIME type
                mime_type = self.mime.from_file(file_path)

                # Get extension from MIME type
                guessed_extension = mimetypes.guess_extension(mime_type)
                if guessed_extension:
                    file_extension = guessed_extension.lstrip(".")

                # If still empty, use a fallback based on MIME type
                if not file_extension:
                    if mime_type.startswith("video/"):
                        file_extension = "mp4"
                    elif mime_type.startswith("audio/"):
                        file_extension = "wav"
                    elif mime_type.startswith("image/"):
                        file_extension = "jpg"
                    elif mime_type == "application/pdf":
                        file_extension = "pdf"
                    else:
                        file_extension = ""  # Binary file as fallback
            except Exception as e:
                logger.warning(f"Error determining file extension from MIME type: {e}")
                file_extension = ""  # Default fallback

        # Final fallback if everything else failed
        if not file_extension:
            file_extension = ""

        return FileCompressionResult(
            file_path=file_path,
            file_length=int(file_length),
            file_size=file_size,
            file_extension=file_extension,
            file_type=file_type,
        )

    def get_pdf_page_count(self, file_path: str) -> int:  # pragma: no cover
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
