# terms_processor.py
import re
from typing import Dict, List
import os
import json
from langchain_core.messages import HumanMessage
from lecture.condense.base_processor import BaseProcessor

class TermsProcessor(BaseProcessor):
    def __init__(self, notes_folder: str, save_terms: bool = False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.save_terms = save_terms
        self.summary_type = "terms" # the name of the output directory for the terms summary
        
        # reading in the slides
        self.slides = []
        self.slide_names = []
        for file_name in sorted(os.listdir(notes_folder)):
            if file_name.endswith('.txt'):
                slide_path = os.path.join(notes_folder, file_name)
                with open(slide_path, 'r') as file:
                    self.slides.append(file.read())
                    self.slide_names.append(file_name.split('.')[0])
        
        # Generate timestamp for output file
        os.makedirs(os.path.join(self.output_dir, self.timestamp, self.summary_type), exist_ok=True)
        self.json_output_file = os.path.join(self.output_dir, self.timestamp, self.summary_type, "summary.json")
        self.text_output_file = os.path.join(self.output_dir, self.timestamp, self.summary_type, "summary.txt")
        
        self.prompts = {
        "Key Terms": f"Extract the key terms from the following slides and provide a clear and concise definition for each one. Your key terms should be specific to this lecture, but also make sense as a general topic in the context of {self.course_title}. Respond in the following format: <term>: <definition>. Use LaTeX format when including any math symbols. Do not include any other text, like numbering, intermediate references, or general summaries before/after the term. Do not add any modifiers around the key terms, like textbf'{{}}' or texttt'{{}}'. Avoid using HTML tags or unicode. Do not focus on generating Problem Types or Algorithm Solutions since this will be done in another section. If you are citing a slide, include the slide number at the end of the term. Here is an example: 'Normal Equation: A closed-form solution for the least squares problem in linear regression. It's always solvable, even if the original system of equations is not.<SLIDE 12>'. If citing multiple slides, include the slide numbers at the end of the definition. Here is another example: 'Support Vectors: The data points closest to the hyperplane in an SVM. They are the most influential points in determining the hyperplane.<SLIDE 10><SLIDE 12><SLIDE 17>'.",
        
        "Problem Types": f"Extract the key types of problems discussed in the following slides and provide examples if possible. Your problem types should be specific to this lecture, but also make sense as a general problem in the context of {self.course_title}. Respond in the following format: <problem type>: <description>. Use LaTeX format when including any math symbols. Do not include any other text, like numbering, intermediate references, or general summaries before/after the problem type. Do not add any modifiers around the key types of problems, like textbf'{{}}' or texttt'{{}}'. Avoid using HTML tags or unicode. Do not focus on generating Key Terms or Algorithm Solutions since this will be done in another section. If you are citing a slide, include the slide number at the end of the term. Here is an example: 'Verifying Optimality: A method for verifying the optimality of a solution is presented, involving checking the objective function value and the feasibility of the dual solution.<SLIDE 13>'. If citing multiple slides, include the slide numbers at the end of the description. Here is another example: 'Determining the existence of a non-negative solution to `Ax = b`: This problem investigates whether there exists a vector `x` with non-negative components that satisfies the equation `Ax = b`. Several equivalent conditions are presented using a vector `y`. <SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5><SLIDE 6><SLIDE 7><SLIDE 8><SLIDE 9><SLIDE 10><SLIDE 11>'.",
        
        "Algorithm Solutions": f"Extract the key algorithms to solve the problems from the following slides, and explain their meaning briefly. Your algorithms should be specific to this lecture, but also make sense as a general algorithm solution in the context of {self.course_title}. Using formulas is encouraged. Respond in the following format: <algorithm>: <formula and/or explanation>. Use LaTeX format when including any math symbols. Do not include any other text, like numbering, intermediate references, or general summaries before/after the algorithm. Do not add any modifiers around the key algorithms, like textbf'{{}}' or texttt'{{}}'. Avoid using HTML tags or unicode. Do not focus on generating Key Terms or Problem Types since this will be done in another section. If you are citing a slide, include the slide number at the end of the term. Here is an example: 'Strong Duality: This theorem states that the optimal objective function values of the primal and dual problems are equal.<SLIDE 2>'. If citing multiple slides, include the slide numbers at the end of the term. Here is another example: 'Caratheodory's Theorem: This theorem states that any point in the convex hull of a set in Rm can be expressed as a convex combination of at most m+1 points. This significantly reduces the computational complexity of algorithms dealing with convex hulls, as it limits the number of points that need to be considered.<SLIDE 8><SLIDE 9>'."
        }
        
        if self.regenerate_timestamp:
            self.terms = {}
        else:
            filename = os.path.join(self.output_dir, self.timestamp, self.summary_type, "summary.json")
            with open(filename, "r") as file:
                self.terms = json.load(file)
        
        
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
                            "type": category
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
                try:
                    result = self.process_batch(batch, category, i // batch_size)
                    self.clean_result(result, self.slide_names[i], category)
                except Exception as e:
                    print(f"Error processing batch {i // batch_size} for {category}: {e}")

        # Save results to file
        self.save_terms_json(self.json_output_file)

        if self.save_terms:
            self.save_terms_text(self.text_output_file)
                
    def save_terms_json(self, file_path: str):
        with open(file_path, "w") as file:
            json.dump(self.terms, file, indent=4)
    
    def save_terms_text(self, file_path: str):
        with open(file_path, "w") as file:
            terms = self.terms.keys()
            file.write("\n".join(terms))
