from typing import List, Any, Optional, Callable, Awaitable, Tuple
from agents import Agent
from datetime import datetime
from app.extensions import get_supabase, get_gemini
from agents import Agent, Runner, trace, RunHooks, Tool, RunContextWrapper, RawResponsesStreamEvent, RunConfig, ModelBehaviorError, InputGuardrailTripwireTriggered
from app.services.chat.models.main import Documents, CreateFigureResponse, CreateQuestionResponse, CreateSummaryResponse
from app.services.chat.utils.references import process_special_tags, clean_references
from agents.items import TResponseInputItem
from openai.types.responses import ResponseTextDeltaEvent
import logging
import asyncio

from app.services.chat.agents.main import GeneralAgent
from app.services.chat.agents.guardrail import GuardrailAgent

logger = logging.getLogger(__name__)

class ChatProcessor(RunHooks):
    def __init__(
        self,
        prompt_type: str,
        course_title: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        trace_id: str | None = None,
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None,
        update_trace_id: Optional[Callable[[str], Awaitable[None]]] = None,
        update_chat_title: Optional[Callable[[str, str], Awaitable[None]]] = str,
        update_chat_usage: Optional[Callable[[str, str, int, int], Awaitable[None]]] = None,
    ):
        super().__init__()
        self.supabase_client = get_supabase()
        self.gemini_client = get_gemini()
        self.prompt_type = prompt_type
        self.course_title = course_title
        self.trace_id = trace_id
        self.current_question = question
        self.chat_history = []
        # Format past messages into chat history
        for _, q, r in past_messages:
            if q and r:  # Only add complete message pairs
                self.chat_history.extend([q, r])

        # set the stream callback. Will be used to update the chat.
        self.stream_callback = stream_callback
        self.update_trace_id = update_trace_id
        self.update_chat_title = update_chat_title
        self.update_chat_usage = update_chat_usage

        self.starting_agent = GeneralAgent(self.course_title).main()
        self.guardrail = GuardrailAgent(self.course_title, self.update_chat_title, self.update_chat_usage).main()

    async def format_conversation(self, google_file_ids: List[str], reference_description: str, documents: Documents, add_current=True) -> list[TResponseInputItem]:
        """Format the conversation history into context"""

        initial_context = [{"type": "input_text", "text": f"The class you are to help me with is {self.course_title}. You should center your responses around this class only, refraining from creating content that does not pertain to this class. Use the following reference description to help you with your responses: {reference_description}"}]

        # for each google_file_id, we add a message to the context
        for google_file_id in google_file_ids:
            initial_context.append({
                    "type": "input_image",
                    "image_url": f"https://generativelanguage.googleapis.com/v1beta/{google_file_id}",
                    "detail": "high"
                })
            
        context_summary = [{"role": "user", "content": initial_context}]
        
        # Add conversation history
        for i in range(0, len(self.chat_history)-1, 2):
            user_message = "No user message"
            if self.chat_history[i] != "":
                user_message = self.chat_history[i]
            context_summary.append({"role": "user", "content": user_message})

            assistant_messages = [{"role": "assistant", "content": "No assistant message"}]
            if self.chat_history[i+1] != "":
                assistant_messages = await process_special_tags(self.chat_history[i+1], self.supabase_client, documents)
            context_summary.extend(assistant_messages)
        
        if add_current:
            # Getting current message ready
            current_context = []
            current_context.append({"type": "input_text", "text": self.current_question})
            
            # Add the current question
            context_summary.append({"role": "user", "content": current_context})
        
        return context_summary
    
    async def on_agent_start(
        self, context: RunContextWrapper[Documents], agent: Agent[Documents]
    ) -> None:
        """Called before the agent is invoked. Called each time the current agent changes."""
        if agent.name == "Figure Agent":
            await self.stream_callback(f"<FIGURE_GENERATING>")
        elif agent.name == "Summary Agent":
            await self.stream_callback(f"<SUMMARY_GENERATING>")
        elif agent.name == "Question Agent":
            await self.stream_callback(f"<QUESTION_GENERATING>")
  
    async def process_message(
        self,
        chat_id: str,
        google_ids: List[str],
        documents: Documents,
        reference_description: str,
    ) -> None:
        """Process a single message with streaming"""
        retry_number = 0
        retry_errors = []
        
        while retry_number < 3:  # Limit to 3 retries
            try:
                # Update status for retry attempts
                if retry_number > 0:
                    logger.info(f"Retry attempt {retry_number}/3")
                    self.supabase_client.table("messages").update({
                        "status_text": f"Retrying... (Attempt {retry_number}/3)"
                    }).eq("id", documents.message_id).execute()

                    
                    # Add a delay between retries (increasing with each retry)
                    await asyncio.sleep(1 * retry_number)
                
                conversation_context = await self.format_conversation(
                    google_ids, 
                    reference_description, 
                    documents=documents,
                )

                # Create a new run configuration for each attempt
                input_guardrails = [self.guardrail] if len(self.chat_history) == 0 else []
                run_config = RunConfig(
                    group_id=chat_id,
                    trace_id=self.trace_id,
                    input_guardrails=input_guardrails
                )
                
                # Run the agent with the current context
                result = Runner.run_streamed(
                    self.starting_agent, 
                    input=conversation_context, 
                    context=documents, 
                    hooks=self, 
                    max_turns=15, 
                    run_config=run_config
                )

                # Set trace ID if not already set
                if not self.trace_id:
                    trace_id = result.trace.trace_id
                    self.trace_id = trace_id
                    await self.update_trace_id(chat_id, trace_id)

                # Process streaming events
                async for event in result.stream_events():
                    if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
                        if isinstance(event.data, ResponseTextDeltaEvent):
                            chunk = event.data.delta
                            cleaned_chunk = clean_references(chunk, documents.references)
                            await self.stream_callback(cleaned_chunk)

                # Update usage statistics
                raw_responses = result.raw_responses
                for response in raw_responses:
                    usage = response.usage
                    await self.update_chat_usage(
                        documents.chat_id, 
                        documents.profile_id, 
                        usage.input_tokens, 
                        usage.output_tokens
                    )
                
                # If we get here, processing was successful
                return
            
            except InputGuardrailTripwireTriggered as e:
                # Handle tripwire triggered
                error_msg = str(e)
                logger.error(f"InputGuardrailTripwireTriggered in process_message: {error_msg}")
                return
                
            except ModelBehaviorError as e:
                # Handle model behavior errors (like the tool not found error)
                error_msg = str(e)
                logger.error(f"ModelBehaviorError in process_message: {error_msg}")
                retry_number += 1
                retry_errors.append(error_msg)
                
                # If this was our last retry, send an error message to the user
                if retry_number >= 3:
                    await self.stream_callback("\n\nI'm sorry, I encountered an error while processing your request. Please try again with a different question or in a new chat.")
                    
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