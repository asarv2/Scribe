# terms_processor.py
import re
from typing import Dict, List, TypedDict, Optional
import os
import json
from langchain_core.messages import HumanMessage
from app.services.base_processor import BaseProcessor

class Figure(TypedDict):
    id: str
    document: str
    y_min: float
    x_min: float
    y_max: float
    x_max: float
    description: str

class LectureContent(TypedDict):
    figures: Dict[int, List[Figure]]
    content: str

class Term(TypedDict):
    term: str
    definition: str
    lectures: Dict[str, List[int]]
    type: str
    figures: List[str]

class TermsProcessor(BaseProcessor):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.summary_type = "terms" # the name of the output directory for the terms summary
        
        # reading in the slides
        lectures_folder = os.path.join(self.output_dir, self.course_code, "lectures")
        self.slides = []
        self.slide_names = []
        self.figures = {}
        for lecture_dir in sorted(os.listdir(lectures_folder)):
            notes_path = os.path.join(lectures_folder, lecture_dir, "notes.txt")
            self.figures[lecture_dir] = []
            
            if os.path.isfile(notes_path):
                with open(notes_path, 'r') as file:
                    self.slides.append(file.read())
                    self.slide_names.append(lecture_dir)
                    
            figures_folder = os.path.join(lectures_folder, lecture_dir, "figures")
            if os.path.isdir(figures_folder):
                for figure_file in os.listdir(figures_folder):
                    self.figures[lecture_dir].append(figure_file)
        # Generate timestamp for output file
        os.makedirs(os.path.join(self.output_dir, self.course_code, self.summary_type), exist_ok=True)
        self.json_output_file = os.path.join(self.output_dir, self.course_code, self.summary_type, "summary.json")
        self.text_output_file = os.path.join(self.output_dir, self.course_code, self.summary_type, "summary.txt")
        
        self.processed_terms_file = os.path.join(self.output_dir, self.course_code, self.summary_type, "processed_terms.txt")
        
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
        # check if summary.json exists
        if os.path.exists(self.json_output_file) and not self.regenerate:
            with open(self.json_output_file, "r") as file:
                self.terms = json.load(file)
        else:
            self.terms = {}
            
        if os.path.exists(self.processed_terms_file) and not self.regenerate:
            with open(self.processed_terms_file, "r") as file:
                self.processed_terms = file.read().splitlines()
        else:
            self.processed_terms = []
        
    def process_batch(self, 
                      slides: List[str], 
                      category: str,
                      batch_index: int) -> str:
        """
        Process a batch of slides and generate terms.
        """
        print(f"Processing batch {batch_index + 1} for {category}")
        combined_text = "\n".join(slides)
        message = HumanMessage(content=[
            {"type": "text", "text": self.prompts[category]},
            {"type": "text", "text": "The following terms have already been generated. Do not repeat them: " + ", ".join(self.terms.keys())},
            {"type": "text", "text": combined_text},
        ])
        return self.robust_generate(message)
        
    def clean_result(self, result: str, lecture_name: str, category: str):
        """
        Clean up the result by getting it in the form of {
            "cleaned_term_name" : {
                    "term": "term",
                    "definition": "definition",
                    "lectures": {
                        "lecture_name": [1, 2, 3, e.t.c.] # list of slides
                    }
                    "type": "concept/problem/algorithm"
                    "visuals": ["figure1.png", "figure2.png", "figure3.png", e.t.c.] # list of names of figure files
                }  
            }
            
        }
        """
        terms_added = []
        for line in result.splitlines():
            if ":" in line:
                try:
                    formatted_term, definition_with_slides = line.split(":", 1)
                    term = formatted_term.strip().lower().strip("*")
                    term = re.sub(r'\([^)]*\)', '', term).strip()
                    
                    # Extract slides more carefully
                    slides = []
                    if "<SLIDE" in definition_with_slides:
                        definition = definition_with_slides.split("<SLIDE")[0].strip()
                        # Extract slide numbers using regex
                        slide_matches = re.findall(r'<SLIDE\s+(\d+)>', definition_with_slides)
                        slides = [int(num) for num in slide_matches if num.isdigit()]
                    else:
                        definition = definition_with_slides.strip()
                        slides = []  # No slides referenced
                        
                    visuals = [] # find visuals based on slides. Check the 
                    for slide in slides:
                        for figure in self.figures[lecture_name]:
                            if int(figure.split(".")[0]) == slide:
                                visuals.append(figure)
                    
                    if term in self.terms:
                        lectures = self.terms[term]["lectures"]
                        if lecture_name in lectures:
                            lectures[lecture_name] = list(set(lectures[lecture_name] + slides))
                        else:
                            lectures[lecture_name] = slides
                        print("Pruning term: ", term)
                    else:
                        self.terms[term] = {
                            "term": formatted_term,
                            "definition": definition,
                            "lectures": {
                                lecture_name: slides
                            },
                            "type": category,
                            "visuals": visuals
                        }
                        terms_added.append(term)
                except Exception as e:
                    print(f"Error processing line: '{line}'\nError: {str(e)}")
                    continue
        print(f"Terms added: {terms_added}")

    def process_terms(self,
                      num_slides: int = None,
                      batch_size: int = 1):
        """
        Process slides, extract content in batches, and generates terms.
        
        Args:
            num_slides: the number of slides to process. If None, process all slides.
            batch_size: the number of slides to process in each batch.
        """
        
        # Process each category and aggregate results
        for i in range(0, len(self.slides) if num_slides is None else num_slides, batch_size):
            batch = self.slides[i:i + batch_size]
            for category in self.prompts.keys():
                if f"{self.slide_names[i]} - {category}" in self.processed_terms:
                    print(f"Skipping {self.slide_names[i]} - {category} because it has already been processed")
                    continue
                try:
                    result = self.process_batch(batch, category, i // batch_size)
                    self.clean_result(result, self.slide_names[i], category)
                    
                    # Save results to file
                    self.save_terms_json(self.json_output_file)
                    self.save_terms_text(self.text_output_file)
                    self.update_processed_terms(self.slide_names[i], category)
                except Exception as e:
                    print(f"Error processing batch {i // batch_size} for {category}: {e}")
                    
    def update_processed_terms(self, lecture_name: str, category: str):
        self.processed_terms.append(f"{lecture_name} - {category}")
        self.save_processed_terms(self.processed_terms_file)
                
    def save_terms_json(self, file_path: str):
        with open(file_path, "w") as file:
            json.dump(self.terms, file, indent=4)
    
    def save_terms_text(self, file_path: str):
        with open(file_path, "w") as file:
            terms = self.terms.keys()
            file.write("\n".join(terms))
            
    def save_processed_terms(self, file_path: str):
        with open(file_path, "w") as file:
            file.write("\n".join(self.processed_terms))
