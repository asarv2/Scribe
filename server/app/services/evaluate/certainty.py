from multiprocessing.dummy.connection import Client
import re

from app.utils.convert_generation_example import GenerationFormatter

class CertaintyEvaluator(object):
    def __init__(self, supabase: Client, generation_id: str):
        self.supabase = supabase
        self.generation = self.supabase.table("generations").select("*").eq("id", generation_id).single().execute().data
        class_id = self.generation.get("class")
        self.course = self.supabase.table("classes").select("*").eq("id", class_id).single().execute().data
        self.questions = self.supabase.table("questions").select("*").eq("generation", generation_id).execute().data

        self.generation_formatter = GenerationFormatter(self.supabase, generation_id)
        
    def evaluate_certainty(self):
        response = self.generation_formatter.main()
        
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
