import json
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff, RunContextWrapper, HandoffInputData, ToolCallItem
from app.extensions import get_gemini
from app.services.chat.models.main import Documents
from app.services.chat.agents.actions.generate.question.main import QuestionAgent
from app.services.chat.agents.actions.generate.summary.main import SummaryAgent
from app.services.chat.agents.actions.generate.figure.main import FigureAgent
from app.services.chat.agents.specialists.review.main import ReviewAgent
from app.services.chat.agents.specialists.homework.main import HomeworkAgent
from app.services.chat.agents.specialists.learn.main import LearnAgent
from app.services.chat.agents.actions.generate.main import GenerateAgent
from typing import List, Awaitable
from app.extensions import get_supabase
from app.services.chat.models.main import ContextFile

class GeneralAgent:
    def __init__(self, course_title: str):
        self.gemini_client = get_gemini()
        self.course_title = course_title

        self.files = []

        # Phase 1: create all agents without handoffs
        self.general = self.agent()
        self.question = QuestionAgent(course_title).agent()
        self.summary  = SummaryAgent(course_title).agent()
        self.figure   = FigureAgent(course_title).agent()
        self.review   = ReviewAgent(course_title).agent()
        self.homework = HomeworkAgent(course_title).agent()
        self.learn    = LearnAgent(course_title).agent()


        def on_invoke_files_handoff(wrapper: RunContextWrapper[Documents], files: List[int], return_agent: str = "general") -> Awaitable[Agent[Documents]]:
            # get the files from the supabase
            supabase = get_supabase()
            file_mapping = wrapper.context.files
            file_ids = [file_mapping[file_number] for file_number in files]
            self.files +=supabase.table("files").select("*").in_("id", file_ids).execute().data

            if return_agent == "general":
                return self.general
            elif return_agent == "question":
                return self.question
            elif return_agent == "summary":
                return self.summary
            elif return_agent == "figure":
                return self.figure
            elif return_agent == "review":
                return self.review
            elif return_agent == "homework":
                return self.homework
            elif return_agent == "learn":
                return self.learn
        
        def files_input_filter(data: HandoffInputData) -> HandoffInputData:
            """
            This function is used to add the files that model requests, allowing for larger context windows and the model to choose which files to use and bring into context.
            """
            supabase = get_supabase()
            
            # get the google file ids
            google_file_ids = supabase.table("google").select("google_id").in_("file", self.files).execute().data

            # insert these into the conversation history
            images = []
            for google_file_id in google_file_ids:
                images.append({
                    "type": "input_image",
                    "image_url": f"https://generativelanguage.googleapis.com/v1beta/{google_file_id}",
                    "detail": "high"
                })

            # adding all of the images as a user message
            data.conversation_history.append({
                "role": "user",
                "content": images
            })

            # once we have the file_ids, we should get the respective google file ids, maybe another mapping
            return data

        # create a handoff for file fetching
        self.files_handoff = Handoff(
            tool_name="get_files",
            tool_description="Used to fetch extra files from the course, if you want to see the full pdf, to reference the material correctly or see full lecture notes. After you have fetched the files, you should specify which agent to return to.",
            input_json_schema={
                "type": "object",
                "properties": {
                    "files": {
                        "type": "array",
                        "items": {
                            "type": "integer"
                        }
                    },
                    "return_agent": {
                        "type": "string",
                        "enum": ["general", "question", "summary", "figure", "review", "homework", "learn"]
                    }
                }
            },
            on_invoke_handoff=on_invoke_files_handoff,
            agent_name="Files Agent",
            input_filter=files_input_filter,
            strict_json_schema=True
        )

        # Phase 2: wire up handoffs once all agents exist
        self.review.handoffs    = [self.question, self.summary, self.figure]
        self.homework.handoffs  = [self.question, self.summary, self.figure]
        self.learn.handoffs     = [self.question, self.summary, self.figure]

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
                include_usage=True,
                # store=True,
                # extra_body={"cachedContent": cache.name},
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
            "If you are tasked with creating a visual, plot, table, graph, tree, or any sort of figure, use the transfer_to_figure function to allow the colleague specialized in generating figures to take over.\n"
            "If you are tasked with creating a summary or review paper or anything similar, use the transfer_to_summary function to allow the colleague specialized in generating summaries to take over.\n"
            "If you are tasked with creating any type of practice question(s), use the transfer_to_question function to allow the colleague specialized in generating practice questions to take over.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you only Respond in English only.\n"
        )

    def handoff_prompt(self):
        prefix = "You are a highly skilled university teaching assistant, deeply knowledgeable in information related to the course. Our educational system utilizes a team of specialized teaching assistants. When a student or teacher requires help beyond your expertise, use the transfer_to_<assistant_name> function to connect them with the best-suited colleague. Do not inform the student or teacher about this internal transfer.\n\n"

        prompt = "Used when the user or another teacher assistant has a question related to course content, learning, preparing for an exam, homework help, or generating material. Always follow the exact behavior specified in the base system prompt.\n"

        return prefix + prompt

    