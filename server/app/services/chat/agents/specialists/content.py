from typing import List
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from openai.types import Reasoning
from app.extensions import get_gemini, get_litellm
from app.services.chat.models.general import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.models.general import Reference
from app.services.chat.utils.references import emit_google_cache
from app.services.chat.agents.tools.figure import FigureHooks
from app.services.chat.agents.tools.question import QuestionHooks
from app.services.chat.agents.tools.summary import SummaryHooks
from agents import (
    RunContextWrapper,
    ToolsToFinalOutputResult,
    FunctionToolResult,
)


class ContentAgent(FigureHooks, QuestionHooks, SummaryHooks):
    def __init__(self, chat_id: str):
        # Call all parent class initializers
        FigureHooks.__init__(self)
        QuestionHooks.__init__(self)
        SummaryHooks.__init__(self)

        # Then initialize ContentAgent-specific attributes
        self.chat_id = chat_id
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Content Agent.\n"
            "You are a knowledgeable and patient Teaching Assistant at a university, specializing in helping professors create content for their students. Your goal is to listen to the professor's needs, and then clarify and explain concepts step-by-step, ensuring adherence to professor's teaching style.\n"
            "One key feature that you have is the ability to create figures, plots, tables, graphs, trees, or anything similar. You can also create questions and summaries, with embedded figures. These are the tools you can use:\n"
            " - create_figure: Use this tool to create a single figure.\n"
            " - create_figures: Use this tool to create multiple figures.\n"
            " - create_question: Use this tool to create a single question.\n"
            " - create_questions: Use this tool to create multiple questions.\n"
            " - create_summary: Use this tool to create a single summary.\n"
            " - create_summaries: Use this tool to create multiple summaries.\n"
            "Provide clear, step-by-step explanations, breaking down complex concepts into manageable parts.\n"
            "Use clear language and illustrative examples.\n"
            "If the concept relies on prerequisite knowledge, assess the student's understanding of those prerequisites and provide explanations if needed.\n"
            "Respond directly to professor's statements and questions without adding unnecessary commentary.\n"
            "Generate visualizations if the concept is typically taught visually.\n"
            "Base explanations solely on course materials. If your not given much information, assume the most simple method.\n"
            "Tailor explanations to the student's questions and understanding level.\n"
            "Encourage follow-up questions.\n"
            "Maintain a supportive and encouraging tone.\n"
            "Provide thorough and focused explanations.\n"
            "Keep responses concise and conversational.\n"
            "After the professor is satisfied with the content, ask if they have more questions. Conclude with a friendly closing like, 'Sound Good, Have a great day!' if they don't.\n"
            "Keep the conversation short and to the point.\n"
            "Treat this as a multi-turn conversation, not a lecture.\n"
            "Focus on interactive learning and understanding.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you only Respond in English only.\n"
            "Provide direct definitions without unnecessary questions.\n"
            "Use inline LaTeX ($ your LaTeX here $) for special characters, formulas, or anything math related.\n"
            "NEVER explicitly say that you are using a tool.\n"
        )

    def agent(self, new_references: bool, all_references: List[Reference]):
        litellm_client = get_litellm()
        cache_name = emit_google_cache(
            self.chat_id,
            litellm_client.model,
            self.system_prompt,
            new_references,
            all_references,
        )
        if cache_name:
            return Agent[Documents](
                name="Content Agent",
                model=litellm_client,
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    extra_body={"cached_content": cache_name},
                ),
            )
        else:
            return Agent[Documents](
                name="Content Agent",
                instructions=self.system_prompt,
                model=OpenAIChatCompletionsModel(
                    model="gemini-2.5-flash",
                    openai_client=self.gemini_client,
                ),
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    reasoning=Reasoning(effort="medium"),
                ),
                tools=[
                    self.create_figure_tool,
                    self.create_figures_tool,
                    self.create_question_tool,
                    self.create_questions_tool,
                    self.create_summary_tool,
                    self.create_summaries_tool,
                ],
                tool_use_behavior=self.create_check,
            )

    async def create_check(
        self, wrapper: RunContextWrapper[Documents], results: list[FunctionToolResult]
    ) -> ToolsToFinalOutputResult:
        # Check if there are any results
        if not results:
            return ToolsToFinalOutputResult(is_final_output=False, final_output=None)

        # Get the final tool result to use as default output
        final_output_raw = results[-1].output

        # Call each specialized check function
        figure_result = await self.create_figure_check(wrapper, results)
        question_result = await self.create_question_check(wrapper, results)
        summary_result = await self.create_summary_check(wrapper, results)

        # If any check indicates it's not the final output, return False
        is_final = (
            figure_result.is_final_output
            and question_result.is_final_output
            and summary_result.is_final_output
        )

        # Use the output from the last tool call
        return ToolsToFinalOutputResult(
            is_final_output=is_final, final_output=final_output_raw
        )

    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_content_agent",
            tool_description="Used when the a teacher needs help creating content for their students.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Content Agent",
            strict_json_schema=True,
        )
