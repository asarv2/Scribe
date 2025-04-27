from agents import AgentHooks, RunContextWrapper, Agent
from typing import List
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models.main import Documents, Question, CreateQuestionResponse, CreateFigureResponse
from app.services.chat.agents.actions.generate.figure.hooks import FigureHooks
import logging

logger = logging.getLogger(__name__)

class QuestionHooks(AgentHooks):

    def __init__(self):
        # import the figure hooks
        self.figure_hooks = FigureHooks()
        self.supabase_client = get_supabase()

    
    async def on_handoff(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        source: Agent[Documents],
    ) -> None:
        """Called when the agent is being handed off to. The `source` is the agent that is handing
        off to this agent."""
        message_id = wrapper.context.message_id
        # update the status text
        self.supabase_client.table("messages").update({
            "status_text": f"Getting ready to create questions..."
        }).eq("id", message_id).execute()

    async def on_end(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        questions: List[Question],
    ) -> List[CreateQuestionResponse]:
        """Generates the questions in supabase and returns the responses to the user."""
        responses = []

        # get the message id
        message_id = wrapper.context.message_id

        for question in questions:
            question_id = None  # Initialize question_id at the beginning of each loop
            
            if question.question_type == "mcq":
                try:
                    title = question.title
                    question_text = question.question  # Rename to avoid overwriting the question object
                    options = question.options
                    explanations = question.explanations
                    answer = question.answer
                    figures = question.figures

                    # Get references
                    references = [wrapper.context.references.get(ref, None) for ref in question.references]
                    references = [ref for ref in references if ref is not None]
                    
                    # insert a question in the database, with the generation status set to generating
                    question_response = self.supabase_client.table('questions').insert({
                        'generation_status': 'generating',
                        'message': message_id,
                        'title': title,
                        'problem': question_text,
                        'options': options,
                        'explanations': explanations,
                        'answers': [answer],
                        'frq': False,
                        'references': references
                    }).execute()
                    
                    # get the question id
                    question_id = question_response.data[0]['id']

                    # create any figures that are needed
                    figure_responses = await self.figure_hooks.on_end(wrapper, agent, figures)

                    figure_errors = []
                    figure_ids = []
                    for figure_response in figure_responses:
                        if isinstance(figure_response, CreateFigureResponse):
                            if not figure_response.success:
                                figure_errors.append(figure_response.error)
                            else:
                                figure_ids.append(figure_response.figure_id)

                    if any(figure_errors):
                        # Filter out None values before joining
                        error_messages = [err for err in figure_errors if err is not None]
                        raise Exception("Failed to create figures with the following errors: " + ", ".join(error_messages))
                    else:
                        question_update_data = {
                            "figures": figure_ids,
                            "generation_status": "complete"
                        }

                        # Insert the question into the database
                        question_update_response = self.supabase_client.table('questions').update(question_update_data).eq("id", question_id).execute()

                        if not (question_update_response.data and len(question_update_response.data) > 0):
                            raise Exception("Failed to update question: No ID returned from database")
                        
                        responses.append(CreateQuestionResponse(success=True, question_id=question_id))
                except Exception as e:
                    if question_id:  # Only try to update if question_id exists
                        # update the question into the database
                        question_update_response = self.supabase_client.table('questions').update({
                            "generation_status": "error",
                            "generation_error": str(e)
                        }).eq("id", question_id).execute()

                    responses.append(CreateQuestionResponse(success=False, error=str(e)))
            elif question.question_type == "frq":
                try:
                    title = question.title
                    question_text = question.question  # Rename to avoid overwriting the question object
                    answer = question.answer
                    figures = question.figures

                    # Get references
                    references = [wrapper.context.references.get(ref, None) for ref in question.references]
                    references = [ref for ref in references if ref is not None]
                    
                    # insert a question in the database, with the generation status set to generating
                    question_response = self.supabase_client.table('questions').insert({
                        'generation_status': 'generating',
                        'message': message_id,
                        'title': title,
                        'problem': question_text,
                        'solution': answer,
                        'frq': True,
                        'references': references
                    }).execute()
                    
                    # get the question id
                    question_id = question_response.data[0]['id']

                    # create any figures that are needed
                    figure_responses = await self.figure_hooks.on_end(wrapper, agent, figures)

                    figure_errors = []
                    figure_ids = []
                    for figure_response in figure_responses:
                        if isinstance(figure_response, CreateFigureResponse):
                            if not figure_response.success:
                                figure_errors.append(figure_response.error)
                            else:
                                figure_ids.append(figure_response.figure_id)

                    if any(figure_errors):
                        # Filter out None values before joining
                        error_messages = [err for err in figure_errors if err is not None]
                        raise Exception("Failed to create figures with the following errors: " + ", ".join(error_messages))
                    else:
                        question_update_data = {
                            "figures": figure_ids,
                            "generation_status": "complete"
                        }

                        # Insert the question into the database
                        question_update_response = self.supabase_client.table('questions').update(question_update_data).eq("id", question_id).execute()

                        if not (question_update_response.data and len(question_update_response.data) > 0):
                            raise Exception("Failed to update question: No ID returned from database")
                        
                        responses.append(CreateQuestionResponse(success=True, question_id=question_id))
                except Exception as e:
                    if question_id:  # Only try to update if question_id exists
                        # update the question into the database
                        question_update_response = self.supabase_client.table('questions').update({
                            "generation_status": "error",
                            "generation_error": str(e)
                        }).eq("id", question_id).execute()
                    responses.append(CreateQuestionResponse(success=False, error=str(e)))

        return responses