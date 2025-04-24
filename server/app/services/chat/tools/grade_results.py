# tools/grade_results.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from typing import List, Tuple
from app.extensions import get_supabase
from app.services.chat.models import Documents
import logging

logger = logging.getLogger(__name__)

@function_tool()
async def classify_grades(wrapper: RunContextWrapper[Documents], prompts: List[Tuple[int, int | None]]) -> List[int]:
    """Used to classify the files into the correct grade category.

    Args:
        prompts: A list of tuples for each grading entry, where the first element is the ID of the assingment to be graded, and the second element is the ID of the rubric to be used for grading, if any. The reference number should be used to find the correct files that are classified as a assingment to be graded or as a rubric.
    Returns:
        The list of the grading entry numbers that were just created.
    """
    try:
        supabase_client = get_supabase()
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        grades = []
        # create grade entries
        for index, prompt in enumerate(prompts):
            assignment_id, rubric_id = prompt

            file_id = references[assignment_id]
            rubric_id = rubric_id if rubric_id is not None else None

            updates = {
                "file": file_id,
                "message": message_id,
            }
            if rubric_id is not None:
                updates["rubric"] = rubric_id

            grade_response = supabase_client.table('grades').insert(updates).execute()
            grade_id = grade_response.data[0]['id']
            # add the grade id to the context
            wrapper.context.grades.append(grade_id)
            grades.append(index)
        return grades
    except Exception as e:  
        raise e

@function_tool()
async def grade_results(wrapper: RunContextWrapper[Documents], grade_entry: int, results: List[Tuple[str, str]]) -> str:
    """Used to display the graded results of a given set of problems, with the results and feedback for each problem. You should aim to make the results have the format of the rubric if specified, otherwise just display the results in a nice format. The feedback should be detailed and specific to the problem, with actionable feedback for the user. 

    Args:
        grade_id: The id of the grading entry to be updated.
        results: A list of tuples for each grading entry, where the first element is the result of the user's work, and the second element is the feedback of the user's work. The length of this array is the number of problems on the assingment, not the number of grading entries.
    Returns:
        The id of the grading entry that was just updated.
    """
    try:
        supabase_client = get_supabase()
        
        # Find the grade id by index
        grade_id = wrapper.context.grades[grade_entry]

        # unpack the results and feedback
        results = [result for result, _ in results]
        feedback = [feedback for _, feedback in results]  

        grade_update_response = supabase_client.table('grades').update({
            "results": results,
            "feedback": feedback,
            "generation_status": "complete"
        }).eq("id", grade_id).execute()

        if not (grade_update_response.data and len(grade_update_response.data) > 0):
            raise Exception("Failed to update grade: No ID returned from database")

        return grade_id
            
    except Exception as e:

        # update the question into the database
        grade_update_response = supabase_client.table('grades').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", grade_id).execute()   

        raise e