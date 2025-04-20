import os
import subprocess
import logging
import math
from typing import Tuple, List

logger = logging.getLogger(__name__)

def compress_video_to_webm(input_path: str, output_dir: str, filename: str) -> str:
    """
    Compress a video file to webm format using ffmpeg
    
    Args:
        input_path: Path to the input video file
        output_dir: Directory to save the compressed file
        filename: Original filename
    
    Returns:
        Path to the compressed file
    """
    try:
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Compressed filename
        compressed_filename = f"{os.path.splitext(filename)[0]}.webm"
        compressed_file_path = os.path.join(output_dir, compressed_filename)
        
        # Check if the file already exists and is valid
        if os.path.exists(compressed_file_path):
            # Verify the file is valid by checking duration
            duration = get_media_duration(compressed_file_path)
            if duration > 0:
                logger.info(f"Using existing compressed file: {compressed_file_path}")
                return compressed_file_path
        
        # Compress video to webm with reasonable quality
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libvpx-vp9", 
            "-crf", "30", "-b:v", "0",  # Constant quality
            "-c:a", "libopus",
            compressed_file_path
        ]
        
        logger.info(f"Compressing video to webm: {compressed_file_path}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            return input_path
        
        # Verify the compressed file exists and has a reasonable size
        if os.path.exists(compressed_file_path):
            compressed_size = os.path.getsize(compressed_file_path) / (1024 * 1024)
            original_size = os.path.getsize(input_path) / (1024 * 1024)
            
            logger.info(f"Video compression complete: {compressed_size:.2f} MB (was {original_size:.2f} MB)")
            
            # If compression actually made the file larger, use the original
            if compressed_size > original_size * 1.1:  # 10% larger
                logger.warning("Compression increased file size, using original")
                return input_path
                
            return compressed_file_path
        else:
            logger.error("Compressed file not created")
            return input_path
            
    except Exception as e:
        logger.error(f"Error compressing video: {str(e)}")
        # Return the original file path if compression fails
        return input_path

def get_media_duration(file_path: str) -> float:
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

def split_media_into_chunks(
    file_path: str, 
    output_dir: str, 
    filename: str, 
    file_type: str,
    file_size_mb: float,
    target_chunk_size_mb: float = 90
) -> Tuple[List[str], int]:
    """
    Split a large media file into smaller chunks using ffmpeg
    
    Args:
        file_path: Path to the media file
        output_dir: Directory to save the chunks
        filename: Original filename
        file_type: Type of file ('video' or 'audio')
        file_size_mb: Size of the file in MB
        target_chunk_size_mb: Target size for each chunk in MB
    
    Returns:
        Tuple of (list of chunk file paths, number of chunks)
    """
    try:
        # Create chunks directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Get media duration
        duration = get_media_duration(file_path)
        if duration <= 0:
            raise ValueError("Could not determine media duration")
        
        # Calculate number of chunks needed
        num_chunks = math.ceil(file_size_mb / target_chunk_size_mb)
        chunk_duration = duration / num_chunks
        
        logger.info(f"Processing {duration:.2f}s {file_type} in {num_chunks} chunks of ~{chunk_duration:.2f}s each")
        
        # Create chunks
        chunk_files = []
        
        for i in range(num_chunks):
            try:
                start_time = i * chunk_duration
                
                # Determine output format based on file type
                if file_type == "video":
                    chunk_filename = f"chunk_{i+1:03d}_{os.path.splitext(filename)[0]}.mp4"
                elif file_type == "audio":
                    chunk_filename = f"chunk_{i+1:03d}_{os.path.splitext(filename)[0]}.wav"
                else:
                    raise ValueError(f"Unsupported file type: {file_type}")
                
                chunk_path = os.path.join(output_dir, chunk_filename)
                
                # Use ffmpeg to extract chunk with copy codec (fast)
                cmd = [
                    "ffmpeg", "-y", "-i", file_path,
                    "-ss", str(start_time),
                    "-t", str(chunk_duration)
                ]
                
                if file_type == "video":
                    cmd.extend([
                        "-map", "0:v:0",  # Map only the first video stream
                        "-map", "0:a:0?",  # Map only the first audio stream if it exists
                        "-c", "copy",     # Copy the selected streams
                        "-strict", "unofficial",  # Allow unofficial features
                        "-avoid_negative_ts", "1"  # Avoid negative timestamps
                    ])
                
                cmd.append(chunk_path)
                
                subprocess.run(cmd, check=True)
                chunk_files.append(chunk_path)
                
            except Exception as e:
                logger.error(f"Error creating chunk {i+1}: {str(e)}")
                # Continue with next chunk instead of failing completely
                continue
        
        # If we couldn't create any chunks, raise an exception
        if not chunk_files:
            raise ValueError("Failed to create any chunks from the media file")
        
        return chunk_files, len(chunk_files)  # Return actual number of chunks created
        
    except Exception as e:
        logger.error(f"Error splitting {file_type} into chunks: {str(e)}")
        raise