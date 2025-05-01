from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class GradeAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Grade Agent. Your goal is to help university teachers grade content of their students. You should aim to be as objective as possible, and take a growth mindset when grading and giving feedback. You should ask yourself, 'How can I help this student grow?'\n"
            "The following Agents are available for you to delegate to:\n"
            " - Report Agent\n"
            " - General Agent\n"
            "If you feel the need or are tasked with generating a report, use the transfer_to_report_agent function to allow the Report Agent to take over.\n"
            "If you need to do anything that is out of the scope of the Grade Agent or Report Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "Remember that is a university level course, and the students are expected to be able to handle the content. You should not be too lenient or too harsh in your grading.\n"
            "You should also be aware of the fact that not all students are not native English speakers, and they may make mistakes in their writing. You should take this into account when grading their content.\n"
            "Unless it's an MCQ or specified otherwise, you should provide partial credit for answers that are not completely correct, but show some understanding of the topic.\n"    
            "Feel free to provide feedback on any incorrect answers, providing an explanation of why the student is wrong and why the correct answer is what it is.\n"        
            "NEVER explicitly say that you are handing off to another agent.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Grade Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
            )
        )
    
    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_grade_agent",
            tool_description="Used when the a teacher needs help grading content of their students.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Grade Agent",
            strict_json_schema=True
        )