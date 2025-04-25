# tools/create_question.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models import Documents, Question, CreateQuestionResponse, CreateFigureResponse
from app.services.chat.tools.create_figures import create_figures

async def create_questions(wrapper: RunContextWrapper[Documents], questions: List[Question]) -> List[CreateQuestionResponse]:
    """Generates a list of questions given the questions. This will return the ids of the questions, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        questions: The questions to create. If it is a multiple choice question, it has a title, question, options, explanations, answer, references, and figures. For each of the figure objects, you should provide the code, references, and title to create the figure. If it is a free response question, it has a title, question, answer, references, and figures. For each of the figure objects, you should provide the code, references, and title to create the figure.

    Returns:
        A list of CreateQuestionsResponse objects. Each object will have a success field, which will be true if the question was created successfully, and false if there was an error. If there was an error, the error field will contain the error message describing the issue. If the question was created successfully, the question_id field will contain the id of the question.
    """
    responses = []
    supabase_client = get_supabase()

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
                question_response = supabase_client.table('questions').insert({
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
                figure_responses = await create_figures(wrapper, figures)

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
                    question_update_response = supabase_client.table('questions').update(question_update_data).eq("id", question_id).execute()

                    if not (question_update_response.data and len(question_update_response.data) > 0):
                        raise Exception("Failed to update question: No ID returned from database")
                    
                    responses.append(CreateQuestionResponse(success=True, question_id=question_id))
            except Exception as e:
                if question_id:  # Only try to update if question_id exists
                    # update the question into the database
                    question_update_response = supabase_client.table('questions').update({
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
                question_response = supabase_client.table('questions').insert({
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
                figure_responses = await create_figures(wrapper, figures)

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
                    question_update_response = supabase_client.table('questions').update(question_update_data).eq("id", question_id).execute()

                    if not (question_update_response.data and len(question_update_response.data) > 0):
                        raise Exception("Failed to update question: No ID returned from database")
                    
                    responses.append(CreateQuestionResponse(success=True, question_id=question_id))
            except Exception as e:
                if question_id:  # Only try to update if question_id exists
                    # update the question into the database
                    question_update_response = supabase_client.table('questions').update({
                        "generation_status": "error",
                        "generation_error": str(e)
                    }).eq("id", question_id).execute()
                responses.append(CreateQuestionResponse(success=False, error=str(e)))

    return responses
