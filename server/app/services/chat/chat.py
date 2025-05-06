from typing import List, Any, Optional, Callable, Awaitable, Tuple
from agents import Agent
from app.extensions import get_supabase, get_gemini
from agents import (
    Runner,
    RunHooks,
    Tool,
    RunContextWrapper,
    RunConfig,
    ModelBehaviorError,
    InputGuardrailTripwireTriggered,
    OutputGuardrailTripwireTriggered,
)
from app.services.chat.models.general import (
    Documents,
    CreateFigureResponse,
    CreateQuestionResponse,
    CreateSummaryResponse,
    CreateReportResponse,
    ChatAgents,
    Reference,
)
from app.services.chat.utils.references import process_special_tags, clean_references
from agents.items import TResponseInputItem
from openai.types.responses import (
    ResponseTextDeltaEvent,
    ResponseReasoningSummaryTextDeltaEvent,
)
import logging
import asyncio
from app.services.chat.agents.guardrail import GuardrailAgent
from app.services.chat.utils.graph import AgentGraph
from app.services.chat.utils.references import (
    emit_user_references,
    emit_google_references,
    get_cached_tokens,
)

logger = logging.getLogger(__name__)


class ChatProcessor(RunHooks):
    def __init__(
        self,
        chat_id: str,
        starting_agent: ChatAgents,
        teacher: bool,
        course_title: str,
        question: str,
        all_references: List[Reference],  # all references
        expanded_references: List[Reference],  # expanded references
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        past_references: List[
            List[Reference]
        ],  # Will be a 2D array of references, where each sub-array is a list of references for a single message
        trace_id: str | None = None,
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None,
        update_trace_id: Optional[Callable[[str, str], Awaitable[None]]] = None,
        update_chat_title: Optional[Callable[[str, str], Awaitable[str]]] = None,
        update_chat_usage: Optional[
            Callable[[str, str, str, int, int, int, int], Awaitable[None]]
        ] = None,
        update_end_agent: Optional[Callable[[str, ChatAgents], Awaitable[None]]] = None,
        update_chat_files: Optional[Callable[[str], Awaitable[None]]] = None,
        full_outcome_description: Optional[str] = None,
    ):
        super().__init__()
        self.chat_id = chat_id
        self.supabase_client = get_supabase()
        self.gemini_client = get_gemini()
        self.course_title = course_title
        self.teacher = teacher
        self.trace_id = trace_id
        self.current_question = question
        self.all_references = all_references
        self.expanded_references = emit_user_references(expanded_references)
        self.expanded_references_google = emit_google_references(expanded_references)
        self.chat_history = []
        # Format past messages into chat history
        for _, q, r in past_messages:
            if q and r:  # Only add complete message pairs
                self.chat_history.extend([q, r])

        self.chat_references = []  # 2D array for all of the tool calls
        self.google_references = []  # 1D array for all of the google references
        for references in past_references:
            google_references = emit_google_references(references)
            # only add references for this message if google references exist
            if google_references:
                new_message = {"role": "user", "content": google_references}
                self.google_references.append(new_message)

                references_tool_call = emit_user_references(references)
                self.chat_references.append(references_tool_call)
            else:
                logger.warning("No google references found")

        # set the stream callback. Will be used to update the chat.
        self.stream_callback = stream_callback
        self.update_trace_id = update_trace_id
        self.update_chat_title = update_chat_title
        self.update_chat_usage = update_chat_usage
        self.starting_agent_name = starting_agent
        self.update_end_agent = update_end_agent
        self.update_chat_files = update_chat_files

        graph = AgentGraph(self.chat_id, self.teacher, self.starting_agent_name)
        self.starting_agent = graph.forward(
            new_references=(len(self.expanded_references) > 0),
            all_references=self.all_references,
        )
        model_body = self.starting_agent.model_settings.extra_body
        if (
            model_body
            and isinstance(model_body, dict)
            and "cached_content" in model_body
        ):
            cache_name = model_body.get("cached_content")
            self.cached_tokens = get_cached_tokens(cache_name)
            self.is_caching = True
        else:
            self.cached_tokens = 0
            self.is_caching = False

        # check if this is a new chat
        new_chat = len(self.chat_history) == 0
        self.guardrail = GuardrailAgent(
            self.course_title,
            full_outcome_description,
            self.update_chat_title
            if new_chat and self.update_chat_title is not None
            else None,
            self.update_chat_usage,
        )
        self.input_guardrail = self.guardrail.input_guardrail_wrapper()
        self.output_guardrail = self.guardrail.output_guardrail_wrapper()

    async def format_conversation(
        self, outcomes_description: str, documents: Documents, add_current=True
    ) -> list[TResponseInputItem]:
        """Format the conversation history into context"""

        context_summary: list[TResponseInputItem] = [
            {
                "role": "user",
                "content": f"I am a {'teacher' if self.teacher else 'student'} at a university. The class you are to help me with is {self.course_title}. You should center your responses around this class only, refraining from creating content that does not pertain to this class.{len(outcomes_description) > 0 and ' The following are the outcomes of the class that you should try to follow in your responses: ' + outcomes_description or ''}\n\nEmphasize the use of inline LaTeX when referencing equations, formulas, and other mathematical content ($ your latex here $). To cite any references, you can create inline citations with [x], where x is the reference number. \n\n You can tell that a reference is a full file if file=True, and otherwise it is a single page number (file=False). If I add references, more likely than not, you should use them. When handing off to another agent, you should prioritize adding the reference to the full file with all the page numbers, instead of each page individually (to save space). Those files from the reference handoff will appear after this message as the chat progresses. When citing your sources to me, you should prioritize the individual page number over the general file reference (for specificity).",
            }
        ]

        # Add conversation history
        reference_count = len(self.chat_references)  # Number of reference sets

        for i in range(0, len(self.chat_history) - 1, 2):
            message_index = i // 2  # Convert flat index to message pair index

            if self.chat_history[i] != "":
                user_message_items: list[TResponseInputItem] = []
                # Only add references if they exist for this message
                if message_index < reference_count and not self.is_caching:
                    user_message_items.append(
                        {
                            "role": "user",
                            "content": self.google_references[message_index]["content"],
                        }  # type: ignore
                    )
                    for ref in self.chat_references[message_index]:
                        user_message_items.append(
                            {"role": "user", "content": ref["content"]}
                        )  # type: ignore
                user_message_items.append(
                    {"role": "user", "content": self.chat_history[i]}
                )
                context_summary.extend(user_message_items)

            assistant_messages: list[TResponseInputItem] = [
                {"role": "assistant", "content": "No assistant message"}
            ]
            if self.chat_history[i + 1] != "":
                assistant_messages = await process_special_tags(
                    self.chat_history[i + 1], self.supabase_client, documents
                )
            context_summary.extend(assistant_messages)

        if add_current:
            # Add the current question
            current_message_items: list[TResponseInputItem] = []
            if self.expanded_references_google and not self.is_caching:
                current_message_items.append(
                    {"role": "user", "content": self.expanded_references_google}  # type: ignore
                )
            if self.expanded_references and not self.is_caching:
                for ref in self.expanded_references:
                    current_message_items.append(
                        {"role": "user", "content": ref["content"]}
                    )  # type: ignore
            current_message_items.append(
                {"role": "user", "content": self.current_question}
            )
            context_summary.extend(current_message_items)

        return context_summary

    async def on_agent_start(
        self, context: RunContextWrapper[Documents], agent: Agent[Documents]
    ) -> None:
        """Called before the agent is invoked. Called each time the current agent changes."""
        if self.stream_callback:
            if agent.name == "Figure Agent":
                await self.stream_callback("<FIGURE_GENERATING>")
            elif agent.name == "Summary Agent":
                await self.stream_callback("<SUMMARY_GENERATING>")
            elif agent.name == "Question Agent":
                await self.stream_callback("<QUESTION_GENERATING>")
            elif agent.name == "Report Agent":
                await self.stream_callback("<REPORT_GENERATING>")

    async def on_tool_start(
        self,
        context: RunContextWrapper[Documents],
        agent: Agent[Documents],
        tool: Tool,
    ) -> None:
        """Called before a tool is invoked."""
        if self.stream_callback:
            if tool.name == "create_figure" or tool.name == "create_figures":
                await self.stream_callback("<FIGURE_GENERATING>")
            elif tool.name == "create_question" or tool.name == "create_questions":
                await self.stream_callback("<QUESTION_GENERATING>")
            elif tool.name == "create_summary" or tool.name == "create_summaries":
                await self.stream_callback("<SUMMARY_GENERATING>")
            elif tool.name == "create_report" or tool.name == "create_reports":
                await self.stream_callback("<REPORT_GENERATING>")

    async def on_tool_end(
        self,
        context: RunContextWrapper[Documents],
        agent: Agent[Documents],
        tool: Tool,
        result: Any,
    ) -> None:
        """Called after a tool is invoked."""
        if self.stream_callback:
            if tool.name == "create_figure":
                if isinstance(result, CreateFigureResponse):
                    await self.stream_callback(result.message)
            elif tool.name == "create_figures":
                # Check if result is a list first, then check each item
                if isinstance(result, list):
                    for i, item in enumerate(result):
                        prefix = "<FIGURE_GENERATING>" if i > 0 else ""
                        if isinstance(item, CreateFigureResponse):
                            await self.stream_callback(f"{prefix}{item.message}")
            elif tool.name == "create_question":
                if isinstance(result, CreateQuestionResponse):
                    await self.stream_callback(result.message)
            elif tool.name == "create_questions":
                # Check if result is a list first, then check each item
                if isinstance(result, list):
                    for i, item in enumerate(result):
                        prefix = "<QUESTION_GENERATING>" if i > 0 else ""
                        if isinstance(item, CreateQuestionResponse):
                            await self.stream_callback(f"{prefix}{item.message}")
            elif tool.name == "create_summary":
                if isinstance(result, CreateSummaryResponse):
                    await self.stream_callback(result.message)
            elif tool.name == "create_summaries":
                # Check if result is a list first, then check each item
                if isinstance(result, list):
                    for i, item in enumerate(result):
                        prefix = "<SUMMARY_GENERATING>" if i > 0 else ""
                        if isinstance(item, CreateSummaryResponse):
                            await self.stream_callback(f"{prefix}{item.message}")
            elif tool.name == "create_report":
                if isinstance(result, CreateReportResponse):
                    await self.stream_callback(result.message)
            elif tool.name == "create_reports":
                # Check if result is a list first, then check each item
                if isinstance(result, list):
                    for i, item in enumerate(result):
                        prefix = "<REPORT_GENERATING>" if i > 0 else ""
                        if isinstance(item, CreateReportResponse):
                            await self.stream_callback(f"{prefix}{item.message}")

    async def on_handoff(
        self,
        context: RunContextWrapper[Documents],
        from_agent: Agent[Documents],
        to_agent: Agent[Documents],
    ) -> None:
        """Called when a handoff occurs."""
        if self.stream_callback:
            if from_agent.name == "General Agent":
                if to_agent.name == "Learn Agent":
                    await self.stream_callback(
                        "<HANDOFF>Preparing your learning session...</HANDOFF>"
                    )
                elif to_agent.name == "Review Agent":
                    await self.stream_callback(
                        "<HANDOFF>Preparing your review session...</HANDOFF>"
                    )
                elif to_agent.name == "Homework Agent":
                    await self.stream_callback(
                        "<HANDOFF>Preparing your homework session...</HANDOFF>"
                    )

    async def on_agent_end(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        output: Any,
    ) -> None:
        """Called when the agent produces a final output."""
        if self.update_end_agent:
            chat_id = wrapper.context.chat_id
            message_id = wrapper.context.message_id
            if agent.name == "Learn Agent":
                await self.update_end_agent(message_id, "learn")
            elif agent.name == "Review Agent":
                await self.update_end_agent(message_id, "review")
            elif agent.name == "Homework Agent":
                await self.update_end_agent(message_id, "homework")
            elif agent.name == "Content Agent":
                await self.update_end_agent(message_id, "content")
            elif agent.name == "Analyze Agent":
                await self.update_end_agent(message_id, "analyze")
            elif agent.name == "Grade Agent":
                await self.update_end_agent(message_id, "grade")
            else:
                logger.error(f"Unknown agent: {agent.name}")

        if self.update_chat_files:
            # just update the chat with the current files and documents, according to the references
            await self.update_chat_files(chat_id)

    async def process_message(
        self,
        chat_id: str,
        outcomes_description: str,
        documents: Documents,
    ) -> None:
        """Process a single message with streaming"""
        retry_number = 0
        retry_errors = []

        while retry_number < 3:  # Limit to 3 retries
            try:
                # Update status for retry attempts
                if retry_number > 0:
                    logger.info(f"Retry attempt {retry_number}/3")
                    self.supabase_client.table("messages").update(
                        {"status_text": f"Retrying... (Attempt {retry_number}/3)"}
                    ).eq("id", documents.message_id).execute()

                    # Add a delay between retries (increasing with each retry)
                    await asyncio.sleep(1 * retry_number)

                conversation_context = await self.format_conversation(
                    outcomes_description=outcomes_description,
                    documents=documents,
                )

                # Create a new run configuration for each attempt
                input_guardrails = (
                    [self.input_guardrail] if len(self.chat_history) == 0 else []
                )
                run_config = RunConfig(
                    group_id=chat_id,
                    trace_id=self.trace_id,
                    input_guardrails=input_guardrails,
                    # output_guardrails=[self.output_guardrail]
                )

                # Run the agent with the current context
                agent = self.starting_agent  # type: ignore

                result = Runner.run_streamed(
                    agent,
                    input=conversation_context,
                    context=documents,
                    hooks=self,
                    max_turns=15,
                    run_config=run_config,
                )

                # Set trace ID if not already set
                if not self.trace_id and self.update_trace_id and result.trace:
                    trace_id = result.trace.trace_id
                    self.trace_id = trace_id
                    await self.update_trace_id(chat_id, trace_id)

                # Process streaming events
                async for event in result.stream_events():
                    if event.type == "raw_response_event":
                        if isinstance(event.data, ResponseTextDeltaEvent):
                            chunk = event.data.delta
                            cleaned_chunk = clean_references(
                                chunk, documents.references
                            )
                            if self.stream_callback:
                                await self.stream_callback(cleaned_chunk)
                        elif isinstance(
                            event.data, ResponseReasoningSummaryTextDeltaEvent
                        ):
                            logger.info(f"Reasoning summary: {event.data.delta}")

                # Update usage statistics
                raw_responses = result.raw_responses
                for response in raw_responses:
                    usage = response.usage
                    # calculate the reasoning tokens to be total tokens minus input + output
                    reasoning_tokens = usage.total_tokens - (
                        usage.input_tokens + usage.output_tokens
                    )
                    if self.update_chat_usage:
                        model = result.current_agent.model
                        model_name = getattr(model, "model", str(model))
                        await self.update_chat_usage(
                            documents.chat_id,
                            documents.profile_id,
                            model_name,
                            usage.input_tokens,
                            self.cached_tokens,
                            usage.output_tokens,
                            reasoning_tokens if reasoning_tokens > 0 else 0,
                        )

                # If we get here, processing was successful
                return

            except InputGuardrailTripwireTriggered as e:
                # Handle tripwire triggered
                error_msg = str(e)
                input_guardrail_result = e.guardrail_result
                logger.error(
                    f"InputGuardrailTripwireTriggered in process_message: {error_msg}"
                )
                # raise exception to have message be marked as error
                raise Exception(
                    f"{input_guardrail_result.output.output_info['reason_out_of_scope']}"
                )
            except OutputGuardrailTripwireTriggered as e:
                # Handle tripwire triggered
                error_msg = str(e)
                output_guardrail_result = e.guardrail_result
                logger.error(
                    f"OutputGuardrailTripwireTriggered in process_message: {error_msg}"
                )
                # Fixed: use the correct output_info fields
                output_info = output_guardrail_result.output.output_info
                correct = output_info.get("correct", False)
                reason = output_info.get("reason", "")

                result = (
                    self.supabase_client.table("messages")
                    .update(
                        {
                            "correct": correct,
                            "reason": reason,
                        }
                    )
                    .eq("id", documents.message_id)
                    .execute()
                )
                return

            except ModelBehaviorError as e:
                # Handle model behavior errors (like the tool not found error)
                error_msg = str(e)
                logger.error(f"ModelBehaviorError in process_message: {error_msg}")
                retry_number += 1
                retry_errors.append(error_msg)

                # If this was our last retry, send an error message to the user
                if retry_number >= 3:
                    # update the message with an error message
                    self.supabase_client.table("messages").update(
                        {
                            "generation_status": "error",
                            "generation_error": f"ModelBehaviorError: {error_msg}",
                        }
                    ).eq("id", documents.message_id).execute()
                    return

            except Exception as e:
                # Handle other exceptions, including the 499 client closed error
                error_msg = str(e)
                logger.error(f"Error in process_message: {error_msg}")

                # Check if it's a client closed error (499)
                if "499" in error_msg and "cancelled" in error_msg.lower():
                    logger.info("Client connection was closed, retrying...")
                    retry_number += 1
                    retry_errors.append("Connection was interrupted")

                    # If this was our last retry, we'll just let it fail
                    if retry_number >= 3:
                        raise
                else:
                    # For other errors, just raise them
                    raise
