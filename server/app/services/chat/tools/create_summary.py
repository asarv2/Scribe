# tools/create_summary.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models import Documents
from app.services.chat.models import clean_references

@function_tool
async def create_summary(wrapper: RunContextWrapper[Documents], title: str, preamble: str, body: str, conclusion: str, references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a summary object given the preamble, body, and conclusion. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool.

    To include document references in the summary, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user. 

    Args:
        title: The title of the summary.
        preamble: The preamble of the summary.
        body: The body of the summary.
        conclusion: The conclusion of the summary.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given summary.

    Example Summary:
    Title: Simplex Method Summary
    Preamble: This summary explores the simplex method and its variants for solving linear programming problems, emphasizing both the algorithmic process and the underlying mathematical structure.
    Body:
        - The simplex method iteratively moves from one vertex of the feasible region to another, improving the objective function value at each step until the optimal solution is found.\n"
        - **Basic Variables/Basic Feasible Solution**: Basic variables define a vertex of the feasible region; setting non-basic variables to zero yields a basic feasible solution.\n"
        - **Slack Variable**: Slack variables convert inequality constraints into equality constraints, enabling the use of matrix methods.\n"
        - **Feasible Region**: The feasible region is the set of all points satisfying all constraints of the linear program; it is typically a convex polytope.\n"
        - **Optimal Dictionary**: The optimal dictionary expresses basic variables in terms of non-basic variables and provides the optimal objective function value.\n"
        - **Reduced Costs**: Reduced costs represent the change in the objective function value per unit increase in a non-basic variable; non-negativity is necessary and sufficient for optimality.\n"
        - **Visualization**: See Figure 1 for a geometric illustration of the simplex method traversing the vertices of a feasible region.\n"
    Conclusion: The simplex method and its variants, including the network simplex method, provide efficient algorithms for solving large-scale linear programs by leveraging the structure of the feasible region and the properties of basic feasible solutions.\n"
    Figures: [create_figure: A 2D plot showing the feasible region of a linear program as a polygon, with arrows indicating the path taken by the simplex method from vertex to vertex toward the optimal solution.]\n"

    Returns:
        The id of the summary.

    Remember, do not repeat the summary in a message after this tool is run, as this will be confusing to the user.
    """
    try:
        supabase_client = get_supabase()
        
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first summary that is generating
        summary_response = supabase_client.table('summaries').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        summary_id = summary_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]
        
        # Apply replacements to all text sections
        preamble = clean_references(preamble, wrapper.context.references)
        body = clean_references(body, wrapper.context.references)
        conclusion = clean_references(conclusion, wrapper.context.references)
        
        # Update the summary into the database
        summary_update_response = supabase_client.table('summaries').update({
            "title": title,
            "preamble": preamble,
            "body": body,
            "conclusion": conclusion,
            "references": references,
            "figures": figure_ids,
            "generation_status": "complete"
        }).eq("id", summary_id).execute()
        
        # Extract the summary ID from the response
        if not (summary_update_response.data and len(summary_update_response.data) > 0):
            raise Exception("Failed to update summary: No ID returned from database")
        
        return summary_id
            
    except Exception as e:
        # update the summary into the database
        summary_update_response = supabase_client.table('summaries').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", summary_id).execute()

        raise e