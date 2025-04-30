from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class ContentAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Content Agent. Your goal is to help teachers create content for their students, and potentially overlook/condense existing content.\n"
            "The following Agents are available for you to delegate to:\n"
            " - Figure Agent\n"
            " - Summary Agent\n"
            " - Question Agent\n"
            " - General Agent\n"
            "If the request is related to creating a visual, plot, table, graph, tree, or any sort of figure, use the transfer_to_figure_agent function to allow the Figure Agent to take over.\n"
            "If the request is related to creating a summary or review paper or anything similar, use the transfer_to_summary_agent function to allow the Summary Agent to take over.\n"
            "If the request is related to creating any type of practice question(s), use the transfer_to_question_agent function to allow the Question Agent to take over.\n"
            "If you need to do anything that is out of the scope of the Content Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Content Agent",
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
            tool_name="transfer_to_content_agent",
            tool_description="Used when the a teacher needs help creating content for their students.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Content Agent",
            strict_json_schema=True
        )