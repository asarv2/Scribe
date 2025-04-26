# tools/create_summary.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models import Documents, Summary, CreateSummaryResponse, CreateFigureResponse
from app.services.chat.models import clean_references
from app.services.chat.tools.create_figures import create_figures

async def create_summaries(wrapper: RunContextWrapper[Documents], summaries: List[Summary]) -> List[CreateSummaryResponse]:
    """Generates a summary object given the preamble, body, and conclusion. If you need any figures generated via LaTeX, you should create figure prompts within the create_summaries tool, and they will be added to the summary.

    To include document references in the summary, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user. 

    Args:
        title: The title of the summary.
        preamble: The preamble of the summary.
        body: The body of the summary.
        conclusion: The conclusion of the summary.
        references: List of number references that were used.
        figures: List of figure prompts that should be included in the summary.

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
    Figures: [A 2D plot showing the feasible region of a linear program as a polygon, with arrows indicating the path taken by the simplex method from vertex to vertex toward the optimal solution.]\n"

    Returns:
        The id of the summary.

    Remember, do not repeat the summary in a message after this tool is run, as this will be confusing to the user.
    """
    supabase_client = get_supabase()
    # get the message id
    message_id = wrapper.context.message_id

    responses = []
    for summary in summaries:
        summary_id: str | None = None
        try:
            title = summary.title
            preamble = summary.preamble
            body = summary.body
            conclusion = summary.conclusion
            figures = summary.figures

            # Get references
            references = [wrapper.context.references.get(ref, None) for ref in summary.references]
            references = [ref for ref in references if ref is not None]

            # Apply replacements to all text sections
            preamble = clean_references(preamble, wrapper.context.references)
            body = clean_references(body, wrapper.context.references)
            conclusion = clean_references(conclusion, wrapper.context.references)

            # insert a summary in the database, with the generation status set to generating
            summary_response = supabase_client.table('summaries').insert({
                'generation_status': 'generating',
                'message': message_id,
                'title': title,
                'preamble': preamble,
                'body': body,
                'conclusion': conclusion,
                'references': references
            }).execute()
            summary_id = summary_response.data[0]['id']

            # create any figures that are needed
            figure_responses = await create_figures(wrapper, figures)

            figure_errors = []
            figure_ids = []
            for figure_response in figure_responses:
                if isinstance(figure_response, CreateFigureResponse):
                    if not figure_response.success:
                        figure_errors.append(figure_response.error)
                    else:
                        figure_errors.append(None)
                        figure_ids.append(figure_response.figure_id)

            if figure_errors:
                raise Exception("Failed to create figures with the following errors: " + ", ".join(figure_errors))
            else:
                summary_update_data = {
                    "figures": figure_ids,
                    "generation_status": "complete"
                }

                if summary_id is None:
                    raise Exception("Failed to create summary: No ID returned from database")

                # Insert the question into the database
                summary_update_response = supabase_client.table('summaries').update(summary_update_data).eq("id", summary_id).execute()

                if not (summary_update_response.data and len(summary_update_response.data) > 0):
                    raise Exception("Failed to update summary: No ID returned from database")
                
                responses.append(CreateSummaryResponse(success=True, summary_id=summary_id))
        
        except Exception as e:
            if summary_id is not None:
                # update the summary into the database
                summary_update_response = supabase_client.table('summaries').update({
                    "generation_status": "error",
                    "generation_error": str(e)
                }).eq("id", summary_id).execute()

            responses.append(CreateSummaryResponse(success=False, error=str(e)))

    return responses
