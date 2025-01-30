import os
from supabase import Client, ClientOptions, create_client
from dotenv import load_dotenv
from app.utils.convert_question_example import QuestionFormatter
from app.utils.convert_summary_example import SummaryFormatter

class GenerationFormatter:
    def __init__(self, supabase: Client, generation_id: str):
        self.supabase = supabase
        self.generation_data = self.supabase.table("generations").select("*").eq("id", generation_id).single().execute().data
        
        # Get all related questions or summaries based on generation type
        if self.generation_data.get("type") == "problem":
            self.items = self.supabase.table("questions").select("*").eq("generation", generation_id).execute().data
        elif self.generation_data.get("type") == "summary":
            self.items = self.supabase.table("summaries").select("*").eq("generation", generation_id).execute().data
        else:
            self.items = []
    
    def main(self) -> str:
        """Format all content into a single text string"""
        if not self.items:
            return ""
            
        if self.generation_data.get("type") == "problem":
            return self._format_questions()
        elif self.generation_data.get("type") == "summary":
            return self._format_summary()
        else:
            return ""
        
    def format_question_requirements(self) -> str:
        """Format question requirements"""
        if self.generation_data.get("type") == "problem":
            formatted_text = f"Wanted {len(self.items)} questions\n"
            for question_index, question in enumerate(self.items):
                formatted_text += f"QUESTION {question_index + 1}: {question.get('question', '')}\n"
                formatted_text += f"Wanted {'single part' if question.get('multipart', None) == None else 'multi part'} question\n"
                formatted_text += f"Wanted {'mcq' if question.get('mcq', False) else 'free response'} question\n"
                formatted_text += f"Wanted {'conceptual' if question.get('conceptual', False) else 'computational'} question\n"
                formatted_text += f"IMPORTANT: Wanted the following additional information: {question.get('additional_info', '')}\n"
            return formatted_text
        else:
            return ""
    
    def _format_questions(self) -> str:
        """Format multiple questions"""
        formatted_text = f"QUESTIONS for {self.generation_data.get('name')}\n\n"
        for idx, question_data in enumerate(self.items, 1):
            formatter = QuestionFormatter(self.supabase, question_data["id"], question_number=idx)
            formatted_text += formatter.main()
            formatted_text += "\n" + "-"*50 + "\n\n"  # Separator between questions
        return formatted_text
    
    def _format_summary(self) -> str:
        """Format summary"""
        if not self.items:
            return ""
        formatter = SummaryFormatter(self.supabase, self.items[0]["id"])
        return formatter.main()
    


if __name__ == "__main__":
    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

    generation_formatter = GenerationFormatter(supabase, "59c38189-32f8-499e-8777-de42080999a7") # 3 questions
    print(generation_formatter.main())