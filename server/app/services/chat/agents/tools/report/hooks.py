from agents import AgentHooks, RunContextWrapper, Agent, ToolsToFinalOutputResult, FunctionToolResult
from typing import List, Dict
from agents.tool import function_tool, FunctionTool, Tool
from agents.run_context import RunContextWrapper
from app.extensions import get_supabase
from app.services.chat.models.main import Documents, Report, CreateReportResponse, CreateFigureResponse
from app.services.chat.agents.tools.figure.hooks import create_figures
from app.services.chat.utils.references import clean_references
from app.services.chat.utils.figures import clean_figures
import logging

logger = logging.getLogger(__name__)

class ReportHooks(AgentHooks):

    def __init__(self):
        self.create_report_tool = function_tool(create_report, name_override="create_report")
        self.create_reports_tool = function_tool(create_reports, name_override="create_reports")
        self.create_report_check = create_report_check

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
            "status_text": f"Getting ready to create reports..."
        }).eq("id", message_id).execute()

async def create_report_check(
    wrapper: RunContextWrapper[Documents],
    results: list[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    # 1⃣  Collect *all* CreateReportResponse objects
    all_responses: list[CreateReportResponse] = []
    for result in results:
        if result.tool.name == "create_report":
            if isinstance(result.output, CreateReportResponse):
                all_responses.append(result.output)
        elif result.tool.name == "create_reports":
            all_responses.extend(
                [r for r in result.output if isinstance(r, CreateReportResponse)]
            )

    # 2⃣  Build a success map keyed by summary_id
    report_success: dict[str, bool] = {}
    for resp in all_responses:
        rid = resp.report_id or ""          # empty string if not provided
        # Initialise to False; upgrade to True if any success comes in
        report_success[rid] = report_success.get(rid, False) or resp.success

    # 3⃣  Every seen question_id must have succeeded
    all_success = bool(report_success) and all(report_success.values())

    # 4⃣  Decide finality based on the *last* tool invoked
    final_tool       = results[-1].tool
    final_output_raw = results[-1].output

    if final_tool.name == "create_report":
        # Single-report call: final iff that single ID succeeded
        is_final = isinstance(final_output_raw, CreateReportResponse) \
                   and final_output_raw.success
        return ToolsToFinalOutputResult(
            is_final_output=is_final,
            final_output=final_output_raw
        )

    elif final_tool.name == "create_reports":
        # Multi-summary call: final only if *all* unique IDs succeeded
        return ToolsToFinalOutputResult(
            is_final_output=all_success,
            final_output=final_output_raw
        )

    # Fallback: not a question-creation tool
    return ToolsToFinalOutputResult(
        is_final_output=False,
        final_output=final_output_raw
    )

async def create_reports(wrapper: RunContextWrapper[Documents], reports: List[Report]) -> List[CreateReportResponse]:
    """Generates a report object given the content. If you need any figures generated via LaTeX, you should create figure prompts within the create_reports tool, and they will be added to the report.

    To include document references in the report, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    To include figures in the report, you should use {y}, where y is the number of the figure. This will be replaced by the actual figure in the report.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the report, which will then be replaced by the actual report of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the report id itself, as this is unknown to the user. 

    Args:
        reports: List[Report]
            content: The content of the report.
            references: List of number references that were used.
            figures: List of figures that should be included in the report.
            message: The message to be displayed to the user after the tool is run.

        Figure:
            title: The title of the figure.
            latex_code: The LaTeX code for the figure.
            references: List of number references that were used.

    Returns:
        List[CreateReportResponse]
            success: Whether the report was created successfully.
            report_id: The id of the report.
            error: The error message if the report was not created successfully.
            message: The message to be displayed to the user after the tool is run.

    Example Reports:
    reports = [
        {
            "title": "Homework 7 │ Grading Overview",
            "content": (
                "Lecture 8 introduced the eigen-equation $A\\mathbf v = \\lambda\\mathbf v$ and showed that "
                "eigenvectors span invariant lines [1].  Figure {1} illustrates this geometry, while "
                "Figure {2} walks through the full diagonalisation pipeline.  \n\n"
                "**Key feedback**\n"
                "- Algebraic setup is solid, but several students mis-copied the characteristic polynomial.\n"
                "- Common slip-up: forgetting that similar matrices share eigenvalues.\n"
                "- See the rubric embedded in the LMS for point-by-point deductions.\n"
            ),
            "references": [1, 2],
            "figures": [
                {
                    "title": "Invariant Line Geometry",
                    "latex_code": (
                        "\\begin{tikzpicture}[scale=1]\n"
                        "  \\draw[->] (-2,0)--(2,0) node[right]{$x$};\n"
                        "  \\draw[->] (0,-2)--(0,2) node[above]{$y$};\n"
                        "  \\draw[very thick,blue,->] (0,0)--(1.2,1) "
                        "      node[midway,above]{$\\mathbf v$};\n"
                        "  \\draw[very thick,red,->] (0,0)--(1.8,1.5) "
                        "      node[midway,right]{$A\\mathbf v$};\n"
                        "  \\draw[dashed] (1.2,1)--(1.8,1.5);\n"
                        "  \\node at (0.2,-1.5) "
                        "        {$A=\\begin{bmatrix}1&0.5\\\\0.5&1\\end{bmatrix}$};\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [1]
                },
                {
                    "title": "Diagonalisation Workflow",
                    "latex_code": (
                        "\\begin{tikzpicture}[node distance=17mm,>=latex]\n"
                        "  \\node (start) [draw,rounded corners] {Start with $A$};\n"
                        "  \\node (poly)  [below of=start,draw,rounded corners] "
                        "        {Characteristic poly};\n"
                        "  \\node (lambda)[below of=poly,draw,rounded corners] "
                        "        {Solve $\\det(A-\\lambda I)=0$};\n"
                        "  \\node (eigv)  [below of=lambda,draw,rounded corners] "
                        "        {Find eigenvectors};\n"
                        "  \\node (diag)  [below of=eigv,draw,rounded corners] "
                        "        {$A=PDP^{-1}$};\n"
                        "  \\draw[->] (start) -- (poly);\n"
                        "  \\draw[->] (poly)  -- (lambda);\n"
                        "  \\draw[->] (lambda)-- (eigv);\n"
                        "  \\draw[->] (eigv)  -- (diag);\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [2]
                }
            ],
            "message": "Homework 7 has been graded and summarised. Let me know if anything looks off!"
        },
        {
            "title": "Analytics Report │ Learning Outcome - Proof Writing",
            "content": (
                "Overall class mastery of proof techniques is trending upward [3, 4].  \n\n"
                "**Highlights**\n"
                "- **78 %** of submissions achieved full marks for logical structure.\n"
                "- Common issue: insufficient justification when invoking previously proved lemmas.\n"
                "- Targeted workshop on *proof by contradiction* raised median scores by **12 %**.\n\n"
                "Figure {1} shows the score distribution on the last exam; Figure {2} projects the likely "
                "distribution after the next formative assessment if current interventions continue."
            ),
            "references": [3, 4],
            "figures": [
                {
                    "title": "Current Exam-Score Distribution",
                    "latex_code": (
                        "\\begin{tikzpicture}\n"
                        "  \\begin{axis}[\n"
                        "    ybar, ymin=0, ymax=30,\n"
                        "    xlabel=Score (/100), ylabel=Number of Students,\n"
                        "    symbolic x coords={40-49,50-59,60-69,70-79,80-89,90-100},\n"
                        "    xtick=data, bar width=7mm\n"
                        "  ]\n"
                        "    \\addplot coordinates {(40-49,2)(50-59,4)(60-69,6)(70-79,11)(80-89,18)(90-100,9)};\n"
                        "  \\end{axis}\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [3]
                },
                {
                    "title": "Projected Scores After Workshop",
                    "latex_code": (
                        "\\begin{tikzpicture}\n"
                        "  \\begin{axis}[\n"
                        "    ybar, ymin=0, ymax=30,\n"
                        "    xlabel=Score (/100), ylabel=Projected Count,\n"
                        "    symbolic x coords={40-49,50-59,60-69,70-79,80-89,90-100},\n"
                        "    xtick=data, bar width=7mm, bar shift=0pt, fill=gray\n"
                        "  ]\n"
                        "    \\addplot coordinates {(40-49,1)(50-59,3)(60-69,4)(70-79,9)(80-89,17)(90-100,16)};\n"
                        "  \\end{axis}\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [4]
                }
            ],
            "message": "Proof-writing analytics report generated - happy to dive deeper if needed!"
        }
    ]

    Remember, do not repeat the report in a message after this tool is run, as this will be confusing to the user.
    """
    # get the message id
    message_id = wrapper.context.message_id
    class_id = wrapper.context.class_id
    supabase_client = get_supabase()

    responses = []
    for report in reports:
        report_id: str | None = None
        try:
            title = report.title
            content = report.content
            figures = report.figures

            references = [wrapper.context.references.get(ref, None) for ref in report.references]
            references = [ref.get("id") for ref in references if ref is not None and ref.get("file") is False]

            # insert a summary in the database, with the generation status set to generating
            report_response = supabase_client.table('reports').insert({
                'generation_status': 'generating',
                'message': message_id,
                'title': title,
                'references': references,
                'class': class_id
            }).execute()
            report_id = report_response.data[0]['id']

            # create any figures that are needed
            figure_responses = await create_figures(wrapper, figures)

            # --- build index → id map and list of *successful* IDs -------------
            fig_by_index: Dict[int, str] = {}
            figure_ids: list[str] = []

            for idx, resp in enumerate(figure_responses, start=1):
                if isinstance(resp, CreateFigureResponse):
                    if resp.success:
                        fig_by_index[idx] = resp.figure_id
                        figure_ids.append(resp.figure_id)
            # -------------------------------------------------------------------

            # now do a single pass of substitution, *after* we know the mapping
            content = clean_figures(content, fig_by_index)

            # Apply replacements to all text sections
            content = clean_references(content, wrapper.context.references)

            # Filter out None values from figure_errors
            figure_errors = [r.error or "Unknown error" for r in figure_responses if not r.success]

            if figure_errors:
                raise Exception("Failed to create figures with the following errors: " + ", ".join(figure_errors))
            else:
                report_update_data = {
                    "figures": figure_ids,
                    'content': content,
                    "generation_status": "complete"
                }

                if report_id is None:
                    raise Exception("Failed to create report: No ID returned from database")

                # Insert the question into the database
                report_update_response = supabase_client.table('reports').update(report_update_data).eq("id", report_id).execute()

                if not (report_update_response.data and len(report_update_response.data) > 0):
                    raise Exception("Failed to update report: No ID returned from database")
                
                responses.append(CreateReportResponse(success=True, report_id=report_id, message=report.message))
        
        except Exception as e:
            if report_id is not None:
                # update the report into the database
                report_update_response = supabase_client.table('reports').update({
                    'content': content,
                    "generation_status": "error",
                    "generation_error": str(e)
                }).eq("id", report_id).execute()

            responses.append(CreateReportResponse(success=False, error=str(e), report_id=report_id or "", message=report.message))

    return responses

async def create_report(wrapper: RunContextWrapper[Documents], report: Report) -> CreateReportResponse:
    """Generates a report object given the content. If you need any figures generated via LaTeX, you should create figure prompts within the create_reports tool, and they will be added to the report.

    To include document references in the report, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    To include figures in the report, you should use {y}, where y is the number of the figure. This will be replaced by the actual figure in the report.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the report more readable.

    This function will return the id of the report, which will then be replaced by the actual report of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the report id itself, as this is unknown to the user. 

    Args:
        report: Report
            title: The title of the report.
            content: The content of the report.
            references: List of number references that were used.
            figures: List of figure prompts that should be included in the report.
            message: The message to be displayed to the user after the tool is run.
        Figure:
            title: The title of the figure.
            latex_code: The LaTeX code for the figure.
            references: List of number references that were used.

    Returns:
        CreateReportResponse
            success: Whether the report was created successfully.
            report_id: The id of the report.
            error: The error message if the report was not created successfully.
            message: The message to be displayed to the user after the tool is run.
    
    Example Report:
        {
            "title": "Analytics Report │ Learning Outcome - Proof Writing",
            "content": (
                "Overall class mastery of proof techniques is trending upward [3, 4].  \n\n"
                "**Highlights**\n"
                "- **78 %** of submissions achieved full marks for logical structure.\n"
                "- Common issue: insufficient justification when invoking previously proved lemmas.\n"
                "- Targeted workshop on *proof by contradiction* raised median scores by **12 %**.\n\n"
                "Figure {1} shows the score distribution on the last exam; Figure {2} projects the likely "
                "distribution after the next formative assessment if current interventions continue."
            ),
            "references": [3, 4],
            "figures": [
                {
                    "title": "Current Exam-Score Distribution",
                    "latex_code": (
                        "\\begin{tikzpicture}\n"
                        "  \\begin{axis}[\n"
                        "    ybar, ymin=0, ymax=30,\n"
                        "    xlabel=Score (/100), ylabel=Number of Students,\n"
                        "    symbolic x coords={40-49,50-59,60-69,70-79,80-89,90-100},\n"
                        "    xtick=data, bar width=7mm\n"
                        "  ]\n"
                        "    \\addplot coordinates {(40-49,2)(50-59,4)(60-69,6)(70-79,11)(80-89,18)(90-100,9)};\n"
                        "  \\end{axis}\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [3]
                },
                {
                    "title": "Projected Scores After Workshop",
                    "latex_code": (
                        "\\begin{tikzpicture}\n"
                        "  \\begin{axis}[\n"
                        "    ybar, ymin=0, ymax=30,\n"
                        "    xlabel=Score (/100), ylabel=Projected Count,\n"
                        "    symbolic x coords={40-49,50-59,60-69,70-79,80-89,90-100},\n"
                        "    xtick=data, bar width=7mm, bar shift=0pt, fill=gray\n"
                        "  ]\n"
                        "    \\addplot coordinates {(40-49,1)(50-59,3)(60-69,4)(70-79,9)(80-89,17)(90-100,16)};\n"
                        "  \\end{axis}\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [4]
                }
            ],
            "message": "Proof-writing analytics report generated - happy to dive deeper if needed!"
        }

    Remember, do not repeat the report in a message after this tool is run, as this will be confusing to the user.
    """
    result = await create_reports(wrapper, [report])
    return result[0]