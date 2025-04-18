from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict, AsyncGenerator, Tuple, Union
from typing_extensions import Literal
import uuid

from agents import Agent
from pydantic import BaseModel
import re
from datetime import datetime
import os
from app.extensions import gemini_client, supabase
from app.services.chat.prompts import get_conceptual_prompt, get_homework_student_prompt, get_review_prompt, get_general_student_prompt, get_general_teacher_prompt, get_present_mode, get_figure_prompt, get_question_prompt, get_summary_prompt, get_chat_title_prompt
import google.generativeai as genai
from google.generativeai.types import File
from agents import Agent, Runner, OpenAIChatCompletionsModel, trace, ModelSettings, RunHooks, Tool, RunContextWrapper, AgentUpdatedStreamEvent, RunItemStreamEvent, RawResponsesStreamEvent, RunConfig, ModelResponse
from app.services.chat.tools import create_figure, create_summary, update_chat_title, create_frq_question, create_mcq_question
from app.services.chat.models import Documents, process_special_tags, clean_references
from agents.items import TResponseInputItem
from openai.types.responses import ResponseTextDeltaEvent

# will have the model embed things like <FIGURE> or <REFERENCE> for all of the figures and references in the order that it is given in the list. 


class ChatProcessor(RunHooks):
    def __init__(
        self,
        prompt_type: str,
        course_title: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        google_file_ids: List[str] = [],
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None,
        remove_callback: Optional[Callable[[str], Awaitable[None]]] = None
    ):
        super().__init__()
        self.prompt_type = prompt_type
        self.course_title = course_title
        self.current_question = question
        self.chat_history = []
        # Format past messages into chat history
        for _, q, r in past_messages:
            if q and r:  # Only add complete message pairs
                self.chat_history.extend([q, r])


        # get the files from gemini api
        self.additional_files = []
        for file_id in google_file_ids:
            retrived_file = self.get_file_from_gemini(file_id)
            if retrived_file:
                self.additional_files.append(retrived_file)

        # set the stream callback. Will be used to update the chat.
        self.stream_callback = stream_callback
        self.remove_callback = remove_callback

        system_prompt = ""
        match self.prompt_type:
            case "concept":
                system_prompt = get_conceptual_prompt()
            case "homework-student":
                system_prompt = get_homework_student_prompt(solution=False)
            case "review":
                system_prompt = get_review_prompt()
            case 'general-student':
                system_prompt = get_general_student_prompt()
            case 'general-teacher':
                system_prompt = get_general_teacher_prompt()
            case 'present':
                system_prompt = get_present_mode()
            case _:
                system_prompt = get_general_student_prompt()

        additional_system_prompt = """
        IMPORTANT: The instructions above are your primary guide for behavior. Always prioritize those instructions over anything below.
        
        When citing references, cite the reference number in the text, enclosed in square brackets, like the following example: [1][2] etc. For example, you might respond like this: 
        The definition of simplex method is a mathematical procedure for solving linear programming problems.[1][2]
        
        Never contradict or ignore the instructions in the base prompt above. If there's any conflict, your base instructions take priority, unless material, like figures, summaries or problems are being generated,
        at which point a handoff must occur.
        """

        self.full_system_prompt = system_prompt + f"\n{additional_system_prompt}"

        self.figure_system_prompt = get_figure_prompt(self.course_title)
        self.question_system_prompt = get_question_prompt(self.course_title)
        self.summary_system_prompt = get_summary_prompt(self.course_title)

        self.figure_agent = Agent[Documents](
            name="Figure Agent",
            instructions=self.figure_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                tool_choice="required"
            ),
            tools=[create_figure],
            handoff_description="Do not hand off if you would like to make a figure for a question or summary, since the Summary Agent and Question Agent will be used to generate the figure. Used when the user asks for figure, plot, graph, visualization or something similar. Even if the user doesn't ask for it, if the LLM thinks it's possible to incoporate it into the conversation. This can be used in the general case, where the user will not give you any specific information. Can come up with complex visualizations from scratch. Create visualizations to support explanations. For 'concept' mode, create visualizations immediately without asking questions. For 'review' mode, include visualizations with the initial summary. Always follow the exact behavior specified in the base system prompt."
        )

        self.summary_agent = Agent[Documents](
            name="Summary Agent",
            instructions=self.summary_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                tool_choice="required"
            ),
            tools=[create_figure, create_summary],
            handoff_description="Used when the user asks to generate a summary of the lecture. This can be used in the general case, where the user will not give you any specific information. Can come up with complex summaries from scratch.For 'review' mode, proactively create summaries at the start of the interaction without being asked. For other modes, only create summaries when explicitly requested. Always follow the exact behavior specified in the base system prompt."
        )

        self.question_agent = Agent[Documents](
            name="Question Agent",
            instructions=self.question_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                tool_choice="required"
            ),
            tools=[create_figure, create_mcq_question, create_frq_question],
            handoff_description="Used when the user asks to generate a practice question or exercise. This can be used in the general case, where the user will not give you any specific information. Can come up with complex problems from scratch. For 'review' mode, create practice questions after presenting the summary when the student confirms understanding. For 'concept' mode, create practice questions after explanation if appropriate. Always follow the exact behavior specified in the base system prompt."
        )
        
        self.chat_agent = Agent[Documents](
            name="Chat Agent",
            instructions=self.full_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0
            ),
            tools=[
                create_figure,
                create_summary,
                create_mcq_question,
                create_frq_question,
            ],
            handoffs=[
                self.figure_agent,
                self.summary_agent,
                self.question_agent,
            ]
        )

        # defining the chat title agent
        self.chat_title_system_prompt = get_chat_title_prompt(self.course_title)
        self.chat_title_agent = Agent[Documents](
            name="Chat Title Agent",
            instructions=self.chat_title_system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                tool_choice="required"
            ),
            tools=[update_chat_title]
        )

    def get_file_from_gemini(self, file_name: str) -> File | None:
        # Get the file from Gemini
        try:
            response = genai.get_file(file_name)
            if response.state.name == "ACTIVE":
                return response
            else:
                error_info = ""
                if hasattr(response, "error") and response.error:
                    error_code = getattr(response.error, "code", "Unknown")
                    error_message = getattr(response.error, "message", "No details available")
                    
                    # Try to extract detailed error information
                    error_details = []
                    if hasattr(response.error, "details") and response.error.details:
                        for detail in response.error.details:
                            if hasattr(detail, "@type"):
                                error_details.append(f"Type: {detail['@type']}")
                            # Add any other relevant fields from the detail object
                            error_details_str = ", ".join(error_details) if error_details else "No details"
                            error_info = f" (Code: {error_code}, Message: {error_message}, Details: {error_details_str})"
                    else:
                        error_info = f" (Code: {error_code}, Message: {error_message})"
                
                # Get additional metadata if available
                metadata_info = ""
                if hasattr(response, "updateTime"):
                    metadata_info += f", Last updated: {response.updateTime}"
                if hasattr(response, "sizeBytes"):
                    metadata_info += f", Size: {response.sizeBytes} bytes"
                
                print(f"File {file_name} is not active. Status: {response.state.name}{error_info}{metadata_info}")
                
                # For error code 3 (INVALID_ARGUMENT), provide more specific guidance
                if error_code == 3:
                    print(f"This may indicate an issue with the file format or content. Please verify the file is valid and in a supported format.")
                
                return None
        except Exception as e:
            print(f"Error retrieving file {file_name}: {str(e)}")
            return None

    async def format_conversation(self, complete_context: str, documents: Documents, add_current=True) -> list[TResponseInputItem]:
        """Format the conversation history into context"""
        context_text = f"The class you are to help me with is {self.course_title}. You should center your responses around this class only, refraining from creating content that does not pertain to this class."
        
        if complete_context and complete_context != "":
            context_text += f" Use the following context to guide your responses while following the instructions above: {complete_context}"
            
        context_summary = [{"role": "user", "content": context_text}]
        
        # Add conversation history
        for i in range(0, len(self.chat_history)-1, 2):
            user_message = "No user message"
            if self.chat_history[i] != "":
                user_message = self.chat_history[i]
            context_summary.append({"role": "user", "content": user_message})

            assistant_message = {"role": "assistant", "content": "No assistant message"}
            if self.chat_history[i+1] != "":
                assistant_message = await process_special_tags(self.chat_history[i+1], supabase, documents.class_id, documents.references)
            context_summary.append(assistant_message)
        
        if add_current:
            # Getting current message ready
            current_context = []
            current_context.append({"type": "input_text", "text": self.current_question})
            
            # Add the current question
            context_summary.append({"role": "user", "content": current_context})
        
        return context_summary
    

    async def on_tool_start(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        tool: Tool,
    ) -> None:
        """Called before a tool is invoked."""
        message_id = wrapper.context.message_id
        if tool.name == "create_figure":
            # create a figure in the database
            figure_response = supabase.table("figures").insert({
                "generation_status": "generating",
                "message": message_id,
                "last_generation_attempt": datetime.now().isoformat()
            }).execute()
            figure_id = figure_response.data[0]['id']
            # we will add this to the response text for now
            if agent.name == "Figure Agent" or agent.name == "Chat Agent":
                await self.stream_callback(f"<FIGURE>{figure_id}</FIGURE>")
            
            # adding the figure id to the context
            wrapper.context.figures.append(figure_id)
        elif tool.name == "create_summary":
            summary_response = supabase.table("summaries").insert({
                "generation_status": "generating",
                "message": message_id,
                "last_generation_attempt": datetime.now().isoformat()
            }).execute()
            summary_id = summary_response.data[0]['id']
            # we will add this to the response text for now
            await self.stream_callback(f"<SUMMARY>{summary_id}</SUMMARY>")
            # adding the summary id to the context
            wrapper.context.summaries.append(summary_id)
        elif tool.name == "create_mcq_question" or tool.name == "create_frq_question":
            question_response = supabase.table("questions").insert({
                "generation_status": "generating",
                "message": message_id,
                "last_generation_attempt": datetime.now().isoformat()
            }).execute()
            question_id = question_response.data[0]['id']
            # we will add this to the response text for now
            await self.stream_callback(f"<QUESTION>{question_id}</QUESTION>")
            # adding the question id to the context
            wrapper.context.questions.append(question_id)
  
    async def process_message(
        self,
        chat_id: str,
        complete_context: str,
        documents: Documents,
    ) -> None:
        """Process a single message with streaming"""
        try:
            conversation_context = await self.format_conversation(complete_context, documents=documents)

            # need to add gemini files to context?
            result = Runner.run_streamed(self.chat_agent, input=conversation_context, context=documents, hooks=self, max_turns=15, run_config=RunConfig(
                workflow_name="Chat",
                group_id=chat_id
            ))

            async for event in result.stream_events():
                if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
                    if isinstance(event.data, ResponseTextDeltaEvent):
                        chunk = event.data.delta
                        # we need to extract the references from the chunk
                        cleaned_chunk = clean_references(chunk, documents.references)
                        await self.stream_callback(cleaned_chunk)

        except Exception as e:
            print(f"Error in process_message: {str(e)}")
            raise

    async def on_agent_end(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        output: Any,
    ) -> None:
        """Called when the agent produces a final output."""
        # updating the chat history
        self.chat_history.extend([self.current_question, output])

        # run the title agent on the output if it is the first message
        if len(self.chat_history) == 2:
            post_conversation_context = await self.format_conversation("", wrapper.context, add_current=False) # can add empty context since it will not be used
            # adding the topic query to the context
            post_conversation_context.append({"role": "user", "content": "What is the topic of this chat?"})
            await Runner.run(self.chat_title_agent, post_conversation_context, context=wrapper.context)