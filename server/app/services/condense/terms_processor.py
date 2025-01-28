from typing import Dict, List, TypedDict, Optional
from app.services.base_processor import BaseProcessor
from langchain_core.messages import HumanMessage
import re

class Figure(TypedDict):
    id: str
    document: str
    y_min: float
    x_min: float
    y_max: float
    x_max: float
    description: str

class Term(TypedDict):
    term: str
    definition: str
    lectures: Dict[str, List[int]]  # lecture_id -> slide numbers
    type: str
    figures: List[str]

class Terms(TypedDict):
    terms: Dict[str, Term]

class TermsProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        lectures: Dict[str, Dict[str, Dict[int, List[Figure]]]]
    ):
        super().__init__()
        self.course_title = course_title
        self.lectures = lectures
        self.terms: Dict[str, Term] = {}
        self.processed_terms: List[str] = []
        self.initialize_prompts()

    def initialize_prompts(self) -> None:
        """Initialize the prompts for different term categories"""
        self.prompts = {
        "Key Terms": f"""Extract the key terms from the following slides and provide a clear and concise definition for each one.
        
        WHAT YOU SHOULD DO:
        1. Your key terms should be specific to this lecture, but also make sense as a general topic in the context of {self.course_title}. 
        2. Respond in the following format: <term>: <definition>. 
        3. Use LaTeX format when including any math symbols. 
        4. If you are citing a slide, include the slide number at the end of the term, with the format <SLIDE <slide number>>. 
        5. Make all terms concise as you can, try to avoid many-word terms. 
        6. Someone should be able to see how this term is specific to this course, and not just a vague scenario. 
        
        WHAT YOU SHOULD AVOID:
        1. Do not include any other text, like numbering, intermediate references, or general summaries before/after the term. 
        2. Do not add any modifiers around the key terms, like textbf'{{}}' or texttt'{{}}'. 
        3. Avoid using HTML tags or unicode. 
        4. Do not focus on generating Problem Types or Algorithm Solutions since this will be done in another section. 
        5. You should have a maximum of 5 key terms, so make sure they are the most important ones. 
        Here is a full example: 'Normal Equation: A closed-form solution for the least squares problem in linear regression. It's always solvable, even if the original system of equations is not.<SLIDE 12>'. If citing multiple slides, include the slide numbers at the end of the definition. Here is another example: 'Support Vectors: The data points closest to the hyperplane in an SVM. They are the most influential points in determining the hyperplane.<SLIDE 10><SLIDE 12><SLIDE 17>'.""",
        
        "Problem Types": f"""Extract the key types of problems discussed in the following slides and provide examples if possible. 
        
        WHAT YOU SHOULD DO:
        1. Your problem types should be specific to this lecture, but also make sense as a general problem in the context of {self.course_title}. 
        2. Respond in the following format: <problem type>: <description>. 
        3. Use LaTeX format when including any math symbols. 
        4. If you are citing a slide, include the slide number at the end of the term, with the format <SLIDE <slide number>>. 
        5. Make all problem types concise as you can, try to avoid many-word terms. 
        6. Someone should be able to see how this problem type is specific to this course, and not just a vague scenario. 
        7. You should have a maximum of 5 problem types, so make sure they are the most important ones. 
        
        WHAT YOU SHOULD AVOID:
        1. Do not include any other text, like numbering, intermediate references, or general summaries before/after the problem type. 
        2. Do not add any modifiers around the key types of problems, like textbf'{{}}' or texttt'{{}}'. 
        3. Avoid using HTML tags or unicode. 
        4. Do not focus on generating Key Terms or Algorithm Solutions since this will be done in another section. 
        
        Here is an example: 'Verifying Optimality: A method for verifying the optimality of a solution is presented, involving checking the objective function value and the feasibility of the dual solution.<SLIDE 13>'. If citing multiple slides, include the slide numbers at the end of the description. Here is another example: 'Determining the existence of a non-negative solution to `Ax = b`: This problem investigates whether there exists a vector `x` with non-negative components that satisfies the equation `Ax = b`. Several equivalent conditions are presented using a vector `y`. <SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5><SLIDE 6><SLIDE 7><SLIDE 8><SLIDE 9><SLIDE 10><SLIDE 11>'.""",
        
        "Algorithm Solutions": f"""Extract the key algorithms to solve the problems from the following slides, and explain their meaning briefly. 
        
        WHAT YOU SHOULD DO:
        1. Your algorithms should be specific to this lecture, but also make sense as a general algorithm solution in the context of {self.course_title}. 
        2. Respond in the following format: <algorithm>: <formula and/or explanation>. Use LaTeX format when including any math symbols. 
        3. If you are citing a slide, include the slide number at the end of the term, with the format <SLIDE <slide number>>. 
        4. Make all algorithms concise as you can, try to avoid many-word terms. 
        5. Someone should be able to see how this algorithm is specific to this course, and not just a vague scenario. 
        6. You should have a maximum of 5 algorithms, so make sure they are the most important ones. 
        WHAT YOU SHOULD AVOID:
        1. Do not include any other text, like numbering, intermediate references, or general summaries before/after the algorithm. 
        2. Do not add any modifiers around the key algorithms, like textbf'{{}}' or texttt'{{}}'. 
        3. Avoid using HTML tags or unicode. 
        4. Do not focus on generating Key Terms or Problem Types since this will be done in another section. 
        
        Here is an example: 'Strong Duality: This theorem states that the optimal objective function values of the primal and dual problems are equal.<SLIDE 2>'. If citing multiple slides, include the slide numbers at the end of the term. Here is another example: 'Caratheodory's Theorem: This theorem states that any point in the convex hull of a set in Rm can be expressed as a convex combination of at most m+1 points. This significantly reduces the computational complexity of algorithms dealing with convex hulls, as it limits the number of points that need to be considered.<SLIDE 8><SLIDE 9>'."""
        }

    async def process_batch(
        self,
        lecture_content: str,
        category: str,
        batch_index: int
    ) -> str:
        """Process a batch of content for term extraction"""
        print(f"Processing batch {batch_index + 1} for {category}")
        message = HumanMessage(content=[
            {"type": "text", "text": self.prompts[category]},
            {
                "type": "text",
                "text": "The following terms have already been generated. Do not repeat them: " +
                    ", ".join(self.terms.keys())
            },
            {"type": "text", "text": lecture_content}
        ])
        return await self.robust_generate(message)

    def clean_result(
        self,
        result: str,
        lecture_name: str,
        category: str
    ) -> None:
        """Clean and process the result from the LLM"""
        lines = result.split("\n")
        
        for line in lines:
            if ":" not in line:
                continue

            try:
                formatted_term, definition_with_slides = line.split(":", 1)
                term = formatted_term.strip().lower()
                # Remove content in parentheses
                term = re.sub(r'\([^)]*\)', '', term).strip()

                # Extract slides and definition
                if "<SLIDE" in definition_with_slides:
                    definition = definition_with_slides.split("<SLIDE")[0].strip()
                    # Extract slide numbers using regex
                    slides = [
                        int(num)
                        for num in re.findall(r'<SLIDE\s+(\d+)>', definition_with_slides)
                    ]
                else:
                    definition = definition_with_slides.strip()
                    slides = []

                # Find visuals based on slides
                figures = []
                for slide in slides:
                    figures_for_slide = self.lectures[lecture_name]['figures'].get(slide, [])
                    figures.extend(figure['id'] for figure in figures_for_slide)

                # Update or create term
                if term in self.terms:
                    lectures = self.terms[term]['lectures']
                    if lecture_name in lectures:
                        lectures[lecture_name] = list(set(lectures[lecture_name] + slides))
                    else:
                        lectures[lecture_name] = slides
                    print("Updating existing term:", term)
                else:
                    self.terms[term] = {
                        "term": formatted_term,
                        "definition": definition,
                        "lectures": {lecture_name: slides},
                        "type": category,
                        "figures": figures
                    }
                    print("Added new term:", term)

            except Exception as error:
                print(f"Error processing line: '{line}'\nError: {str(error)}")

    async def process_terms(self) -> Dict[str, Term]:
        """Process all lectures and extract terms"""
        for i, lecture_name in enumerate(self.lectures):
            lecture_content = self.lectures[lecture_name]['content']
            
            for category in self.prompts:
                process_key = f"{lecture_name} - {category}"
                
                if process_key in self.processed_terms:
                    print(f"Skipping {process_key} because it has already been processed")
                    continue

                try:
                    result = await self.process_batch(lecture_content, category, i)
                    self.clean_result(result, lecture_name, category)
                    self.processed_terms.append(process_key)
                except Exception as error:
                    print(f"Error processing batch {i} for {category}:", error)

        return self.terms

    def get_terms(self) -> Dict[str, Term]:
        """Get all processed terms"""
        return self.terms

    def get_processed_terms(self) -> List[str]:
        """Get list of processed term keys"""
        return self.processed_terms