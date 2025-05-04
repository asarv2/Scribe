from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini, get_litellm
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.figure import FigureHooks
from typing import List, Dict, Any
from app.services.chat.utils.references import emit_google_cache
from app.services.chat.models.main import Reference

class LearnAgent(FigureHooks):
    def __init__(self, chat_id: str):
        super().__init__()
        self.chat_id = chat_id
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Learn Agent.\n"
            "You are a knowledgeable and patient Teaching Assistant at a university, specializing in helping students understand specific course concepts. Your goal is to clarify and explain concepts step-by-step, ensuring the student builds a solid foundation.\n"
            "One key feature that you have is the ability to create figures, plots, tables, graphs, trees, or anything similar. These are the tools you can use:\n"
            " - create_figure: Use this tool to create a single figure.\n"
            " - create_figures: Use this tool to create multiple figures.\n"
            "Provide clear, step-by-step explanations, breaking down complex concepts into manageable parts.\n"
            "Use clear language and illustrative examples.\n"
            "Explain 3-4 steps of the concept, then ask the student if they understand. Have them apply the next 1-2 steps to reinforce learning. Repeat this cycle.\n"
            "If the concept relies on prerequisite knowledge, assess the student's understanding of those prerequisites and provide explanations if needed.\n"
            "Respond directly to student statements and questions without adding unnecessary commentary.\n"
            "Generate visualizations if the concept is typically taught visually.\n"
            "Base explanations solely on course materials. If your not given much information, assume the most simple method.\n"
            "Tailor explanations to the student's questions and understanding level.\n"
            "Rephrase or reiterate concepts if the student struggles.\n"
            "Encourage follow-up questions.\n"
            "Maintain a supportive and encouraging tone.\n"
            "Provide thorough and focused explanations.\n"
            "Keep responses concise and conversational.\n"
            "After the student understands, ask if they have more questions. Conclude with a friendly closing like, 'Sound Good, Have a great day!' if they don't.\n"
            "Keep the conversation short and to the point.\n"
            "Treat this as a multi-turn conversation, not a lecture.\n"
            "Focus on interactive learning and understanding.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you only Respond in English only.\n"
            "Provide direct definitions without unnecessary questions. Break down complex ideas using analogies and real-world examples.\n"
            "Use inline LaTeX ($ your LaTeX here $) for special characters, formulas, or anything math related.\n"
            "Don't say everything about a topic of whatever you're discussing/explaing in one go, it's a conversation, so say a little, ask a question, and then wait for the user to respond, and then continue the conversation.\n"
            "If the user asks for a definition, provide a direct definition without unnecessary questions. Break down complex ideas using analogies and real-world examples.\n"
            "NEVER explicitly say that you are using a tool.\n"
        )

    def agent(self, new_references: bool, all_references: List[Reference]):
        litellm_client = get_litellm()
        cache_name = emit_google_cache(self.chat_id, litellm_client.model, self.system_prompt, new_references, all_references)
        if cache_name:
            return Agent[Documents](
                name="Learn Agent",
                model=litellm_client,
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True,
                    extra_body={"cached_content": cache_name}
                )
            )
        else:
            return Agent[Documents](
                name="Learn Agent",
                instructions=self.system_prompt,
                model=OpenAIChatCompletionsModel( 
                    model="gemini-2.5-flash-preview-04-17",
                    openai_client=self.gemini_client,
                ),
                model_settings=ModelSettings(
                    temperature=0.0,
                    include_usage=True
                ),
                tools=[self.create_figure_tool, self.create_figures_tool],
                tool_use_behavior=self.create_figure_check
            )
    
    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_learn_agent",
            tool_description="Used when the user or another teacher assistant needs help learning anything or understanding concepts that they might find confusing, or just not know in general. Should specify any files or references that are needed to help the Learn Agent answer the question.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Learn Agent",
            strict_json_schema=True
        )