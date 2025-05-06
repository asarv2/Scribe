from agents import (
    AgentHooks,
    RunContextWrapper,
    Agent,
    ToolsToFinalOutputResult,
    FunctionToolResult,
)
from typing import List, Dict
from agents.tool import function_tool
from app.extensions import get_supabase
from app.services.chat.models.general import (
    Documents,
    Summary,
    CreateSummaryResponse,
    CreateFigureResponse,
)
from app.services.chat.agents.tools.figure import create_figures
from app.services.chat.utils.references import clean_references
from app.services.chat.utils.figure_tools import clean_figures
import logging

logger = logging.getLogger(__name__)


class SummaryHooks(AgentHooks):
    def __init__(self):
        self.create_summary_tool = function_tool(
            create_summary, name_override="create_summary"
        )
        self.create_summaries_tool = function_tool(
            create_summaries, name_override="create_summaries"
        )
        self.create_summary_check = create_summary_check
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
        self.supabase_client.table("messages").update(
            {"status_text": "Getting ready to create summaries..."}
        ).eq("id", message_id).execute()


async def create_summary_check(
    wrapper: RunContextWrapper[Documents], results: list[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    # 1⃣  Collect *all* CreateSummaryResponse objects
    all_responses: list[CreateSummaryResponse] = []
    for result in results:
        if result.tool.name == "create_summary":
            if isinstance(result.output, CreateSummaryResponse):
                all_responses.append(result.output)
        elif result.tool.name == "create_summaries":
            all_responses.extend(
                [r for r in result.output if isinstance(r, CreateSummaryResponse)]
            )

    # 2⃣  Build a success map keyed by summary_id
    summary_success: dict[str, bool] = {}
    for resp in all_responses:
        sid = resp.summary_id or ""  # empty string if not provided
        # Initialise to False; upgrade to True if any success comes in
        summary_success[sid] = summary_success.get(sid, False) or resp.success

    # 3⃣  Every seen question_id must have succeeded
    all_success = bool(summary_success) and all(summary_success.values())

    # 4⃣  Decide finality based on the *last* tool invoked
    final_tool = results[-1].tool
    final_output_raw = results[-1].output

    if final_tool.name == "create_summary":
        # Single-summary call: final iff that single ID succeeded
        is_final = (
            isinstance(final_output_raw, CreateSummaryResponse)
            and final_output_raw.success
        )
        return ToolsToFinalOutputResult(
            is_final_output=is_final, final_output=final_output_raw
        )

    elif final_tool.name == "create_summaries":
        # Multi-summary call: final only if *all* unique IDs succeeded
        return ToolsToFinalOutputResult(
            is_final_output=all_success, final_output=final_output_raw
        )

    # Fallback: not a question-creation tool
    return ToolsToFinalOutputResult(
        is_final_output=False, final_output=final_output_raw
    )


async def create_summaries(
    wrapper: RunContextWrapper[Documents], summaries: List[Summary]
) -> List[CreateSummaryResponse]:
    """Generates a summary object given the preamble, body, and conclusion. If you need any figures generated via LaTeX, you should create figure prompts within the create_summaries tool, and they will be added to the summary. Use markdown bullet points to make the summary more readable.

    To include document references in the summary, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    To include figures in the summary, you should use {y}, where y is the number of the figure. This will be replaced by the actual figure in the summary.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user.

    Args:
        summaries: List[Summary]
            title: The title of the summary.
            preamble: The preamble of the summary.
            body: The body of the summary.
            conclusion: The conclusion of the summary.
            references: List of number references that were used.
            figures: List of figures that should be included in the summary.
            message: The message to be displayed to the user after the tool is run.

        Figure:
            title: The title of the figure.
            latex_code: The LaTeX code for the figure.
            references: List of number references that were used.

    Returns:
        List[CreateSummaryResponse]
            success: Whether the summary was created successfully.
            summary_id: The id of the summary.
            error: The error message if the summary was not created successfully.
            message: The message to be displayed to the user after the tool is run.

    Example Summary:
    summaries = [
        {
            "title": "Lecture 8 | Eigenvalues, Eigenvectors & Spectral Decomposition",
            "preamble": (
                "In Lecture 8 we introduced the eigen-equation "
                "$A\\mathbf v = \\lambda\\mathbf v$ and saw how eigenvectors span "
                "invariant lines [1]. Prof. Lee sketched the geometry {1} before "
                "deriving the diagonalisation pipeline {2}."
            ),
            "body": (
                "- **Characteristic Polynomial**: $\\det\\bigl(A-\\lambda I\\bigr)=0$ "
                "yields up to $n$ eigenvalues for $A\\in\\mathbb R^{n\\times n}$ [1].\\n"
                "- **Algebraic vs Geometric Multiplicity** and the criterion "
                "$\\sum\\dim\\ker\\bigl(A-\\lambda_i I\\bigr)=n$ for diagonalisation [2].\\n"
                "- **Spectral Theorem**: for symmetric $A$, $A=Q\\Lambda Q^{\\mathsf T}$ "
                "(orthonormal $Q$) ⇒ orthogonal eigenspaces.\\n\\n"
                "{2}\\n"
                "- **Power Iteration** outline: "
                "$\\tfrac{A^k\\mathbf v}{\\lVert A^k\\mathbf v\\rVert}$ "
                "converges to the dominant eigenvector when "
                "$|\\lambda_1|>|\\lambda_2|$."
            ),
            "conclusion": (
                "Eigen-analysis converts linear maps into scaled basis directions, "
                "enabling $A^t=Q\\Lambda^tQ^{-1}$ and underpinning PCA, graph "
                "Laplacians, and quantum dynamics."
            ),
            "references": [1, 2],
            "figures": [
                {
                    "title": "Geometric View of an Eigenvector",
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
                    "title": "Block Diagram of Diagonalisation",
                    "latex_code": (
                        "\\begin{tikzpicture}[node distance=3cm, font=\\small]\n"
                        "  \\node (A)  [draw,rectangle] {$A$};\n"
                        "  \\node (eig)[draw,rectangle,right of=A] "
                        "        {eigen solve};\n"
                        "  \\node (P)  [draw,rectangle,right of=eig] {$P$};\n"
                        "  \\node (D)  [draw,rectangle,below of=P,node distance=2cm] "
                        "        {$D=\\operatorname{diag}(\\lambda_i)$};\n"
                        "  \\node (rec)[draw,rectangle,left of=D] {$A=PDP^{-1}$};\n"
                        "  \\draw[->] (A)   -- (eig) node[midway,above]{\\small $\\lambda_i$};\n"
                        "  \\draw[->] (eig) -- (P);\n"
                        "  \\draw[->] (P)   -- (D);\n"
                        "  \\draw[->] (D)   -- (rec);\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [2]
                }
            ],
            "message": "I have created a summary on Eigenvalues, Eigenvectors & Spectral Decomposition, please review it and let me know if you have any questions."
        },
        {
            "title": "Lecture 12 | Balanced Search Trees (AVL & Red-Black)",
            "preamble": (
                "Plain BSTs can degenerate to height $n$. "
                "Lecture 12 showed how rebalancing maintains "
                "$\\mathcal O(\\log n)$ height: we first traced AVL rotations {1} "
                "then formalised the Red-Black invariants {2}."
            ),
            "body": (
                "- **AVL Height Bound**: "
                "$|h_{\\text{left}}-h_{\\text{right}}|\\le 1$ ⇒ "
                "$h\\le 1.44\\,\\log_2 n$ [3].\\n\\n"
                "{1}\\n"
                "- **Rotations** (single & double) restore balance in "
                "$\\Theta(1)$ after insert/delete.\\n"
                "- **Red-Black Properties** guarantee root-leaf black-height consistency, "
                "bounding height by $\\le 2\\log_2(n+1)$ [4].\\n\\n"
                "{2}\\n"
                "- **Amortised Costs**: search, insert, delete ➜ "
                "$\\mathcal O(\\log n)$; proof via potential method."
            ),
            "conclusion": (
                "Balanced trees trade occasional restructuring for guaranteed "
                "log-time operations, forming the backbone of maps, sets, and "
                "database indices."
            ),
            "references": [3, 4],
            "figures": [
                {
                    "title": "AVL Right Rotation Example",
                    "latex_code": (
                        "\\begin{tikzpicture}[level distance=1.2cm,\n"
                        "  level 1/.style={sibling distance=2.4cm},\n"
                        "  every node/.style={circle,draw,minimum size=6mm}]\n"
                        "  % before rotation\n"
                        "  \\node(3){3}\n"
                        "    child{node(2){2}\n"
                        "      child{node{1}}\n"
                        "      child{edge from parent[draw=none]}\n"
                        "    }\n"
                        "    child{node{4}};\n"
                        "  % after rotation (shifted right)\n"
                        "  \\begin{scope}[xshift=5cm]\n"
                        "    \\node(2b){2}\n"
                        "      child{node{1}}\n"
                        "      child{node(3b){3}\n"
                        "        child{edge from parent[draw=none]}\n"
                        "        child{node{4}}\n"
                        "      };\n"
                        "  \\end{scope}\n"
                        "  \\draw[->,thick] (3) -- node[midway,above]{rotate} (2b);\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [3]
                },
                {
                    "title": "Red-Black Tree with Invariants",
                    "latex_code": (
                        "\\begin{tikzpicture}[level distance=1.1cm,\n"
                        "  every node/.style={circle,draw,minimum size=6mm}]\n"
                        "  \\node[fill=black,text=white]{10}\n"
                        "    child{node[fill=red]{5}\n"
                        "      child{node[fill=black,text=white]{2}}\n"
                        "      child{node[fill=black,text=white]{7}}\n"
                        "    }\n"
                        "    child{node[fill=red]{15}\n"
                        "      child{node[fill=black,text=white]{12}}\n"
                        "      child{node[fill=black,text=white]{18}}\n"
                        "    };\n"
                        "  \\node at (3.9,-2.1) {black-height = 3};\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [4]
                }
            ],
            "message": "I have created a summary on Balanced Search Trees (AVL & Red-Black), please review it and let me know if you have any questions."
        }
    ]

    Remember, do not repeat the summary in a message after this tool is run, as this will be confusing to the user.
    """
    # get the message id
    message_id = wrapper.context.message_id
    class_id = wrapper.context.class_id
    supabase_client = get_supabase()

    responses = []
    for summary in summaries:
        summary_id: str | None = None
        try:
            title = summary.title
            preamble = summary.preamble
            body = summary.body
            conclusion = summary.conclusion
            figures = summary.figures

            # Add validation before proceeding
            if not body.strip():
                raise ValueError("Summary body cannot be empty")
            for f in figures:
                if not f.latex_code.strip():
                    raise ValueError("Each figure must contain latex_code")

            references = [
                wrapper.context.references.get(ref, None) for ref in summary.references
            ]
            references = [
                ref.get("id")
                for ref in references
                if ref is not None and ref.get("file") is False
            ]

            # insert a summary in the database, with the generation status set to generating
            summary_response = (
                supabase_client.table("summaries")
                .insert(
                    {
                        "generation_status": "generating",
                        "message": message_id,
                        "title": title,
                        "references": references,
                        "class": class_id,
                    }
                )
                .execute()
            )
            summary_id = summary_response.data[0]["id"]

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
            preamble = clean_figures(preamble, fig_by_index)
            body = clean_figures(body, fig_by_index)
            conclusion = clean_figures(conclusion, fig_by_index)

            # Apply replacements to all text sections
            preamble = clean_references(preamble, wrapper.context.references)
            body = clean_references(body, wrapper.context.references)
            conclusion = clean_references(conclusion, wrapper.context.references)

            # Fix markdown bullet points by ensuring proper line breaks
            body = body.replace("\\n-", "\\n\n-")

            # Filter out None values from figure_errors
            figure_errors = [
                r.error or "Unknown error" for r in figure_responses if not r.success
            ]

            if figure_errors:
                raise Exception(
                    "Failed to create figures with the following errors: "
                    + ", ".join(figure_errors)
                )
            else:
                summary_update_data = {
                    "figures": figure_ids,
                    "preamble": preamble,
                    "body": body,
                    "conclusion": conclusion,
                    "generation_status": "complete",
                }

                if summary_id is None:
                    raise Exception(
                        "Failed to create summary: No ID returned from database"
                    )

                # Insert the question into the database
                summary_update_response = (
                    supabase_client.table("summaries")
                    .update(summary_update_data)
                    .eq("id", summary_id)
                    .execute()
                )

                if not (
                    summary_update_response.data
                    and len(summary_update_response.data) > 0
                ):
                    raise Exception(
                        "Failed to update summary: No ID returned from database"
                    )

                responses.append(
                    CreateSummaryResponse(
                        success=True, summary_id=summary_id, message=summary.message
                    )
                )

        except Exception as e:
            if summary_id is not None:
                # update the summary into the database
                summary_update_response = (
                    supabase_client.table("summaries")
                    .update(
                        {
                            "preamble": preamble,
                            "body": body,
                            "conclusion": conclusion,
                            "generation_status": "error",
                            "generation_error": str(e),
                        }
                    )
                    .eq("id", summary_id)
                    .execute()
                )

            responses.append(
                CreateSummaryResponse(
                    success=False,
                    error=str(e),
                    summary_id=summary_id or "",
                    message=summary.message,
                )
            )

    return responses


async def create_summary(
    wrapper: RunContextWrapper[Documents], summary: Summary
) -> CreateSummaryResponse:
    """Generates a summary object given the preamble, body, and conclusion. If you need any figures generated via LaTeX, you should create figure prompts within the create_summaries tool, and they will be added to the summary. Use markdown bullet points to make the summary more readable.

    To include document references in the summary, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    To include figures in the summary, you should use {y}, where y is the number of the figure. This will be replaced by the actual figure in the summary.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user.

    Args:
        summary: Summary
            title: The title of the summary.
            preamble: The preamble of the summary.
            body: The body of the summary.
            conclusion: The conclusion of the summary.
            references: List of number references that were used.
            figures: List of figure prompts that should be included in the summary.
            message: The message to be displayed to the user after the tool is run.
        Figure:
            title: The title of the figure.
            latex_code: The LaTeX code for the figure.
            references: List of number references that were used.

    Returns:
        CreateSummaryResponse
            success: Whether the summary was created successfully.
            summary_id: The id of the summary.
            error: The error message if the summary was not created successfully.
            message: The message to be displayed to the user after the tool is run.
    Example Summary:
        {
            "title": "Lecture 8 | Eigenvalues, Eigenvectors & Spectral Decomposition",
            "preamble": (
                "In Lecture 8 we introduced the eigen-equation "
                "$A\\mathbf v = \\lambda\\mathbf v$ and saw how eigenvectors span "
                "invariant lines [1]. Prof. Lee sketched the geometry {1} before "
                "deriving the diagonalisation pipeline {2}."
            ),
            "body": (
                "- **Characteristic Polynomial**: $\\det\\bigl(A-\\lambda I\\bigr)=0$ "
                "yields up to $n$ eigenvalues for $A\\in\\mathbb R^{n\\times n}$ [1].\\n"
                "- **Algebraic vs Geometric Multiplicity** and the criterion "
                "$\\sum\\dim\\ker\\bigl(A-\\lambda_i I\\bigr)=n$ for diagonalisation [2].\\n"
                "- **Spectral Theorem**: for symmetric $A$, $A=Q\\Lambda Q^{\\mathsf T}$ "
                "(orthonormal $Q$) ⇒ orthogonal eigenspaces.\\n\\n"
                "{2}\\n"
                "- **Power Iteration** outline: "
                "$\\tfrac{A^k\\mathbf v}{\\lVert A^k\\mathbf v\\rVert}$ "
                "converges to the dominant eigenvector when "
                "$|\\lambda_1|>|\\lambda_2|$."
            ),
            "conclusion": (
                "Eigen-analysis converts linear maps into scaled basis directions, "
                "enabling $A^t=Q\\Lambda^tQ^{-1}$ and underpinning PCA, graph "
                "Laplacians, and quantum dynamics."
            ),
            "references": [1, 2],
            "figures": [
                {
                    "title": "Geometric View of an Eigenvector",
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
                    "title": "Block Diagram of Diagonalisation",
                    "latex_code": (
                        "\\begin{tikzpicture}[node distance=3cm, font=\\small]\n"
                        "  \\node (A)  [draw,rectangle] {$A$};\n"
                        "  \\node (eig)[draw,rectangle,right of=A] "
                        "        {eigen solve};\n"
                        "  \\node (P)  [draw,rectangle,right of=eig] {$P$};\n"
                        "  \\node (D)  [draw,rectangle,below of=P,node distance=2cm] "
                        "        {$D=\\operatorname{diag}(\\lambda_i)$};\n"
                        "  \\node (rec)[draw,rectangle,left of=D] {$A=PDP^{-1}$};\n"
                        "  \\draw[->] (A)   -- (eig) node[midway,above]{\\small $\\lambda_i$};\n"
                        "  \\draw[->] (eig) -- (P);\n"
                        "  \\draw[->] (P)   -- (D);\n"
                        "  \\draw[->] (D)   -- (rec);\n"
                        "\\end{tikzpicture}"
                    ),
                    "references": [2]
                }
            ],
            "message": "I have created a summary on Eigenvalues, Eigenvectors & Spectral Decomposition, please review it and let me know if you have any questions."
        }

    Remember, do not repeat the summary in a message after this tool is run, as this will be confusing to the user.
    """
    result = await create_summaries(wrapper, [summary])
    return result[0]
