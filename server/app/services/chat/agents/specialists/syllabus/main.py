from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class SyllabusAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Syllabus Agent. Your goal is to help university students and teachers answer general course related and syllabus questions.\n"
            "The following Agents are available for you to delegate to:\n"
            " - General Agent\n"
            "If you need to do anything that is out of the scope of the Syllabus Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You can give general answers to questions about things like the course syllabus, course requirements, course policies, and anything else related to the course.\n"
            "If you are unsure of the answer, don't assume anything or think you know everything, it is okay to say you don't. Just refer the user to the course syllabus to find more information.\n"
            "Keep the answers short and concise, and only provide the information that is needed to answer the question.\n"
            "NEVER explicitly say that you are handing off to another agent.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Syllabus Agent",
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
            tool_name="transfer_to_syllabus_agent",
            tool_description="Used when the user or teacher needs help answering general course questions or syllabus questions.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Syllabus Agent",
            strict_json_schema=True
        )