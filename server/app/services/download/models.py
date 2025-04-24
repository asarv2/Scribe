from typing import List, Literal, TypedDict

class Grade(TypedDict):
    id: str
    title: str
    results: List[str]
    feedback: List[str]
    references: List[str]
    figures: List[str]

class Figure(TypedDict):
    id: str
    title: str
    code: str
    references: List[str]

class Summary(TypedDict):
    id: str
    title: str
    preamble: str
    content: str
    conclusion: str
    references: List[str]
    figures: List[str]

class MCQQuestion(TypedDict):
    id: str
    title: str
    question: str
    question_type: Literal["mcq"]
    options: List[str]
    answers: List[str]
    explanations: List[str]
    references: List[str]
    figures: List[str]

class FRQQuestion(TypedDict):
    id: str
    title: str
    question: str
    question_type: Literal["frq"]
    solution: str
    references: List[str]
    figures: List[str]