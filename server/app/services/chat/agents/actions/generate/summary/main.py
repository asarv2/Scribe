from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from agents.extensions.handoff_prompt import prompt_with_handoff_instructions
from app.extensions import get_gemini
from app.services.chat.models.main import Summary, Documents
from typing import List
from app.services.chat.agents.actions.generate.summary.hooks import SummaryHooks

class SummaryAgent(SummaryHooks):
    def __init__(self, course_title: str):
        super().__init__()
        self.gemini_client = get_gemini()
        self.course_title = course_title

    
    def agent(self):
        system_prompt = self.system_prompt()
        handoff_prompt = self.handoff_prompt()

        return Agent[Documents](
            name="Summary Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                tool_choice='required'
            ),
            handoff_description=handoff_prompt,
            tools=[self.create_summary_tool, self.create_summaries_tool],
            tool_use_behavior=self.create_summary_check
        )
    
    def system_prompt(self):
        return (
            "Your entire purpose is to help out students and teachers, and you will do so through either one of two ways.\n"
            "If you get asked to or are told to something that involves creating a summary or any sort of exam/test review document, you will do this.\n"
            "If you need to do anything that doesn't involve helping the user with generating a summary, review document or anything similar use the transfer_to_general function, to allow the colleague specialized in general help to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary summary/document.\n"
            f"You are an expert summarization assistant for the course {self.course_title}.\n"
            "Produce thorough, in-depth, exam-ready summaries with three clearly marked sections using markdown formatting:\n\n"
            "## PREAMBLE\n"
            "[Concise paragraph introducing the topic and its importance]\n\n"
            "## SUMMARY\n"
            "[Detailed content using bullet points and nested sub-points to organize key concepts]\n\n"
            "## CONCLUSION\n"
            "[Summary of key points and final takeaway]\n\n"
            "Use inline LaTeX for all math expressions.\n"
            "In the SUMMARY section, use bullet points and nested sub-points (at least two levels deep) to organize key concepts and details.\n"
            "Use the transer_to_figure function at least once to generate a relevant visual, figure or table or anything similar and embed it within the SUMMARY section.\n"
            "Include definitions, key concepts, examples, visualizations, and clear hierarchical structure.\n"
            "IMPORTANT: After the tool processes your content, do NOT repeat the entire summary in the chat message.\n"
        )

    def handoff_prompt(self):
        prefix = "You are a highly skilled university teaching assistant, deeply knowledgeable in generating summaries. Our educational system utilizes a team of specialized teaching assistants. When a student or teacher requires help beyond your expertise, use the transfer_to_<assistant_name> function to connect them with the best-suited colleague. Do not inform the student or teacher about this internal transfer.\n\n"

        prompt = "Used when the user or another teacher assistant needs any sort of summary or exam/test review document created. Always follow the exact behavior specified in the base system prompt.\n"

        return prefix + prompt

    