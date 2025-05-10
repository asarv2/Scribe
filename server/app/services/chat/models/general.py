# creating the output types
from typing import Dict, List, Optional, Literal, Any
import logging
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

ChatAgents = Literal[
    "general",
    "review",
    "homework",
    "learn",
    "question",
    "summary",
    "figure",
    "syllabus",
    "content",
    "grade",
    "analyze",
]


class Reference(BaseModel):
    number: int
    title: str
    url: str = ""
    file: bool
    error: Optional[str] = None


class ReferencesOutputSchema(BaseModel):
    references: List[Reference] = Field(default_factory=list)


class HandoffInputSchema(BaseModel):
    references: List[int] = Field(default_factory=list)


class ContextFile(BaseModel):
    file_id: str


class InitialChatOutput(BaseModel):
    in_scope: bool = Field(default=True)
    title: str = Field(default="")
    reason_out_of_scope: str = Field(default="")


class OutcomeObjectives(BaseModel):
    number: int  # "Outcome 1", "Outcome 2", ...
    objectives: List[str]  # 1–2-word strings


class AfterChatOutput(BaseModel):
    outcomes: List[OutcomeObjectives] = Field(default_factory=list)
    correct: bool = Field(default=True)
    reason: str = Field(default="")


class Figure(BaseModel):
    title: str = Field(default="")
    latex_code: str = Field(default="")
    references: List[int] = Field(default=[])
    message: str = Field(default="")


class CreateFigureResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    figure_id: str = Field(default="")
    message: str = Field(default="")


class Question(BaseModel):
    title: str = Field(default="")
    question_type: Literal["mcq", "frq"] = "mcq"
    question: str = Field(default="")
    options: List[str] = Field(default_factory=list)
    answer: str = Field(default="")
    explanations: List[str] = Field(default_factory=list)
    references: List[int] = Field(default_factory=list)
    figures: List[Figure] = Field(default_factory=list)
    message: str = Field(default="")


class CreateQuestionResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    question_id: str = Field(default="")
    message: str = Field(default="")


class Summary(BaseModel):
    title: str = Field(default="")
    preamble: str = Field(default="")
    body: str = Field(default="")
    conclusion: str = Field(default="")
    references: List[int] = Field(default=[])
    figures: List[Figure] = Field(default=[])
    message: str = Field(default="")


class CreateSummaryResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    summary_id: str = Field(default="")
    message: str = Field(default="")


class Report(BaseModel):
    title: str = Field(default="")
    content: str = Field(default="")
    references: List[int] = Field(default=[])
    figures: List[Figure] = Field(default=[])
    message: str = Field(default="")


class CreateReportResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    report_id: str = Field(default="")
    message: str = Field(default="")


class Documents(BaseModel):
    class_id: str
    profile_id: str
    chat_id: str
    message_id: str
    references: Dict[
        int, Dict[str, Any]
    ]  # maps number found in text to the id in supabase
    outcomes: Dict[int, str]  # maps outcome number to outcome id in supabase
    used_files: List[str] = []
    used_documents: List[str] = []
    figures: List[str] = []
    summaries: List[str] = []
    questions: List[str] = []
    grades: List[str] = []
