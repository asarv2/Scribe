# Graph of agents and handoffs
from app.services.chat.agents.specialists.content.main import ContentAgent
from app.services.chat.agents.specialists.grade.main import GradeAgent
from app.services.chat.agents.specialists.analyze.main import AnalyzeAgent
from app.services.chat.agents.specialists.review.main import ReviewAgent
from app.services.chat.agents.specialists.homework.main import HomeworkAgent
from app.services.chat.agents.specialists.learn.main import LearnAgent
from app.services.chat.models.main import ChatAgents

class AgentGraph:
    def __init__(self, teacher: bool, starting_agent: ChatAgents):
        self.teacher = teacher
        self.starting_agent = starting_agent

        # Specialized Agents
        # Student
        self.review = ReviewAgent()
        self.review_agent = self.review.agent()

        self.homework = HomeworkAgent()
        self.homework_agent = self.homework.agent()

        self.learn = LearnAgent()
        self.learn_agent = self.learn.agent()

        # Teacher
        self.content = ContentAgent()
        self.content_agent = self.content.agent()

        self.grade = GradeAgent()
        self.grade_agent = self.grade.agent()

        self.analyze = AnalyzeAgent()
        self.analyze_agent = self.analyze.agent()

    def forward(self):
        "Defining the workflow of agents and handoffs"
        if self.starting_agent == "content":
            return self.content_agent
        elif self.starting_agent == "grade":
            return self.grade_agent
        elif self.starting_agent == "analyze":
            return self.analyze_agent
        elif self.starting_agent == "learn":
            return self.learn_agent
        elif self.starting_agent == "review":
            return self.review_agent
        elif self.starting_agent == "homework":
            return self.homework_agent
        else:
            raise ValueError(f"Invalid starting agent: {self.starting_agent}")
