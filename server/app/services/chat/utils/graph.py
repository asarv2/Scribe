# Graph of agents and handoffs
from app.services.chat.agents.specialists.content.main import ContentAgent
from app.services.chat.agents.specialists.grade.main import GradeAgent
from app.services.chat.agents.specialists.analyze.main import AnalyzeAgent
from app.services.chat.agents.specialists.review.main import ReviewAgent
from app.services.chat.agents.specialists.homework.main import HomeworkAgent
from app.services.chat.agents.specialists.learn.main import LearnAgent
from app.services.chat.models.main import ChatAgents
from typing import List, Dict, Any
from app.services.chat.models.main import Reference
class AgentGraph:
    def __init__(self, chat_id: str, references: List[Reference], references_mapping: Dict[int, Dict[str, Any]], teacher: bool, starting_agent: ChatAgents):
        self.chat_id = chat_id
        self.references = references
        self.references_mapping = references_mapping
        self.teacher = teacher
        self.starting_agent = starting_agent

        # Student
        self.review = ReviewAgent(self.chat_id, self.references, self.references_mapping)
        self.homework = HomeworkAgent(self.chat_id, self.references, self.references_mapping) 
        self.learn = LearnAgent(self.chat_id, self.references, self.references_mapping)
        # Teacher
        self.content = ContentAgent(self.chat_id, self.references, self.references_mapping)
        self.grade = GradeAgent(self.chat_id, self.references, self.references_mapping)
        self.analyze = AnalyzeAgent(self.chat_id, self.references, self.references_mapping)

    def forward(self):
        "Defining the workflow of agents and handoffs"
        if self.starting_agent == "content":
            return self.content.agent()
        elif self.starting_agent == "grade":
            return self.grade.agent()
        elif self.starting_agent == "analyze":
            return self.analyze.agent()
        elif self.starting_agent == "learn":
            return self.learn.agent()
        elif self.starting_agent == "review":
            return self.review.agent()
        elif self.starting_agent == "homework":
            return self.homework.agent()
        else:
            raise ValueError(f"Invalid starting agent: {self.starting_agent}")
