# creating the output types
import re
from collections import defaultdict
from typing import Dict, List, Tuple, Set, Optional, Literal, Any
from pydantic import BaseModel, Field
import google.generativeai as genai
from google.generativeai.types import File
import json
import logging
from collections import defaultdict
from typing import Dict, List, Tuple, Set
import math
from agents import AgentOutputSchemaBase

logger = logging.getLogger(__name__)

class InitialChatOutput(BaseModel):
    in_scope: bool = Field(default=True)
    title: str = Field(default="")

class Figure(BaseModel):
    title: str = Field(default="")
    latex_code: str = Field(default="")
    references: List[int] = Field(default=[])

class CreateFigureResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    figure_id: str = Field(default="")

class Question(BaseModel):
    title: str = Field(default="")
    question_type: Literal["mcq", "frq"] = "mcq"
    question: str = Field(default="")
    options: List[str] = Field(default_factory=list)
    answer: str = Field(default="")
    explanations: List[str] = Field(default_factory=list)
    references: List[int] = Field(default_factory=list)
    figures: List[Figure] = Field(default_factory=list)

class CreateQuestionResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    question_id: str = Field(default="")

class Summary(BaseModel):
    title: str = Field(default="")
    preamble: str = Field(default="")
    body: str = Field(default="")
    conclusion: str = Field(default="")
    references: List[int] = Field(default=[])
    figures: List[Figure] = Field(default=[])

class CreateSummaryResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    summary_id: str = Field(default="") 

class Documents(BaseModel):
    class_id: str
    profile_id: str
    chat_id: str
    message_id: str
    references: Dict[int, str] # maps number found in text to the id in supabase
    figures: List[str] = []
    summaries: List[str] = []
    questions: List[str] = []
    grades: List[str] = []