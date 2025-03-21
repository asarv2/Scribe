from enum import Enum
import re
from typing import TypedDict, Dict, List, Union, Any, Optional, Callable, Awaitable, Tuple
from app.services.base_processor import BaseProcessor, Message
from app.extensions import QUESTIONS_DIR
import os
# from pylatex import Document, Section, Subsection, Command, Package
# from pylatex.base_classes import Container
# from pylatex.utils import NoEscape, bold
# from pylatex.base_classes import Environment

class QuestionPrompt(TypedDict):
    id: str
    mcq: bool
    multi_part: bool
    computational: bool
    additional_info: str

class MCQQuestion(TypedDict):
    id: str
    question: str
    options: Dict[str, str]
    answers: Dict[str, bool]
    explanations: Dict[str, str]
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class FRQQuestion(TypedDict):
    id: str
    question: str
    solution: str
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class ProblemsProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        critical_instructions: str,
        all_content: List[Any],
        lectures: List[Dict[str, Any]],
        chapters: List[Dict[str, Any]],
        homeworks: List[Dict[str, Any]],
        lecture_documents: List[Dict[str, Any]],
        chapter_documents: List[Dict[str, Any]],
        chapter_exercises: List[Dict[str, Any]],
        homework_exercises: List[Dict[str, Any]],
    ):
        super().__init__()
        self.course_title = course_title
        self.critical_instructions = critical_instructions
        self.questions: Dict[str, List[List[Union[MCQQuestion, FRQQuestion]]]] = {}
        self.lectures = lectures
        self.chapters = chapters
        self.homeworks = homeworks
        self.lecture_documents = lecture_documents
        self.chapter_documents = chapter_documents
        self.chapter_exercises = chapter_exercises
        self.homework_exercises = homework_exercises
        self.all_content = all_content

    def initialize_mcq_prompts(self) -> tuple[str, str, str, str]:
        """Initialize MCQ prompts. Will return a tuple of 4 strings, single_part_conceptual_prompt, single_part_computational_prompt, multi_part_conceptual_prompt, multi_part_computational_prompt"""
                # Prompts
        base_question_prompt = f"You are a professor for the class {self.course_title}. You will be given documents from lectures and be asked to generate multiple choice questions for the students to answer. You will have 5 answer choices available, 'A', 'B', 'C', 'D', and 'E'. For each question generated, there can only be one correct answer. If your response contains math symbols, be sure to use LaTeX formatting."

        quality_prompt = f"""To generate questions of the highest quality, here are some guidelines you should follow.
            
            CRITICAL REQUIREMENTS:
            1. This course is a graduate level class, so you will need to generate complex, multi-step questions.
            2. Questions should directly relate to the core content of the material.
            3. Make each explanation complete and self-contained.
            4. Each question should be difficult to answer correctly, if the student is not familiar with the content.
            5. Make sure the questions cover a diverse set of concepts from the material."""

        single_part_prompt = f"""TASK: You will be generating single-part questions to test comprehension of the material. 
        
        WHAT TO DO:
        1. Put the question in <QUESTION> and </QUESTION> tags.
        2. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center.
        3. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. 
        4. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags.
        5. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question.
        6. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations."""

        multi_part_prompt = f"""TASK: You will be generating multi-part questions to test comprehension of the material. 
        
        WHAT TO DO: 
        1. You must generate exactly 3 parts.
        2. Put the part number in <PART_X> and </PART_X> tags, where X is the part number. You must use <PART_A>, <PART_B>, and <PART_C> tags. The part number must be 'A', 'B' or 'C'. 
        3. Put each of the questions in <QUESTION> and </QUESTION> tags.
        4. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center.
        5. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. 
        6. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags.
        7. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations."""


        single_part_conceptual_prompt = """IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 single-part conceptual practice problem for the Simplex Method."
        
        OUTPUT: <OUTPUT><QUESTION>Which statement about degeneracy in the Simplex Method is correct?</QUESTION> <OPTION_A> Degeneracy only happens if the objective function has multiple optimal solutions.</OPTION_A> <OPTION_B>Degeneracy can cause the Simplex Method to cycle, so tie-breaking rules (like Bland's rule) may be needed.</OPTION_B> <OPTION_C>Once the Simplex Method encounters a degenerate BFS, it automatically concludes the solution is optimal.</OPTION_C> <OPTION_D>Degeneracy can never occur if all right-hand side constants are strictly positive.</OPTION_D> <OPTION_E>Degeneracy only appears in minimization problems, not in maximization.</OPTION_E> <CORRECT_B>In degenerate solutions, more constraints are active at a corner than strictly necessary, which can cause zero steps in objective improvement and lead the algorithm to revisit the same BFS (cycling). Anti-cycling pivot rules help avoid infinite loops.</CORRECT_B> <INCORRECT_A>Multiple optimal solutions can occur even without degeneracy in the BFS. Likewise, degeneracy can occur in problems that do not have multiple optima. They are different concepts.</INCORRECT_A> <INCORRECT_C>A degenerate BFS does not guarantee optimality. It simply means a basic variable is zero or multiple constraints are active at the same vertex.</INCORRECT_C> <INCORRECT_D>You can have degeneracy even if all RHS values are positive, for example if constraints intersect in such a way that multiple constraints are tight at the same point. Strict positivity of RHS does not rule out degeneracy.</INCORRECT_D> <INCORRECT_E>Degeneracy can arise in both minimization and maximization problems; it's an artifact of geometry (multiple constraints meeting at a corner in certain ways), not the direction of optimization.</INCORRECT_E></OUTPUT><LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>"""
        
        single_part_computational_prompt = """IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 single-part computational practice problem for the Simplex Method."
        
        OUTPUT: <OUTPUT><QUESTION>Consider the following maximization problem: $\max z = 3x_1 + 5x_2$ subject to:
        $\begin{align*}
        2x_1 + 3x_2 &\leq 6 \\
        x_1 + x_2 &\leq 4 \\
        x_1, x_2 &\geq 0
        \end{align*}$

        You introduce slack variables $s_1$ and $s_2$ to convert the constraints into equalities:
        $\begin{align*}
        2x_1 + 3x_2 + s_1 &= 6 \\
        x_1 + x_2 + s_2 &= 4
        \end{align*}$

        Initial Basic Feasible Solution (BFS): $x_1 = x_2 = 0$, $s_1 = 6$, $s_2 = 4$.

        After forming the initial simplex tableau, we ask: which pivot column and pivot row would be chosen for the first pivot (using the "most negative entry in the objective row" rule for entering variable, and the minimum ratio test for leaving variable)? 
        Which is the correct pivot choice?</QUESTION> <OPTION_A>Enter $x_1$ (pivot column), leave $s_1$.</OPTION_A> <OPTION_B>Enter $x_1$ (pivot column), leave $s_2$.</OPTION_B> <OPTION_C>Enter $x_2$ (pivot column), leave $s_1$.</OPTION_C> <OPTION_D>Enter $x_2$ (pivot column), leave $s_2$.</OPTION_D> <OPTION_E>Skip pivoting altogether since the BFS is already optimal.</OPTION_E> <CORRECT_B>If the objective row indicates $x_1$ as the best variable to enter (most negative coefficient) and the ratio test indicates $s_2$ leaves first, this is the correct pivot choice.</CORRECT_B> <INCORRECT_A>Entering $x_1$ and leaving $s_1$ might be incorrect if the ratio test (i.e., $\min\{(\text{RHS})/(\text{coefficient in pivot column})\}$) indicates that $s_2$ has the smaller ratio, meaning $s_2$ hits zero first as $x_1$ increases.</INCORRECT_A> <INCORRECT_C>Entering $x_2$ could be correct if $x_2$ had the most negative objective coefficient, but in our hypothetical calculations, we assume $x_1$'s coefficient is more negative. Also, the ratio test might not single out $s_1$ if it doesn't yield the smallest ratio.</INCORRECT_C> <INCORRECT_D>Same rationale as in (C): it might happen if the numbers align that way, but we are positing a scenario where $x_1$ is chosen.</INCORRECT_D> <INCORRECT_E>The BFS $(x_1=0,x_2=0,s_1=6,s_2=4)$ is feasible, but the objective row has negative coefficients for $x_1$ or $x_2$, meaning we can improve the objective. We do not skip pivoting in that case.</INCORRECT_E></OUTPUT><LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>
        """
        multi_part_conceptual_prompt = """IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 multi-part (3 parts) conceptual practice problem for the Simplex Method."
        
        OUTPUT: 
        <OUTPUT>
        <PART_A>
        <QUESTION>You are given a linear program in the following standard form for maximization:
        $\max z = c_1x_1 + c_2x_2 + \cdots + c_nx_n$

        subject to:
        $\begin{align*}
        a_{11}x_1 + a_{12}x_2 + \cdots + a_{1n}x_n &\leq b_1 \\
        a_{21}x_1 + a_{22}x_2 + \cdots + a_{2n}x_n &\leq b_2 \\
        &\vdots \\
        a_{m1}x_1 + a_{m2}x_2 + \cdots + a_{mn}x_n &\leq b_m \\
        x_j &\geq 0 \quad (j=1,\ldots,n)
        \end{align*}$

        Which statement is correct regarding how we set up the initial Simplex tableau?</QUESTION>
        <OPTION_A>We use slack variables to convert each "$\leq$" constraint into an equality and treat those slack variables as basic variables initially.</OPTION_A> 
        <OPTION_B>We immediately add artificial variables to all constraints, even if they are "$\leq$" type.</OPTION_B> 
        <OPTION_C>We only add surplus variables to "$\leq$" constraints, and never use slack variables.</OPTION_C> 
        <OPTION_D>We do not need slack, surplus, or artificial variables if $b_i > 0$ for all $i$.</OPTION_D> 
        <OPTION_E>We write the constraints as "$=$" by subtracting slack variables (since it's a maximization problem).</OPTION_E>
        <CORRECT_A>For each "$\leq$" constraint in standard form, we typically add a slack variable to convert it into an equality. These slack variables start as the basic variables in the initial BFS.</CORRECT_A> 
        <INCORRECT_B>Artificial variables are only added when a straightforward BFS is not easily available (e.g., in "$\geq$" or "$=$" constraints). For "$\leq$" constraints with positive $b_i$, slack variables suffice for an initial solution.</INCORRECT_B> 
        <INCORRECT_C>Surplus variables appear in "$\geq$" constraints, not in "$\leq$" constraints.</INCORRECT_C> 
        <INCORRECT_D>Even if $b_i > 0$, we must introduce slack variables for each "$\leq$" constraint to get an initial basic solution.</INCORRECT_D>
        <INCORRECT_E>In a maximization standard form, we add slack variables (not subtract them). Sometimes you'll see it written as "$\leq \rightarrow +s_i =$", but it's never done by subtracting slack variables for "$\leq$" constraints.</INCORRECT_E></PART_A>
        
        <PART_B>
        <QUESTION>Suppose you actually have a mixture of constraints: some are "$\geq$" and others are "$\leq$". You cannot find an obvious initial basic feasible solution. You decide to use the Two-Phase Simplex Method. Which statement is true regarding Phase I?</QUESTION> 
        <OPTION_A>In Phase I, we keep the original objective function and solve the LP as-is.</OPTION_A> 
        <OPTION_B>In Phase I, we minimize the sum of all artificial variables introduced to find a feasible solution.</OPTION_B> 
        <OPTION_C>In Phase I, any artificial variables that appear must remain in the final basis for Phase II.</OPTION_C> 
        <OPTION_D>If the sum of artificial variables is minimized to a positive value, we simply proceed to Phase II to fix it.</OPTION_D> 
        <OPTION_E>In Phase I, we maximize the sum of artificial variables because we need them to be as large as possible.</OPTION_E>
        <CORRECT_B>The whole point of Phase I is to find feasibility by driving any artificial variables to zero if possible. That is done by minimizing $\sum(\text{artificial variables})$.</CORRECT_B> 
        <INCORRECT_A>Phase I temporarily replaces the original objective with the objective of minimizing the sum of artificial variables.</INCORRECT_A> 
        <INCORRECT_C>Answer C is incorrect because determining the pivot column is a step in the simplex algorithm, not related to adding slack variables.</INCORRECT_C> 
        <INCORRECT_D>If the minimum sum of artificial variables is not zero, we conclude the problem is infeasible; we do not simply proceed to Phase II with a positive sum.</INCORRECT_D>
        <INCORRECT_E>We do not maximize artificial variables; that would be counter to seeking a feasible solution.</INCORRECT_E>
        
        <PART_C>
        <QUESTION>After successfully completing Phase I (you found a feasible solution with all artificial variables at zero), you move to Phase II and restore the original objective function (maximization). However, you notice that several constraints in the new Phase II tableau have degenerate basic feasible solutions. Which of the following statements is correct regarding degeneracy?</QUESTION> 
        <OPTION_A>Degeneracy means the solution is automatically optimal.</OPTION_A> 
        <OPTION_B>Degeneracy can lead to cycling, so we may need tie-breaking rules like Bland's rule.</OPTION_B> 
        <OPTION_C>Degeneracy only occurs in minimization problems, not in maximization.</OPTION_C> 
        <OPTION_D>If the BFS is degenerate, the LP is definitely unbounded.</OPTION_D> 
        <OPTION_E>Degeneracy in Phase II implies the original problem has no feasible solution.</OPTION_E>
        <CORRECT_B>Degeneracy can cause the Simplex Method to get "stuck" pivoting among the same BFS or revert to it later, a phenomenon called cycling. Bland's rule is one well-known technique to avoid cycling.</CORRECT_B> 
        <INCORRECT_A>A degenerate BFS is not necessarily optimal; it simply indicates that more constraints are binding than the dimension requires (some basic variable(s) might be zero).</INCORRECT_A> 
        <INCORRECT_C>Degeneracy can arise in any linear program, regardless of whether it's min or max.</INCORRECT_C> 
        <INCORRECT_D>A degenerate BFS does not imply unboundedness. It just means a corner (vertex) of the feasible region is formed by multiple intersecting constraints.</INCORRECT_D>
        <INCORRECT_E>If you completed Phase I successfully, you have feasibility. A degenerate BFS does not negate that.</INCORRECT_E></PART_C></OUTPUT><LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>"""
        multi_part_computational_prompt = """IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 multi-part computational practice problem for the Simplex Method."
        
        OUTPUT: 
        <OUTPUT>
        <PART_A>
        <QUESTION>Consider the following maximization problem:

        $\begin{align*}
        \text{maximize} \quad z &= 2x_1 + 3x_2 \\
        \text{subject to:} \quad x_1 + 2x_2 &\leq 8 \\
        2x_1 + x_2 &\leq 8 \\
        x_1, x_2 &\geq 0
        \end{align*}$

        We introduce slack variables $s_1$ and $s_2$ to rewrite constraints as equalities:

        $\begin{align*}
        x_1 + 2x_2 + s_1 &= 8 \\
        2x_1 + x_2 + s_2 &= 8
        \end{align*}$

        Initial BFS is $(x_1,x_2)=(0,0)$ with $s_1=8$ and $s_2=8$. 
        
        You form the initial Simplex tableau. Let's say the objective row (sometimes written as the $-z$ row for convenience) has coefficients reflecting $-2x_1$ and $-3x_2$, and zero for slack variables. Which statement correctly describes how to pick the entering variable (pivot column) in the first iteration? </QUESTION>
        <OPTION_A>Pick $s_1$ because it has a positive coefficient in the objective row.</OPTION_A> 
        <OPTION_B>Pick $s_2$ because it started as a basic variable.</OPTION_B> 
        <OPTION_C>Pick $x_1$ if its coefficient in the objective row is more negative than $x_2$'s</OPTION_C> 
        <OPTION_D>Always pick $x_2$ in a maximization problem.</OPTION_D> 
        <OPTION_E>Skip pivoting if both $x_1$ and $x_2$ have negative coefficients.</OPTION_E>
        <CORRECT_C>Correct approach: among the nonbasic variables ($x_1$ and $x_2$), pick the one with the most negative coefficient in the objective row.</CORRECT_C> 
        <INCORRECT_A>We do not pick slack variables to improve the objective if they have a zero coefficient in the objective row. Typically, their coefficients remain zero; we pick the variable that can improve the objective.</INCORRECT_A> 
        <INCORRECT_B>That's reversed: we don't pick a basic variable to enter. We look at the nonbasic variables.</INCORRECT_B> 
        <INCORRECT_D>We do not always pick $x_2$. We compare the objective coefficients at each iteration.</INCORRECT_D>
        <INCORRECT_E>If both are negative, that actually implies we can improve the objective (since negative in the $-z$ row for a maximization problem means an improvement direction). We do not skip pivoting if at least one is negative.</INCORRECT_E></PART_A>
        
        <PART_B>
        <QUESTION>Assume the entering variable is $x_2$. Next, you perform the minimum ratio test to determine the leaving variable from $\{s_1, s_2\}$. Suppose the ratio test yields:

        $\frac{8}{2} = 4$ (for $s_1$), $\frac{8}{1} = 8$ (for $s_2$).

        Which statement is correct?</QUESTION> 
        <OPTION_A>$s_2$ has the smaller ratio and leaves the basis.</OPTION_A> 
        <OPTION_B>Since $4 < 8$, we pick $s_1$ to leave the basis.</OPTION_B> 
        <OPTION_C>We remove whichever slack variable started with the larger numeric value.</OPTION_C> 
        <OPTION_D>We do not pivot because both ratios are positive.</OPTION_D> 
        <OPTION_E>Let $x_2$ replace both $s_1$ and $s_2$ simultaneously since it's feasible to do so.</OPTION_E>
        <CORRECT_B>Indeed, $s_1$ leaves because $8/2=4$ is less than $8/1=8$.</CORRECT_B> 
        <INCORRECT_A>In a minimum ratio test, the variable associated with the smallest positive ratio leaves. That's $4$ (not $8$).</INCORRECT_A> 
        <INCORRECT_C>The ratio test is not about whichever slack variable has the bigger or smaller starting value—it depends on the ratio of right-hand side to the pivot-column coefficient.</INCORRECT_C> 
        <INCORRECT_D>Both ratios being positive means we do have a valid pivot row. We must pivot because the objective can be improved.</INCORRECT_D>
        <INCORRECT_E>Only one basic variable leaves at a time. $x_2$ replaces one slack in the basis.</INCORRECT_E></PART_B>
        
        <PART_C>
        <QUESTION>After pivoting, you update the tableau. Now the basis is $\{x_2, s_2\}$. Suppose the new BFS from the pivot is:

        $x_2 = 4, s_2 = 4, x_1 = 0, s_1 = 0$

        You look at the new objective row and find that $x_1$ has a $-2$ coefficient (still negative), meaning you can potentially improve the objective further by introducing $x_1$. Which statement is correct for the next pivot?</QUESTION> 
        <OPTION_A>Pick $x_1$ as entering variable, then do another ratio test among $\{x_2, s_2\}$</OPTION_A> 
        <OPTION_B>Once a slack variable has left the basis, it cannot re-enter.</OPTION_B> 
        <OPTION_C>We cannot pivot on $x_1$ because it is zero in the BFS.</OPTION_C> 
        <OPTION_D>If $x_1$ is negative in the objective row, it implies the problem is infeasible.</OPTION_D> 
        <OPTION_E>Because $x_2$ and $s_2$ are in the basis, we never consider changing them again.</OPTION_E>
        <CORRECT_A>Having a negative reduced cost for $x_1$ in a maximization problem means we can further improve by bringing $x_1$ into the basis. We then do the ratio test among the basic variables to see who leaves.</CORRECT_A> 
        <INCORRECT_B>Slack variables can leave or re-enter the basis multiple times. There's no rule preventing nonbasic variables from re-entering.</INCORRECT_B> 
        <INCORRECT_C>A variable being zero in the BFS is exactly how we typically identify a nonbasic variable that might enter.</INCORRECT_C> 
        <INCORRECT_D>A negative coefficient in the $-z$ row does not imply infeasibility; it implies an opportunity to increase the objective.</INCORRECT_D>
        <INCORRECT_E>The entire point of the Simplex algorithm is that the basis can change iteration by iteration. We absolutely consider pivoting further if there is any negative cost in the objective row.</INCORRECT_E></OUTPUT><LECTURE 1><SLIDE 7><SLIDE 8><SLIDE 9><SLIDE 10><SLIDE 11></LECTURE></PART_C>"""


        return f"{base_question_prompt}\n{quality_prompt}\n{single_part_prompt}\n{single_part_conceptual_prompt}", f"{base_question_prompt}\n{quality_prompt}\n{single_part_prompt}\n{single_part_computational_prompt}", f"{base_question_prompt}\n{quality_prompt}\n{multi_part_prompt}\n{multi_part_conceptual_prompt}", f"{base_question_prompt}\n{quality_prompt}\n{multi_part_prompt}\n{multi_part_computational_prompt}"

    def initialize_frq_prompts(self) -> None:
        """Initialize FRQ prompts. Will return a tuple of 4 strings, single_part_conceptual_prompt, single_part_computational_prompt, multi_part_conceptual_prompt, multi_part_computational_prompt"""
        
        base_question_prompt = f"You are a professor for the class {self.course_title}. You will be given documents from lectures and be asked to generate free response questions for the students to answer. You should provide step by step reasoning for the answer. If your response contains math symbols, be sure to use LaTeX formatting."

        quality_prompt = f"""To generate questions of the highest quality, here are some guidelines you should follow.
            
            CRITICAL REQUIREMENTS:
            1. This course is a graduate level class, so you will need to generate complex, multi-step questions.
            2. Questions should directly relate to the core content of the material.
            3. Make each explanation complete and self-contained.
            4. Each question should be difficult to answer correctly, if the student is not familiar with the content.
            5. Make sure the questions cover a diverse set of concepts from the material."""

        single_part_prompt = f"""TASK: You will be generating single-part questions to test comprehension of the material. 
        
        WHAT TO DO:
        1. Put the question in <QUESTION> and </QUESTION> tags.
        2. Put the solution in <SOLUTION> and </SOLUTION> tags.
        3. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question and solution."""

        multi_part_prompt = f"""TASK: You will be generating multi-part questions to test comprehension of the material. 
        
        WHAT TO DO:
        1. You must generate exactly 3 parts.
        2. Put each of the questions in <QUESTION> and </QUESTION> tags.
        3. Put the solution in <SOLUTION> and </SOLUTION> tags.
        4. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question and solution."""


        single_part_conceptual_prompt = f"""IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 single-part conceptual practice problem for the Simplex Method.

        OUTPUT: <OUTPUT><QUESTION>Explain how degeneracy can lead to cycling in the Simplex Method, and name at least one strategy (or pivot rule) used to avoid cycling. Provide a concise but thorough explanation, using geometric and algebraic reasoning to illustrate your answer.</QUESTION>

        <SOLUTION>Definition of Degeneracy\nA Basic Feasible Solution (BFS) is degenerate if at least one of the basic variables is zero. Equivalently, more constraints are "active" at the same vertex of the feasible region than strictly necessary.\nIn geometric terms, degeneracy happens when multiple edges (or faces) of the feasible region intersect at a single point, potentially causing more constraints than needed to be tight at a vertex.\nHow Degeneracy Can Cause Cycling\nIn a non-degenerate iteration, each pivot typically improves the objective (or at least changes the BFS). In a degenerate situation, it is possible to pivot from one BFS to another BFS that has exactly the same objective value—and possibly even the same BFS if the pivot reintroduces the identical set of basic variables in a different order. Algebraically, a zero basic variable might remain at zero after a pivot step if the entering variable does not actually change in value (due to ratio tests matching up in a way that yields no net change). When this happens repeatedly, the Simplex Method might "cycle" through a sequence of BFSs (or effectively come back to the same BFS configuration), preventing forward progress.\nAnti-Cycling Strategies\nBland's Rule: Pick the entering and leaving variables by the smallest index among the candidates, which guarantees the algorithm will not cycle.\nOther strategies include Lexicographic ordering, Perturbation methods, etc.\nFinal Summary\nDegeneracy is not uncommon and doesn't always lead to cycling, but it can. \nHow Degeneracy Can Cause Cycling. In a non-degenerate iteration, each pivot typically improves the objective (or at least changes the BFS). In a degenerate situation, it is possible to pivot from one BFS to another BFS that has exactly the same objective value—and possibly even the same BFS if the pivot reintroduces the identical set of basic variables in a different order. Algebraically, a zero basic variable might remain at zero after a pivot step if the entering variable does not actually change in value (due to ratio tests matching up in a way that yields no net change). When this happens repeatedly, the Simplex Method might "cycle" through a sequence of BFSs (or effectively come back to the same BFS configuration), preventing forward progress. Anti-Cycling Strategies\nBland's Rule: Pick the entering and leaving variables by the smallest index among the candidates, which guarantees the algorithm will not cycle. Other strategies include Lexicographic ordering, Perturbation methods, etc.\nFinal Summary\nDegeneracy is not uncommon and doesn't always lead to cycling, but it can. Pivot rules that systematically break ties (like Bland's rule) ensure eventual progress toward an optimal solution.</SOLUTION>
        </OUTPUT><LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>"""

        single_part_computational_prompt = """IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 single-part computational practice problem for the Simplex Method.
        
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

        </OUTPUT><LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>"""
        
        multi_part_conceptual_prompt = """IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 multi-part (3 parts) conceptual practice problem for the Simplex Method.
        
        OUTPUT: <OUTPUT>
        <PART_A>
        <QUESTION>You are studying a minimization problem in standard form, but the constraints are "$\geq$" type. You decide to use the Two-Phase Simplex Method. Describe the purpose of Phase I in the Two-Phase Simplex Method, specifically when constraints are of the form "$\geq$."</QUESTION><SOLUTION>Phase I is used to find any feasible solution when it's not obvious how to construct an initial BFS. 
        
        In particular, for "$\geq$" constraints (or "$=$" constraints), the usual trick of adding slack variables does not yield an immediate BFS. Instead, we add artificial variables to create a system we can solve easily as the initial step.
        The objective in Phase I is to minimize the sum of these artificial variables, ideally driving them all to zero, proving feasibility.</SOLUTION>
        </PART_A>

        <PART_B>
        <QUESTION>Explain how artificial variables are introduced in this scenario and why they are necessary.</QUESTION>
        <SOLUTION>For a constraint like $2x_1 + 3x_2 - s_1 = 10$ or $2x_1 + 3x_2 \geq 10$, we can't treat the added variable ($s_1$) as a "slack" that is automatically the BFS. Instead, we add an artificial variable $a_1$ to rewrite it as $2x_1 + 3x_2 - s_1 + a_1 = 10$.
        The artificial variable $a_1$ starts as the basic variable with value $10$. Phase I attempts to drive $a_1$ to zero (if feasible). If $a_1$ remains positive in the best solution, it signals infeasibility.</SOLUTION>
        
        </PART_B>

        <PART_C>
        <QUESTION>After completing Phase I, you find that the sum of artificial variables is greater than zero at optimality. What conclusion do you draw about the original problem, and why?</QUESTION>
        <SOLUTION>If, after Phase I, the objective (sum of artificial variables) cannot be reduced to zero, it implies that at least one artificial variable remains positive.
        Conclusion: The original problem is infeasible because there is no way to satisfy the constraints (at least one constraint physically cannot be satisfied simultaneously with the others).
        Algebraically, that leftover positive artificial variable is the proof that no feasible solution exists.</SOLUTION>

        </PART_C>
        </OUTPUT><LECTURE 1><SLIDE 9><SLIDE 12></LECTURE>"""

        multi_part_computational_prompt = """IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process. Here is a full example output, generating 1 multi-part (3 parts) computational practice problem for the Simplex Method.
        
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

        </PART_B>
        <PART_C>
        <QUESTION>Check if the solution is optimal. If not, describe which variable(s) can still enter the basis and how you would proceed.</QUESTION>
        <SOLUTION>
        Look at the new objective row. If there is still a negative coefficient, the solution is not optimal. For instance, if $x_2$ has a negative coefficient after updating, you can still pivot to improve the objective.

        If all coefficients in the objective row are $\geq 0$ (for a max problem in standard form with the $-z$ row), you have found the optimal solution.

        In many cases, after the first pivot, you might see a $-1$ or $-\frac{2}{3}$ for $x_2$ in the objective row, indicating you can bring $x_2$ in next. You'd do another iteration, repeating the ratio test, etc., until no negative coefficients remain.
        </SOLUTION>

        </PART_C>
        </OUTPUT><LECTURE 1><SLIDE 9><SLIDE 11><SLIDE 12></LECTURE>"""

        return f"{base_question_prompt}\n{quality_prompt}\n{single_part_prompt}\n{self.critical_instructions}\n{single_part_conceptual_prompt}\n", f"{base_question_prompt}\n{quality_prompt}\n{single_part_prompt}\n{self.critical_instructions}\n{single_part_computational_prompt}\n", f"{base_question_prompt}\n{quality_prompt}\n{multi_part_prompt}\n{self.critical_instructions}\n{multi_part_conceptual_prompt}\n", f"{base_question_prompt}\n{quality_prompt}\n{multi_part_prompt}\n{self.critical_instructions}\n{multi_part_computational_prompt}\n"


    async def process_batch(
        self,
        question_id: str,
        content: str,
        prompt: str,
        additional_info: str
    ) -> str:
        """Process a batch of questions"""
        try:
            flat_questions = [
                q["question"]
                for questions in self.questions.values()
                for group in questions
                for q in group
            ]
            flat_questions_str = "\n".join(flat_questions)

            system_message = prompt + "\n\nVERY IMPORTANT: Follow these additonal instructions in the generation of the problems: " + additional_info

            message = Message(content=[
                {
                    "type": "text",
                    "text": "The following questions have already been generated. Do not repeat them: " + flat_questions_str
                },
                {
                    "type": "text", 
                    "text": f"You should generate 1 new question. INPUT: {content}\n\nYOUR OUTPUT: "
                }
            ])

            # save input prompt to .txt file in questions folder
            with open(os.path.join(QUESTIONS_DIR, f"{question_id}.txt"), "w") as f:
                f.write("SYSTEM PROMPT: " + system_message + "\n\n" + "INPUT PROMPT: " + prompt)
            
            # Use a faster model with higher RPM
            response = await self.robust_generate(system_message, message, model="gemini-2.0-flash-lite")
            print(f"Successfully generated response for {question_id}")
            return response
            
        except Exception as e:
            print(f"Error in process_batch: {str(e)}")
            raise

    def clean_result(
        self,
        question_id: str,
        question_type: str,
        result: str,
        tags: List[str],
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],
        figures: List[str]
    ) -> None:
        """Clean the result based on question type"""
        if question_type == "mcq":
            self.clean_mcq_result(question_id, result, tags, lecture_references, chapter_references, chapter_exercise_references, homework_exercise_references, figures)
        else:
            self.clean_frq_result(question_id, result, tags, lecture_references, chapter_references, chapter_exercise_references, homework_exercise_references, figures)

    def clean_mcq_result(
        self,
        question_id: str,
        result: str,
        tags: List[str],
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],
        figures: List[str]
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
                            question_obj = self.process_mcq_block(question_id, part_match.group(1), tags, lecture_references, chapter_references, chapter_exercise_references, homework_exercise_references, figures)
                            if question_obj:
                                multi_part_question_obj.append(question_obj)
                    
                    # Only add if we have all parts
                    if len(multi_part_question_obj) == 3:
                        if question_id not in self.questions:
                            self.questions[question_id] = []
                        self.questions[question_id].append(multi_part_question_obj)
                else:
                    # Handle single-part questions
                    question_obj = self.process_mcq_block(question_id, block, tags, lecture_references, chapter_references, chapter_exercise_references, homework_exercise_references, figures)
                    if question_obj:
                        if question_id not in self.questions:
                            self.questions[question_id] = []
                        self.questions[question_id].append([question_obj])
                        
            except Exception as e:
                print(f"Error processing question block: {str(e)}")

    def clean_frq_result(
        self,
        question_id: str,
        result: str,
        tags: List[str],
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],
        figures: List[str]
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
                            question_obj = self.process_frq_block(question_id, part_match.group(1), tags, lecture_references, chapter_references, chapter_exercise_references, homework_exercise_references, figures)
                            if question_obj:
                                multi_part_question_obj.append(question_obj)
                    
                    # Only add if we have all parts
                    if len(multi_part_question_obj) == 3:
                        if question_id not in self.questions:
                            self.questions[question_id] = []
                        self.questions[question_id].append(multi_part_question_obj)
                else:
                    # Handle single-part questions
                    question_obj = self.process_frq_block(question_id, block, tags, lecture_references, chapter_references, chapter_exercise_references, homework_exercise_references, figures)
                    if question_obj:
                        if question_id not in self.questions:
                            self.questions[question_id] = []
                        self.questions[question_id].append([question_obj])
                        
            except Exception as e:
                print(f"Error processing question block: {str(e)}")

    def process_mcq_block(
        self,
        question_id: str,
        block: str,
        tags: List[str],
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],
        figures: List[str]
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

        return {
            "id": question_id,
            "question": question,
            "options": options,
            "answers": answers,
            "explanations": explanations,
            "tags": tags,
            "lecture_references": lecture_references,
            "chapter_references": chapter_references,
            "chapter_exercise_references": chapter_exercise_references,
            "homework_exercise_references": homework_exercise_references,
            "figures": figures
        }

    def process_frq_block(
        self,
        question_id: str,
        block: str,
        tags: List[str],
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],
        figures: List[str]
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

        return {
            "id": question_id,
            "question": question,
            "solution": solution,
            "tags": tags,
            "lecture_references": lecture_references,
            "chapter_references": chapter_references,
            "chapter_exercise_references": chapter_exercise_references,
            "homework_exercise_references": homework_exercise_references,
            "figures": figures
        }

    async def process_problems(
        self,
        question_prompts: List[QuestionPrompt],
        clean_figures_and_references: Callable[[Any], Any] = None,
        on_batch_complete: Callable[[List[List[Union[MCQQuestion, FRQQuestion]]]], Awaitable[None]] = None
    ) -> Dict[str, List[List[Union[MCQQuestion, FRQQuestion]]]]:
        """Process problems for lectures"""
        
        print(f"Generating {len(question_prompts)} questions")

        mcq_prompts = self.initialize_mcq_prompts()
        frq_prompts = self.initialize_frq_prompts()

        for question_prompt in question_prompts:
            question_id = question_prompt.get('id')
            
            tags = []
            prompt = None
            if question_prompt.get('computational') and question_prompt.get('multi_part'):
                tags.append('computational')
                tags.append('multi-part')
                if question_prompt.get('mcq'):
                    prompt = mcq_prompts[3]
                else:
                    prompt = frq_prompts[3]
            elif question_prompt.get('computational'):
                tags.append('computational')
                if question_prompt.get('mcq'):
                    prompt = mcq_prompts[1]
                else:
                    prompt = frq_prompts[1]
            elif not question_prompt.get('computational') and question_prompt.get('multi_part'):
                tags.append('conceptual')
                tags.append('multi-part')
                if question_prompt.get('mcq'):
                    prompt = mcq_prompts[2]
                else:
                    prompt = frq_prompts[2]
            elif not question_prompt.get('computational'):
                tags.append('conceptual')
                if question_prompt.get('mcq'):
                    prompt = mcq_prompts[0]
                else:
                    prompt = frq_prompts[0]

            if prompt:
                print(f"Generating 1 {tags} question")
            else:
                print(f"No prompt found for {tags}")
                continue

            result = await self.process_batch(
                    question_id,
                    "\n".join(self.all_content),
                    prompt,
                    question_prompt.get('additional_info')
                )
            
            # clean the result, get the figures and references, of type ChatMessage
            figures_and_references = clean_figures_and_references(result, self.lectures, self.chapters, self.homeworks, self.lecture_documents, self.chapter_documents, self.chapter_exercises, self.homework_exercises)

            print(f"Figures and references: {figures_and_references}")

            self.clean_result(
                question_id, 
                "mcq" if question_prompt.get('mcq') else "frq", 
                figures_and_references['response'], 
                tags, 
                figures_and_references['lecture_references'], 
                figures_and_references['chapter_references'], 
                figures_and_references['chapter_exercise_references'], 
                figures_and_references['homework_exercise_references'], 
                figures_and_references['figures']
            )

            if on_batch_complete:
                await on_batch_complete(self.questions[question_id])

        return self.questions  # Return all questions, not just the last one

    # Add a method to convert the questions to a JSON-friendly format
    def to_json(self) -> Dict:
        """Convert the questions to a JSON-friendly format"""
        result = {}
        for question_id, question_groups in self.questions.items():
            result[question_id] = []
            for group in question_groups:
                group_json = []
                for question in group:
                    question_json = dict(question)
                    group_json.append(question_json)
                result[question_id].append(group_json)
        return result

    # Add a method to export the questions to a JSON file
    def export_to_json(self, filename: str) -> None:
        """Export the questions to a JSON file"""
        import json
        with open(filename, 'w') as f:
            json.dump(self.to_json(), f, indent=2)


    # # Common utility methods
    # def format_url_for_latex(self, url: str) -> str:
    #     """
    #     Format URL for LaTeX hyperref package.
    #     """
    #     # Replace problematic characters in URLs
    #     url = url.replace('%', '\\%')
    #     url = url.replace('#', '\\#')
    #     url = url.replace('&', '\\&')
    #     url = url.replace('_', '\\_')
            
    #     return url
    
    # def process_math_term(self, term: str) -> str:
    #     """Enhanced math term processing with better handling of nested expressions"""
    #     if not term:
    #         return ""

    #     # Remove HTML tags and escaped sequences that cause issues
    #     cleanup_replacements = {
    #         'textasciicircum{}': '^',
    #         'textbackslash{}': '',
    #         '\\\\': '\\',
    #         '\\_SAT': '_SAT'
    #     }
        
    #     for old, new in cleanup_replacements.items():
    #         term = term.replace(old, new)

    #     # Detect if term is already in math mode
    #     # Count occurrences of single $; if odd, it's partially in math mode.
    #     is_math_mode = (term.count('$') % 2 == 1)

    #     # Store and protect existing math blocks
    #     math_blocks = []
    #     # Use a non-greedy regex to ensure minimal capturing between $...$
    #     term = re.sub(r'\$(.*?)\$',
    #                   lambda m: self._store_math(m.group(1), math_blocks),
    #                   term, flags=re.DOTALL)

    #     # Special cases, longer patterns first
    #     special_cases = {
    #         # Basic math operations
    #         'log(1 + e^(-z))': r'\log(1 + e^{-z})',
    #         '(0, 0)': r'$(0, 0)$',
    #         '^T': r'^T',

    #         # Greek letters
    #         'alpha': r'$\alpha$',
    #         'beta': r'$\beta$',
    #         'gamma': r'$\gamma$',
    #         'delta': r'$\delta$',
    #         'epsilon': r'$\epsilon$',
    #         'theta': r'$\theta$',
    #         'lambda': r'$\lambda$',
    #         'mu': r'$\mu$',
    #         'sigma': r'$\sigma$',
    #         'omega': r'$\omega$',

    #         # Function notation
    #         'sigma(x)': r'$\sigma(x)$',
    #         'sigma(z)': r'$\sigma(z)$',
    #         "sigma'(z)": r'$\sigma\'(z)$',
    #         'f(x)': r'$f(x)$',
    #         'g(x)': r'$g(x)$',

    #         # Subscripts and superscripts
    #         'x_0': r'$x_0$',
    #         '-x_0': r'$-x_0$',
    #         'x_i': r'$x_i$',
    #         'y_i': r'$y_i$',
    #         '_i': r'$_i$',
    #         '_j': r'$_j$',
    #         '_n': r'$_n$',
    #         '_p': r'$_p$',

    #         # Matrix notation
    #         'c^T': r'$c^T$',
    #         'b^T': r'$b^T$',
    #         'A^T': r'$A^T$',
    #         '^{-1}': r'^{-1}',
    #         '^{T}': r'^{T}',

    #         # Special functions and operators
    #         'mathbb{1}': r'$\mathbb{1}$',
    #         'frac{': r'$\frac{',
    #         'sum_{': r'$\sum_{',
    #         'prod_{': r'$\prod_{',
    #         'int_{': r'$\int_{',

    #         # Logical operators
    #         'implies': r'$\implies$',
    #         'iff': r'$\iff$',
    #         'forall': r'$\forall$',
    #         'exists': r'$\exists$',
    #         'ne': r'$\ne$',

    #         # Arrows and symbols
    #         'leftarrow': r'$\leftarrow$',
    #         'rightarrow': r'$\rightarrow$',
    #         'leftrightarrow': r'$\leftrightarrow$',
    #         'Leftarrow': r'$\Leftarrow$',
    #         'Rightarrow': r'$\Rightarrow$',
    #         'cdot': r'$\cdot$',

    #         # Norms and spaces
    #         'L^1': r'$L^1$',
    #         'L^2': r'$L^2$',
    #         'L^infty': r'$L^\infty$',
    #         'L^∞': r'$L^\infty$',
    #         '||': r'$\|$',

    #         # HTML-style tags
    #         '<sup>': r'^{',
    #         '</sup>': r'}',
    #         '<sub>': r'_{',
    #         '</sub>': r'}',

    #         # Special characters
    #         '\\{': r'\{',
    #         '\\}': r'\}',
    #         'textbackslash': r'\textbackslash',

    #         # Additional math expressions
    #         'max{0, -z}': r'$\max\{0, -z\}$',
    #         'max{0, 1-z}': r'$\max\{0, 1-z\}$',
    #         'y(w^Tx)': r'$y(w^{T}x)$',
    #         'w^T': r'$w^{T}$',
    #         'e^(-z)': r'$e^{-z}$',
    #         # Already included in a transformed version above, but ensure unique
    #         'e^{-z}': r'$e^{-z}$'
    #     }

    #     # Process special cases longest first
    #     for case in sorted(special_cases.keys(), key=len, reverse=True):
    #         if case in term:
    #             replacement = special_cases[case]
    #             # If we are inside math mode and the replacement is also wrapped in $...$, remove extra $
    #             if is_math_mode and replacement.startswith('$') and replacement.endswith('$'):
    #                 replacement = replacement[1:-1]
    #             term = term.replace(case, replacement)

    #     # Clean up duplicate or empty math mode markers
    #     term = re.sub(r'\${2,}', '$', term)  # collapse multiple $$ to single $
    #     term = re.sub(r'(\$)\s*(\$)', r'\1\2', term)  # Remove spaces between $ $
    #     # Remove isolated $ pairs with no content
    #     term = re.sub(r'\$\$', '$', term)

    #     try:
    #         # Instead of '\\+\\', use a quantifier to mean multiple backslashes.
    #         # '\\+\{' means one or more backslashes followed by '{'
    #         # '\\+\}' means one or more backslashes followed by '}'
    #         # '\\{2,}' means two or more backslashes
    #         term = re.sub(r'\\+\{', '{', term)
    #         term = re.sub(r'\\+\}', '}', term)
    #         term = re.sub(r'\\{2,}', r'\\', term)
    #     except re.error as e:
    #         print(f"Regex error while cleaning braces and backslashes: {e}")
    #         # If needed, handle the error by logging, raising a different exception, or returning the unmodified term.
    #         return term

    #     # If not in math mode and term contains math-y chars, wrap in $
    #     if not is_math_mode and any(c in term for c in '_^\\{}'):
    #         if not term.strip().startswith('$'):
    #             term = f'${term}$'

    #     # Restore protected math blocks
    #     term = self._restore_math(term, math_blocks)

    #     # Final normalization of math mode delimiters
    #     # Ensure balanced math mode (if not balanced, we could try to fix it)
    #     if term.count('$') % 2 != 0:
    #         # Add a trailing $ if odd count
    #         term += '$'

    #     return term

    # def sanitize_latex(self, text: str) -> str:
    #     """Enhanced sanitization for LaTeX output"""
    #     if not text:
    #         return ""
        
    #     math_blocks = []
    #     # Protect existing math
    #     text = re.sub(r'\$(.*?)\$',
    #                   lambda m: self._store_math(m.group(1), math_blocks),
    #                   text, flags=re.DOTALL)

    #     # Unicode math replacements
    #     unicode_math = {
    #         '\u2212': r'-',
    #         '∧': r'\wedge',
    #         '\u2228': r'\vee',
    #         '↔': r'\leftrightarrow',
    #         '¬': r'\neg',
    #         '⊗': r'\otimes',
    #         '⊕': r'\oplus',
    #         '∈': r'\in',
    #         '∉': r'\notin',
    #         '∀': r'\forall',
    #         '∃': r'\exists',
    #         '≤': r'\leq',
    #         '≥': r'\geq',
    #         '≠': r'\neq',
    #         '≈': r'\approx',
    #         '∞': r'\infty'
    #     }
    #     for symbol, replacement in unicode_math.items():
    #         # Insert in math mode
    #         text = text.replace(symbol, f'${replacement}$')

    #     # General replacements (outside math mode)
    #     # Note: We must be careful with $ and other chars that we already handled
    #     replacements = {
    #         '%': r'\%',
    #         '&': r'\&',
    #         '#': r'\#',
    #         '~': r'\textasciitilde{}',
    #         '^': r'\textasciicircum{}',
    #         '<': r'\textless{}',
    #         # unicode arrow replacements done above
    #         '→': r'$\rightarrow$',
    #         '←': r'$\leftarrow$',
    #         '≠': r'$\neq$',
    #         '∑': r'$\sum$',
    #         '⇒': r'$\implies$',
    #         '·': r'$\cdot$',
    #         '…': r'\ldots',
    #         # Smart quotes handling
    #         '"': '``',
    #         '"': "''",
    #         '"': "''",
    #         '\u2019': "'",
    #         '\u2018': "`",
    #         '—': '---'
    #     }

    #     for char, replacement in replacements.items():
    #         text = text.replace(char, replacement)

    #     # Restore math blocks
    #     text = self._restore_math(text, math_blocks)

    #     # Ensure balanced math mode after restoration
    #     if text.count('$') % 2 != 0:
    #         # Attempt simple fix by adding a trailing $
    #         text += '$'

    #     return text

    # def sanitize_section_title(self, title: str) -> str:
    #     """Sanitize section titles specifically"""
    #     # Handle special characters in section titles
    #     title = title.replace('&', r'\&')
    #     title = title.replace('\\', '')  # Remove backslashes
    #     title = title.replace('{', r'\{')
    #     title = title.replace('}', r'\}')
    #     title = title.replace('_', r'\_')
    #     title = title.replace('^', r'\textasciicircum{}')
    #     title = title.replace('~', r'\textasciitilde{}')
    #     title = title.replace('<', r'\textless{}')
    #     title = title.replace('>', r'\textgreater{}')
    #     # Replace {-} with simple hyphen
    #     title = title.replace('{-}', '-')
    #     return title
    
    # def save_questions_latex(self, name: str, questions: list[list[dict]], base_filename: str):
    #     """
    #     Save processed questions to a LaTeX PDF file using PyLaTeX. We will have one section titled 'Questions' for questions, and one section titled 'Answers' for answers. The answers should be in the same format as the questions, but the options should have the answer explanation in red text instead of the answer stem.
        
    #     Args:
    #         questions (list[list[dict]]): A list of lists of dictionaries for a given lecture as keys and slide numbers as values. Example: [[
    #             [
    #                 {
    #                     "question": "According to the Klee-Minty example, how many steps does the Largest Coefficient Rule require in the worst case?",
    #                     "options": {
    #                     "A": "n steps",
    #                     "B": "2n steps", 
    #                     "C": "2^n - 1 steps",
    #                     "D": "3m/2 steps",
    #                     "E": "3m steps"
    #                 },
    #                 "answers": {
    #                     "A": false,
    #                     "B": false,
    #                     "C": true,
    #                     "D": false,
    #                     "E": false
    #                 },
    #                 "explanations": {
    #                     "A": "Answer A is incorrect because the Smallest Coefficient Rule requires n steps, not the Largest Coefficient Rule.",
    #                     "B": "Answer B is incorrect because the Largest Coefficient Rule does not require 2n steps.",
    #                     "C": "Answer C is correct because the Klee-Minty example shows that the Largest Coefficient Rule requires 2^n - 1 steps in the worst case.",
    #                     "D": "Answer D is incorrect because 3m/2 steps is the average case for the simplex method, not the worst case for the Largest Coefficient Rule.",
    #                     "E": "Answer E is incorrect because 3m steps is the rare case for the simplex method, not the worst case for the Largest Coefficient Rule."
    #                 },
    #                 "type": "conceptual",
    #                 "slides": [
    #                     3
    #                 ]
    #             }
    #         ]]
    #     }
    #     """
    #     geometry_options = {
    #         "margin": "1in",
    #         "headheight": "14pt",
    #         "headsep": "25pt"
    #     }
    #     doc = Document(geometry_options=geometry_options)
        
    #     # Add packages
    #     for pkg in ['hyperref', 'enumitem', 'fancyhdr', 'xcolor', 'url', 'breakurl']:
    #         doc.packages.append(Package(pkg))

    #     doc.preamble.append(NoEscape(r'''
    #         \hypersetup{
    #             colorlinks=true,
    #             linkcolor=blue,
    #             filecolor=magenta,
    #             urlcolor=blue
    #         }
    #         \pagestyle{fancy}
    #         \fancyhf{}
    #         \rhead{Generated on \today}
    #         \cfoot{\thepage}
            
    #         % Configure enumeration settings
    #         \setlist[enumerate,1]{label=\arabic*.}
    #         \setlist[enumerate,2]{label=\alph*.}
    #         \setlist[enumerate,3]{label=\Alph*.}
    #         \setlist[enumerate]{itemsep=0.5em}
            
    #         % Define a command for red text
    #         \newcommand{\incorrect}[1]{\textcolor{red}{#1}}
    #     '''))
    #     doc.preamble.append(Command('lhead', f'{name}'))
        
    #     # Title
    #     doc.preamble.append(Command('title', f'Practice Questions for {name}'))
    #     doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
    #     doc.preamble.append(Command('date', NoEscape(r'\today')))
    #     doc.append(NoEscape(r'\maketitle'))

    #     # Questions Section
    #     with doc.create(Section('Questions')):
    #         doc.append(NoEscape(r'\begin{enumerate}'))
    #         for question_group in questions:
    #             if len(question_group) > 1:
    #                 # Multipart question
    #                 doc.append(NoEscape(r'\item'))
    #                 doc.append(NoEscape(r'\begin{enumerate}'))
                    
    #                 for part in question_group:
    #                     doc.append(NoEscape(f'\\item {part["question"]}'))
    #                     doc.append(NoEscape(r'\begin{enumerate}'))
                        
    #                     for opt in ['A', 'B', 'C', 'D', 'E']:
    #                         if opt in part['options']:
    #                             doc.append(NoEscape(f'\\item {part["options"][opt]}'))
                        
    #                     doc.append(NoEscape(r'\end{enumerate}'))
    #                     doc.append(NoEscape(r'\vspace{0.5em}'))
                    
    #                 doc.append(NoEscape(r'\end{enumerate}'))
    #             else:
    #                 # Single question
    #                 doc.append(NoEscape(f'\\item {question_group[0]["question"]}'))
    #                 doc.append(NoEscape(r'\begin{enumerate}'))
                    
    #                 for opt in ['A', 'B', 'C', 'D', 'E']:
    #                     if opt in question_group[0]['options']:
    #                         doc.append(NoEscape(f'\\item {question_group[0]["options"][opt]}'))
                    
    #                 doc.append(NoEscape(r'\end{enumerate}'))
    #                 doc.append(NoEscape(r'\vspace{1em}'))
            
    #         doc.append(NoEscape(r'\end{enumerate}'))

    #     # Answers Section
    #     doc.append(NoEscape(r'\newpage'))
    #     with doc.create(Section('Answers')):
    #         doc.append(NoEscape(r'\begin{enumerate}'))
    #         for question_group in questions:
    #             if len(question_group) > 1:
    #                 # Multipart question answers
    #                 doc.append(NoEscape(r'\item'))
    #                 doc.append(NoEscape(r'\begin{enumerate}'))
                    
    #                 for part in question_group:
    #                     doc.append(NoEscape(f'\\item {part["question"]}'))
    #                     doc.append(NoEscape(r'\begin{enumerate}'))
                        
    #                     for opt in ['A', 'B', 'C', 'D', 'E']:
    #                         if opt in part['options']:
    #                             explanation = part['explanations'].get(opt, '')
    #                             if part['answers'].get(opt, False):
    #                                 doc.append(NoEscape(f'\\item {explanation}'))
    #                             else:
    #                                 doc.append(NoEscape(f'\\item \\incorrect{{{explanation}}}'))
                        
    #                     doc.append(NoEscape(r'\end{enumerate}'))
    #                     doc.append(NoEscape(r'\vspace{0.5em}'))
                    
    #                 doc.append(NoEscape(r'\end{enumerate}'))
    #             else:
    #                 # Single question answers
    #                 part = question_group[0]
    #                 doc.append(NoEscape(f'\\item {part["question"]}'))
    #                 doc.append(NoEscape(r'\begin{enumerate}'))
                    
    #                 for opt in ['A', 'B', 'C', 'D', 'E']:
    #                     if opt in part['options']:
    #                         explanation = part['explanations'].get(opt, '')
    #                         if part['answers'].get(opt, False):
    #                             doc.append(NoEscape(f'\\item {explanation}'))
    #                         else:
    #                             doc.append(NoEscape(f'\\item \\incorrect{{{explanation}}}'))
                    
    #                 doc.append(NoEscape(r'\end{enumerate}'))
    #                 doc.append(NoEscape(r'\vspace{1em}'))
            
    #         doc.append(NoEscape(r'\end{enumerate}'))

    #     filename = os.path.join(self.content_dir, name, base_filename)
        
    #     log_dir = "_logs"
    #     # Generate PDF with logs in separate directory
    #     try:
    #         # Generate PDF with logs in separate directory
    #         doc.generate_pdf(
    #             filename,
    #             clean_tex=False,
    #             compiler='latexmk',
    #             compiler_args=[
    #                 '-pdf',
    #                 '-interaction=nonstopmode',
    #                 '-file-line-error',
    #                 '-shell-escape',
    #                 '-8bit',
    #                 # Separate auxiliary files into logs directory
    #                 f'-aux-directory={log_dir}',
    #                 '-recorder',
    #                 '-verbose'
    #             ]
    #         )
            
    #         # Handle log files
    #         log_extensions = ['.log', '.aux', '.out', '.fls']
    #         for ext in log_extensions:
    #             src_file = os.path.join(self.content_dir, name, log_dir, f"{base_filename}{ext}")
    #             if os.path.exists(src_file):
    #                 # Display log content for debugging
    #                 if ext == '.log':
    #                     print(f"\nContents of log file:")
    #                     with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
    #                         lines = f.readlines()
    #                         print("..." if len(lines) > 50 else "")
    #                         for line in lines[-50:]:
    #                             if "!" in line or "Error" in line or "Warning" in line:
    #                                 print(f"ERROR/WARNING: {line.strip()}")
                
    #         print(f"PDF generated successfully: {filename}.pdf")
    #         # Clean up the .tex file if successful
    #         if os.path.exists(f"{filename}.tex"):
    #             os.remove(f"{filename}.tex")
    #         return True

    #     except Exception as e:
    #         error_msg = str(e)
    #         print(f"Error during compilation: {error_msg}")
            
    #         # Error analysis and log display
    #         if "! LaTeX Error:" in error_msg:
    #             latex_error = re.search(r'! LaTeX Error:(.*?)\n', error_msg)
    #             if latex_error:
    #                 print(f"LaTeX Error: {latex_error.group(1).strip()}")
    #         elif "! Package" in error_msg:
    #             package_error = re.search(r'! Package (.*?) Error:(.*?)\n', error_msg)
    #             if package_error:
    #                 print(f"Package {package_error.group(1)} Error: {package_error.group(2).strip()}")
    #         elif "! Missing" in error_msg:
    #             missing_error = re.search(r'! Missing (.*?) inserted', error_msg)
    #             if missing_error:
    #                 print(f"Missing character error: {missing_error.group(1)}")
            
    #         # Check log files in the log directory
    #         for ext in ['.log', '.aux', '.out']:
    #             log_file = os.path.join(self.content_dir, name, log_dir, f"{base_filename}{ext}")
    #             if os.path.exists(log_file):
    #                 print(f"\nContents of {log_file}:")
    #                 with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
    #                     for line in f:
    #                         if any(marker in line for marker in ["!", "Error", "Warning"]):
    #                             print(line.strip())
    #         return False
        
    # def save_summary_latex(self, name: str, summary: str, base_filename: str):
    #     """
    #     Save processed summary to a LaTeX PDF file using PyLaTeX.
    #     """
    #     geometry_options = {
    #         "margin": "1in",
    #         "headheight": "14pt",
    #         "headsep": "25pt"
    #     }
    #     doc = Document(geometry_options=geometry_options)
        
    #     # Add packages
    #     for pkg in ['hyperref', 'enumitem', 'fancyhdr', 'xcolor', 'url', 'breakurl']:
    #         doc.packages.append(Package(pkg))

    #     doc.preamble.append(NoEscape(r'''
    #         \hypersetup{
    #             colorlinks=true,
    #             linkcolor=blue,
    #             filecolor=magenta,
    #             urlcolor=blue
    #         }
    #         \pagestyle{fancy}
    #         \fancyhf{}
    #         \rhead{Generated on \today}
    #         \cfoot{\thepage}
            
    #         % Configure enumeration settings
    #         \setlist[enumerate,1]{label=\arabic*.}
    #         \setlist[enumerate,2]{label=\alph*.}
    #         \setlist[enumerate,3]{label=\Alph*.}
    #         \setlist[enumerate]{itemsep=0.5em}
            
    #         % Define a command for red text
    #         \newcommand{\incorrect}[1]{\textcolor{red}{#1}}
    #     '''))
    #     doc.preamble.append(Command('lhead', f'{name}'))
        
    #     # Title
    #     doc.preamble.append(Command('title', f'Summary for {name}'))
    #     doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
    #     doc.preamble.append(Command('date', NoEscape(r'\today')))
    #     doc.append(NoEscape(r'\maketitle'))

    #     # Questions Section
    #     with doc.create(Section('Summary')):
    #         doc.append(NoEscape(summary))

    #     filename = os.path.join(self.content_dir, name, base_filename)

    #     log_dir = "_logs"
    #     # Generate PDF with logs in separate directory
    #     try:
    #         # Generate PDF with logs in separate directory
    #         doc.generate_pdf(
    #             filename,
    #             clean_tex=False,
    #             compiler='latexmk',
    #             compiler_args=[
    #                 '-pdf',
    #                 '-interaction=nonstopmode',
    #                 '-file-line-error',
    #                 '-shell-escape',
    #                 '-8bit',
    #                 # Separate auxiliary files into logs directory
    #                 f'-aux-directory={log_dir}',
    #                 '-recorder',
    #                 '-verbose'
    #             ]
    #         )
            
    #         # Handle log files
    #         log_extensions = ['.log', '.aux', '.out', '.fls']
    #         for ext in log_extensions:
    #             src_file = os.path.join(self.content_dir, name, log_dir, f"{base_filename}{ext}")
    #             if os.path.exists(src_file):
    #                 # Display log content for debugging
    #                 if ext == '.log':
    #                     print(f"\nContents of log file:")
    #                     with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
    #                         lines = f.readlines()
    #                         print("..." if len(lines) > 50 else "")
    #                         for line in lines[-50:]:
    #                             if "!" in line or "Error" in line or "Warning" in line:
    #                                 print(f"ERROR/WARNING: {line.strip()}")
                
    #         print(f"PDF generated successfully: {filename}.pdf")
    #         # Clean up the .tex file if successful
    #         if os.path.exists(f"{filename}.tex"):
    #             os.remove(f"{filename}.tex")
    #         return True

    #     except Exception as e:
    #         error_msg = str(e)
    #         print(f"Error during compilation: {error_msg}")
            
    #         # Error analysis and log display
    #         if "! LaTeX Error:" in error_msg:
    #             latex_error = re.search(r'! LaTeX Error:(.*?)\n', error_msg)
    #             if latex_error:
    #                 print(f"LaTeX Error: {latex_error.group(1).strip()}")
    #         elif "! Package" in error_msg:
    #             package_error = re.search(r'! Package (.*?) Error:(.*?)\n', error_msg)
    #             if package_error:
    #                 print(f"Package {package_error.group(1)} Error: {package_error.group(2).strip()}")
    #         elif "! Missing" in error_msg:
    #             missing_error = re.search(r'! Missing (.*?) inserted', error_msg)
    #             if missing_error:
    #                 print(f"Missing character error: {missing_error.group(1)}")
            
    #         # Check log files in the log directory
    #         for ext in ['.log', '.aux', '.out']:
    #             log_file = os.path.join(self.content_dir, name, log_dir, f"{base_filename}{ext}")
    #             if os.path.exists(log_file):
    #                 print(f"\nContents of {log_file}:")
    #                 with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
    #                     for line in f:
    #                         if any(marker in line for marker in ["!", "Error", "Warning"]):
    #                             print(line.strip())
    #         return False