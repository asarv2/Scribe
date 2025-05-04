from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini, get_litellm
from openai.types import Reasoning
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.report import ReportHooks
from typing import List, Dict, Any
from app.services.chat.models.main import Reference
from app.services.chat.utils.references import emit_google_cache

class AnalyzeAgent(ReportHooks):
    def __init__(self, chat_id: str):
        super().__init__()
        self.chat_id = chat_id
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Analyze Agent. Your goal is to help university teachers analyze their student performance using chat history and other metrics.\n"
            "One key feature you have is the ability to summarize large amounts of data and create reports. These are the tools you can use:\n"
            " - create_report: Use this tool to create a report of student performance.\n"
            " - create_reports: Use this tool to create multiple reports of student performance.\n"
            "You can give broad overviews and trends based on what you notice, to give the teacher insights on how their students are doing, and if they are meeting outcomes.\n"
            "Try to mostly help with the analysis of the data and reports of groups of students, rather than individual students, or even the entire class.\n"
            "Make sure that the analysis that you provide is based on the data that you have been given, and that you do not make any assumptions about the data.\n"
            "In your analysis of the class, include some positive feedback, and but also some constructive feedback, and suggestions for area of improvement.\n"
            "You should not disclose any student names, or any other personally identifiable information, since you must adhere by FERPA.\n"
            "NEVER explicitly say that you are using a tool.\n"
        )

    def agent(self, new_references: bool, all_references: List[Reference]):
        litellm_client = get_litellm()
        cache_name = emit_google_cache(self.chat_id, litellm_client.model, self.system_prompt, new_references, all_references)
        if cache_name:
            return Agent[Documents](
                name="Analyze Agent",
                model=litellm_client,
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    extra_body={"cached_content": cache_name}
                )
            )
        else:
            return Agent[Documents](
                name="Analyze Agent",
                instructions=self.system_prompt,
                model=OpenAIChatCompletionsModel( 
                    model="gemini-2.5-flash-preview-04-17",
                    openai_client=self.gemini_client,
                ),
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    reasoning=Reasoning(
                        effort="low"
                    )
                ),
                tools=[self.create_report_tool, self.create_reports_tool],
                tool_use_behavior=self.create_report_check
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