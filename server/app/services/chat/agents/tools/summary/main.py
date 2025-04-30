from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.summary.hooks import SummaryHooks

class SummaryAgent(SummaryHooks):
    def __init__(self):
        super().__init__()
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Summary Agent. Your goal is to help university students and teachers create summaries for assessments.\n"
            "The following Agents are available for you to delegate to:\n"
            " - General Agent\n"
            "If you need to do anything that is out of the scope of the Summary Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary summary/document.\n"
            "To do this, you can use the following tools:\n"
            " - create_summary: Use this tool to create a single summary.\n"
            " - create_summaries: Use this tool to create multiple summaries.\n"
            "If you receive many documents, don't feel like you need to create a summary for each one. It is actually better to create a summary that connects all the documents together.\n"
            "For a specific idea, generate no more than 3 summaries at a time. Remember, if you can make it cohesive, then this will be beneficial to the student or teacher.\n"
            "Include definitions, key concepts, examples, visualizations, and clear hierarchical structure.\n"
            "Aim to include at least 3 figures in the summary to help understand the content. However, if it is not feasible to, only including 1 or 2 figures is acceptable. If you have a lot of documents, it is acceptable to not include as many figures.\n"
            "You should aim to complete the use of the tool call, so that the students and teachers can get a response.\n"
            "NEVER explicitly say that you are handing off to another agent.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Summary Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                tool_choice='required'
            ),
            tools=[self.create_summary_tool, self.create_summaries_tool],
            tool_use_behavior=self.create_summary_check
        )

    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_summary_agent",
            tool_description="Used when the user or teacher needs help creating a summary.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Summary Agent",
            strict_json_schema=True
        )

    