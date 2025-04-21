from typing import List, Any, Optional, Callable, Awaitable, Tuple
from agents import Agent
from datetime import datetime
from app.extensions import gemini_client, supabase
from app.services.chat.prompts import get_learn_prompt, get_homework_prompt, get_test_prompt, get_student_prompt, get_teacher_prompt, get_grading_prompt, get_figure_prompt, get_question_prompt, get_summary_prompt, get_chat_title_prompt
from agents import Agent, Runner, OpenAIChatCompletionsModel, trace, ModelSettings, RunHooks, Tool, RunContextWrapper, RawResponsesStreamEvent, RunConfig
from app.services.chat.tools import create_figure, create_summary, update_chat_title, create_frq_question, create_mcq_question, grade_results
from app.services.chat.models import Documents, process_special_tags, clean_references
from agents.items import TResponseInputItem
from openai.types.responses import ResponseTextDeltaEvent

class ChatProcessor(RunHooks):
    def __init__(
        self,
        prompt_type: str,
        course_title: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        trace_id: str | None = None,
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None,
        remove_callback: Optional[Callable[[str], Awaitable[None]]] = None,
        update_trace_id: Optional[Callable[[str], Awaitable[None]]] = None,
        update_chat_usage: Optional[Callable[[str, str, int, int], Awaitable[None]]] = None,
    ):
        super().__init__()
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
        self.remove_callback = remove_callback
        self.update_trace_id = update_trace_id
        self.update_chat_usage = update_chat_usage

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
                tool_choice="required",
                include_usage=True
            ),
            tools=[update_chat_title]
        )

        # empty starting agent
        self.starting_agent = None

        # defining the subagents
        self.figure_system_prompt = get_figure_prompt(self.course_title)
        self.question_system_prompt = get_question_prompt(self.course_title)
        self.summary_system_prompt = get_summary_prompt(self.course_title)
        self.grading_system_prompt = get_grading_prompt(self.course_title)

        self.figure_agent = Agent[Documents](
            name="Figure Agent",
            instructions=self.figure_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                tool_choice="required",
                temperature=0.0,
                include_usage=True
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
                tool_choice="required",
                temperature=0.0,
                include_usage=True
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
                tool_choice="required",
                temperature=0.0,
                include_usage=True
            ),
            tools=[create_figure, create_mcq_question, create_frq_question],
            handoff_description="Used when the user asks to generate a practice question or exercise. This can be used in the general case, where the user will not give you any specific information. Can come up with complex problems from scratch. For 'review' mode, create practice questions after presenting the summary when the student confirms understanding. For 'concept' mode, create practice questions after explanation if appropriate. Always follow the exact behavior specified in the base system prompt."
        )

        self.grading_agent = Agent[Documents](
            name="Grading Agent",
            instructions=self.grading_system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                tool_choice="required",
                temperature=0.0,
                include_usage=True
            ),
            tools=[grade_results],
        )

        
        system_prompt = ""
        additional_system_prompt = """
        IMPORTANT: The instructions above are your primary guide for behavior. Always prioritize those instructions over anything below.
        
        When citing references, cite the reference number in the text, enclosed in square brackets, like the following example: [1][2] etc. For example, you might respond like this: 
        The definition of simplex method is a mathematical procedure for solving linear programming problems.[1][2]
        
        You should generally handoff the creation of summaries, and questions to the Summary Agent and Question Agent respectively. The Figure Agent can be used in a more special case, where you want to generate standalone figures. If necessary, you can use the create_figure tool to generate a figure (in the case that you then want to reference it in a summary or question). You can use the create_summary tool to generate a summary. You can use the create_mcq_question tool to generate a multiple choice question, and the create_frq_question tool to generate a free response question. Use these tools only if you explicity know what needs to be generated (for example, if the user asks to modify an existing figure, summary or question).
        """
        # defining the system prompt and starting agent
        match self.prompt_type:
            case "learn":
                system_prompt = get_learn_prompt(self.course_title)
            case "homework":
                system_prompt = get_homework_prompt(self.course_title)
            case "test":
                system_prompt = get_test_prompt(self.course_title)
            case 'student':
                system_prompt = get_student_prompt(self.course_title)
            case 'teacher':
                system_prompt = get_teacher_prompt(self.course_title)
            case 'figure':
                self.starting_agent = self.figure_agent
            case 'summary':
                self.starting_agent = self.summary_agent
            case 'question':
                self.starting_agent = self.question_agent
            case 'grade':
                self.starting_agent = self.grading_agent
            case _:
                system_prompt = get_student_prompt(self.course_title)

        # get the full system prompt for the chat agent
        self.full_system_prompt = system_prompt + f"\n{additional_system_prompt}"
        self.chat_agent = Agent[Documents](
            name="Chat Agent",
            instructions=self.full_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
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

        # if no starting agent is defined, use the chat agent   
        if not self.starting_agent:
            self.starting_agent = self.chat_agent

    async def format_conversation(self, google_file_ids: List[str], documents: Documents, add_current=True) -> list[TResponseInputItem]:
        """Format the conversation history into context"""
        initial_context = [{"type": "input_text", "text": f"The class you are to help me with is {self.course_title}. You should center your responses around this class only, refraining from creating content that does not pertain to this class."}]

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
                assistant_messages = await process_special_tags(self.chat_history[i+1], supabase, documents)
            context_summary.extend(assistant_messages)
        
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
    
    async def on_tool_end(
        self,
        context: RunContextWrapper[Documents],
        agent: Agent[Documents],
        tool: Tool,
        result: str,
    ) -> None:
        """Called after a tool is invoked."""
        if tool.name == "update_chat_title":
            if self.trace_id:
                chat_title = result
                with trace(workflow_name=chat_title, trace_id=self.trace_id):
                    pass
            else:
                print("No trace id found while updating chat title")
  
    async def process_message(
        self,
        chat_id: str,
        google_file_ids: List[str],
        documents: Documents,
    ) -> None:
        """Process a single message with streaming"""
        try:
            conversation_context = await self.format_conversation(google_file_ids, documents=documents)

            # need to add gemini files to context?
            result = Runner.run_streamed(self.starting_agent, input=conversation_context, context=documents, hooks=self, max_turns=15, run_config=RunConfig(
                group_id=chat_id,
                trace_id=self.trace_id
            ))

            # setting the trace id
            if not self.trace_id:
                trace_id = result._trace.trace_id
                self.trace_id = trace_id
                await self.update_trace_id(chat_id, trace_id)

            async for event in result.stream_events():
                if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
                    if isinstance(event.data, ResponseTextDeltaEvent):
                        chunk = event.data.delta
                        # we need to extract the references from the chunk
                        cleaned_chunk = clean_references(chunk, documents.references)
                        await self.stream_callback(cleaned_chunk)

            # updating the usage
            raw_responses = result.raw_responses
            for response in raw_responses:
                usage = response.usage

                await self.update_chat_usage(documents.chat_id, documents.profile_id, usage.input_tokens, usage.output_tokens)

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
        if agent.name != "Chat Title Agent":
            # updating the chat history
            self.chat_history.extend([self.current_question, output])

            # run the title agent on the output if it is the first message
            if len(self.chat_history) == 2:
                # can add empty context since it will not be used
                post_conversation_context = await self.format_conversation("", wrapper.context, add_current=False)

                # adding the topic query to the context
                post_conversation_context.append({"role": "user", "content": "What is the topic of this chat?"})
                await Runner.run(self.chat_title_agent, post_conversation_context, context=wrapper.context, run_config=RunConfig(
                    group_id=wrapper.context.chat_id,
                    trace_id=self.trace_id
                ), hooks=self)
        else:
            # updating the usage
            usage = wrapper.usage
            chat_id = wrapper.context.chat_id
            profile_id = wrapper.context.profile_id
            await self.update_chat_usage(chat_id, profile_id, usage.input_tokens, usage.output_tokens)