# syllabus_processor.py 

import os
from typing import Dict, Any
import docx2txt
from pypdf import PdfReader
import google.generativeai as genai
from xml.etree import ElementTree as ET
from dotenv import load_dotenv
import re

load_dotenv()

class SyllabusProcessor:
    def __init__(self, api_key: str, file_path: str):
        self.file_path = file_path
        self.file_extension = os.path.splitext(file_path)[1].lower()
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-001')
        
    def extract_text(self) -> str:
        """Extract text from the syllabus file based on file type."""
        try:
            if self.file_extension == '.pdf':
                return self._extract_text_from_pdf()
            elif self.file_extension in ['.docx', '.doc']:
                return self._extract_text_from_docx()
            elif self.file_extension == '.txt':
                return self._extract_text_from_txt()
            else:
                raise ValueError(f"Unsupported file type: {self.file_extension}")
        except Exception as e:
            raise Exception(f"Error extracting text from {self.file_extension} file: {str(e)}")
    
    def _extract_text_from_pdf(self, max_pages: int = 5) -> str:
        """Extract text from the first few pages of a PDF file."""
        try:
            reader = PdfReader(self.file_path)
            # Only process the first few pages where course info is typically found
            end_page = min(max_pages, len(reader.pages))
                
            text = []
            for page_num in range(end_page):
                page_text = reader.pages[page_num].extract_text()
                text.append(page_text)
            
            return "\n".join(text)
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")
    
    def _extract_text_from_docx(self) -> str:
        """Extract text from a Word document."""
        try:
            return docx2txt.process(self.file_path)
        except Exception as e:
            raise Exception(f"Error reading Word document: {str(e)}")
    
    def _extract_text_from_txt(self) -> str:
        """Extract text from a plain text file."""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except UnicodeDecodeError:
            # Try with a different encoding if UTF-8 fails
            with open(self.file_path, 'r', encoding='latin-1') as file:
                return file.read()
        except Exception as e:
            raise Exception(f"Error reading text file: {str(e)}")

    def extract_course_info(self, text: str) -> str:
        """Extract course information using Gemini."""
        prompt = """
        You are an expert at extracting course information from university syllabi.

        Your task is to extract the following information in EXACTLY this XML format:

        <COURSE_INFO>
            <COURSE_CODE>ABC 123</COURSE_CODE>
            <COURSE_TITLE>Introduction to Example</COURSE_TITLE>
            <COURSE_DESCRIPTION>
                A brief description of the course content and objectives.
                This may span multiple lines.
            </COURSE_DESCRIPTION>
            <INSTRUCTOR>Dr. Example Professor</INSTRUCTOR>
            <TERM>Fall 2023</TERM>
        </COURSE_INFO>

        STRICT RULES:
        1. COURSE_CODE format: Must have a space between prefix and number (e.g., "CS 101" not "CS101")
           - Remove any section numbers or additional identifiers
           - Examples: "MA 351", "PHYS 272", "CSE 142"
        
        2. COURSE_TITLE: The official name of the course
           - Do not include the course code in the title
           - Capitalize appropriately
           - Examples: "Introduction to Computer Science", "Calculus I", "Organic Chemistry"
        
        3. COURSE_DESCRIPTION: Include a concise description of the course
           - Focus on course content, objectives, and learning outcomes
           - Limit to 3-5 sentences that best summarize the course
           - Do not include administrative details like grading policies
        
        4. INSTRUCTOR: The primary professor's name with appropriate title
           - Format as "Dr. First Last" or "Prof. First Last" as appropriate
           - If multiple instructors, list the primary one only
        
        5. TERM: The academic term when the course is offered
           - Format as "Season Year" (e.g., "Fall 2023", "Spring 2024")
           - If not specified, make your best guess based on dates in the document

        If you cannot find specific information, use these placeholders:
        - For missing COURSE_CODE: "UNKNOWN 000"
        - For missing COURSE_TITLE: "Untitled Course"
        - For missing COURSE_DESCRIPTION: "No description available."
        - For missing INSTRUCTOR: "Instructor not specified"
        - For missing TERM: "Term not specified"

        INPUT:
        {text}
        
        OUTPUT (format exactly as shown in example):
        """
        
        try:
            response = self.model.generate_content(prompt.format(text=text))
            return response.text
        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")

    def parse_course_info_xml(self, xml_string: str) -> Dict[str, Any]:
        """Parse the XML course info into a structured format."""
        try:
            # Clean up the XML string to handle potential formatting issues
            xml_string = xml_string.strip()
            
            # Extract the COURSE_INFO content using regex to handle malformed XML
            course_info_pattern = r'<COURSE_INFO>(.*?)</COURSE_INFO>'
            match = re.search(course_info_pattern, xml_string, re.DOTALL)
            
            if not match:
                raise ValueError("Could not find COURSE_INFO tags in the response")
            
            # Create a properly formatted XML string
            cleaned_xml = f"<COURSE_INFO>{match.group(1)}</COURSE_INFO>"
            
            # Replace multiple whitespaces and newlines with single spaces in the XML
            cleaned_xml = re.sub(r'\s+', ' ', cleaned_xml)
            
            # Extract individual elements using regex
            course_info = {
                "course_code": self._extract_xml_element(cleaned_xml, 'COURSE_CODE'),
                "course_title": self._extract_xml_element(cleaned_xml, 'COURSE_TITLE'),
                "course_description": self._extract_xml_element(cleaned_xml, 'COURSE_DESCRIPTION'),
                "instructor": self._extract_xml_element(cleaned_xml, 'INSTRUCTOR'),
                "term": self._extract_xml_element(cleaned_xml, 'TERM')
            }
            
            return course_info
        except Exception as e:
            print(f"XML Content being parsed: {xml_string}")
            print(f"Error details: {str(e)}")
            raise Exception(f"Error parsing course info XML: {str(e)}")

    def _extract_xml_element(self, xml_string: str, tag_name: str) -> str:
        """Extract content from an XML tag using regex."""
        pattern = f"<{tag_name}>(.*?)</{tag_name}>"
        match = re.search(pattern, xml_string, re.DOTALL)
        if match:
            # Clean up whitespace in the extracted content
            return re.sub(r'\s+', ' ', match.group(1)).strip()
        return ""

    def process(self) -> Dict[str, Any]:
        """Process the syllabus and extract course information."""
        try:
            text = self.extract_text()
            xml_response = self.extract_course_info(text)
            course_info = self.parse_course_info_xml(xml_response)
            return course_info
        except Exception as e:
            print(f"Error processing syllabus: {str(e)}")
            # Return default values if processing fails
            return {
                "course_code": "UNKNOWN 000",
                "course_title": os.path.basename(self.file_path),
                "course_description": "No description available.",
                "instructor": "Instructor not specified",
                "term": "Term not specified"
            }


# if __name__ == "__main__":
#     processor = SyllabusProcessor(api_key=os.getenv("GEMINI_API_KEY"), file_path="/Users/ashoksaravanan/Coding/ScribeLec/server/uploads/courses/a3aabdd3-bb5b-433f-b7aa-8cf2a57c8c2c/syllabus/20250304_233423_COM 217 Syllabus Spring 25_updated_1.7.25.docx")
#     course_info = processor.process()
#     print(course_info)