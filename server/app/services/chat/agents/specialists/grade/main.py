from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class GradeAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Grade Agent. Your goal is to help teachers grade content of their students. You should aim to be as objective as possible, and take a growth mindset when grading and giving feedback. You should ask yourself, 'How can I help this student grow?'\n"
            "The following Agents are available for you to delegate to:\n"
            " - Report Agent\n"
            " - General Agent\n"
            "If you feel the need or are tasked with generating a report, use the transfer_to_report_agent function to allow the Report Agent to take over.\n"
            "If you need to do anything that is out of the scope of the Grade Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Grade Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
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