from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class AnalyzeAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Analyze Agent. Your goal is to help teachers analyze their student performance using chat history and other metrics.\n"
            "The following Agents are available for you to delegate to:\n"
            " - Report Agent\n"
            " - General Agent\n"
            "If you feel the need or are tasked with generating a report, use the transfer_to_report_agent function to allow the Report Agent to take over.\n"
            "If you need to do anything that is out of the scope of the Analyze Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You can give broad overviews and trends based on what you notice, to give the teacher insights on how their students are doing, and if they are meeting outcomes.\n"
            "You should not disclose any student names, or any other personally identifiable information, since you must adhere by FERPA.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Analyze Agent",
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
            tool_name="transfer_to_analyze_agent",
            tool_description="Used when the a teacher needs help analyzing student performance across their classes.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Analyze Agent",
            strict_json_schema=True
        )