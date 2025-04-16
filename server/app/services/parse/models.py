from pydantic import BaseModel

class ParseOutput(BaseModel):
    description: str

class CleanedResponse(BaseModel):
    page: int
    description: str
    text: str

