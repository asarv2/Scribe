from typing import Optional, Callable, Awaitable
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, InitialChatOutput
from agents import input_guardrail, RunContextWrapper, GuardrailFunctionOutput, Runner, trace
from agents.items import TResponseInputItem

class GuardrailAgent:
    def __init__(self, course_title: str, update_chat_title: Optional[Callable[[str, str], Awaitable[None]]] = str, update_chat_usage: Optional[Callable[[str, str, int, int], Awaitable[None]]] = None):
        self.gemini_client = get_gemini()
        self.course_title = course_title
        self.update_chat_title = update_chat_title
        self.update_chat_usage = update_chat_usage

        self.guardrail_agent = self.agent()

    def main(self):
        @input_guardrail
        async def general_guardrail( 
            ctx: RunContextWrapper[Documents], agent: Agent, input: str | list[TResponseInputItem]
        ) -> GuardrailFunctionOutput:
            if isinstance(input, list):
                input = [input[-1]] # get the last message
            result = await Runner.run(self.guardrail_agent, input, context=ctx.context)
            output = result.final_output_as(InitialChatOutput)

            # updating the chat title
            if self.update_chat_title:
                trace_id = await self.update_chat_title(ctx.context.chat_id, output.title)
                with trace(trace_id=trace_id, workflow_name=output.title):
                    pass
            # updating the chat usage
            if self.update_chat_usage:
                await self.update_chat_usage(ctx.context.chat_id, 
                        ctx.context.profile_id, 
                        ctx.usage.input_tokens, 
                        ctx.usage.output_tokens)

            return GuardrailFunctionOutput(
                output_info=output.title, 
                tripwire_triggered=(not output.in_scope),
            )
    
        return general_guardrail

    def agent(self):
        system_prompt = self.system_prompt()

        return Agent[Documents](
            name="Guardrail Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
            ),
            output_type=InitialChatOutput,
        )
    
    def system_prompt(self):
        return (
            f"You are a guardrail agent. You are responsible for ensuring that the user's message is within the scope of a question being answered by a teaching assistant for {self.course_title}. You should mark it as in_scope=True if it is within the scope, and in_scope=False otherwise. In either case, whether it is in scope or not, provide a title for the chat, that is concise and only 3-4 words long."
        )
