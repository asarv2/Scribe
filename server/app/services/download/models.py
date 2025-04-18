from typing import List, Literal, TypedDict


class Summary(TypedDict):
    id: str
    preamble: str
    content: str
    conclusion: str
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class MCQQuestion(TypedDict):
    id: str
    question: str
    question_type: Literal["mcq"]
    options: List[str]
    answers: List[str]
    explanations: List[str]
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class FRQQuestion(TypedDict):
    id: str
    question: str
    question_type: Literal["frq"]
    solution: str
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]