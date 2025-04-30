# Graph of agents and handoffs
from app.services.chat.agents.general import GeneralAgent
from app.services.chat.agents.tools.figure.main import FigureAgent
from app.services.chat.agents.tools.summary.main import SummaryAgent
from app.services.chat.agents.tools.question.main import QuestionAgent
from app.services.chat.agents.tools.report.main import ReportAgent
from app.services.chat.agents.specialists.syllabus.main import SyllabusAgent
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
        
        # Triage
        self.general = GeneralAgent()
        self.general_agent = self.general.agent()
        self.general_handoff = self.general.handoff(self.general_agent)

        # General Agents
        self.syllabus = SyllabusAgent()
        self.syllabus_agent = self.syllabus.agent()
        self.syllabus_handoff = self.syllabus.handoff(self.syllabus_agent)

        self.figure = FigureAgent()
        self.figure_agent = self.figure.agent()
        self.figure_handoff = self.figure.handoff(self.figure_agent)

        self.summary = SummaryAgent()
        self.summary_agent = self.summary.agent()
        self.summary_handoff = self.summary.handoff(self.summary_agent)

        self.question = QuestionAgent()
        self.question_agent = self.question.agent()
        self.question_handoff = self.question.handoff(self.question_agent)

        self.report = ReportAgent()
        self.report_agent = self.report.agent()
        self.report_handoff = self.report.handoff(self.report_agent)

        # Specialized Agents
        # Student
        self.review = ReviewAgent()
        self.review_agent = self.review.agent()
        self.review_handoff = self.review.handoff(self.review_agent)

        self.homework = HomeworkAgent()
        self.homework_agent = self.homework.agent()
        self.homework_handoff = self.homework.handoff(self.homework_agent)

        self.learn = LearnAgent()
        self.learn_agent = self.learn.agent()
        self.learn_handoff = self.learn.handoff(self.learn_agent)

        # Teacher
        self.content = ContentAgent()
        self.content_agent = self.content.agent()
        self.content_handoff = self.content.handoff(self.content_agent)

        self.grade = GradeAgent()
        self.grade_agent = self.grade.agent()
        self.grade_handoff = self.grade.handoff(self.grade_agent)

        self.analyze = AnalyzeAgent()
        self.analyze_agent = self.analyze.agent()
        self.analyze_handoff = self.analyze.handoff(self.analyze_agent)

        # setup handoffs
        self._setup_handoffs()


    def _setup_handoffs(self):
        # General Agent
        if self.teacher:
            self.general_agent.handoffs = [self.syllabus_handoff, self.figure_handoff, self.summary_handoff, self.question_handoff, self.report_handoff, self.content_handoff, self.grade_handoff, self.analyze_handoff]
        else:
            self.general_agent.handoffs = [self.syllabus_handoff, self.figure_handoff, self.summary_handoff, self.question_handoff, self.review_handoff, self.homework_handoff, self.learn_handoff]
        
        # Syllabus Agent
        self.syllabus_agent.handoffs = [self.general_handoff]

        # Figure Agent
        self.figure_agent.handoffs = [self.general_handoff]

        # Summary Agent
        self.summary_agent.handoffs = [self.general_handoff]

        # Question Agent
        self.question_agent.handoffs = [self.general_handoff]

        # Report Agent
        self.report_agent.handoffs = [self.general_handoff]

        # Learn Agent
        self.learn_agent.handoffs = [self.question_handoff, self.summary_handoff, self.figure_handoff, self.general_handoff]

        # Review Agent
        self.review_agent.handoffs = [self.question_handoff, self.summary_handoff, self.figure_handoff, self.general_handoff]

        # Homework Agent
        self.homework_agent.handoffs = [self.question_handoff, self.summary_handoff, self.figure_handoff, self.general_handoff]

        # Content Agent
        self.content_agent.handoffs = [self.question_handoff, self.summary_handoff, self.figure_handoff, self.general_handoff]

        # Grade Agent
        self.grade_agent.handoffs = [self.report_handoff, self.general_handoff]

        # Analyze Agent
        self.analyze_agent.handoffs = [self.report_handoff, self.general_handoff]

    def forward(self):
        "Defining the workflow of agents and handoffs"
        if self.starting_agent == "general":
            return self.general_agent
        elif self.starting_agent == "syllabus":
            return self.syllabus_agent
        elif self.starting_agent == "figure":
            return self.figure_agent
        elif self.starting_agent == "summary":
            return self.summary_agent
        elif self.starting_agent == "question":
            return self.question_agent
        elif self.starting_agent == "report":
            return self.report_agent
        elif self.starting_agent == "content":
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
