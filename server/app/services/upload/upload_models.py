from typing import Literal, Optional
from pydantic import BaseModel


class FileCompressionResult(BaseModel):
    file_path: str
    file_length: int
    file_size: int
    file_extension: str
    file_type: Optional[Literal["pdf", "audio", "video", "image", "other"]] = None


class FileExtractChunk(BaseModel):
    text: str
    page: int
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    image_data: Optional[bytes] = None
    type: str = "text"
    video_chunk_path: Optional[str] = None
    audio_chunk_path: Optional[str] = None
