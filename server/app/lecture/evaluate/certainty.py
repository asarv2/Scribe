from multiprocessing.dummy.connection import Client
import re

class CertaintyEvaluator(object):
    def __init__(self, supabase: Client, generation_id: str):
        self.supabase = supabase
        self.generation = self.supabase.table("generations").select("*").eq("id", generation_id).single().execute().data
        class_id = self.generation.get("class")
        self.course = self.supabase.table("classes").select("*").eq("id", class_id).single().execute().data
        self.questions = self.supabase.table("questions").select("*").eq("generation", generation_id).execute().data
        
    def _format_questions_text(self) -> str:
        """Format all questions into a single text string based on generation parameters"""
        formatted_text = ""
        
        # Get generation parameters
        is_mcq = self.generation.get("mcq", True)
        is_multipart = not self.generation.get("single", True)
        
        for q_idx, question in enumerate(self.questions, 1):
            formatted_text += f"QUESTION {q_idx}:\n"
            
            if is_multipart and isinstance(question.get("question"), list):
                # Handle multipart questions
                for part_idx, part in enumerate(question["question"]):
                    part_letter = chr(65 + part_idx)
                    formatted_text += f"\nPart {part_letter}:\n{part}\n"
                    
                    if is_mcq:
                        formatted_text += self._format_mcq_options(question, part_idx)
                    
                    formatted_text += f"\nAnswer: {self._format_answer(question, part_idx)}\n"
                    formatted_text += f"Explanation: {self._format_explanation(question, part_idx)}\n"
            else:
                # Handle single questions
                formatted_text += f"{question.get('question', '')}\n"
                
                if is_mcq:
                    formatted_text += self._format_mcq_options(question)
                
                formatted_text += f"\nAnswer: {self._format_answer(question)}\n"
                formatted_text += f"Explanation: {self._format_explanation(question)}\n"
            
            formatted_text += "\n\n"
        
        return formatted_text

    def _format_mcq_options(self, question: dict, part_idx: int = None) -> str:
        """Format MCQ options for a question or question part"""
        options_text = ""
        options = question.get("options", {})
        
        if part_idx is not None:
            options = options[part_idx] if isinstance(options, list) else {}
        
        for opt in ['A', 'B', 'C', 'D', 'E']:
            if opt in options:
                options_text += f"{opt}. {options[opt]}\n"
        
        return options_text

    def _format_answer(self, question: dict, part_idx: int = None) -> str:
        """Format the answer for a question or question part"""
        answers = question.get("answers", {})
        
        if part_idx is not None:
            answers = answers[part_idx] if isinstance(answers, list) else {}
        
        if isinstance(answers, dict):  # MCQ answer
            try:
                return next(opt for opt, value in answers.items() if value)
            except StopIteration:
                return "NO CORRECT ANSWER MARKED"
        return str(answers)  # Free response answer

    def _format_explanation(self, question: dict, part_idx: int = None) -> str:
        """Format the explanation for a question or question part"""
        explanations = question.get("explanations", {})
        
        if part_idx is not None:
            explanations = explanations[part_idx] if isinstance(explanations, list) else {}
        
        if isinstance(explanations, dict):  # MCQ explanations
            return "\n".join(f"{opt}: {exp}" for opt, exp in explanations.items())
        return str(explanations)  # Free response explanation
        
    def evaluate_certainty(self):
        response = self._format_questions_text()
        
        uncertainty_keywords = [
        r"\bmay\b", r"\bmight\b", r"\bperhaps\b", r"\bcould\b",
        r"\bpossibly\b", r"\bprobably\b", r"\bassume\b",
        r"\bnot sure\b", r"\bdoubt\b", r"\buncertain\b",
        r"\bsomewhat\b", r"\bmight be\b", r"\bnot entirely\b",
        r"\blikely\b", r"\btends to\b", r"\bappears to\b",
        r"\bseems to\b", r"\bcan be\b", r"\bshould be\b",
        r"\bmay not\b", r"\bnot likely\b", r"\bnot certain\b",
        r"\bnot sure\b"
        ]
    
        sentences = re.split(r'[.!?]+', response)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return 10, []
        
        uncertain_sentences = 0
        detected_keywords = set()  # Track unique keywords found
        
        for sentence in sentences:
            for keyword in uncertainty_keywords:
                if re.search(keyword, sentence.lower()):
                    uncertain_sentences += 1
                    # Store keyword without regex markers
                    clean_keyword = keyword.replace(r'\b', '').replace(r'\s+', ' ')
                    detected_keywords.add(clean_keyword)
        
        uncertainty_percentage = (uncertain_sentences / len(sentences)) * 100
        confidence_score = 10 - min(10, max(1, round(uncertainty_percentage / 10)))
        
        return confidence_score, list(detected_keywords)

# # Example usage
# if __name__ == "__main__":
#     llm_response = "This is definitely true. It might be related to that. I'm certain about this part. Perhaps we should consider alternatives. This is absolutely correct. I'm not entirely sure about this last point."
#     confidence, keywords = evaluate_certainty(llm_response)
#     print(f"Confidence Score: {confidence}/10 \nKeywords Detected: {', '.join(keywords)}")
