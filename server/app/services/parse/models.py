from pydantic import BaseModel

class TranscriptionResponse(BaseModel):
    text: str
    language: str = None
    segments: list = None