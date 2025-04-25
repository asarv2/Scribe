from typing import List, Literal, Optional
from pydantic import BaseModel

class FileCompressionResult(BaseModel):
    file_path: str
    file_length: int
    file_size: int
    file_extension: str
    file_type: Literal['pdf', 'audio', 'video', 'image', 'other'] | None

class FileExtractChunk:
    def __init__(self, text: str, page: int, start_time: float = None, end_time: float = None, 
                 image_data: bytes = None, type: str = 'text', 
                 video_chunk_path: str = None, audio_chunk_path: str = None):
        self.text = text
        self.page = page
        self.start_time = start_time
        self.end_time = end_time
        self.image_data = image_data
        self.type = type
        self.video_chunk_path = video_chunk_path
        self.audio_chunk_path = audio_chunk_path