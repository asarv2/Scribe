from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from app.extensions import get_gemini
from app.services.chat.models.main import Documents
from app.services.chat.agents.actions.generate.question.main import QuestionAgent
from app.services.chat.agents.actions.generate.summary.main import SummaryAgent
from app.services.chat.agents.actions.generate.figure.main import FigureAgent
from app.services.chat.agents.specialists.review.main import ReviewAgent
from app.services.chat.agents.specialists.homework.main import HomeworkAgent
from app.services.chat.agents.specialists.learn.main import LearnAgent
from app.services.chat.agents.actions.generate.main import GenerateAgent

class GeneralAgent:
    def __init__(self, course_title: str):
        self.gemini_client = get_gemini()
        self.course_title = course_title

        # Phase 1: create all agents without handoffs
        self.general = self.agent()
        self.question = QuestionAgent(course_title).agent()
        self.summary  = SummaryAgent(course_title).agent()
        self.figure   = FigureAgent(course_title).agent()
        # self.generate = GenerateAgent(course_title).agent()
        self.review   = ReviewAgent(course_title).agent()
        self.homework = HomeworkAgent(course_title).agent()
        self.learn    = LearnAgent(course_title).agent()

        # Phase 2: wire up handoffs once all agents exist
        self.question.handoffs  = [self.general]
        self.summary.handoffs   = [self.general]
        self.figure.handoffs    = [self.general]

        # self.generate.handoffs  = [self.question, self.summary, self.figure, self.general]
        self.review.handoffs    = [self.general]
        self.homework.handoffs  = [self.general]
        self.learn.handoffs     = [self.general]

        self.general.handoffs   = [self.review, self.homework, self.learn, self.figure, self.question, self.summary]

    def main(self):
        return self.general
    
    def review(self):
        return self.review
    
    def homework(self):
        return self.homework
    
    def learn(self):
        return self.learn
    
    def agent(self):
        system_prompt = self.system_prompt()
        handoff_prompt = self.handoff_prompt()

        return Agent[Documents](
            name="General Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
            ),
            handoff_description=handoff_prompt
        )
    
    def system_prompt(self):
        return (
            "Your entire purpose is to help out students and teachers, and you will do so through either one of two ways.\n"
            "If you get asked a question about general course information, like when a homework is due, or when the midterm is, or similar questions that you might find in a syllabus, then answer briefly if you know. If you don't know, say that you were provided the class syllabus.\n"
            "If you get asked, or are told to do something that isn't related to general course information, simply go tell a different teacher assistant, never try to do it yourself.\n"
            "If the request is related to course material, such as the student needing help understanding a concept, or anything related to a student learning, use the transfer_to_learn function, so that the colleague specialized in helping students learn can take over.\n"
            "If the request is related to preparing for an exam, quiz, midterm, or anything similar, use the transfer_to_review function, to allow the colleague specialized in helping with test preparation can take over.\n"
            "If the request is related to a student needing help with anything homework related, use the transfer_to_homework function, to allow the colleague specialized in helping with homework, can take over.\n"
            "If the request is related to generating any sort of content use the transfer_to_generate function, to allow the colleague specialized in generating material to take over.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you only Respond in English only.\n"
        )

    def handoff_prompt(self):
        prefix = "You are a highly skilled university teaching assistant, deeply knowledgeable in information related to the course. Our educational system utilizes a team of specialized teaching assistants. When a student or teacher requires help beyond your expertise, use the transfer_to_<assistant_name> function to connect them with the best-suited colleague. Do not inform the student or teacher about this internal transfer.\n\n"

        prompt = "Used when the user or another teacher assistant has a question related to course content, learning, preparing for an exam, homework help, or generating material. Always follow the exact behavior specified in the base system prompt.\n"

        return prefix + prompt

    