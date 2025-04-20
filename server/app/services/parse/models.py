from pydantic import BaseModel

class CleanedResponse(BaseModel):
    page: int
    description: str
    text: str

