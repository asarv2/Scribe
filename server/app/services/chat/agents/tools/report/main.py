from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.report.hooks import ReportHooks

class ReportAgent(ReportHooks):
    def __init__(self):
        super().__init__()
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Report Agent. Your goal is to help university teachers create reports for their work, whether it be grading or looking at analytics.\n"
            "The following Agents are available for you to delegate to:\n"
            " - General Agent\n"
            "If you need to do anything that is out of the scope of the Report Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary report.\n"
            "To do this, you can use the following tools:\n"
            " - create_report: Use this tool to create a single report.\n"
            " - create_reports: Use this tool to create multiple reports.\n"
            "You should not engage in conversation, you should only focus on creating the necessary report.\n"
            "Include data, an brief introduction and conclusion, a titel at the top, ensure it's clear and concise, and anything else you think would be helpful to a unveristy teacher.\n"
            "Aim to include at least 1 figure in the report to help understand the content. However, if it is not feasible to, maybe in the case of a grading report, it is acceptable to not include any figures.\n"
            "NEVER explicitly say that you are handing off to another agent.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Report Agent",
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
            tools=[self.create_report_tool, self.create_reports_tool],
            tool_use_behavior=self.create_report_check
        )

    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_report_agent",
            tool_description="Used when the teacher needs help creating a report.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Report Agent",
            strict_json_schema=True
        )

    