# tools/create_question.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models import Documents

@function_tool()
async def create_mcq_question(wrapper: RunContextWrapper[Documents], title: str = "", question: str = "", options: List[str] = [], explanations: List[str] = [], answer: str = "", references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a question object given the MCQ question. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool. 
    
    This function will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Remember, do not repeat the question in a message after this tool is run, as this will be confusing to the user.

    Args:
        title: The title of the question.
        question: The question.
        options: List of options for the question.
        explanations: List of explanations for the options.
        answer: The answer to the question.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given question.

    Returns:
        The id of the question.
    """
    try:
        supabase_client = get_supabase()

        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first question that is generating
        question_response = supabase_client.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]
        
        question_data = {
            "title": title,
            "problem": question,
            "options": options,
            "explanations": explanations,
            "answers": [answer],
            "frq": False,
            "figures": figure_ids,
            "references": references,
            "generation_status": "complete"
        }
        
        # Insert the question into the database
        question_update_response = supabase_client.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:

        # update the question into the database
        question_update_response = supabase_client.table('questions').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", question_id).execute()   

        raise e

@function_tool()
async def create_frq_question(wrapper: RunContextWrapper[Documents], title: str = "", question: str = "", answer: str = "", references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a question object given the FRQ question. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool. 
    
    This function will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        title: The title of the question.
        question: The question.
        answer: The answer to the question.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given question.

    Returns:
        The id of the question.
    """
    try:
        supabase_client = get_supabase()
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first question that is generating
        question_response = supabase_client.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]

        question_data = {
                "title": title,
                "problem": question,
                "solution": answer,
                "frq": True,
                "figures": figure_ids,
                "references": references,
                "generation_status": "complete"
        }
        
        # Insert the question into the database
        question_update_response = supabase_client.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:

        # update the question into the database
        question_update_response = supabase_client.table('questions').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", question_id).execute()   

        raise e