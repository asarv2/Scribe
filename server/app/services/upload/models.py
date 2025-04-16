from typing import Optional, List
from pydantic import BaseModel

class HomeworkProblemPart(BaseModel):
    problem: str  # The text of the problem
    problem_part_number: Optional[str]  # If this is a multi part problem, the part number (e.g., "(a)")
    references: List[str]  # The references to the textbook (e.g., ["1.1", "1.2"])


class Chapter(BaseModel):
    title: str  # The title of the chapter
    chapter_number: int  # The chapter number (e.g., 1)
    start_page: int  # The start page of the chapter
    end_page: int  # The end page of the chapter
