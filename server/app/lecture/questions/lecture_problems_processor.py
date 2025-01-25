import json
import os
from lecture.base_processor import BaseProcessor, ContentType
from langchain_core.messages import HumanMessage
import re
import uuid
from enum import Enum
from lecture.questions.base_problems_processor import BaseProblemsProcessor, QuestionType

class LectureProblemsProcessor(BaseProblemsProcessor):
    def __init__(self, question_type: QuestionType, *args, **kwargs):
        super().__init__(ContentType.LECTURE, question_type, *args, **kwargs)
        
        self.content_dir = os.path.join(self.questions_dir, "lectures")
        
        # Initialize lecture-specific attributes
        self.slides = []
        self.slide_names = []
        self._load_lectures()
    
    def _load_lectures(self):
        """Load lecture content from notes.txt files"""
        lectures_folder = os.path.join(self.output_dir, self.course_code, "lectures")
        for lecture_dir in sorted(os.listdir(lectures_folder)):
            notes_path = os.path.join(lectures_folder, lecture_dir, "notes.txt")
            if os.path.isfile(notes_path):
                with open(notes_path, 'r') as file:
                    self.slides.append(file.read())
                    self.slide_names.append(lecture_dir)
    
    def process_problems(self, num_docs = None, num_questions: int = 3, conceptual_computational_ratio = None, single_multi_part_ratio = None):
        """
        Process slides, extract content in batches, and generates problems.
        
        Args:
            num_docs: the number of documents to process. If None, process all documents.
            num_questions: the number of questions to ask.
            conceptual_computational_ratio: the ratio of conceptual questions to computational questions. If None, generate all questions.
            single_multi_part_ratio: the ratio of single-part questions to multi-part questions. If None, generate all questions.
        """
        
        if conceptual_computational_ratio is None:
            conceptual_computational_ratio = 1
        if single_multi_part_ratio is None:
            single_multi_part_ratio = 1
        
        if conceptual_computational_ratio > 1:
            raise ValueError("conceptual_computational_ratio cannot be greater than 1")
        
        if single_multi_part_ratio > 1:
            raise ValueError("single_multi_part_ratio cannot be greater than 1")
        
        # Process each category and aggregate results
        if num_docs is None:  
            num_docs = len(self.slides)
        else:
            num_docs = min(num_docs, len(self.slides))
        
        for i in range(0, num_docs):
            print(f"Processing {self.slide_names[i]}")
            lecture_name = self.slide_names[i]
            
            # Skip if lecture doesn't exist in questions dict
            if lecture_name not in self.questions:
                self.questions[lecture_name] = []
            
            remaining_questions = num_questions - len(self.questions[lecture_name])
            if remaining_questions <= 0:
                print(f"Skipping {lecture_name} - already has {len(self.questions[lecture_name])} questions")
                continue
            try:
                print(f"Generating {remaining_questions} questions for {self.slide_names[i]}")
                
                # First split: conceptual vs computational
                conceptual_questions = round(remaining_questions * conceptual_computational_ratio)
                computational_questions = remaining_questions - conceptual_questions
                
                # Then split each category into single vs multi-part
                single_part_conceptual = round(conceptual_questions * single_multi_part_ratio)
                multi_part_conceptual = conceptual_questions - single_part_conceptual
                
                single_part_computational = round(computational_questions * single_multi_part_ratio)
                multi_part_computational = computational_questions - single_part_computational
                
                question_numbers = [single_part_conceptual, multi_part_conceptual, single_part_computational, multi_part_computational]
                prompts = [self.single_part_conceptual_prompt, self.multi_part_conceptual_prompt, self.single_part_computational_prompt, self.multi_part_computational_prompt]
                all_tags = [["conceptual"], ["conceptual", "multi-part"], ["computational"], ["computational", "multi-part"]]
                
                for num_q, prompt, tags in zip(question_numbers, prompts, all_tags):
                    if num_q == 0:
                        continue
                    # Only try to print tags[1] if it exists
                    tag_description = f"{tags[0]} {tags[1]}" if len(tags) > 1 else tags[0]
                    print(f"Generating {num_q} {tag_description} questions")
                    result = self.process_batch(num_q, self.slide_names[i], self.slides[i], prompt)
                    self.clean_result(result, self.slide_names[i], tags)

            except Exception as e:
                print(f"Error processing batch {i + 1}: {e}")
                
            # save outputs
            self.save_questions_json()
        self.save_questions_text()
        self.save_questions_pdf()