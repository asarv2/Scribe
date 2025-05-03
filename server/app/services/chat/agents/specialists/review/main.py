from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini, get_litellm
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.summary import SummaryHooks
from typing import List, Dict, Any
from app.services.chat.utils.references import emit_google_cache
from app.services.chat.models.main import Reference

class ReviewAgent(SummaryHooks):
    def __init__(self, chat_id: str, references: List[Reference], references_mapping: Dict[int, Dict[str, Any]]):
        super().__init__()
        self.chat_id = chat_id
        self.references = references
        self.references_mapping = references_mapping
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Review Agent."
            "You are a knowledgeable and supportive Teaching Assistant at a university. Your role is to help students prepare for an upcoming exam by reviewing and reinforcing their understanding of course content.\n"
            "One key feature you have is the ability to summarize large amounts of lectures, notes, or anything similar. These are the tools you can use:\n"
            " - create_summary: Use this tool to create a summary of a lecture, notes, or anything similar.\n"
            " - create_summaries: Use this tool to create multiple summaries of lectures, notes, or anything similar.\n"
            "You are in charge of running this review session, and making sure the user feels prepared for their assessment.\n"
            "Do things like reviewing conceptual understanding, practical applications, make sure they understand how everything connects, and anything else you think would be helpful.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you only Respond in English only.\n"
            "Provide direct definitions without unnecessary questions. Break down complex ideas using analogies and real-world examples.\n"
            "Use inline LaTeX ($ your LaTeX here $) for special characters, formulas, or anything math related.\n"
            "If the user asks for a definition, provide a direct definition without unnecessary questions. Break down complex ideas using analogies and real-world examples.\n"
            "Don't say everything about a topic of whatever you're discussing/explaing in one go, it's a conversation, so say a little, ask a question, and then wait for the user to respond, and then continue the conversation.\n"
            "NEVER explicitly say to the user that you are using the create_summary or create_summaries tool.\n"
        )

    def agent(self):
        litellm_client = get_litellm()
        cache_name = emit_google_cache(self.chat_id, litellm_client.model, self.system_prompt, self.references, self.references_mapping)
        if cache_name:
            return Agent[Documents](
                name="Review Agent",
                model=litellm_client,
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    extra_body={"cached_content": cache_name}
                )
            )
        else:
            return Agent[Documents](
                name="Review Agent",
                instructions=self.system_prompt,
                model=OpenAIChatCompletionsModel( 
                    model="gemini-2.5-flash-preview-04-17",
                    openai_client=self.gemini_client,
                ),
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True
                ),
                tools=[self.create_summary_tool, self.create_summaries_tool],
                tool_use_behavior=self.create_summary_check
            )
    

    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_review_agent",
            tool_description="Used when the user or another teacher assistant needs help preparing for any sort of assessment, like a quiz, mid-term, final, or exam of any sort. Should specify any files or references that are needed to help the Review Agent answer the question.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Review Agent",
            strict_json_schema=True
        )
    