import re
from google.generativeai import GenerativeModel
import google.generativeai as genai
import os

from langchain_google_genai import ChatGoogleGenerativeAI

from dotenv import load_dotenv

from app.utils.convert_generation_example import GenerationFormatter


class AccuracyEvaluator:
    def __init__(self, supabase, generation_id):
        '''
        Class for evaluating the accuracy and quality of generated questions.
        
        Args:
            supabase: The supabase client.
            generation_id: The uuid of the class in supabase
            
        Attributes:
            self.supabase: The supabase client
            self.generation: The generation data from supabase
            self.questions: The questions in the generation
        '''
        load_dotenv()
        
        # getting generation info
        self.supabase = supabase
        self.generation = self.supabase.table("generations").select("*").eq("id", generation_id).single().execute().data
        self.questions = self.supabase.table("questions").select("*").eq("generation", generation_id).execute().data

    def is_self_contained(self, content):
        """
        Checks if the content is self-contained (e.g., no external references like <SLIDE 17>).
        """
        external_reference_pattern = r"<SLIDE \d+>"
        return not re.search(external_reference_pattern, content)

    def validate_latex(self, content):
        """
        Checks if the LaTeX content contains invalid tags.
        """
        invalid_patterns = [r"<>", r">", r"<.*?>"]
        for pattern in invalid_patterns:
            if re.search(pattern, content):
                return False
        return True

    def evaluate_accuracy(self) -> tuple[str, int]:
        """
        Evaluates the accuracy of the generated questions based on objective metrics.
        
        Returns:
            tuple: (explanation string, score out of 10)
        """
        issues = []
        actual_question_count = len(self.questions)
        total_possible = actual_question_count * 4  # 4 points per question
        score = 0

        # Check each question (up to 4 points each)
        for i, question in enumerate(self.questions, start=1):
            question_text = question.get("question", "")
            solution = question.get("solution", "")
            expected_type = "MCQ" if len(solution) == 1 else "FRQ"
            actual_type = "MCQ" if question.get("mcq", False) else "FRQ"
            expected_structure = "Single" if self.generation.get("single", True) else "Multi"
            actual_structure = "Single" if question.get("multipart", None) is None else "Multi"

            # 1. Check self-contained (1 point)
            if self.is_self_contained(question_text) and self.is_self_contained(solution):
                score += 1
            else:
                issues.append(f"Question {i} or its solution contains external references (<SLIDE X>)")
            
            # 2. Check type (1 point)
            if actual_type == expected_type:
                score += 1
            else:
                issues.append(f"Question {i} is '{actual_type}', should be '{expected_type}'.")

            # 3. Check structure (1 point)
            if actual_structure == expected_structure:
                score += 1
            else:
                issues.append(f"Question {i} has '{actual_structure}' structure, should be '{expected_structure}'.")

            # 4. Check LaTeX validity (1 point)
            if self.validate_latex(question_text) and self.validate_latex(solution):
                score += 1
            else:
                issues.append(f"Question {i} or its solution contains invalid LaTeX formatting")

        # Generate summary
        title = self.generation.get("name", "")
        summary = f"Evaluation Report for {title}\n"
        summary += f"Score: {score}/{total_possible}\n"
        if issues:
            summary += "Issues found:\n" + "\n".join(f"- {issue}" for issue in issues)
        else:
            summary += "No issues found. All requirements met."

        return summary, int(float(score/total_possible) * 10)


# Example usage
if __name__ == "__main__":
    # Example LLM output
    title = "Math Problems"
    llm_output = [
        {"question": "Write a proof for \\( a^2 + b^2 = c^2 \\).", "solution": "The proof is as follows...", "type": "FRQ", "actual": "FRQ", "note": "Make this problem a proof", "structure": "Single", "actual structure": "Single"},
        {"question": "Solve \\( x^2 + 3x + 2 = 0 \\).", "solution": "Solution: \\( x = -1, -2 \\) <SLIDE 17>.", "type": "FRQ", "actual": "FRQ","note": "Make this problem a proof", "structure": "Multi", "actual structure": "Single"},
        {"question": "<FRQ> Write a function in Python.", "solution": "Here is the function...", "type": "FRQ", "actual": "MCQ", "structure": "Single", "actual structure": "Single"},
    ]

    result = AccuracyEvaluator(None, None).evaluate_accuracy()
    print("Evaluation Results:")
    print(result)
