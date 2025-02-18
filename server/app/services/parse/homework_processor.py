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

        Your task is to extract information in EXACTLY this format, following these strict rules:

        1. TITLE format: Must be "Homework X" where X is the number
        2. COURSE_NAME format: Must have a space between prefix and number, and omit trailing zeros
           - Correct: "MA 351" (not "MA 35100" or "MA35100")
           - Correct: "CSE 351" (not "CSE 35100" or "CSE35100")
           - Remove any trailing zeros from the course number
        3. HOMEWORK_DESCRIPTION: Include ONLY general homework information such as:
           - Due dates
           - Submission instructions
           - General formatting requirements
           - Important notes
           - General Advice/Instructions
           - DO NOT include any information about specific problems or exercises
           - DO NOT include the list of problems or any problem-specific instructions
        4. HOMEWORK_NUMBER: Just the number (e.g., "1", "2")
        5. For each PROBLEM:
           - CHAPTER: For section numbers like "1.2" or "2.3", use ONLY the first number (the chapter number)
             - Example: For section "1.2", CHAPTER should be "1"
             - Example: For section "2.3", CHAPTER should be "2"
             - Always take just the number before the decimal point
           - NUMBER: The sequential order of the problem in this homework assignment
             - Just use "1" for first problem, "2" for second problem, etc.
             - This is NOT the textbook exercise number
             - This is simply counting the problems in order: 1, 2, 3, ...
           - REFERENCE: Must follow this EXACT format: "X.YY (Type)"
             - X.YY is the exercise number (e.g., "1.65", "2.03")
             - (Type) must be one of: (Exercises), (True-False Questions), (Discussion Questions)
             - Examples of correct format:
               * "1.65 (Exercises)"
               * "2.03 (True-False Questions)"
             - DO NOT include:
               * Part numbers (a,b,c,d)
               * Additional instructions
               * Any other text
           - DESCRIPTION: Look for specific instructions that appear next to the problem number, often in parentheses
             - Example: "2.1 (Do parts a and c only)" -> DESCRIPTION should be "Do parts a and c only"
             - Only include instructions specific to this problem

        EXAMPLE OUTPUT (copy this format EXACTLY):
        <HOMEWORK>
            <TITLE>Homework 1</TITLE>
            <COURSE_NAME>MA 351</COURSE_NAME>
            <HOMEWORK_DESCRIPTION>
                Due Friday at 11:59pm. Submit your solutions through Canvas.
                You must show all work to receive full credit.
            </HOMEWORK_DESCRIPTION>
            <HOMEWORK_NUMBER>1</HOMEWORK_NUMBER>
            <PROBLEM>
                <CHAPTER>1</CHAPTER>
                <NUMBER>1</NUMBER>
                <REFERENCE>1.29 (Exercises)</REFERENCE>
                <DESCRIPTION>Do parts a and c only</DESCRIPTION>
            </PROBLEM>
            <PROBLEM>
                <CHAPTER>2</CHAPTER>
                <NUMBER>2</NUMBER>
                <REFERENCE>2.15 (True-False Questions)</REFERENCE>
                <DESCRIPTION>Justify your answer</DESCRIPTION>
            </PROBLEM>
        </HOMEWORK>

        STRICT RULES:
        1. Use EXACTLY the same tags as shown above
        2. Never split or duplicate tags
        3. Never add HTML formatting
        4. Keep all text within its designated tags
        5. Follow the exact indentation shown
        6. Include all required tags for each section
        7. REFERENCE format must be exactly "X.YY (Type)" with NO ADDITIONAL TEXT
        8. COURSE_NAME must omit trailing zeros from course number
        9. DESCRIPTION should only contain problem-specific instructions found next to the problem number
        
        INPUT:
        {text}
        
        OUTPUT (format exactly as shown in example):
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
            print(root)
            
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
                chapter_elem = problem.find('CHAPTER')
                number_elem = problem.find('NUMBER')
                reference_elem = problem.find('REFERENCE')
                description_elem = problem.find('DESCRIPTION')

                problem_info = {
                    "chapter": chapter_elem.text.strip() if chapter_elem is not None and chapter_elem.text else "",
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
        response = supabase.table('homeworks').insert(homework_record).execute()
        homework_id = response.data[0]['id']
        # upload the problems to the problems table
        for problem in homework_data['problems']:
            chapter_id = supabase.table('chapters').select('id').eq('chapter_number', problem['chapter']).execute().data[0]['id']
            print(f"Chapter ID: {chapter_id}")
            print(f"Problem Reference: {problem['reference']}")
            exercise_id = supabase.table('exercises').select('id').eq('chapter', chapter_id).eq('title', problem['reference']).execute().data[0]['id']
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
    homework = process_homework('HW2.pdf')
    print(json.dumps(homework, indent=2))
    upload_homework_and_problems_to_supabase(homework, 'HW2.pdf')
