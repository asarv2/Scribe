import json
import os
from lecture.base_processor import BaseProcessor, ContentType
from langchain_core.messages import HumanMessage
import re
import uuid
from enum import Enum
from lecture.summary.base_summary_processor import BaseSummaryProcessor

class LectureSummaryProcessor(BaseSummaryProcessor):
    def __init__(self, *args, **kwargs):
        super().__init__(ContentType.LECTURE, *args, **kwargs)
        
        self.content_dir = os.path.join(self.summary_dir, "lectures")
        
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
    
    def process_summary(self, num_docs = None):
        """
        Process slides, extract content in batches, and generates problems.
        
        Args:
            num_docs: the number of documents to process. If None, process all documents.
        """
        
        # Process each category and aggregate results
        if num_docs is None:  
            num_docs = len(self.slides)
        else:
            num_docs = min(num_docs, len(self.slides))

        for i in range(0, num_docs):
            print(f"Processing {self.slide_names[i]}")
            # check if the lecture already has specified number of questions, and subtract from num_questions
            if len(self.summary.get(self.slide_names[i], "")) > 0:
                print(f"Skipping {self.slide_names[i]} - already has {len(self.summary.get(self.slide_names[i], []))} questions")
                continue
            try:
                print(f"Generating summary for {self.slide_names[i]}")
                result = self.process_batch(self.slide_names[i], self.slides[i])
                self.clean_result(result, self.slide_names[i])

            except Exception as e:
                print(f"Error processing batch {i + 1}: {e}")
                
            # save outputs
            self.save_summary_json()
        self.save_summary_text()
        self.save_summary_pdf()