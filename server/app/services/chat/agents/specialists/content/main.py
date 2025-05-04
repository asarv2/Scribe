from typing import List
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini, get_litellm
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.models.main import Reference
from app.services.chat.utils.references import emit_google_cache
from typing import Dict, Any

class ContentAgent:
    def __init__(self, chat_id: str):
        self.chat_id = chat_id
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Content Agent. Your goal is to help teachers create content for their students, and potentially overlook/condense existing content.\n"
            "NEVER explicitly say that you are using a tool.\n"
        )

    def agent(self, new_references: bool, all_references: List[Reference]):
        litellm_client = get_litellm()
        cache_name = emit_google_cache(self.chat_id, litellm_client.model, self.system_prompt, new_references, all_references)
        if cache_name:
            return Agent[Documents](
                name="Content Agent",
                model=litellm_client,
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    extra_body={"cached_content": cache_name}
                )
            )
        else:
            return Agent[Documents](
                name="Content Agent",
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
            tool_name="transfer_to_content_agent",
            tool_description="Used when the a teacher needs help creating content for their students.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Content Agent",
            strict_json_schema=True
        )