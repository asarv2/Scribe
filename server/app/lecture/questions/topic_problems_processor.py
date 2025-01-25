import json
import os
from langchain_core.messages import HumanMessage
import re
import uuid
from lecture.questions.base_problems_processor import BaseProblemsProcessor, QuestionType
from lecture.base_processor import ContentType

class TopicProblemsProcessor(BaseProblemsProcessor):
    def __init__(self, question_type: QuestionType, *args, **kwargs):
        super().__init__(ContentType.TOPIC, question_type, *args, **kwargs)
        
        self.content_dir = os.path.join(self.questions_dir, "topics")
        # Initialize lecture-specific attributes
        self.topics = []
        self.topic_names = []
        self._load_topics()
        
    def _load_topics(self):
        """Load topic content from summary.json files"""
        lectures_folder = os.path.join(self.output_dir, self.course_code, "lectures")
        response = self.supabase.table("topics").select("title, lectures").eq("class", self.class_id).neq("type", "problem").neq("type", "algorithm").execute().data
        self.topic_names = [topic["title"] for topic in response if topic["title"]]
        topic_lectures_uuids = [topic["lectures"] for topic in response]
        
        # Get lecture mapping
        lecture_mapping_response = self.supabase.table("lectures").select("id, name").execute().data
        lecture_mapping = {lecture["id"]: lecture["name"] for lecture in lecture_mapping_response}
        
        # Process each UUID list to get corresponding lecture names
        lecture_slides = []
        for uuid_list in topic_lectures_uuids:
            # Map each UUID in the list to its lecture name
            lecture_names = [lecture_mapping[uuid] for uuid in uuid_list]
            lecture_slides.append(lecture_names)
        
        # Process content for each topic
        self.topics = []
        for lectures in lecture_slides:
            topic_content = ""
            for lecture_dir in sorted(os.listdir(lectures_folder)):
                if lecture_dir in lectures:
                    notes_path = os.path.join(lectures_folder, lecture_dir, "notes.txt")
                    if os.path.isfile(notes_path):
                        with open(notes_path, 'r') as file:
                            topic_content += file.read()
            self.topics.append(topic_content)
    
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
            num_docs = len(self.topics)
        else:
            num_docs = min(num_docs, len(self.topics))
        
        for i in range(0, num_docs):
            print(f"Processing {self.topic_names[i]}")
            remaining_questions = num_questions - len(self.questions.get(self.topic_names[i], []))
            # check if the lecture already has specified number of questions, and subtract from num_questions
            if remaining_questions <= 0:
                print(f"Skipping {self.topic_names[i]} - already has {len(self.questions.get(self.topic_names[i], []))} questions")
                continue
            try:
                print(f"Generating {remaining_questions} questions for {self.topic_names[i]}")
                
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
                    result = self.process_batch(num_q, self.topic_names[i], self.topics[i], prompt)
                    self.clean_result(result, self.topic_names[i], tags)

            except Exception as e:
                print(f"Error processing batch {i + 1}: {e}")
                
            # save outputs
            self.save_questions_json()
        # save all questions
        self.save_questions_text()
        self.save_questions_pdf()
