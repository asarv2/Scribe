from multiprocessing.dummy.connection import Client
import re
from google.generativeai import GenerativeModel
import google.generativeai as genai
import os

from langchain_google_genai import ChatGoogleGenerativeAI

from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    raise ValueError("No Google API Key found. Make sure GOOGLE_API_KEY is set in your environment.")

genai.configure(api_key=api_key)

def is_self_contained(content):
    """
    Checks if the content is self-contained (e.g., no external references like <SLIDE 17>).
    """
    external_reference_pattern = r"<SLIDE \d+>"
    return not re.search(external_reference_pattern, content)

def validate_latex(content):
    """
    Checks if the LaTeX content contains invalid tags.
    """
    invalid_patterns = [r"<>", r">", r"<.*?>"]
    for pattern in invalid_patterns:
        if re.search(pattern, content):
            return False
    return True

class GeminiDecisionMaker:
    def __init__(self, 
                 supabase: Client, 
                 generation_id: str, 
                 model_name='gemini-1.5-flash',
                 temperature=0.5,
                 max_tokens=None,
                 max_retries=2):
        try:
            self.model = GenerativeModel(model_name)
            self.generation_config = {  # Add this missing config
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }
            self.max_retries = max_retries
            
            self.supabase = supabase
            
            self.generation = self.supabase.table("generations").select("*").eq("id", generation_id).single().execute().data
            class_id = self.generation.get("class")
            self.course = self.supabase.table("classes").select("*").eq("id", class_id).single().execute().data
            
            self.questions = self.supabase.table("questions").select("*").eq("generation", generation_id).execute().data
            
            
        except Exception as e:
            print(f"Error initializing GeminiDecisionMaker: {e}")
            self.model = None
    
    def generate_text(self, prompt: str) -> str:
        """
        Sends a prompt to the Gemini model and returns the generated text.
        """
        if not self.model:
            return "Gemini model not initialized properly."
        
        attempt = 0
        while attempt < self.max_retries:
            try:
                response = self.model.generate_content(prompt, generation_config=self.generation_config)
                return response.text
            except Exception as e:
                attempt += 1
                if attempt >= self.max_retries:
                    return f"Error generating text: {e}"
        return "Unknown error in GeminiDecisionMaker."

def generate_llm_quality_report(gemini_decision_maker: GeminiDecisionMaker,
                               expected_question_count: int) -> str:
    output = []
    for question in gemini_decision_maker.questions:
        output.append({"question": question.get("question", ""), "solution": question.get("solution", ""), "type": "MCQ" if len(question.get("solution", "")) == 1 else "FRQ", "actual": "MCQ" if gemini_decision_maker.generation.get("mcq", "") == True else "FRQ", "note": gemini_decision_maker.generation.get("additional_info", ""), "structure": "Single" if gemini_decision_maker.generation.get("single", True) == True else "Multi", "actual structure": "Single" if question.get("multipart", "") == "" else "Multi"})
        
    title = gemini_decision_maker.generation.get("name", "")
    
    
    issues = []
    score = 0
    total_possible = 1 + (expected_question_count * 3)  # 1 for count + 3 points per question

    # Check question count (1 point)
    if len(output) == expected_question_count:
        score += 1
    else:
        issues.append(f"Expected {expected_question_count} questions, found {len(output)}.")

    # Check each question (up to 3 points each)
    for i, item in enumerate(output, start=1):
        question = item.get("question", "")
        solution = item.get("solution", "")
        expected_type = item.get("type", "")
        actual_type = item.get("actual", "")
        note = item.get("note", "")
        expected_structure = item.get("structure", "")
        actual_structure = item.get("actual structure", "")

        # Check all issues independently
        # 1. Check self-contained
        if not is_self_contained(question) or not is_self_contained(solution):
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

        # 4. Check note (1 point)
        if note:
            note_prompt = f"Does this question follow the note '{note}'?\nQuestion: {question}\nAnswer with just 'yes' or 'no'."
            follows_note = gemini_decision_maker.generate_text(note_prompt).lower().strip()
            if 'yes' in follows_note:
                score += 1
            else:
                issues.append(f"Question {i} does not follow the note: '{note}'")

    # Generate summary with score
    if issues:
        prompt = (
            f"For the {title} question set, summarize these issues in a short bullet list:\n"
            f"Score: {score}/{total_possible}\n\n" +
            "\n".join(issues)
        )
    else:
        prompt = f"The {title} question set appears correct and complies with all requirements.\nScore: {score}/{total_possible}"

    report = gemini_decision_maker.generate_text(prompt)
    return report, int(float(score/total_possible) * 10)


# Example usage
if __name__ == "__main__":
    # Example LLM output
    title = "Math Problems"
    llm_output = [
        {"question": "Write a proof for \\( a^2 + b^2 = c^2 \\).", "solution": "The proof is as follows...", "type": "FRQ", "actual": "FRQ", "note": "Make this problem a proof", "structure": "Single", "actual structure": "Single"},
        {"question": "Solve \\( x^2 + 3x + 2 = 0 \\).", "solution": "Solution: \\( x = -1, -2 \\) <SLIDE 17>.", "type": "FRQ", "actual": "FRQ","note": "Make this problem a proof", "structure": "Multi", "actual structure": "Single"},
        {"question": "<FRQ> Write a function in Python.", "solution": "Here is the function...", "type": "FRQ", "actual": "MCQ", "structure": "Single", "actual structure": "Single"},
    ]

    # Evaluation
    gemini_decision_maker = GeminiDecisionMaker()
    result = generate_llm_quality_report(gemini_decision_maker, llm_output,title, expected_question_count=3)
    print("Evaluation Results:")
    print(result)
