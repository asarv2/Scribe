from typing import Dict, List, Any
from supabase import Client
import fitz
import re
import xml.etree.ElementTree as ET
import json
import os
import google.generativeai as genai
import logging

logger = logging.getLogger(__name__)


class ProblemsExtractor:
    def __init__(self, api_key: str):
        self.api_key = api_key


    def extract_exercises_from_text(self, text: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract exercises from text using Gemini."""
        prompt = """
        You are an expert at extracting problems from a homework assignment.

        Please analyze the following text and extract the individual problems in this exact format:
        1. Enclose your response in <HOMEWORK> </HOMEWORK> tags.

        2. Use <TITLE>a</TITLE> tags to enclose the title of the homework, where a is the title of the homework.

        3. Use a <DUE>b</DUE> tag to enclose the due date of the homework, where b is the due date in the format month-day-year. An example is <DUE>02-25-2025</DUE>.

        4. Use <PROBLEM> and </PROBLEM> tags to start and end each of the problems. Enclose the problem information in these tags.

            4. For each part in the given problem, use <PART> and </PART> tags. Enclose the part information in these tags. If no parts are given, just use a singular <PART> </PART> tag. An example is <PART> </PART>.

            5. Within each <PART> tag, use the following tags to enclose the information for the textbooks used, pages needed, exercises required, or other additional information:

                6. Use <TEXTBOOK> and </TEXTBOOK> tags to enclose the information for the textbooks used. The name and textbook numbers for the course will be given to you so you know which textbook number to use.

                    7. Use <TEXTBOOK_NUMBER>c</TEXTBOOK_NUMBER> tags to enclose the textbook number, where c is the textbook number.

                    8. Use <EXERCISE>d</EXERCISE> tags to enclose the information for the exercises needed, where d is the name of the exercise. Avoid using the word "Exercise" or "Exercise d" in the <EXERCISE> tag.
                    
                    9. Use <PAGE>e</PAGE> or <PAGE>e-f</PAGE> tags to enclose the starting page number of each problem, where e is the page number where the problem starts and f is the page number where the problem ends. If the problem spans multiple pages, use the page range format (e.g., <PAGE>2-3</PAGE>).
                
                10. Use <GIVEN></GIVEN> tags to enclose the information for the given information in the problem. This is distinct from additional information, and should only be used for the information that is part of the problem statement.

            11. Use <INFO></INFO> tags to enclose the additional information/instructions in the problem. This is distinct from the given information, and should only be used for the information that is not part of the problem statement.

        Here is an example of what a response could look like:

        Given: 

        Textbook Name: Linear Programming, Foundations and Extensions, 5th edition, Robert J. Vanderbei, Springer. [V]
        Textbook Number: 1

        Textbook Name: Understanding and Using Linear Programming, Jiri Matousek and Bernd Gartner, Springer. [MG]
        Textbook Number: 2

        Textbook Name: Linear Programming, Vasek Chvatal. [C]
        Textbook Number: 3


        Output: 

        <HOMEWORK>
            <TITLE>Homework 10</TITLE>
            <DUE>02-25-2025</DUE>
            <PROBLEM>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <PAGE>10</PAGE>
                        <EXERCISE>1.2</EXERCISE>
                    </TEXTBOOK>
                </PART>
            </PROBLEM>
            <PROBLEM>
                <PART>
                    <GIVEN>Find the maximum value of z = 2x + 3y subject to the following constraints:</GIVEN>
                </PART>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>2.1</EXERCISE>
                    </TEXTBOOK>
                </PART>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>2.2</EXERCISE>
                    </TEXTBOOK>
                </PART>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>2.5</EXERCISE>
                    </TEXTBOOK>
                </PART>
                <INFO>
                    Use simplex method to solve 2.1, 2.2, 2.5, following the procedure in p.11-14. For 2.2 and 2.5, you also need to draw in R^2 the feasible set and also the sequence of vertices you go through during the simplex method. For your graphs, use one page for each problem. See p.21 for an example of such a graph. For 2.10, you can use whatever method. If you can "visualize" the geometry of the problem, even in R^4, then the solution is extremely simple.
                </INFO>
            </PROBLEM>
            <PROBLEM>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>3.1</EXERCISE>
                    </TEXTBOOK>
                </PART>
            </PROBLEM>
        </HOMEWORK>

        Now, it is your turn to analyze the following text and extract the homework info and problems in the exact format specified above. Only output the homework info and problems, nothing else. Do not use any other tags than the ones specified above. 

        INPUT: 
        {text}

        OUTPUT:

        """
        print(prompt.format(text=text))
        
        try:
            # Initialize Gemini
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-2.0-flash-001')
            
            # Format the prompt with textbook info and input text
            formatted_prompt = prompt.format(text=text)
            response = model.generate_content(formatted_prompt)

            print(response.text.strip())
            
            return self._parse_homework_xml(response.text.strip())
        except Exception as e:
            logger.error(f"Error extracting exercises: {str(e)}")
            return {"problems": []}

    def _parse_homework_xml(self, xml_string: str) -> Dict[str, List[Dict[str, Any]]]:
        """Parse the XML homework response into a structured format."""
        try:
            # Check if xml_string is empty or invalid
            if not xml_string or not xml_string.strip():
                return {"problems": []}

            # Clean up incomplete XML by finding complete problems
            problem_pattern = r'<PROBLEM>.*?</PROBLEM>'
            complete_problems = re.findall(problem_pattern, xml_string, re.DOTALL)
            
            # Include the title and due date sections if they exist
            title_pattern = r'<TITLE>.*?</TITLE>'
            due_date_pattern = r'<DUE>.*?</DUE>'
            
            title_match = re.search(title_pattern, xml_string, re.DOTALL)
            due_date_match = re.search(due_date_pattern, xml_string, re.DOTALL)
            
            title_section = title_match.group(0) if title_match else ""
            due_date_section = due_date_match.group(0) if due_date_match else ""
            
            cleaned_xml = f"<HOMEWORK>{title_section}{due_date_section}{''.join(complete_problems)}</HOMEWORK>"
            
            root = ET.fromstring(cleaned_xml)
            
            homework_structure = {
                "title": None,
                "due_date": None,
                "problems": []
            }

            # Extract title if present
            title_elem = root.find('TITLE')
            if title_elem is not None and title_elem.text:
                homework_structure["title"] = title_elem.text.strip()

            # Extract due date if present
            due_date_elem = root.find('DUE')
            if due_date_elem is not None and due_date_elem.text:
                homework_structure["due_date"] = due_date_elem.text.strip()

            # Process each problem
            for problem in root.findall('PROBLEM'):
                problem_info = {
                    "parts": [],
                    "info": None,
                }

                # Extract parts
                for part in problem.findall('PART'):
                    part_info = {}
                    
                    # Extract textbook information if present
                    textbook = part.find('TEXTBOOK')
                    if textbook is not None:
                        textbook_info = {}
                        
                        textbook_num = textbook.find('TEXTBOOK_NUMBER')
                        if textbook_num is not None and textbook_num.text:
                            textbook_info["number"] = textbook_num.text.strip()
                        
                        exercise = textbook.find('EXERCISE')
                        if exercise is not None and exercise.text:
                            textbook_info["exercise"] = exercise.text.strip()
                        
                        page = textbook.find('PAGE')
                        if page is not None and page.text:
                            textbook_info["page"] = page.text.strip()
                        
                        if textbook_info:
                            part_info["textbook"] = textbook_info

                    # Extract given information if present
                    given = part.find('GIVEN')
                    if given is not None and given.text:
                        part_info["given"] = given.text.strip()

                    if part_info:
                        problem_info["parts"].append(part_info)

                # Extract additional information if present
                info = problem.find('INFO')
                if info is not None and info.text:
                    problem_info["info"] = info.text.strip()

                if problem_info["parts"] or problem_info["info"]:
                    homework_structure["problems"].append(problem_info)

            return homework_structure
            
        except ET.ParseError as e:
            logger.error(f"Invalid XML format: {str(e)}")
            return {"problems": []}
        except Exception as e:
            logger.error(f"Error parsing homework XML: {str(e)}")
            return {"problems": []}

    def save_homework(self, homework_data: Dict[str, Any], output_path: str) -> None:
        """Save homework data to JSON file."""
        try:
            with open(output_path, 'w') as f:
                json.dump(homework_data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving homework data: {str(e)}")

    def load_homework(self, input_path: str) -> Dict[str, Any]:
        """Load homework data from JSON file."""
        try:
            if os.path.exists(input_path):
                with open(input_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading homework data: {str(e)}")
        return {"problems": []}