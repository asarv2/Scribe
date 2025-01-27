from typing import Dict, List, TypedDict, Optional, Union
from enum import Enum
from app.services.base_processor import BaseProcessor, ContentType
from langchain_core.messages import HumanMessage
import re

class QuestionType(Enum):
    MCQ = "mcq"
    FRQ = "frq"

class Rubric(TypedDict):
    standard: str
    content: str
    points: int

class MCQQuestion(TypedDict):
    question: str
    options: Dict[str, str]
    answers: Dict[str, bool]
    explanations: Dict[str, str]
    tags: List[str]
    slides: Dict[str, List[int]]  # lecture_id -> slide numbers

class FRQQuestion(TypedDict):
    question: str
    solution: str
    tags: List[str]
    slides: Dict[str, List[int]]  # lecture_id -> slide numbers
    rubric: List[Rubric]

class ProblemsContent(TypedDict):
    figures: Dict[int, List[str]]
    content: str

class BaseProblemsProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        content_type: ContentType,
        question_type: QuestionType = QuestionType.MCQ,
        additional_instructions: str = ""
    ):
        super().__init__()
        self.course_title = course_title
        self.content_type = content_type
        self.question_type = question_type
        self.additional_instructions = additional_instructions
        self.questions: Dict[str, List[List[Union[MCQQuestion, FRQQuestion]]]] = {}

        # Prompts
        self.base_question_prompt = f"You are a professor for the class {self.course_title}. You will be given documents from lectures and be asked to generate multiple choice questions for the students to answer. You will have 5 answer choices available, 'A', 'B', 'C', 'D', and 'E'. For each question generated, there can only be one correct answer. If your response contains math symbols, be sure to use LaTeX formatting."

        self.quality_prompt = f"""To generate questions of the highest quality, here are some guidelines you should follow.
            
            CRITICAL REQUIREMENTS:
            1. This course is a graduate level class, so you will need to generate complex, multi-step questions.
            2. Questions should directly relate to the core content of the {self.content_type.value}.
            3. Make each explanation complete and self-contained.
            4. Each question should be difficult to answer correctly, if the student is not familiar with the content.
            5. Make sure the questions cover a diverse set of concepts from the {self.content_type.value}."""

        single_part_prompt = f"""TASK: You will be generating single-part questions to test comprehension of the {self.content_type.value}. 
        
        WHAT TO DO:
        1. Put the question in <QUESTION> and </QUESTION> tags.
        2. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center.
        3. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. 
        4. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags.
        5. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question.
        6. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations."""

        multi_part_prompt = f"""TASK: You will be generating multi-part questions to test comprehension of the {self.content_type.value}. 
        
        WHAT TO DO: 
        1. You must generate exactly 3 parts.
        2. Put the part number in <PART_X> and </PART_X> tags, where X is the part number. You must use <PART_A>, <PART_B>, and <PART_C> tags. The part number must be 'A', 'B' or 'C'. 
        3. Put each of the questions in <QUESTION> and </QUESTION> tags.
        4. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center.
        5. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. 
        6. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags.
        7. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question.
        8. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations."""

        single_part_conceptual_prompt = f"""IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 single-part conceptual practice problem for the {
            "lecture 2024-08-27-ExSimplex" if self.content_type.value == "lecture" else "topic Simplex Method"
        }.

        OUTPUT: <OUTPUT><QUESTION>Explain how degeneracy can lead to cycling in the Simplex Method, and name at least one strategy (or pivot rule) used to avoid cycling. Provide a concise but thorough explanation, using geometric and algebraic reasoning to illustrate your answer.</QUESTION>

        <SOLUTION>Definition of Degeneracy\nA Basic Feasible Solution (BFS) is degenerate if at least one of the basic variables is zero. Equivalently, more constraints are "active" at the same vertex of the feasible region than strictly necessary.\nIn geometric terms, degeneracy happens when multiple edges (or faces) of the feasible region intersect at a single point, potentially causing more constraints than needed to be tight at a vertex.\nHow Degeneracy Can Cause Cycling\nIn a non-degenerate iteration, each pivot typically improves the objective (or at least changes the BFS). In a degenerate situation, it is possible to pivot from one BFS to another BFS that has exactly the same objective value—and possibly even the same BFS if the pivot reintroduces the identical set of basic variables in a different order. Algebraically, a zero basic variable might remain at zero after a pivot step if the entering variable does not actually change in value (due to ratio tests matching up in a way that yields no net change). When this happens repeatedly, the Simplex Method might "cycle" through a sequence of BFSs (or effectively come back to the same BFS configuration), preventing forward progress.\nAnti-Cycling Strategies\nBland's Rule: Pick the entering and leaving variables by the smallest index among the candidates, which guarantees the algorithm will not cycle.\nOther strategies include Lexicographic ordering, Perturbation methods, etc.\nFinal Summary\nDegeneracy is not uncommon and doesn't always lead to cycling, but it can. \nHow Degeneracy Can Cause Cycling. In a non-degenerate iteration, each pivot typically improves the objective (or at least changes the BFS). In a degenerate situation, it is possible to pivot from one BFS to another BFS that has exactly the same objective value—and possibly even the same BFS if the pivot reintroduces the identical set of basic variables in a different order. Algebraically, a zero basic variable might remain at zero after a pivot step if the entering variable does not actually change in value (due to ratio tests matching up in a way that yields no net change). When this happens repeatedly, the Simplex Method might "cycle" through a sequence of BFSs (or effectively come back to the same BFS configuration), preventing forward progress. Anti-Cycling Strategies\nBland's Rule: Pick the entering and leaving variables by the smallest index among the candidates, which guarantees the algorithm will not cycle. Other strategies include Lexicographic ordering, Perturbation methods, etc.\nFinal Summary\nDegeneracy is not uncommon and doesn't always lead to cycling, but it can. Pivot rules that systematically break ties (like Bland's rule) ensure eventual progress toward an optimal solution.</SOLUTION>

        <RUBRIC><STANDARD Definition of Degeneracy><POINT 1>For stating that degeneracy involves a BFS with one or more basic variables at zero.</POINT><POINT 1>For mentioning that more constraints are active at a vertex than the dimension requires.</POINT></STANDARD><STANDARD Explanation of Cycling><POINT 1>For mentioning that in a degenerate pivot, the objective might not change.</POINT><POINT 2>For clarifying how the algorithm can revisit the same BFS or bounce among a set of BFSs without progress.</POINT></STANDARD><STANDARD Geometric & Algebraic Reasoning><POINT 1>For describing degeneracy in geometric terms (multiple edges/faces intersecting at one point).</POINT><POINT 1>For mentioning the algebraic perspective (zero pivot steps, repeated BFS).</POINT></STANDARD><STANDARD Anti-Cycling Strategy><POINT 1>For naming a specific strategy (e.g., Bland's rule).</POINT><POINT 1>For briefly explaining how that strategy prevents cycling (e.g., systematic tie-breaking).</POINT><POINT 1>For overall clarity and completeness in linking degeneracy to the need for such rules.</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>
        </OUTPUT>"""

        single_part_computational_prompt = f"""IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 single-part computational practice problem for the {
            "lecture 2024-08-27-ExSimplex" if self.content_type.value == "lecture" else "topic Simplex Method"
        }.""" + """

        OUTPUT: <OUTPUT><QUESTION>Consider the following maximization linear program:

        $\max z = 3x_1 + 2x_2$
        subject to:
        $x_1 + x_2 \leq 4$
        $2x_1 + x_2 \leq 6$
        $x_1, x_2 \geq 0$

        Using one pivot step of the Simplex Method, identify:

        Which variable enters the basis (pivot column), and
        Which variable leaves the basis (pivot row).
        (Assume you set up an initial simplex tableau with slack variables $s_1$ and $s_2$. Show your work clearly.)</QUESTION>

        <SOLUTION>Solution (Step-by-Step)

        Rewriting the Problem with Slacks:

        $x_1 + x_2 + s_1 = 4$
        $2x_1 + x_2 + s_2 = 6$

        Initial Basic Feasible Solution (BFS): 
        $(x_1, x_2, s_1, s_2) = (0, 0, 4, 6)$

        Form the Initial Tableau:
        A typical layout (rows for constraints, plus the objective row) might look like:

        $\begin{array}{c|cccc|c}
        & x_1 & x_2 & s_1 & s_2 & \text{RHS} \\
        \hline
        \text{Row 1} & 1 & 1 & 1 & 0 & 4 \\
        \text{Row 2} & 2 & 1 & 0 & 1 & 6 \\
        -z & -3 & -2 & 0 & 0 & 0
        \end{array}$

        (Some variations might write the objective row differently; we assume the "$-z$ method": $-z + 3x_1 + 2x_2 = 0$.)

        Select the Pivot Column (Entering Variable):
        - We look for the most negative coefficient in the objective row (for a maximization problem).
        - Here, $-3 < -2$, so $x_1$ is the entering variable (pivot column).

        Ratio Test for the Leaving Variable:
        - For Row 1: Ratio = $\frac{4}{1} = 4$
        - For Row 2: Ratio = $\frac{6}{2} = 3$
        - The smaller ratio (3) indicates that $s_2$ leaves the basis (pivot row is Row 2).

        Answer:
        - Entering variable: $x_1$
        - Leaving variable: $s_2$
        </SOLUTION>

        <RUBRIC><STANDARD Setup with Slack Variables><POINT 1>For correctly adding slack variables $s_1$ and $s_2$ to the constraints.</POINT><POINT 1>For stating the initial BFS $(x_1, x_2, s_1, s_2) = (0, 0, 4, 6)$.</POINT></STANDARD><STANDARD Initial Tableau & Objective Function><POINT 1>For correctly placing coefficients into the tableau.</POINT><POINT 1>For indicating the correct $-z$ row (or equivalent representation).</POINT><POINT 1>For identifying negative coefficients (the "most negative" approach for pivot).</POINT></STANDARD><STANDARD Pivot Column Selection><POINT 2>For correctly naming which $x_i$ has the most negative reduced cost and thus enters.</POINT></STANDARD><STANDARD Minimum Ratio Test & Pivot Row><POINT 2>For correctly applying the ratio test to find the leaving variable, showing the numeric comparison.</POINT></STANDARD><STANDARD Presentation & Correct Conclusion><POINT 1>For stating the final result clearly: "$x_1$ enters, $s_2$ leaves" (or the appropriate pair).</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>
        </OUTPUT>"""

        multi_part_conceptual_prompt = f"""IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 multi-part (3 parts) conceptual practice problem for the {
            "lecture 2024-08-27-ExSimplex" if self.content_type.value == "lecture" else "topic Simplex Method"
        }.

        OUTPUT: <OUTPUT>
        <PART_A>
        <QUESTION>You are studying a minimization problem in standard form, but the constraints are "$\geq$" type. You decide to use the Two-Phase Simplex Method. Describe the purpose of Phase I in the Two-Phase Simplex Method, specifically when constraints are of the form "$\geq$."</QUESTION><SOLUTION>Phase I is used to find any feasible solution when it's not obvious how to construct an initial BFS. 
        
        In particular, for "$\geq$" constraints (or "$=$" constraints), the usual trick of adding slack variables does not yield an immediate BFS. Instead, we add artificial variables to create a system we can solve easily as the initial step.
        The objective in Phase I is to minimize the sum of these artificial variables, ideally driving them all to zero, proving feasibility.</SOLUTION>

        <RUBRIC><STANDARD Purpose of Phase I><POINT 1>For mentioning infeasibility or complicated constraints ("$\geq$" or "$=$").</POINT><POINT 1>For explaining how Phase I finds an initial feasible solution.</POINT><POINT 1>For stating the goal: minimize the sum of artificial variables.</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>
        </PART_A>

        <PART_B>
        <QUESTION>Explain how artificial variables are introduced in this scenario and why they are necessary.</QUESTION>
        <SOLUTION>For a constraint like $2x_1 + 3x_2 - s_1 = 10$ or $2x_1 + 3x_2 \geq 10$, we can't treat the added variable ($s_1$) as a "slack" that is automatically the BFS. Instead, we add an artificial variable $a_1$ to rewrite it as $2x_1 + 3x_2 - s_1 + a_1 = 10$.
        The artificial variable $a_1$ starts as the basic variable with value $10$. Phase I attempts to drive $a_1$ to zero (if feasible). If $a_1$ remains positive in the best solution, it signals infeasibility.</SOLUTION>
        
        <RUBRIC><STANDARD Artificial Variables><POINT 1>For explaining how artificial variables are introduced when no obvious BFS is available.</POINT><POINT 1>For correctly describing how artificial variables are added (especially with "$\geq$" or "$=$" constraints).</POINT><POINT 1>For explaining why artificial variables need to be driven to zero in Phase I.</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 6><SLIDE 7><SLIDE 8></LECTURE>
        </PART_B>

        <PART_C>
        <QUESTION>After completing Phase I, you find that the sum of artificial variables is greater than zero at optimality. What conclusion do you draw about the original problem, and why?</QUESTION>
        <SOLUTION>If, after Phase I, the objective (sum of artificial variables) cannot be reduced to zero, it implies that at least one artificial variable remains positive.
        Conclusion: The original problem is infeasible because there is no way to satisfy the constraints (at least one constraint physically cannot be satisfied simultaneously with the others).
        Algebraically, that leftover positive artificial variable is the proof that no feasible solution exists.</SOLUTION>

        <RUBRIC><STANDARD Conclusion if Sum of Artificial Vars > 0><POINT 2>For stating it means the original LP is infeasible.</POINT><POINT 1>For explaining that at least one artificial variable remains positive, violating feasibility.</POINT><POINT 1>For overall clarity in connecting the final value of artificial variables to feasibility.</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 9><SLIDE 12></LECTURE>
        </PART_C>
        </OUTPUT>"""

        multi_part_computational_prompt = f"""IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 multi-part (3 parts) computational practice problem for the {
            "lecture 2024-08-27-ExSimplex" if self.content_type.value == "lecture" else "topic Simplex Method"
        }.""" + """
        OUTPUT: <OUTPUT>
        <PART_A>
        <QUESTION>You are given the following maximization problem:

        $\max z = 4x_1 + x_2$
        subject to:
        $x_1 + x_2 \leq 5$
        $3x_1 + 2x_2 \leq 12$
        $x_1, x_2 \geq 0$
        
        Set up the initial simplex tableau (including slack variables) and identify the initial basic feasible solution.</QUESTION>
        <SOLUTION>Rewrite constraints with slack variables $s_1$ and $s_2$:

        $x_1 + x_2 + s_1 = 5$
        $3x_1 + 2x_2 + s_2 = 12$

        Initial BFS: $(x_1, x_2, s_1, s_2) = (0, 0, 5, 12)$

        Objective: $\max z = 4x_1 + x_2$. Typically, the "$-z$" row is $-z + 4x_1 + x_2 = 0$ in the tableau.

        Initial Tableau (schematically):

        $\begin{array}{c|cccc|c}
        & x_1 & x_2 & s_1 & s_2 & \text{RHS} \\
        \hline
        \text{Row 1} & 1 & 1 & 1 & 0 & 5 \\
        \text{Row 2} & 3 & 2 & 0 & 1 & 12 \\
        -z & -4 & -1 & 0 & 0 & 0
        \end{array}$
        </SOLUTION>

        <RUBRIC><STANDARD Correct Setup><POINT 1>For correctly rewriting constraints with slack variables $s_1, s_2$.</POINT><POINT 1>For stating the initial BFS $(x_1, x_2, s_1, s_2) = (0, 0, 5, 12)$.</POINT><POINT 1>For correctly writing the objective function in a form suitable for the tableau (e.g., $-z + 4x_1 + x_2 = 0$).</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>
        </PART_A>
        <PART_B>
        <QUESTION>Perform one pivot (select entering and leaving variables) and update the tableau to get the new BFS. Show your calculations.</QUESTION>
        <SOLUTION>
        Entering Variable: Look at the most negative entry in the objective row: $-4$ (for $x_1$) is more negative than $-1$ (for $x_2$). So, $x_1$ enters.

        Ratio Test (for leaving variable):

        Row 1: $\frac{5}{1} = 5$
        Row 2: $\frac{12}{3} = 4$
        The smaller ratio is $4$, so Row 2 is pivot row. Thus, $s_2$ leaves.
        Pivot on the element in Row 2, Column $x_1$ (which is "3").

        Update Row 2 (pivot row) by dividing by 3:

        $x_1 + \frac{2}{3}x_2 + \frac{1}{3}s_2 = 4$

        Use Row Operations to eliminate $x_1$ in Row 1 and the $-4$ in the $-z$ row. Details (omitted for brevity) yield the new BFS. Let's say after pivot, the new BFS is $(x_1=4, x_2=0, s_1=1, s_2=0)$.
        </SOLUTION>

        <RUBRIC><STANDARD One Pivot Step><POINT 1>For identifying the pivot column (most negative in the $-z$ row).</POINT><POINT 1>For ratio test on each row and picking the correct pivot row.</POINT><POINT 1>For correct row operations to pivot.</POINT><POINT 1>For stating the updated BFS (which variable replaced which slack).</POINT></STANDARD></RUBRIC>
        <LECTURE 1><SLIDE 6><SLIDE 7><SLIDE 8></LECTURE>
        </PART_B>
        <PART_C>
        <QUESTION>Check if the solution is optimal. If not, describe which variable(s) can still enter the basis and how you would proceed.</QUESTION>
        <SOLUTION>
        Look at the new objective row. If there is still a negative coefficient, the solution is not optimal. For instance, if $x_2$ has a negative coefficient after updating, you can still pivot to improve the objective.

        If all coefficients in the objective row are $\geq 0$ (for a max problem in standard form with the $-z$ row), you have found the optimal solution.

        In many cases, after the first pivot, you might see a $-1$ or $-\frac{2}{3}$ for $x_2$ in the objective row, indicating you can bring $x_2$ in next. You'd do another iteration, repeating the ratio test, etc., until no negative coefficients remain.
        </SOLUTION>

        <RUBRIC>
        <STANDARD Optimality Check>
        <POINT 1>For verifying if any negative coefficients remain in the objective row.</POINT>
        <POINT 1>For concluding whether the BFS is optimal or not.</POINT>
        <POINT 1>For describing the next step (e.g., pivot again if negative coefficients remain).</POINT>
        </STANDARD>
        </RUBRIC>
        <LECTURE 1><SLIDE 9><SLIDE 11><SLIDE 12></LECTURE>
        </PART_C>
        </OUTPUT>"""

        self.single_part_conceptual_prompt = f"{self.base_question_prompt}\n{self.quality_prompt}\n{single_part_prompt}\n{single_part_conceptual_prompt}"
        self.single_part_computational_prompt = f"{self.base_question_prompt}\n{self.quality_prompt}\n{single_part_prompt}\n{single_part_computational_prompt}"
        self.multi_part_conceptual_prompt = f"{self.base_question_prompt}\n{self.quality_prompt}\n{multi_part_prompt}\n{multi_part_conceptual_prompt}"
        self.multi_part_computational_prompt = f"{self.base_question_prompt}\n{self.quality_prompt}\n{multi_part_prompt}\n{multi_part_computational_prompt}"

        self.initialize_prompts()

    def initialize_prompts(self) -> None:
        """Initialize prompts based on question type"""
        if self.question_type == QuestionType.MCQ:
            self.initialize_mcq_prompts()
        else:
            self.initialize_frq_prompts()

    async def process_batch(
        self,
        num_questions: int,
        name: str,
        content: str,
        prompt: str
    ) -> str:
        """Process a batch of questions"""
        flat_questions = [
            q["question"]
            for questions in self.questions.values()
            for group in questions
            for q in group
        ]
        flat_questions_str = "\n".join(flat_questions)

        message = HumanMessage(content=[
            {"type": "text", "text": prompt},
            {
                "type": "text",
                "text": "The following questions have already been generated. Do not repeat them: " + flat_questions_str
            },
            {
                "type": "text",
                "text": f"You should generate {num_questions} new questions for: {name}. INPUT: {content}\n\nYOUR OUTPUT: "
            }
        ])
        response = await self.robust_generate(message)
        print("RESPONSE: ", response)
        return response

    def clean_result(
        self,
        result: str,
        name: str,
        tags: List[str],
        lectures: List[Dict[str, Union[str, int]]]
    ) -> None:
        """Clean the result based on question type"""
        if self.question_type == QuestionType.MCQ:
            self.clean_mcq_result(result, name, tags, lectures)
        else:
            self.clean_frq_result(result, name, tags, lectures)

    def clean_mcq_result(
        self,
        result: str,
        name: str,
        tags: List[str],
        lectures: List[Dict[str, Union[str, int]]]
    ) -> None:
        """Clean MCQ-specific results"""
        # Remove XML tags if present
        result = result.replace("```xml", "").replace("```", "")
        
        question_blocks = re.findall(r'<OUTPUT>.*?</OUTPUT>', result, re.DOTALL) or []
        
        for block in question_blocks:
            try:
                if "multi-part" in tags:
                    # Handle multi-part questions
                    multi_part_question_obj: List[MCQQuestion] = []
                    
                    # Process each part
                    for letter in ["A", "B", "C"]:
                        part_match = re.search(
                            f'<PART_{letter}>(.*?)</PART_{letter}>',
                            block,
                            re.DOTALL
                        )
                        
                        if part_match:
                            question_obj = self.process_mcq_block(part_match.group(1), tags, lectures)
                            if question_obj:
                                multi_part_question_obj.append(question_obj)
                    
                    # Only add if we have all parts
                    if len(multi_part_question_obj) == 3:
                        if name not in self.questions:
                            self.questions[name] = []
                        self.questions[name].append(multi_part_question_obj)
                else:
                    # Handle single-part questions
                    question_obj = self.process_mcq_block(block, tags, lectures)
                    if question_obj:
                        if name not in self.questions:
                            self.questions[name] = []
                        self.questions[name].append([question_obj])
                        
            except Exception as e:
                print(f"Error processing question block: {str(e)}")

    def clean_frq_result(
        self,
        result: str,
        name: str,
        tags: List[str],
        lectures: List[Dict[str, Union[str, int]]]
    ) -> None:
        """Clean FRQ-specific results"""
        # Remove XML tags if present
        result = result.replace("```xml", "").replace("```", "")
        
        question_blocks = re.findall(r'<OUTPUT>.*?</OUTPUT>', result, re.DOTALL) or []
        
        for block in question_blocks:
            try:
                if "multi-part" in tags:
                    # Handle multi-part questions
                    multi_part_question_obj: List[FRQQuestion] = []
                    
                    # Process each part
                    for letter in ["A", "B", "C"]:
                        part_match = re.search(
                            f'<PART_{letter}>(.*?)</PART_{letter}>',
                            block,
                            re.DOTALL
                        )
                        
                        if part_match:
                            question_obj = self.process_frq_block(part_match.group(1), tags, lectures)
                            if question_obj:
                                multi_part_question_obj.append(question_obj)
                    
                    # Only add if we have all parts
                    if len(multi_part_question_obj) == 3:
                        if name not in self.questions:
                            self.questions[name] = []
                        self.questions[name].append(multi_part_question_obj)
                else:
                    # Handle single-part questions
                    question_obj = self.process_frq_block(block, tags, lectures)
                    if question_obj:
                        if name not in self.questions:
                            self.questions[name] = []
                        self.questions[name].append([question_obj])
                        
            except Exception as e:
                print(f"Error processing question block: {str(e)}")

    def process_mcq_block(
        self,
        block: str,
        tags: List[str],
        lectures: List[Dict[str, Union[str, int]]]
    ) -> Optional[MCQQuestion]:
        """Process MCQ-specific blocks"""
        # Extract question text
        question_match = re.search(r'<QUESTION>(.*?)</QUESTION>', block, re.DOTALL)
        if not question_match:
            return None
        question = question_match.group(1).strip()

        # Extract options
        options: Dict[str, str] = {}
        for opt in ['A', 'B', 'C', 'D', 'E']:
            opt_match = re.search(f'<OPTION_{opt}>(.*?)</OPTION_{opt}>', block, re.DOTALL)
            if opt_match:
                options[opt] = opt_match.group(1).strip()

        # Extract answers and explanations
        answers = {opt: False for opt in ['A', 'B', 'C', 'D', 'E']}
        explanations: Dict[str, str] = {}

        for opt in ['A', 'B', 'C', 'D', 'E']:
            correct_match = re.search(f'<CORRECT_{opt}>(.*?)</CORRECT_{opt}>', block, re.DOTALL)
            incorrect_match = re.search(f'<INCORRECT_{opt}>(.*?)</INCORRECT_{opt}>', block, re.DOTALL)
            
            if correct_match:
                answers[opt] = True
                explanations[opt] = correct_match.group(1).strip()
            elif incorrect_match:
                explanations[opt] = incorrect_match.group(1).strip()

        # Extract lecture and slides information
        lecture_slides: Dict[str, List[int]] = {}
        lecture_matches = re.finditer(r'<LECTURE\s+(\d+)>(.*?)</LECTURE>', block, re.DOTALL)
        
        for match in lecture_matches:
            lecture_number = int(match.group(1).strip())
            lecture_content = match.group(2)
            
            lecture = next((l for l in lectures if l.get('note_number') == lecture_number), None)
            if not lecture:
                continue
            
            slide_numbers = [
                int(num)
                for num in re.findall(r'<SLIDE\s+(\d+)>', lecture_content)
                if num.isdigit()
            ]
            
            if slide_numbers:
                lecture_slides[str(lecture['id'])] = slide_numbers

        return {
            "question": question,
            "options": options,
            "answers": answers,
            "explanations": explanations,
            "tags": tags,
            "slides": lecture_slides
        }

    def process_frq_block(
        self,
        block: str,
        tags: List[str],
        lectures: List[Dict[str, Union[str, int]]]
    ) -> Optional[FRQQuestion]:
        """Process FRQ-specific blocks"""
        # Extract question text
        question_match = re.search(r'<QUESTION>(.*?)</QUESTION>', block, re.DOTALL)
        if not question_match:
            return None
        question = question_match.group(1).strip()

        # Extract solution
        solution_match = re.search(r'<SOLUTION>(.*?)</SOLUTION>', block, re.DOTALL)
        if not solution_match:
            return None
        solution = solution_match.group(1).strip()

        # Extract rubric
        rubric: List[Rubric] = []
        rubric_match = re.search(r'<RUBRIC>(.*?)</RUBRIC>', block, re.DOTALL)

        if rubric_match:
            standard_matches = re.finditer(r'<STANDARD(?:\s+([^>]*))?>(.*?)</STANDARD>', rubric_match.group(1), re.DOTALL)
            
            for match in standard_matches:
                standard_name = match.group(1).strip() if match.group(1) else match.group(2).strip()
                standard_content = match.group(0)
                
                point_matches = re.finditer(r'<POINT\s+(\d+)>(.*?)</POINT>', standard_content, re.DOTALL)
                
                for point_match in point_matches:
                    points = int(point_match.group(1))
                    content = point_match.group(2).strip()
                    
                    rubric.append({
                        "standard": standard_name,
                        "content": content,
                        "points": points
                    })

        # Extract lecture and slides information
        lecture_slides: Dict[str, List[int]] = {}
        lecture_matches = re.finditer(r'<LECTURE\s+(\d+)>(.*?)</LECTURE>', block, re.DOTALL)
        
        for match in lecture_matches:
            lecture_number = int(match.group(1).strip())
            lecture_content = match.group(2)
            
            lecture = next((l for l in lectures if l.get('note_number') == lecture_number), None)
            if not lecture:
                continue
            
            slide_numbers = [
                int(num)
                for num in re.findall(r'<SLIDE\s+(\d+)>', lecture_content)
                if num.isdigit()
            ]
            
            if slide_numbers:
                lecture_slides[str(lecture['id'])] = slide_numbers

        return {
            "question": question,
            "solution": solution,
            "tags": tags,
            "slides": lecture_slides,
            "rubric": rubric
        } 