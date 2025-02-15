# go from PDF to a list of problems
import os
import json
import re
from typing import Dict, Any, List, Tuple
from pypdf import PdfReader
import google.generativeai as genai
from xml.etree import ElementTree as ET
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()

class HomeworkExtractor:
    def __init__(self, api_key: str, pdf_path: str):
        self.reader = PdfReader(pdf_path)
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        
    def extract_text_from_pdf(self, start_page: int = 0, end_page: int = None) -> str:
        """Extract text from PDF pages."""
        try:
            if end_page is None:
                end_page = len(self.reader.pages) - 1
                
            text = []
            for page_num in range(start_page, end_page + 1):
                page_text = self.reader.pages[page_num].extract_text()
                text.append(page_text)
            
            return text
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")

    def extract_problems_and_description(self, text: str) -> str:
        """Extract homework problems and additional information using Gemini."""
        prompt = """
        You are an expert at extracting homework problems and additional information from assignments.

        Before identifying the problems, you need to identify:
        1. The homework title which usually looks like "Homework 1", "Homework 2", etc.
        2. Course name (make sure to SEPERATE the course prefix and the course number with a space. FOR EXAMPLE: MA 351, CSE 351, etc.)
        3. Homework description (instructions, due dates, etc.) that appears before the problems (usually under the label "Important Notes" or "General Advice" or something similar)
        4. Homework number (e.g. "1", "2", etc.)

        For each problem in the homework, you need to identify:
        1. The problem number
        2. The textbook exercise reference (e.g., "Exercise 2.1" or "Section 3.4 #5")
        3. Any additional instructions or requirements specific to that problem (the additional instructions are usually next to the problem number)
        
        Format your response EXACTLY like this example:
        <HOMEWORK>
            <TITLE>Homework 1</TITLE>
            <COURSE_NAME>MATH 351</COURSE_NAME>
            <HOMEWORK_DESCRIPTION>
                You should only submit required problems.
                Students need to write full solutions rather than the answer to get the full mark.
            </HOMEWORK_DESCRIPTION>
            <HOMEWORK_NUMBER>1</HOMEWORK_NUMBER>
            <PROBLEM>
                <NUMBER>1</NUMBER>
                <REFERENCE>2.1 (Exercise)</REFERENCE>
                <DESCRIPTION>Complete parts (a) and (c) only. Show all steps of your work.</DESCRIPTION>
            </PROBLEM>
            <PROBLEM>
                <NUMBER>2</NUMBER>
                <REFERENCE>2.3 (True-False Questions)</REFERENCE>
                <DESCRIPTION>Use the method discussed in class to solve this problem.</DESCRIPTION>
            </PROBLEM>
        </HOMEWORK>

        Important:
        - Include ALL text that describes what needs to be done for each problem in the DESCRIPTION tag
        - Make sure each PROBLEM has all three tags: NUMBER, REFERENCE, and DESCRIPTION
        - Put any general homework instructions in HOMEWORK_DESCRIPTION
        - Use the exact tag names shown above
        
        INPUT:
        {text}
        
        OUTPUT:
        """
        
        try:
            response = self.model.generate_content(prompt.format(text=text))
            return response.text
        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")

    def parse_homework_xml(self, xml_string: str) -> Dict[str, List[Dict[str, str]]]:
        """Parse the XML homework into a structured format."""
        try:
            root = ET.fromstring(xml_string)
            print(xml_string)
            
            homework_structure = {
                "title": "",
                "course_name": "",
                "homework_number": "",
                "homework_description": "",  # Changed from "description" to match the tag
                "problems": []
            }

            # Extract homework title if it exists
            title_elem = root.find('TITLE')
            if title_elem is not None and title_elem.text:
                homework_structure["title"] = title_elem.text.strip()
            
            # Extract course name if it exists
            course_elem = root.find('COURSE_NAME')
            if course_elem is not None and course_elem.text:
                homework_structure["course_name"] = course_elem.text.strip()
            
            # Extract homework number if it exists
            number_elem = root.find('HOMEWORK_NUMBER')
            if number_elem is not None and number_elem.text:
                homework_structure["homework_number"] = number_elem.text.strip()
            
            # Extract homework description if it exists
            description_elem = root.find('HOMEWORK_DESCRIPTION')  # Updated tag name
            if description_elem is not None and description_elem.text:
                homework_structure["homework_description"] = description_elem.text.strip()
            
            # Extract problems as before
            for problem in root.findall('PROBLEM'):
                number_elem = problem.find('NUMBER')
                reference_elem = problem.find('REFERENCE')
                description_elem = problem.find('DESCRIPTION')

                problem_info = {
                    "number": number_elem.text.strip() if number_elem is not None and number_elem.text else "",
                    "reference": reference_elem.text.strip() if reference_elem is not None and reference_elem.text else "",
                    "description": description_elem.text.strip() if description_elem is not None and description_elem.text else ""
                }
                homework_structure["problems"].append(problem_info)
            
            return homework_structure
        except Exception as e:
            print(f"XML Content being parsed: {xml_string}")
            print(f"Error details: {str(e)}")
            raise Exception(f"Error parsing problems XML: {str(e)}")

def process_homework(pdf_filename: str):
    """Main function to process homework PDF."""
    API_KEY = os.getenv('GOOGLE_API_KEY')
    
    # Setup paths
    BASE_DIR = '/app' if os.getenv('DOCKER_ENV') else os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
    pdf_path = os.path.join(UPLOADS_DIR, pdf_filename)
    
    # Initialize extractor
    extractor = HomeworkExtractor(API_KEY, pdf_path)
    
    # Extract text from all pages
    text = extractor.extract_text_from_pdf()
    formatted_text = "\n".join([f"<PAGE {i+1}>\n{page}\n</PAGE {i+1}>" for i, page in enumerate(text)])
    
    # Extract problems using Gemini
    problems_xml = extractor.extract_problems_and_description(formatted_text)
    
    # Parse the problems
    homework = extractor.parse_homework_xml(problems_xml)
    
    # Save to JSON file
    output_path = os.path.join(UPLOADS_DIR, f'homework_{pdf_filename}.json')
    with open(output_path, 'w') as f:
        json.dump(homework, f, indent=2)
    
    return homework

def upload_homework_and_problems_to_supabase(homework_data: dict, pdf_filename: str):
    """Upload processed homework data to Supabase."""
    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

    # get the class id from the classes table using the course name
    class_id = supabase.table('classes').select('id').eq('class_code', homework_data['course_name']).execute().data[0]['id']

    # Prepare data for upload
    homework_record = {
        'title': homework_data['title'],
        'class': class_id,
        'additional_info': homework_data['homework_description'],
        'homework_number': homework_data['homework_number']
    }

    try:
        # Insert into homework table
        response = supabase.table('homework').insert(homework_record).execute()
        homework_id = response.data[0]['id']
        # upload the problems to the problems table
        for problem in homework_data['problems']:
            exercise_id = supabase.table('exercises').select('id').eq('title', problem['reference']).execute().data[0]['id']
            problem_record = {
                'exercise': exercise_id,
                'additional_info': problem['description'],
                'homework': homework_id,
                'problem_number': problem['number']
            }
            response = supabase.table('problems').insert(problem_record).execute()
            return response.data[0]
    except Exception as e:
        raise Exception(f"Error uploading to Supabase: {str(e)}")
    
    

if __name__ == "__main__":
    homework = process_homework('HW1.pdf')
    print(json.dumps(homework, indent=2))
    upload_homework_and_problems_to_supabase(homework, 'HW1.pdf')