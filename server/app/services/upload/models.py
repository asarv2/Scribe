from typing import List, Literal, Optional
from pydantic import BaseModel

class FileCompressionResult(BaseModel):
    file_path: str
    file_length: int
    file_size: int
    file_extension: str

class FileExtractChunk(BaseModel):
    text: str  # Textual content or transcription
    page: int = 1  # Page number or chunk number
    image_data: Optional[bytes] = None  # For pdf_page or image
    start_time: Optional[float] = None  # For audio/video chunks
    end_time: Optional[float] = None  # For audio/video chunks
    type: Literal['pdf_page', 'audio_chunk', 'video_chunk', 'image', 'text', 'other']