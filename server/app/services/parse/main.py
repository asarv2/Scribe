from typing import List, Dict, Any, Optional, Callable, Union, Awaitable
import base64
import re
import os
import tempfile
import requests
from PIL import Image
import io
import google.generativeai as genai
from google.generativeai.types import File
from agents import Agent, OpenAIChatCompletionsModel, Runner, ModelSettings, RunConfig, RawResponsesStreamEvent, RunHooks, RunContextWrapper, TContext
from app.extensions import gemini_client
from app.services.parse.prompts import get_parse_prompt, get_file_type_prompt
from app.services.parse.models import CleanedResponse
from agents.items import TResponseInputItem
from openai.types.responses import ResponseTextDeltaEvent
from app.services.chat.models import Documents, process_special_tags, clean_references
from agents.items import TResponseInputItem
from openai.types.responses import ResponseTextDeltaEvent

class FileProcessor(object):
    def __init__(self, 
        course_title: str, 
        file_title: str, 
        file_type: str, 
        file_id: str, 
        profile_id: str | None = None, 
        update_trace_id: Optional[Callable[[str], Awaitable[None]]] = None, 
        update_file_usage: Optional[Callable[[str, str | None, int, int], Awaitable[None]]] = None,
        trace_id: str | None = None
    ):
        super().__init__()
        self.course_title = course_title
        self.file_title = file_title
        self.file_type = file_type
        self.file_id = file_id
        self.profile_id = profile_id
        self.trace_id = trace_id
        self.chat_history = []

        # creating parse agent
        parse_system_prompt = get_parse_prompt(course_title)
        self.parse_agent = Agent(
            name="Parse Agent",
            instructions=parse_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash-lite",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                include_usage=True
            )
        )

        self.update_trace_id = update_trace_id
        self.update_file_usage = update_file_usage

    def format_conversation(self, document: Dict[str, Any], google_file_id: str) -> list[TResponseInputItem]:
        """Format the conversation history into context"""
        context_text = f"The class you are to help me with is {self.course_title}. You should center your responses around this class only, refraining from creating content that does not pertain to this class. Follow the instructions above and help describe the files."
            
        context_summary = [{"role": "user", "content": context_text}]
        
        # Add chat history if it exists
        for message in self.chat_history:
            context_summary.append({"role": "assistant", "content": str(message)})

        # Create current context with the file reference
        current_context = []
        
        # Add the file reference if we have a google_file_id
        if google_file_id:
            # For Gemini, we use the file ID directly
            current_context.append({
                "type": "input_image",
                "image_url": f"https://generativelanguage.googleapis.com/v1beta/files/{google_file_id}",
                "detail": "low"
            })
        
        # Add the text prompt based on file type
        current_prompt = get_file_type_prompt(self.file_type, document)
        current_context.append({"type": "input_text", "text": current_prompt})

        context_summary.append({"role": "user", "content": current_context})
        return context_summary

    async def process_documents(
        self,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedResponse], None]
    ) -> List[CleanedResponse]:
        try:
            results = []
            for document in documents:
                document_id = document.get('id')
                page_number = document.get('page', 1)
                text = document.get('text', '')
                google_file_id = document.get('google_file_id')
                
                print(f"Processing document {document_id}, page {page_number}, google_file_id: {google_file_id}")
                
                # Format conversation context with the google_file_id
                conversation_context = self.format_conversation(document, google_file_id)

                response = ""

                # Generate response using AI
                result = Runner.run_streamed(
                    self.parse_agent, 
                    input=conversation_context, 
                    run_config=RunConfig(group_id=self.file_id, trace_id=self.trace_id, workflow_name=f"Parse {self.file_title}")
                )
                # setting the trace id
                if not self.trace_id:
                    trace_id = result._trace.trace_id
                    self.trace_id = trace_id
                    await self.update_trace_id(self.file_id, trace_id)

                async for event in result.stream_events():
                    if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
                        if isinstance(event.data, ResponseTextDeltaEvent):
                            chunk = event.data.delta
                            response += chunk

                # updating the usage
                raw_responses = result.raw_responses
                for raw_response in raw_responses:
                    usage = raw_response.usage

                    await self.update_file_usage(self.file_id, self.profile_id, usage.input_tokens, usage.output_tokens)

                if response:
                    # Add AI response to conversation history
                    self.chat_history.append(response)
                
                result = CleanedResponse(
                    page=page_number,
                    description=response,
                    text=text
                )
                
                results.append(result)
                await after_generate(result)
            
            return results
        except Exception as error:
            print("Error processing documents:", error)
            raise error
        