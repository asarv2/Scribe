# initial_course_processor.py

import os
import google.generativeai as genai
import re
from typing import Dict, List, Any, Tuple
from datetime import datetime
import json
import shutil
from dotenv import load_dotenv

load_dotenv()

class InitialCourseProcessor:
    def __init__(self, api_key: str, course_dir: str, class_id: str):
        """
        Initialize the course processor.
        
        Args:
            api_key: Gemini API key
            course_dir: Base directory containing course files
            class_id: Unique identifier for the class
        """
        self.course_dir = course_dir
        self.class_id = class_id
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-001')
        self.metadata_file = os.path.join(course_dir, "metadata.json")
        
    def get_directory_structure(self, root_dir: str = None) -> str:
        """
        Generate a tree-like representation of the directory structure.
        
        Args:
            root_dir: Directory to start from (defaults to course_dir)
            
        Returns:
            String representation of the directory structure
        """
        if root_dir is None:
            root_dir = self.course_dir
            
        result = []
        
        def generate_tree(dir_path, prefix=""):
            # Get all items in the directory
            items = sorted(os.listdir(dir_path))
            
            # Process each item
            for i, item in enumerate(items):
                # Skip hidden files and directories
                if item.startswith('.'):
                    continue
                    
                # Full path to the item
                full_path = os.path.join(dir_path, item)
                
                # Check if this is the last item in the directory
                is_last = i == len(items) - 1
                
                # Add the item to the result
                if is_last:
                    result.append(f"{prefix}└── {item}")
                    new_prefix = prefix + "    "
                else:
                    result.append(f"{prefix}├── {item}")
                    new_prefix = prefix + "│   "
                
                # Recursively process subdirectories
                if os.path.isdir(full_path):
                    generate_tree(full_path, new_prefix)
        
        # Start the tree generation
        result.append(os.path.basename(root_dir))
        generate_tree(root_dir, "")
        
        return "\n".join(result)
    
    def check_for_changes(self) -> Tuple[bool, List[str]]:
        """
        Check if there are new files or changes since the last processing.
        
        Returns:
            Tuple of (bool, list): True if changes detected, False otherwise, and list of new files
        """
        # If metadata file doesn't exist, this is the first run
        new_files = []
        
        if not os.path.exists(self.metadata_file):
            # Get all files for first run
            for root, _, files in os.walk(self.course_dir):
                for file in files:
                    if file == "metadata.json":
                        continue
                    new_files.append(os.path.join(root, file))
            return True, new_files
            
        try:
            # Load previous metadata
            with open(self.metadata_file, 'r') as f:
                metadata = json.load(f)
                
            last_processed_time = metadata.get('last_processed_time')
            last_file_list = set(metadata.get('files', []))
            
            # Get current file list
            current_files = []
            for root, _, files in os.walk(self.course_dir):
                for file in files:
                    # Skip metadata.json itself
                    if file == "metadata.json":
                        continue
                    current_files.append(os.path.join(root, file))
            
            current_file_list = set(current_files)
            
            # Find new files
            new_files = list(current_file_list - last_file_list)
            
            # Check if files have been added or removed
            if current_file_list != last_file_list:
                return True, new_files
                
            # Check if any files have been modified since last processing
            modified_files = []
            for file_path in current_file_list:
                if os.path.exists(file_path):
                    mod_time = os.path.getmtime(file_path)
                    if last_processed_time and mod_time > last_processed_time:
                        modified_files.append(file_path)
                        
            if modified_files:
                new_files.extend(modified_files)
                return True, new_files
                
            return False, []
            
        except Exception as e:
            print(f"Error checking for changes: {str(e)}")
            # Process again if there's an error, treat all files as new
            for root, _, files in os.walk(self.course_dir):
                for file in files:
                    if file == "metadata.json":
                        continue
                    new_files.append(os.path.join(root, file))
            return True, new_files
    
    def categorize_files(self, directory_structure: str) -> str:
        """
        Use Gemini to categorize files into lectures, assignments, and readings.
        
        Args:
            directory_structure: String representation of the directory structure
            
        Returns:
            XML string with categorized files
        """
        prompt = """
        You are an expert at organizing course materials for university classes.

        Your task is to analyze the directory structure below and categorize files into the following groups:
        1. Lectures/Notes
        2. Homeworks/Assignments
        3. Textbooks/Readings
        4. Exams/Quizzes
        5. Syllabus/Course Info
        6. Other

        Return your analysis in EXACTLY this XML format:

        <COURSE_ORGANIZATION>
            <LECTURES>
                <ITEM>path/to/lecture1.pdf</ITEM>
                <ITEM>path/to/lecture2.pptx</ITEM>
                <!-- Add all lecture/notes files here -->
            </LECTURES>
            <ASSIGNMENTS>
                <ITEM>path/to/homework1.pdf</ITEM>
                <ITEM>path/to/project.docx</ITEM>
                <!-- Add all homework/assignment files here -->
            </ASSIGNMENTS>
            <READINGS>
                <ITEM>path/to/textbook.pdf</ITEM>
                <ITEM>path/to/article.pdf</ITEM>
                <!-- Add all textbook/reading files here -->
            </READINGS>
            <EXAMS>
                <ITEM>path/to/midterm.pdf</ITEM>
                <ITEM>path/to/quiz1.docx</ITEM>
                <!-- Add all exam/quiz files here -->
            </EXAMS>
            <SYLLABUS>
                <ITEM>path/to/syllabus.pdf</ITEM>
                <ITEM>path/to/schedule.docx</ITEM>
                <!-- Add all syllabus/course info files here -->
            </SYLLABUS>
            <OTHER>
                <ITEM>path/to/other_file.zip</ITEM>
                <!-- Add any files that don't fit the categories above -->
            </OTHER>
        </COURSE_ORGANIZATION>

        CATEGORIZATION GUIDELINES:
        - Lectures/Notes: Files containing lecture slides, notes, recordings, or class materials
        - Homeworks/Assignments: Files related to homework, projects, labs, or any graded assignments
        - Textbooks/Readings: PDF books, articles, papers, or any required reading materials
        - Exams/Quizzes: Past exams, practice tests, quizzes, or exam preparation materials
        - Syllabus/Course Info: Course syllabus, schedules, policies, or general course information
        - Other: Any files that don't clearly fit into the above categories

        Use these clues to categorize files:
        - File names containing words like "lecture", "notes", "slides", "class" → Lectures
        - File names containing words like "homework", "hw", "assignment", "project", "lab" → Assignments
        - File names containing words like "textbook", "book", "reading", "article", "paper" → Readings
        - File names containing words like "exam", "test", "quiz", "midterm", "final" → Exams
        - File names containing words like "syllabus", "schedule", "policy", "outline" → Syllabus
        
        If you're unsure about a file, use the Other category.
        Include the FULL PATH to each file as shown in the directory structure.
        
        DIRECTORY STRUCTURE:
        {directory_structure}
        
        OUTPUT (format exactly as shown in example):
        """
        
        try:
            response = self.model.generate_content(prompt.format(directory_structure=directory_structure))
            print(f"Gemini response: {response.text}")
            return response.text
        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")
    
    def parse_organization_xml(self, xml_string: str) -> Dict[str, Any]:
        """
        Parse the XML organization into a structured format.
        
        Args:
            xml_string: XML string from Gemini
            
        Returns:
            Dictionary with categorized files
        """
        try:
            # Clean up the XML string
            xml_string = xml_string.strip()
            
            # Extract the COURSE_ORGANIZATION content using regex
            org_pattern = r'<COURSE_ORGANIZATION>(.*?)</COURSE_ORGANIZATION>'
            match = re.search(org_pattern, xml_string, re.DOTALL)
            
            if not match:
                raise ValueError("Could not find COURSE_ORGANIZATION tags in the response")
            
            # Create a properly formatted XML string
            cleaned_xml = f"<COURSE_ORGANIZATION>{match.group(1)}</COURSE_ORGANIZATION>"
            
            # Extract items for each category
            categories = {
                "lectures": self._extract_xml_items(cleaned_xml, 'LECTURES'),
                "assignments": self._extract_xml_items(cleaned_xml, 'ASSIGNMENTS'),
                "readings": self._extract_xml_items(cleaned_xml, 'READINGS'),
                "exams": self._extract_xml_items(cleaned_xml, 'EXAMS'),
                "syllabus": self._extract_xml_items(cleaned_xml, 'SYLLABUS'),
                "other": self._extract_xml_items(cleaned_xml, 'OTHER')
            }
            
            return {
                "categories": categories
            }
            
        except Exception as e:
            print(f"XML Content being parsed: {xml_string}")
            print(f"Error details: {str(e)}")
            raise Exception(f"Error parsing organization XML: {str(e)}")
    
    def _extract_xml_element(self, xml_string: str, tag_name: str) -> str:
        """Extract content from an XML tag using regex."""
        pattern = f"<{tag_name}>(.*?)</{tag_name}>"
        match = re.search(pattern, xml_string, re.DOTALL)
        if match:
            # Clean up whitespace in the extracted content
            return re.sub(r'\s+', ' ', match.group(1)).strip()
        return ""
    
    def _extract_xml_items(self, xml_string: str, tag_name: str) -> List[str]:
        """Extract all ITEM elements within a category tag."""
        # First extract the category section
        pattern = f"<{tag_name}>(.*?)</{tag_name}>"
        match = re.search(pattern, xml_string, re.DOTALL)
        
        if not match:
            return []
            
        category_content = match.group(1)
        
        # Then extract all ITEM tags within that section
        item_pattern = r"<ITEM>(.*?)</ITEM>"
        items = re.findall(item_pattern, category_content, re.DOTALL)
        
        # Clean up each item
        return [re.sub(r'\s+', ' ', item).strip() for item in items]
    
    def save_metadata(self, organization: Dict[str, Any]) -> None:
        """
        Save the organization metadata and processing timestamp.
        
        Args:
            organization: Dictionary with categorized files
        """
        # Get current file list
        current_files = []
        for root, _, files in os.walk(self.course_dir):
            for file in files:
                # Skip metadata.json itself
                if file == "metadata.json":
                    continue
                current_files.append(os.path.join(root, file))
        
        # Create metadata
        metadata = {
            "class_id": self.class_id,
            "categories": organization.get("categories", {}),
            "last_processed_time": datetime.now().timestamp(),
            "files": current_files
        }
        
        # Save metadata
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
    
    def create_formatted_structure(self, organization: Dict[str, Any]) -> None:
        """
        Create a formatted directory structure based on categorization.
        
        Args:
            organization: Dictionary with categorized files
        """
        # Create format directory at the same level as base
        parent_dir = os.path.dirname(self.course_dir)
        format_dir = os.path.join(parent_dir, "format")
        
        # Create category subdirectories
        categories = {
            "lectures": os.path.join(format_dir, "lectures"),
            "assignments": os.path.join(format_dir, "assignments"),
            "readings": os.path.join(format_dir, "readings"),
            "exams": os.path.join(format_dir, "exams"),
            "syllabus": os.path.join(format_dir, "syllabus"),
            "other": os.path.join(format_dir, "other")
        }
        
        # Define allowed file extensions for each category
        allowed_extensions = {
            "lectures": [".pdf"],
            "assignments": [".pdf", ".txt"],
            "readings": [".pdf"],
            "exams": [],  # No restrictions
            "syllabus": [],  # No restrictions
            "other": []  # No restrictions
        }
        
        # Create directories if they don't exist
        os.makedirs(format_dir, exist_ok=True)
        for category_dir in categories.values():
            os.makedirs(category_dir, exist_ok=True)
        
        # Move files to their respective directories
        for category, items in organization.get("categories", {}).items():
            for item_path in items:
                # Fix the path - remove the base directory name if it's included
                base_name = os.path.basename(self.course_dir)
                if item_path.startswith(base_name):
                    item_path = item_path[len(base_name):].lstrip('/')
                
                # Get the full source path
                source_path = os.path.join(self.course_dir, item_path)
                
                # Skip if the source doesn't exist
                if not os.path.exists(source_path):
                    print(f"Source file not found: {source_path}")
                    continue
                
                # Check file extension restrictions
                _, file_extension = os.path.splitext(source_path)
                file_extension = file_extension.lower()
                
                # Skip files with disallowed extensions
                if allowed_extensions[category] and file_extension not in allowed_extensions[category]:
                    print(f"Skipping {source_path}: {file_extension} files not allowed in {category} category")
                    # Move to "other" category instead
                    if category != "other":
                        filename = os.path.basename(source_path)
                        other_dest_path = os.path.join(categories["other"], filename)
                        try:
                            print(f"Moving to 'other' category: {source_path} to {other_dest_path}")
                            shutil.copy2(source_path, other_dest_path)
                        except Exception as e:
                            print(f"Error copying to 'other' category: {str(e)}")
                    continue
                
                # Get the destination path
                filename = os.path.basename(source_path)
                dest_path = os.path.join(categories[category], filename)
                
                # Copy the file (using copy instead of move to preserve original structure)
                try:
                    print(f"Copying {source_path} to {dest_path}")
                    shutil.copy2(source_path, dest_path)
                except Exception as e:
                    print(f"Error copying {source_path} to {dest_path}: {str(e)}")
    
    def process_course(self) -> Dict[str, Any]:
        """
        Process the course directory and categorize files.
        
        Returns:
            Dictionary with categorized files and new files
        """
        try:
            # Check if processing is needed
            has_changes, new_files = self.check_for_changes()
            
            if not has_changes:
                # Load existing metadata if no changes
                with open(self.metadata_file, 'r') as f:
                    organization = json.load(f)
                    # Create formatted structure even if using cached data
                    self.create_formatted_structure(organization)
                    organization['new_files'] = []  # No new files
                    return organization
            
            # Get directory structure
            directory_structure = self.get_directory_structure()
            
            # Categorize files
            xml_response = self.categorize_files(directory_structure)
            
            # Parse the response
            organization = self.parse_organization_xml(xml_response)
            
            # Add the list of new files to the organization
            organization['new_files'] = new_files
            
            # Create formatted directory structure
            self.create_formatted_structure(organization)
            
            # Save metadata
            self.save_metadata(organization)
            
            return organization
            
        except Exception as e:
            print(f"Error processing course: {str(e)}")
            # Return empty organization if processing fails
            return {
                "categories": {
                    "lectures": [],
                    "assignments": [],
                    "readings": [],
                    "exams": [],
                    "syllabus": [],
                    "other": []
                },
                "new_files": []
            }

# if __name__ == "__main__":
#     api_key = os.getenv("GEMINI_API_KEY")
#     course_dir = "/Users/ashoksaravanan/Coding/ScribeLec/server/uploads/courses/11d5b457-6f87-4ea3-94ec-c04b2138ceb3/base"
#     class_id = "11d5b457-6f87-4ea3-94ec-c04b2138ceb3"
#     processor = InitialCourseProcessor(api_key, course_dir, class_id)
#     organization = processor.process_course()
#     print(organization)
