# takes a question, and converts it into text for prompting to the LLM
import os
from supabase import Client, ClientOptions, create_client
from dotenv import load_dotenv

class QuestionFormatter:
    def __init__(self, supabase: Client, question_id: str, question_number: int = 1):
        self.supabase = supabase
        self.question_data = self.supabase.table("questions").select("*").eq("id", question_id).single().execute().data
        self.questions = [self.question_data]  # Wrap single question in list for consistency
        self.question_number = question_number
    def main(self) -> str:
        """Format all questions into a single text string"""
        formatted_text = ""
        
        for question in self.questions:
            formatted_text += f"QUESTION {self.question_number}:\n"
            formatted_text += f"{question.get('question', '')}\n\n"
            
            # Handle MCQ options
            if question.get('mcq', False):
                formatted_text += self._format_mcq_options(question)
            
            # Format answer
            answer = self._get_mcq_answer(question) if question.get('mcq', False) else question.get('solution', '')
            formatted_text += f"\nAnswer: {answer}\n"
            
            # Format explanation
            if question.get('mcq', False):
                formatted_text += f"Explanation: {self._format_mcq_explanation(question)}\n\n"
            
        return formatted_text
    
    def _format_mcq_options(self, question: dict) -> str:
        """Format MCQ options"""
        options_text = ""
        for opt in ['a', 'b', 'c', 'd', 'e']:
            option_key = f'option_{opt}'
            if option_key in question and question[option_key]:
                options_text += f"{opt.upper()}. {question[option_key]}\n"
        return options_text

    def _get_mcq_answer(self, question: dict) -> str:
        """Get the MCQ answer"""
        return question.get('solution', 'NO ANSWER PROVIDED')

    def _format_mcq_explanation(self, question: dict) -> str:
        """Format MCQ explanation"""
        answer = question.get('solution', '').lower()
        if answer and f'explanation_{answer}' in question:
            return question[f'explanation_{answer}']
        return 'No explanation provided'

if __name__ == "__main__":

    # want to test out all of them, on all the following cases

    # 1. Single-Question, Single Part, MCQ, Conceptual, Topics
    # 2. Multi-Question MCQ, Single Part, Conceptual, Topics
    # 3. Single-Question FRQ,Single Part, Conceptual, Topics
    # 4. Multi-Question FRQ, Single Part, Conceptual, Topics
    # 5. Single-Question MCQ, Single Part, Computational, Topics
    # 6. Multi-Question MCQ, Single Part, Computational, Topics
    # 7. Single-Question FRQ, Single Part, Computational, Topics
    # 8. Multi-Question FRQ, Single Part, Computational, Topics
    # 9. Single-Question, Multi Part, MCQ, Conceptual, Topics
    # 10. Multi-Question MCQ, Multi Part, Conceptual, Topics
    # 11. Single-Question FRQ, Multi Part, Conceptual, Topics
    # 12. Multi-Question FRQ, Multi Part, Conceptual, Topics
    # 13. Single-Question MCQ, Multi Part, Computational, Topics
    # 14. Multi-Question MCQ, Multi Part, Computational, Topics
    # 15. Single-Question FRQ, Multi Part, Computational, Topics
    # 16. Multi-Question FRQ, Multi Part, Computational, Topics

    # 17. Single-Question, Single Part, MCQ, Conceptual, Lecture
    # 18. Multi-Question MCQ, Single Part, Conceptual, Lecture
    # 19. Single-Question FRQ,Single Part, Conceptual, Lecture
    # 20. Multi-Question FRQ, Single Part, Conceptual, Lecture
    # 21. Single-Question MCQ, Single Part, Computational, Lecture
    # 22. Multi-Question MCQ, Single Part, Computational, Lecture
    # 23. Single-Question FRQ, Single Part, Computational, Lecture
    # 24. Multi-Question FRQ, Single Part, Computational, Lecture
    # 25. Single-Question, Multi Part, MCQ, Conceptual, Lecture
    # 26. Multi-Question MCQ, Multi Part, Conceptual, Lecture
    # 27. Single-Question FRQ, Multi Part, Conceptual, Lecture
    # 28. Multi-Question FRQ, Multi Part, Conceptual, Lecture
    # 29. Single-Question MCQ, Multi Part, Computational, Lecture
    # 30. Multi-Question MCQ, Multi Part, Computational, Lecture
    # 31. Single-Question FRQ, Multi Part, Computational, Lecture
    # 32. Multi-Question FRQ, Multi Part, Computational, Lecture

    load_dotenv()

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

    question_formatter = QuestionFormatter(supabase, "00329592-d2c9-47f9-81b8-484d2780ddb6")
    print(question_formatter.main())