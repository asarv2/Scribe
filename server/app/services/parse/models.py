from pydantic import BaseModel

class TranscriptionResponse(BaseModel):
    text: str
    language: str = None
    segments: list = None

class ParseDocuments(BaseModel):
    class_id: str
    file_id: str

class SyllabusResponse(BaseModel):
    class_name: str = ""
    class_code: str = ""
    class_description: str = ""
    outcomes: list[str] = []
