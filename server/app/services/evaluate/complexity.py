from supabase.client import Client
import re

from app.utils.convert_generation_example import GenerationFormatter

class ComplexityEvaluator(object):
    def __init__(self, supabase: Client, llm, generation_id: str):
        """
        Evaluates the complexity of a generation, based on the number of steps it took to solve it, the audience it is for, and if the LLM got the correct answer.
        """
        self.supabase = supabase
        
        self.generation = self.supabase.table("generations").select("*").eq("id", generation_id).single().execute().data

        self.generation_formatter = GenerationFormatter(self.supabase, generation_id)
        
        class_id = self.generation.get("class")
        self.course = self.supabase.table("classes").select("*").eq("id", class_id).single().execute().data
        
        self.questions = self.supabase.table("questions").select("*").eq("generation", generation_id).execute().data
        
        self.summaries = self.supabase.table("summaries").select("*").eq("generation", generation_id).execute().data
        
        self.llm = llm

    def evaluate_complexity(self):
        """
        Evaluates the complexity of a generation, based on the number of steps it took to solve it, the audience it is for, and if the LLM got the correct answer.
        """
        
        message = f"""
        You are the professor for the course {self.course.get("title", "")}. You are given a generation, with the name {self.generation.get("name", "")}, and you need to evaluate the complexity of the generation, on a scale of 1 to 10. This course is meant for upper level undergraduate students.
        """

        complexity_prompt = f"""
        YOU MUST EVALUATE THE COMPLEXITY OF THE GENERATION BASED ON THE FOLLOWING CRITERIA:
        1. The number of steps it takes to solve the problem
        2. The audience it is for
        3. Solve the question on your own, and compare it to the steps that were taken in the generation. 
        """
        
        example = """
        FORMATTING:
        1. Use <OUTPUT>x</OUTPUT> tags to encapsulate the output of the rating of the generation, where x is the rating of the generation.
        2. Add a <WHY>x</WHY> tags to encapsulate the reasoning behind the rating of the generation, where x is the reasoning behind the rating of the generation.
        
        Here is a complete example for a generation for: Simplex Method 2x2
        
        INPUT: 
        Generation Requirements:
        - Wanted 1 questions
        QUESTION 1:
        - Wanted multi part question
        - Wanted free response question
        - Wanted computational question
        IMPORTANT: Wanted the following additional information: Make it a 2x2 matrix for simplex method.        
        Generation Output: 
        QUESTION 1:
        Part A: Suppose we change the objective function to minimize $Z = 5x_1 + 4x_2 + 3x_3$. How would you approach solving this problem using the simplex method?  Describe the necessary modifications to the initial tableau and the optimality condition.
        Part B: Continuing from Part A, perform the second iteration of the simplex method.  Again, clearly state the entering and leaving variables, show all calculations, and present the resulting tableau.  Is this solution optimal? Explain.
        Part C: Consider the following linear programming problem: Maximize $Z = 5x_1 + 4x_2 + 3x_3$
        Subject to: $2x_1 + 3x_2 + x_3 \le 5$, $4x_1 + x_2 + 2x_3 \le 11$, $3x_1 + 4x_2 + 2x_3 \le 8$, $x_1, x_2, x_3 \ge 0$ $x_1, x_2, x_3 \ge 0$ 
        Using the simplex method, perform the first iteration starting from the origin (0,0,0).  Clearly identify the entering and leaving variables, and show the updated tableau.  Explain your reasoning for each step.
        Solution A: 
        1. **Initial Tableau:** Introduce slack variables $s_1, s_2, s_3$ to convert inequalities to equalities:\\n\\n$2x_1 + 3x_2 + x_3 + s_1 = 5$\\n$4x_1 + x_2 + 2x_3 + s_2 = 11$\\n$3x_1 + 4x_2 + 2x_3 + s_3 = 8$\\n\\nThe initial basic feasible solution (BFS) is $(x_1, x_2, x_3, s_1, s_2, s_3) = (0, 0, 0, 5, 11, 8)$, with $Z = 0$.  The initial simplex tableau is:\\n\\n$\\begin{array}{c|cccccc|c} & x_1 & x_2 & x_3 & s_1 & s_2 & s_3 & RHS \\\\\\hline s_1 & 2 & 3 & 1 & 1 & 0 & 0 & 5 \\\\ s_2 & 4 & 1 & 2 & 0 & 1 & 0 & 11 \\\\ s_3 & 3 & 4 & 2 & 0 & 0 & 1 & 8 \\\\\\hline Z & -5 & -4 & -3 & 0 & 0 & 0 & 0 \\\\\\end{array}$\\n\\n2. **Entering Variable:** The most negative entry in the Z-row is -5, corresponding to $x_1$. Therefore, $x_1$ enters the basis.\\n\\n3. **Leaving Variable:** Perform the minimum ratio test:\\n\\n$\\frac{5}{2} = 2.5$\\n$\\frac{11}{4} = 2.75$\\n$\\frac{8}{3} \\approx 2.67$\\n\\nThe minimum ratio is 2.5, corresponding to the $s_1$ row.  Therefore, $s_1$ leaves the basis.\\n\\n4. **Pivot Operation:** The pivot element is 2 (in the $s_1$ row and $x_1$ column).  Perform row operations to make the pivot element 1 and other elements in the $x_1$ column 0:\\n\\nNew Row 1: $\\frac{1}{2}R_1$\\nNew Row 2: $R_2 - 4R_1$\\nNew Row 3: $R_3 - 3R_1$\\nNew Z-row: $R_Z + 5R_1$\\n\\nThis yields the updated tableau:\\n\\n$\\begin{array}{c|cccccc|c} & x_1 & x_2 & x_3 & s_1 & s_2 & s_3 & RHS \\\\\\hline x_1 & 1 & \\frac{3}{2} & \\frac{1}{2} & \\frac{1}{2} & 0 & 0 & \\frac{5}{2} \\\\ s_2 & 0 & -5 & 0 & -2 & 1 & 0 & 1 \\\\ s_3 & 0 & -\\frac{1}{2} & \\frac{1}{2} & -\\frac{3}{2} & 0 & 1 & \\frac{1}{2} \\\\\\hline Z & 0 & \\frac{7}{2} & -\\frac{1}{2} & \\frac{5}{2} & 0 & 0 & \\frac{25}{2} \\\\\\end{array}$\\n\\nThe new BFS is $(x_1, x_2, x_3, s_1, s_2, s_3) = (\\frac{5}{2}, 0, 0, 0, 1, \\frac{1}{2})$, with $Z = \\frac{25}{2} = 12.5$.

        Solution B: 
        To minimize $Z = 5x_1 + 4x_2 + 3x_3$, we can use two approaches:\\n\\n**Approach 1:  Big M Method**\\n\\n1. **Convert to Maximization:**  Minimize $Z$ is equivalent to maximizing $-Z = -5x_1 - 4x_2 - 3x_3$.\\n\\n2. **Initial Tableau:** The initial tableau would be the same as in Part A, except the objective function row would be:\\n\\n$Z = 5x_1 + 4x_2 + 3x_3$  (or $-Z = -5x_1 - 4x_2 - 3x_3$)\\n\\n3. **Optimality Condition:** The optimality condition remains the same: all coefficients in the objective function row must be non-negative for a maximization problem.\\n\\n**Approach 2: Dual Simplex Method**\\n\\n1. **Initial Tableau:** The initial tableau would be the same as in Part A.\\n\\n2. **Optimality Condition:** The optimality condition changes.  Instead of looking for non-negative coefficients in the objective row, we look for non-positive coefficients in the right-hand side (RHS) column.  The algorithm proceeds by selecting a leaving variable with a negative RHS value and an entering variable to maintain feasibility.\\n\\nIn both approaches, the simplex method iteratively improves the solution until the optimality condition is met.  The Big M method is simpler conceptually, but the dual simplex method can be more efficient in some cases.

        Solution C: 
        1. **Entering Variable:** In the tableau from Part A, the most negative coefficient in the Z-row is $-\\frac{1}{2}$, corresponding to $x_3$. Therefore, $x_3$ enters the basis.\\n\\n2. **Leaving Variable:** Perform the minimum ratio test:\\n\\n$\\frac{5/2}{1/2} = 5$\\n$\\frac{1/2}{1/2} = 1$\\n\\nThe minimum ratio is 1, corresponding to the $s_3$ row. Therefore, $s_3$ leaves the basis.\\n\\n3. **Pivot Operation:** The pivot element is $\\frac{1}{2}$ (in the $s_3$ row and $x_3$ column). Perform row operations to make the pivot element 1 and other elements in the $x_3$ column 0:\\n\\nNew Row 3: $2R_3$\\nNew Row 1: $R_1 - \\frac{1}{2}R_3$\\nNew Z-row: $R_Z + \\frac{1}{2}R_3$\\n\\nThis yields the updated tableau:\\n\\n$\\begin{array}{c|cccccc|c} & x_1 & x_2 & x_3 & s_1 & s_2 & s_3 & RHS \\\\\\hline x_1 & 1 & 2 & 0 & 1 & 0 & -1 & 2 \\\\ s_2 & 0 & -5 & 0 & -2 & 1 & 0 & 1 \\\\ x_3 & 0 & -1 & 1 & -3 & 0 & 2 & 1 \\\\\\hline Z & 0 & 3 & 0 & 1 & 0 & 1 & 13 \\\\\\end{array}$\\n\\nThe new BFS is $(x_1, x_2, x_3, s_1, s_2, s_3) = (2, 0, 1, 0, 1, 0)$, with $Z = 13$.\\n\\n4. **Optimality Check:** All coefficients in the Z-row are non-negative. Therefore, this solution is optimal.
        OUTPUT:
        <OUTPUT>6</OUTPUT>
        <WHY>The problem was very straightforward, and may not test the student's deep understanding of the topic.</WHY>
        """
        
        final_prompt = f"""
        {message}\n\n{complexity_prompt}\n\n{example}\n\n
        Now, it is your turn to evaluate the generation: {self.generation.get("name", "")}. 
        
        Generation Requirements:
        {self.generation_formatter.format_question_requirements()}
        
        Generation Output: 
        {self.generation_formatter.main()}
        
        OUTPUT:
        """
        
        response = self.llm.invoke(final_prompt)
        response_content = response.content if hasattr(response, 'content') else str(response)

        # Extract score and explanation using regex
        score_match = re.search(r"<OUTPUT>(\d+)</OUTPUT>", response_content)
        explanation_match = re.search(r"<WHY>(.*?)</WHY>", response_content, re.DOTALL)
        
        if not score_match or not explanation_match:
            raise ValueError("Response missing required OUTPUT or WHY tags")
            
        complexity_score = int(score_match.group(1))
        explanation = explanation_match.group(1).strip()
        
        # Validate score is between 1-10
        if not 1 <= complexity_score <= 10:
            raise ValueError(f"Invalid complexity score: {complexity_score}. Must be between 1 and 10.")
        
        return explanation, complexity_score