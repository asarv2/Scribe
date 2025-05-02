from agents import AgentHooks, RunContextWrapper, Agent, ToolsToFinalOutputResult, FunctionToolResult
from typing import List
from agents.run_context import RunContextWrapper
from agents.tool import function_tool
from typing import List
from app.extensions import get_supabase
from app.services.chat.models.main import Documents, Question, CreateQuestionResponse, CreateFigureResponse
from app.services.chat.agents.tools.figure import create_figures
import logging

logger = logging.getLogger(__name__)

class QuestionHooks(AgentHooks):

    def __init__(self):
        self.create_question_tool = function_tool(create_question, name_override="create_question")
        self.create_questions_tool = function_tool(create_questions, name_override="create_questions")
        self.create_question_check = create_question_check

    
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


async def create_question_check(
    wrapper: RunContextWrapper[Documents],
    results: list[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    # 1⃣  Collect *all* CreateFigureResponse objects
    all_responses: list[CreateQuestionResponse] = []
    for result in results:
        if result.tool.name == "create_question":
            if isinstance(result.output, CreateQuestionResponse):
                all_responses.append(result.output)
        elif result.tool.name == "create_questions":
            all_responses.extend(
                [r for r in result.output if isinstance(r, CreateQuestionResponse)]
            )

    # 2⃣  Build a success map keyed by question_id
    question_success: dict[str, bool] = {}
    for resp in all_responses:
        qid = resp.question_id or ""          # empty string if not provided
        # Initialise to False; upgrade to True if any success comes in
        question_success[qid] = question_success.get(qid, False) or resp.success

    # 3⃣  Every seen question_id must have succeeded
    all_success = bool(question_success) and all(question_success.values())

    # 4⃣  Decide finality based on the *last* tool invoked
    final_tool       = results[-1].tool
    final_output_raw = results[-1].output

    if final_tool.name == "create_question":
        # Single-question call: final iff that single ID succeeded
        is_final = isinstance(final_output_raw, CreateQuestionResponse) \
                   and final_output_raw.success
        return ToolsToFinalOutputResult(
            is_final_output=is_final,
            final_output=final_output_raw
        )

    elif final_tool.name == "create_questions":
        # Multi-question call: final only if *all* unique IDs succeeded
        return ToolsToFinalOutputResult(
            is_final_output=all_success,
            final_output=final_output_raw
        )

    # Fallback: not a question-creation tool
    return ToolsToFinalOutputResult(
        is_final_output=False,
        final_output=final_output_raw
    )

async def create_questions(wrapper: RunContextWrapper[Documents], questions: List[Question]) -> List[CreateQuestionResponse]:
    """Generates a list of questions given the questions. This will return the ids of the questions, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        List[Question]: 
            title: str = Field(default="") # The title of the question
            question_type: Literal["mcq", "frq"] = "mcq" # The type of question, either "mcq" or "frq"
            question: str = Field(default="") # The question text
            options: List[str] = Field(default_factory=list) # The options for the question
            answer: str = Field(default="") # The answer to the question
            explanations: List[str] = Field(default_factory=list) # The explanations for the question
            references: List[int] = Field(default_factory=list) # The references for the question
            figures: List[Figure] = Field(default_factory=list) # The figures for the question
            message: str = Field(default="") # The message to be displayed to the user after the tool is run
    
    Figure:
        latex_code: str = Field(default="") # The latex code for the figure
        title: str = Field(default="") # The title of the figure
        references: List[int] = Field(default_factory=list) # The references for the figure
    Returns:
        List[CreateQuestionsResponse]:
            success: bool = Field(default=False) # Whether the question was created successfully
            error: Optional[str] = Field(default="") # The error message if the question was not created successfully
            question_id: str = Field(default="") # The id of the question
            message: str = Field(default="") # The message to be displayed after the tool is run

    You should aim to make these difficult problems that require step by step reasoning, meant for the university level. Here are some examples:
        questions = [
            {
                "title": "Spectral-Radius Limit Theorem",
                "question_type": "frq",
                "question": (
                    "Prove that for any square matrix $A\\in\\mathbb{C}^{n\\times n}$ the spectral radius "
                    "$\\rho(A)$ satisfies $\\displaystyle \\rho(A)=\\lim_{k\\to\\infty}\\lVert A^{k}\\rVert^{1/k}$ "
                    "for **every** matrix norm induced by a vector norm.  Supply a step-by-step argument that:\n"
                    "1. invokes Gelfand's formula to relate eigenvalues to powers of $A$;\n"
                    "2. uses sub-multiplicativity of induced norms to obtain an upper bound;\n"
                    "3. constructs a matching lower bound with the Perron-Frobenius eigenvector (or Jordan form);\n"
                    "4. finishes with the squeeze theorem to show equality."
                ),
                "options": [],
                "answer": "",
                "explanations": [
                    "►  Upper bound: for any eigenvalue $\\lambda$ of $A$, $|\\lambda|\\le\\lVert A^{k}\\rVert^{1/k}$, "
                    "so $\\rho(A)\\le\\limsup_{k}\\lVert A^{k}\\rVert^{1/k}$.",
                    "►  Lower bound: choose $v$ attaining the induced-norm, show "
                    "$\\lVert A^{k}\\rVert^{1/k}\\le\\lVert A\\rVert^{1}\\!(1+o(1))$ then tighten via Jordan blocks.",
                    "►  Combine bounds to squeeze the limit and conclude $\\rho(A)=\\lim_{k}\\lVert A^{k}\\rVert^{1/k}$."
                ],
                "references": [11, 12, 13],
                "figures": [
                    {
                        "latex_code": (
                            "\\begin{tikzpicture}[scale=1]\n"
                            "\\draw[->] (-2.2,0)--(2.2,0) node[right]{$\\operatorname{Re}$};\n"
                            "\\draw[->] (0,-2.2)--(0,2.2) node[above]{$\\operatorname{Im}$};\n"
                            "\\draw[thick] (0,0) circle (1.5cm);\n"
                            "\\node at (1.7,1.6) {$|\\lambda|=\\rho(A)$};\n"
                            "\\draw[fill] (1,1) circle(2pt) node[below]{$\\lambda$};\n"
                            "\\end{tikzpicture}"
                        ),
                        "title": "Unit circle highlighting $\\rho(A)$",
                        "references": [14]
                    }
                ],
                "message": "I have created a question on Spectral Radius Limit Theorem, please review it and let me know if you have any questions."
            },
            {
                "title": "Amortized Union-Find Complexity",
                "question_type": "mcq",
                "question": (
                    "With both **path compression** and **union by rank** enabled, what is the tight asymptotic "
                    "upper bound on the amortized time per **Find** or **Union** operation on a set of $n$ "
                    "elements after $m\\ge n$ operations?"
                ),
                "options": [
                    "(A) $\\Theta(\\log n)$",
                    "(B) $\\Theta\\!\\bigl(\\log^{\\!*} n\\bigr)$",
                    "(C) $\\Theta\\!\\bigl(\\alpha(n)\\bigr)$ (inverse Ackermann)",
                    "(D) $\\Theta(1)$"
                ],
                "answer": "C",
                "explanations": [
                    "Option A $\\Theta(\\log n)$: too pessimistic because compression flattens trees far beyond a logarithmic depth.",
                    "Option B $\\Theta(\\log^{\\!*} n)$: still an overestimate; inverse Ackermann grows more slowly than iterated log.",
                    "Option C $\\Theta\\bigl(\\alpha(n)\\bigr)$: correct; Tarjan proved a total cost $O\\bigl(m\\,\\alpha(n)\\bigr)$ over $m$ ops.",
                    "Option D $\\Theta(1)$: unattainable since any comparison-based structure must spend at least $\\alpha(n)$ in worst cases."
                ],
                "references": [21, 22],
                "figures": [
                    {
                        "latex_code": (
                            "\\begin{tikzpicture}[every node/.style={draw,circle,inner sep=1.2pt}, level distance=7mm]\n"
                            "\\node (a) {} child {node{} child{node{}} child{node{}}}\n"
                            "             child {node{}}\n"
                            "             child {node{} child{node{}}};\n"
                            "\\node[below=3.5cm of a] (fl) {Flattened after finds};\n"
                            "\\draw[dashed,->] (a) -- (fl);\n"
                            "\\end{tikzpicture}"
                        ),
                        "title": "Union-find forest before and after path compression",
                        "references": [23, 24]
                    }
                ],
                "message": "I have created a question on Amortized Union-Find Complexity, please review it and let me know if you have any questions."
            },
            {
                "title": "Decision-Tree Lower Bound for Sorting",
                "question_type": "frq",
                "question": (
                    "Establish a lower bound of $\\Omega(n\\log n)$ comparisons for any deterministic "
                    "comparison-based sorting algorithm on $n$ distinct keys.  Construct the binary decision "
                    "tree, relate its height to $\\log_2(n!)$, invoke Stirling's approximation, and derive the bound."
                ),
                "options": [],
                "answer": "",
                "explanations": [
                    "1. Model the algorithm as a binary decision tree with $n!$ leaves, one per permutation.",
                    "2. Show height $h\\ge \\log_2(n!)$ by counting leaves versus internal nodes.",
                    "3. Apply Stirling's formula $\\log_2(n!) = n\\log_2 n - 1.44n + \\Theta(\\log n)$ to get $\\Omega(n\\log n)$."
                ],
                "references": [31],
                "figures": [
                    {
                        "latex_code": (
                            "\\begin{tikzpicture}[level distance=8mm, every node/.style={circle,draw,inner sep=1pt,font=\\tiny}]\n"
                            "\\node (root) {} child {node(1){} edge from parent node[left]{${x_i<x_j}$}}\n"
                            "                    child {node(2){} edge from parent node[right]{${x_i>x_j}$}};\n"
                            "\\path (1) -- +(-1.2,-1.4) node[circle,draw]{};\n"
                            "\\path (2) -- +(1.2,-1.4) node[circle,draw]{};\n"
                            "\\end{tikzpicture}"
                        ),
                        "title": "Depth-2 fragment of a sorting decision tree",
                        "references": [32, 33]
                    }
                ],
                "message": "I have created a question on Decision-Tree Lower Bound for Sorting, please review it and let me know if you have any questions."
            },
            {
                "title": "Lock-Free Queue Correctness",
                "question_type": "mcq",
                "question": (
                    "The Michael & Scott lock-free queue uses a singly linked list with head/tail pointers and "
                    "CAS.  Which property below is **not** guaranteed by their original algorithm under a "
                    "sequentially consistent memory model?"
                ),
                "options": [
                    "(A) Linearizability of *Enqueue* operations",
                    "(B) Linearizability of *Dequeue* operations that return a value",
                    "(C) Freedom from the ABA problem without additional tagging",
                    "(D) Lock-freedom (system-wide progress)"
                ],
                "answer": "C",
                "explanations": [
                    "Option A: proven linearizable; each enqueue has a CAS that defines its linearization point.",
                    "Option B: dequeue that returns data is also linearizable at its successful CAS removing the node.",
                    "Option C: correct; without version tags a recycled pointer may cause an ABA anomaly despite success of CAS.",
                    "Option D: algorithm is lock-free; some thread always makes progress even under contention."
                ],
                "references": [41, 42, 43],
                "figures": [
                    {
                        "latex_code": (
                            "\\begin{tikzpicture}[>=stealth]\n"
                            "\\node[draw,rectangle] (h) at (0,0) {head};\n"
                            "\\node[draw,rectangle] (n1) at (2,0) {$N_1$};\n"
                            "\\node[draw,rectangle] (n2) at (4,0) {$N_2$};\n"
                            "\\node[draw,rectangle] (t)  at (6,0) {tail};\n"
                            "\\draw[->] (h) -- (n1);\n"
                            "\\draw[->] (n1) -- (n2);\n"
                            "\\draw[->] (n2) -- (t);\n"
                            "\\end{tikzpicture}"
                        ),
                        "title": "Queue layout during concurrent operations",
                        "references": [44, 45]
                    }
                ],
                "message": "I have created a question on Lock-Free Queue Correctness, please review it and let me know if you have any questions."
            }
        ]
    """
    responses = []
    supabase_client = get_supabase()

    # get the message id
    message_id = wrapper.context.message_id
    class_id = wrapper.context.class_id

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
                references = [ref.get("id") for ref in references if ref is not None and ref.get("file") is False]
                
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
                    'references': references,
                    'class': class_id
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
                    
                    responses.append(CreateQuestionResponse(success=True, question_id=question_id, message=question.message))
            except Exception as e:
                if question_id:  # Only try to update if question_id exists
                    # update the question into the database
                    question_update_response = supabase_client.table('questions').update({
                        "generation_status": "error",
                        "generation_error": str(e)
                    }).eq("id", question_id).execute()

                responses.append(CreateQuestionResponse(success=False, error=str(e), message=question.message))
        elif question.question_type == "frq":
            try:
                title = question.title
                question_text = question.question  # Rename to avoid overwriting the question object
                answer = question.answer
                figures = question.figures

                # Get references
                references = [wrapper.context.references.get(ref, None) for ref in question.references]
                references = [ref.get("id") for ref in references if ref is not None and ref.get("file") is False]
                
                # insert a question in the database, with the generation status set to generating
                question_response = supabase_client.table('questions').insert({
                    'generation_status': 'generating',
                    'message': message_id,
                    'title': title,
                    'problem': question_text,
                    'solution': answer,
                    'frq': True,
                    'references': references,
                    'class': class_id
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
                    
                    responses.append(CreateQuestionResponse(success=True, question_id=question_id, message=question.message))
            except Exception as e:
                if question_id:  # Only try to update if question_id exists
                    # update the question into the database
                    question_update_response = supabase_client.table('questions').update({
                        "generation_status": "error",
                        "generation_error": str(e)
                    }).eq("id", question_id).execute()
                responses.append(CreateQuestionResponse(success=False, error=str(e), message=question.message))

    return responses

async def create_question(wrapper: RunContextWrapper[Documents], question: Question) -> CreateQuestionResponse:
    """Generates a list of questions given the questions. This will return the ids of the questions, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        Question: 
            title: str = Field(default="") # The title of the question
            question_type: Literal["mcq", "frq"] = "mcq" # The type of question, either "mcq" or "frq"
            question: str = Field(default="") # The question text
            options: List[str] = Field(default_factory=list) # The options for the question
            answer: str = Field(default="") # The answer to the question
            explanations: List[str] = Field(default_factory=list) # The explanations for the question
            references: List[int] = Field(default_factory=list) # The references for the question
            figures: List[Figure] = Field(default_factory=list) # The figures for the question
            message: str = Field(default="") # The message to be displayed to the user after the tool is run
    Figure:
        latex_code: str = Field(default="") # The latex code for the figure
        title: str = Field(default="") # The title of the figure
        references: List[int] = Field(default_factory=list) # The references for the figure

    Returns:
        CreateQuestionResponse:
            success: bool = Field(default=False)
            error: Optional[str] = Field(default="")
            question_id: str = Field(default="")
            message: str = Field(default="") # The message to be displayed to the user after the tool is run

    You should aim to make these difficult problems that require step by step reasoning, meant for the university level. Here are some examples:
        question = {
                "title": "Spectral-Radius Limit Theorem",
                "question_type": "frq",
                "question": (
                    "Prove that for any square matrix $A\\in\\mathbb{C}^{n\\times n}$ the spectral radius "
                    "$\\rho(A)$ satisfies $\\displaystyle \\rho(A)=\\lim_{k\\to\\infty}\\|A^{k}\\|^{1/k}$ "
                    "for **every** matrix norm induced by a vector norm.  Supply a step-by-step argument that:\n"
                    "1. invokes Gelfand's formula to relate eigenvalues to powers of $A$;\n"
                    "2. uses sub-multiplicativity of induced norms to obtain an upper bound;\n"
                    "3. constructs a matching lower bound with the Perron-Frobenius eigenvector (or Jordan form);\n"
                    "4. finishes with the squeeze theorem to show equality."
                ),
                "options": [],
                "answer": "",
                "explanations": [
                    "►  Upper bound: for any eigenvalue $\\lambda$ of $A$, $|\\lambda|\\leq\\|A^{k}\\|^{1/k}$, "
                    "so $\\rho(A)\\leq\\limsup_{k}\\|A^{k}\\|^{1/k}$.",
                    "►  Lower bound: choose $v$ attaining the induced-norm, show "
                    "$\\|A^{k}\\|^{1/k}\\leq\\|A\\|^{1}(1+o(1))$ then tighten via Jordan blocks.",
                    "►  Combine bounds to squeeze the limit and conclude $\\rho(A)=\\lim_{k}\\|A^{k}\\|^{1/k}$."
                ],
                "references": [11, 12, 13],
                "figures": [
                    {
                        "latex_code": (
                            "\\begin{tikzpicture}[scale=1]\n"
                            "\\draw[->] (-2.2,0)--(2.2,0) node[right]{$\\operatorname{Re}$};\n"
                            "\\draw[->] (0,-2.2)--(0,2.2) node[above]{$\\operatorname{Im}$};\n"
                            "\\draw[thick] (0,0) circle (1.5cm);\n"
                            "\\node at (1.7,1.6) {$|\\lambda|=\\rho(A)$};\n"
                            "\\draw[fill] (1,1) circle(2pt) node[below]{$\\lambda$};\n"
                            "\\end{tikzpicture}"
                        ),
                        "title": "Unit circle highlighting $\\rho(A)$",
                        "references": [14]
                    }
                ],
                "message": "I have created a question on Spectral Radius Limit Theorem, please review it and let me know if you have any questions."
            }
    """
    result = await create_questions(wrapper, [question])
    return result[0]