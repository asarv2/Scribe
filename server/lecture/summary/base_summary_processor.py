import json
import os
from lecture.base_processor import BaseProcessor, ContentType
from langchain_core.messages import HumanMessage
import re


class BaseSummaryProcessor(BaseProcessor):
    def __init__(self, content_type: ContentType, *args, **kwargs):
        """
        Initialize the BaseSummaryProcessor class.
        """
        super().__init__(*args, **kwargs)
        self.content_type = content_type
        # Customizable paths
        self.summary_dir = os.path.join(self.output_dir, self.course_code)
        self.content_dir = os.path.join(self.summary_dir, "content")  # Override in child classes
        self.json_filename = f"{self.content_type.value}_summary.json"
        self.json_output_file = os.path.join(self.summary_dir, self.json_filename)
        
        # Create necessary directories
        os.makedirs(self.summary_dir, exist_ok=True)
        os.makedirs(self.content_dir, exist_ok=True)
        
        # Initialize prompts and questions
        self._initialize_prompts()
        self.summary = self._load_existing_summary()
    
    
    def _initialize_prompts(self):
        """Initialize prompts for summary"""
        self.summary_prompt = f"""You are an expert summarization assistant tasked with creating a comprehensive and cohesive summary of a lecture, in the context of the class {self.course_title}. Follow these precise guidelines:\n"
                "1. Synthesize Information:\n"
                f"- Generate a summary that captures the OVERALL essence of the lecture\n"
                "- Exclude details specific to individual slides or instances\n"
                "- Focus on broad, generalizable concepts and key insights\n\n"
                "2. Formatting Requirements:\n"
                "- Combine term and definition into a SINGLE, concise bullet point\n"
                "- Ensure each bullet point is a complete, informative sentence\n"
                "- Avoid breaking definitions across multiple bullet points\n"
                "- Maintain a clear, flowing narrative that connects key points logically\n\n"
                "3. Content Criteria:\n"
                "- Prioritize the most significant and impactful information\n"
                "- Eliminate redundant or overly specific details\n"
                "- Present information in a way that provides a holistic understanding\n"
                "- Use precise, academic language that conveys depth and nuance\n\n"
                "4. Structure:\n"
                "- Begin with a brief introductory statement defining the core concept\n"
                "- Organize bullet points to create a logical progression of ideas\n"
                "- Ensure each point adds unique value to the overall summary\n\n"
                "5. Final Review:\n"
                "- Check that the summary reads as a cohesive, integrated overview\n"
                "- Verify that no point feels isolated or disconnected from the whole\n"
                "- Confirm that the summary provides a comprehensive yet concise understanding\n\n"
                "Generate the summary strictly adhering to these guidelines."
            """
        
    
    def _load_existing_summary(self):
        """Load existing summary from json file"""
        if os.path.exists(self.json_output_file):
            with open(self.json_output_file, "r") as file:
                return json.load(file)
        return {}
        
    def process_batch(self, name: str, content: str):
        message = HumanMessage(content=[
            {"type": "text", "text": self.summary_prompt},
            {"type": "text", "text": f"You should generate a summary for: {name}. INPUT: " + content + "\n\nYOUR OUTPUT: "},
        ])
        return self.robust_generate(message)
    
    def clean_result(self, result: str, lecture_name: str):
        """Clean up the result into the specified question format"""
        try:
            result = result.strip()
            if lecture_name not in self.summary:
                self.summary[lecture_name] = ""
            self.summary[lecture_name] += result
        
        except Exception as e:
            print(f"Error processing summary block: {str(e)}")
            
    def save_summary_json(self):
        with open(self.json_output_file, "w") as file:
            json.dump(self.summary, file, indent=4)

    def save_summary_pdf(self):
        """Save the questions as a PDF file.

        Args:
            file_path (str): The path to the output directory.
        """
        for name in self.summary.keys():
            os.makedirs(os.path.join(self.content_dir, name), exist_ok=True)
            self.save_summary_latex(name, self.summary[name], f"{self.content_type.value}_summary")
            

    def save_summary_text(self):
        """Save all summaries for each lecture concatenated into a single summary.txt file.
        
        Args:
            file_path (str): The path to the output directory.
        """
        for name in self.summary.keys():
            # Create lecture directory
            name_dir = os.path.join(self.content_dir, name)
            os.makedirs(name_dir, exist_ok=True)

            # Write all slides to single notes.txt file
            summary_path = os.path.join(name_dir, f"{self.content_type.value}_summary.txt")
            with open(summary_path, "w") as summary_file:
                summary_file.write(self.summary[name])
             
    def save_summary_supabase(self):
        """
        Save the questions to supabase. Will insert into the 'questions' table, with the following fields:
        question, solution, slide
        
        question: the question, with the options added onto it
        solution: the solution to the question, with the explanations added onto it
        slide: the slide number that the question is from
        """
        
        lecture_mapping = self.supabase.table("lectures").select("id, name").eq("class", self.class_id).execute().data
        lecture_mapping = {row["name"]: row["id"] for row in lecture_mapping}
        
        topic_mapping = self.supabase.table("topics").select("id, title").eq("class", self.class_id).execute().data
        topic_mapping = {row["title"]: row["id"] for row in topic_mapping}

        summaries_added = 0
        if self.content_type == ContentType.LECTURE:
            for lecture_name in self.summary.keys():
                self.supabase.table("summaries").insert({
                    "content": self.summary[lecture_name],
                    "lecture": lecture_mapping[lecture_name]
                }).execute()
                summaries_added += 1
        else:
            for topic_name in self.summary.keys():
                self.supabase.table("summaries").insert({
                    "content": self.summary[topic_name],
                    "topic": topic_mapping[topic_name]
                }).execute()
                summaries_added += 1
        print(f"Saved {summaries_added} summaries to supabase.")
        
    def save_summary_storage_supabase(self):
        """
        Save the questions to supabase storage.
        """
        for name in self.summary.keys():
            # check if summary.pdf exists
            if not os.path.exists(os.path.join(self.output_dir, self.course_code, self.content_type.value, f"{name}", "summary.pdf")):
                print(f"Skipping {name} - summary.pdf does not exist")
                continue
            response = self.supabase.storage.from_("slides").upload(
                file=os.path.join(self.output_dir, self.course_code, self.content_type.value, f"{name}", "summary.pdf"),
                path=f"{self.course_code}/{self.content_type.value}/{name}/summary.pdf",
                file_options={"cache-control": "3600", "upsert": "true"},
            )
            print(f"Saved {name} to supabase storage. Response: {response}")