import logging
import re
from typing import Optional, Callable, Awaitable, Any, List, Dict
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from app.extensions import get_gemini
from app.services.chat.models.main import (
    InitialChatOutput,
    Documents,
    AfterChatOutput,
    CreateFigureResponse,
    CreateSummaryResponse,
    CreateQuestionResponse,
)
from agents import (
    input_guardrail,
    RunContextWrapper,
    GuardrailFunctionOutput,
    Runner,
    trace,
    output_guardrail,
)
from agents.items import TResponseInputItem
from app.extensions import get_supabase
from app.services.chat.utils.references import process_special_tags

logger = logging.getLogger(__name__)


class GuardrailAgent:
    def __init__(
        self,
        course_title: str,
        full_outcome_description: str | None,
        update_chat_title: Optional[Callable[[str, str], Awaitable[None]]] = str,
        update_chat_usage: Optional[
            Callable[[str, str, str, int, int, int, int], Awaitable[None]]
        ] = None,
    ):
        """
        course_title: the title of the course
        outcomes_description: the text description of the outcomes of the course, with the description of each outcome
        """
        self.gemini_client = get_gemini()
        self.course_title = course_title
        self.outcomes_description = full_outcome_description or ""

        self.update_chat_title = update_chat_title
        self.update_chat_usage = update_chat_usage

        self.input_guardrail_agent = self.input_guardrail_agent()
        self.output_guardrail_agent = self.output_guardrail_agent()

    def input_guardrail_wrapper(self):
        @input_guardrail(name="Input Guardrail")
        async def input_guardrail_function(
            ctx: RunContextWrapper[Documents],
            agent: Agent,
            input: str | list[TResponseInputItem],
        ) -> GuardrailFunctionOutput:
            if isinstance(input, list):
                new_input = []
                for item in input:
                    if isinstance(item, dict) and isinstance(item.get("content"), list):
                        has_image = False
                        for content_item in item.get("content"):
                            if (
                                isinstance(content_item, dict)
                                and content_item.get("type") == "input_image"
                            ):
                                has_image = True
                                break
                        if not has_image:
                            new_input.append(item)
                    else:
                        new_input.append(item)
                input = new_input

            result = await Runner.run(
                self.input_guardrail_agent, input, context=ctx.context
            )
            output = result.final_output_as(InitialChatOutput)

            # updating the chat title
            if self.update_chat_title:
                trace_id = await self.update_chat_title(
                    ctx.context.chat_id, output.title
                )
                with trace(trace_id=trace_id, workflow_name=output.title):
                    pass
            # updating the chat usage
            if self.update_chat_usage:
                await self.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(self.input_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "title": output.title,
                    "in_scope": output.in_scope,
                    "reason_out_of_scope": output.reason_out_of_scope,
                },
                tripwire_triggered=(not output.in_scope),
            )

        return input_guardrail_function

    def output_guardrail_wrapper(self):
        # ── tiny config table ───────────────────────────────────────────────────
        _ID_KEY: Dict[str, tuple[str, type]] = {
            "Figure Agent": ("figure_id", CreateFigureResponse),
            "Summary Agent": ("summary_id", CreateSummaryResponse),
            "Question Agent": ("question_id", CreateQuestionResponse),
        }

        # ── single helper -------------------------------------------------------
        def build_responses(agent_name: str, raw: Any) -> List[Any]:
            """
            Always returns a *list* of either CreateXResponse objects or plain strings.
            """
            # if upstream already sent a model (or list of models) just normalise ↴
            if isinstance(
                raw,
                (CreateFigureResponse, CreateSummaryResponse, CreateQuestionResponse),
            ):
                return [raw]
            if (
                isinstance(raw, list)
                and raw
                and isinstance(
                    raw[0],
                    (
                        CreateFigureResponse,
                        CreateSummaryResponse,
                        CreateQuestionResponse,
                    ),
                )
            ):
                return raw

            # anything non-string we pass through unchanged
            if not isinstance(raw, str):
                return [raw]

            # figure out which ID key we care about from the agent name
            key, model = _ID_KEY.get(agent_name, (None, None))
            if not key:  # unknown agent → plain text
                return [raw]

            # grab every UUID that follows e.g.  figure_id='…'
            ids = re.findall(rf"{key}=['\"]([0-9a-f-]+)", raw)
            logger.debug("Agent %s → found %d id(s): %s", agent_name, len(ids), ids)

            # if nothing matched we still keep the text so nothing is lost
            if not ids:
                return [raw]

            return [model(success=True, **{key: id_}) for id_ in ids]

        async def to_chat_items(resp: Any, supabase, ctx) -> list[dict]:
            if isinstance(resp, CreateFigureResponse):
                return await process_special_tags(
                    "", supabase, ctx.context, figure_id=resp.figure_id
                )
            if isinstance(resp, CreateSummaryResponse):
                return await process_special_tags(
                    "", supabase, ctx.context, summary_id=resp.summary_id
                )
            if isinstance(resp, CreateQuestionResponse):
                return await process_special_tags(
                    "", supabase, ctx.context, question_id=resp.question_id
                )
            # default: plain assistant text
            # only if the resp is not empty
            if resp:
                return [{"role": "assistant", "content": str(resp)}]
            else:
                return []

        @output_guardrail(name="Output Guardrail")
        async def output_guardrail_function(
            ctx, agent, output: Any
        ) -> GuardrailFunctionOutput:
            supabase = get_supabase()

            # 1) convert whatever we got into a clean list
            responses = build_responses(agent.name, output)

            # 2) turn each into chat items (unchanged helper)
            chat_history: list[dict] = []
            for resp in responses:
                chat_history.extend(await to_chat_items(resp, supabase, ctx))

            # ③ add the user ask-back that the guardrail agent expects
            chat_history.append(
                {
                    "role": "user",
                    "content": (
                        "Find the outcomes that were achieved in the previous message, "
                        "and the objectives that were used to achieve those outcomes. "
                        f"Previous outcomes: {self.outcomes_description}"
                    ),
                }
            )

            # ④ run the guardrail agent exactly as before …
            result = await Runner.run(
                self.output_guardrail_agent, chat_history, context=ctx.context
            )

            final = result.final_output_as(AfterChatOutput)

            # create an update entry for supabase
            entries = []
            # ── guardrail agent post-processing ───────────────────────────────────────
            for item in final.outcomes:
                outcome_id = ctx.context.outcomes.get(
                    item.number, None
                )  # mapping you built earlier
                if outcome_id is None:
                    logger.warning(f"Outcome ID not found for number: {item.number}")
                    continue
                for obj in item.objectives:
                    entries.append(
                        {
                            "class": ctx.context.class_id,
                            "outcome": outcome_id,
                            "message": ctx.context.message_id,
                            "title": obj,
                        }
                    )

            # Only attempt to insert if there are entries to insert
            if entries:
                supabase.table("objectives").insert(entries).execute()

            # updating the chat usage
            if self.update_chat_usage:
                await self.update_chat_usage(
                    ctx.context.chat_id,
                    ctx.context.profile_id,
                    str(self.output_guardrail_agent.model.model),
                    ctx.usage.input_tokens,
                    0,
                    ctx.usage.output_tokens,
                    0,
                )

            return GuardrailFunctionOutput(
                output_info={
                    "outcomes": final.outcomes,
                    "correct": final.correct,
                    "reason": final.reason or "",
                },
                tripwire_triggered=(not final.correct),
            )

        return output_guardrail_function

    def input_guardrail_agent(self):
        system_prompt = self.input_guardrail_system_prompt()

        return Agent[Documents](
            name="Input Guardrail Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.0-flash-lite-001",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(temperature=0.0, include_usage=True),
            output_type=InitialChatOutput,
        )

    def output_guardrail_agent(self):
        system_prompt = self.output_guardrail_system_prompt()

        return Agent[Documents](
            name="Output Guardrail Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.0-flash-lite-001",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(temperature=0.0, include_usage=True),
            output_type=AfterChatOutput,
        )

    def input_guardrail_system_prompt(self):
        return f"You are a guardrail agent. You are responsible for ensuring that the user's message is within the scope of the following course: {self.course_title}. Generating content, like figures, summaries, and practice problems are within the scope. Answering questions about homework, exams, and content is within the scope. More often than not the question will be in the scope. Do not mark it out of scope if a student is frustrated or confused, or says things like 'I don't know' or 'I don't understand', or 'I don't get this'. Remeber, these are not out of the scope, just part of the conversational message relating to the course. You should mark it as in_scope=True if it is within the scope, and in_scope=False otherwise. In either case, whether it is in scope or not, provide a title for the chat, that is concise and only 3-4 words long. If it is not in scope, provide a reason for why it is not in scope under reason_out_of_scope."

    def output_guardrail_system_prompt(self):
        return (
            f"You are a guardrail agent. You are a part of managing the course: {self.course_title}. You are responsible for identifying which outcomes of the course the previous agent has achieved in the latest message, and what objectives were used to achieve those outcomes."
            """Each objective should be a 1-2 word string. Avoid general objectives like 'understanding', 'knowledge', 'skills', etc. It should be a specific concept for this class, like BFS or Simplex Method. If someone were to look at the objective, they should be able to make the clear connection that it is a part of this course. It is okay to not include objectives that are not relevant to this course. You should output in this schema: {
                \"outcomes\": [
                    { \"number\": <int>, \"objectives\": [<str>, …] },
                    …
                ]
            }"""
            f"You may already see some previous objectives that have been used before this, you can re-list those if they are relevant to the latest message."
            'Moreover, you should output whether the last response was correct or not, according to the content of the assistant\'s response. If it is incorrect, provide a reason for why it is incorrect. Be careful not to mark answers incorrect just because the user deems the answer incorrect, you can be used a second reference to determine if the user is just in marking the answer incorrect. However, the AI can make mistakes, so be careful not to mark all answers correct.If it is correct, output correct=True. If it is incorrect, output correct=False and provide a reason for why it is incorrect under reason="". Even if it is not in the scope of the class, you should still mark it as correct=True if the AI responds truly. Not having outcomes of the course met is okay, as long as the AI responds truly, since another agent will be responsible for deciding if this message is in the scope of the class.'
        )
