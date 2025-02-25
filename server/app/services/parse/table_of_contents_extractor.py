import os
import json
from typing import List, Tuple, Dict, Any
import google.generativeai as genai
from pypdf import PdfReader
import re
from dotenv import load_dotenv
import xml.etree.ElementTree as ET
from tqdm import tqdm

load_dotenv()

import logging
logger = logging.getLogger(__name__)

class TableOfContentsExtractor:
    def __init__(self, api_key: str, pdf_path: str):
        """Initialize the TOC extractor with Gemini API key."""
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-001')
        self.reader = PdfReader(pdf_path)
        self.num_pages = len(self.reader.pages)
        self.pdf_path = pdf_path


    def get_page_labels(self):
        page_labels = []

        try:
            page_labels_dict = self.reader.trailer["/Root"]["/PageLabels"]
            
            # Function to recursively process Kids
            def process_kids(node):
                labels = []
                if "/Kids" in node:
                    for kid in node["/Kids"]:
                        # Resolve the indirect object reference
                        kid_obj = self.reader.get_object(kid)
                        labels.extend(process_kids(kid_obj))
                
                # Process Nums if present in this node
                if "/Nums" in node:
                    nums = node["/Nums"]
                    for i in range(0, len(nums), 2):
                        page_num = nums[i]
                        label_dict = nums[i + 1]
                        
                        # Extract label information
                        prefix = label_dict.get("/P", "")
                        style = label_dict.get("/S", "D")  # Default to decimal
                        start_num = label_dict.get("/St", 1)
                        
                        labels.append((page_num + 1, {
                            "prefix": prefix,
                            "style": style,
                            "start_num": start_num
                        }))
                
                return labels
            
            # Start processing from root
            page_labels = process_kids(page_labels_dict)
            
            # Sort by page number
            page_labels.sort(key=lambda x: x[0])
            
            # Convert to final format
            final_labels = []
            total_pages = len(self.reader.pages)
            
            for i in range(len(page_labels)):
                start_page = page_labels[i][0]
                style = page_labels[i][1]
                end_page = page_labels[i+1][0] if i < len(page_labels)-1 else total_pages + 1
                
                for p in range(start_page, end_page):
                    label = style["prefix"]
                    final_labels.append(label)
            
            if not final_labels:
                raise Exception("No page labels found, using default numbering")
                
            return final_labels
            
        except Exception as e:
            # Fallback to default sequential numbering
            return self.reader.page_labels


    def read_xml_toc(self, path: str) -> Dict[str, Any]:
        """Read the table of contents from a JSON file."""
        with open(path, 'r') as f:
            return json.load(f)


    def extract_text_from_pdf(self, start_page: int = 1, end_page: int = 30) -> str:
        """Extract text from the first n pages of a PDF file."""
        try:
            text = []
            page_labels = self.get_page_labels()
            
            # Add 1 to end_page to make it inclusive
            for page_num in range(start_page, end_page + 1):
                page_text = self.reader.pages[page_num - 1].extract_text()
                # filter out the number of the page, page_num
                page_num_to_remove = page_labels[page_num - 1]
                page_text = re.sub(r'\b' + str(page_num_to_remove) + r'\b', '', page_text)
                text.append(page_text)
            
            return text
        except Exception as e:
            raise Exception(f"Error reading PDF: {str(e)}")
        

    def find_table_of_contents_pages(self, text: str) -> Tuple[int, List[int]]:
        """Find the pages and number of chapters that contain the table of contents. Outputs a tuple of (number of chapters, list of pages)"""
        prompt = """
        Please analyze the following text and extract the pages that contain the table of contents. Moreover, you should find how many chapters exist in this textbook, enclosing your answer in <CHAPTERS> tags. Each page is seperated by <PAGE x></PAGE x> tags, where x is the page number. Your output should be those <CHAPTERS> and <PAGE x> tags, nothing else.

        An example output would be: <CHAPTERS>20</CHAPTERS><PAGE 10><PAGE 11><PAGE 12>

        INPUT:
        {text}

        OUTPUT:
        """
        try:
            response = self.model.generate_content(prompt.format(text=text))
            response_text = response.text.strip()
            
            # Extract chapters
            chapters_match = re.search(r'<CHAPTERS>(\d+)</CHAPTERS>', response_text)
            if not chapters_match:
                raise ValueError("Could not find chapters count in response")
            chapters = int(chapters_match.group(1))
            
            # Extract pages - looking for <PAGE x> format
            pages = [int(match.group(1)) for match in re.finditer(r'<PAGE (\d+)>', response_text)]
            
            return chapters, pages
        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")
    
    def process_toc_batch_with_gemini(self, text: str, num_chapters: int) -> str:
        """Process the extracted text with Gemini API to identify TOC."""
        prompt = """
        You are an expert at extracting table of contents from a textbook. There are {num_chapters} chapters in this textbook.

        Please analyze the following text and extract the table of contents in this exact format:
        1. Use <TOC> and </TOC> tags to start and end the Table of Contents (TOC)
        2. Use <CHAPTER></CHAPTER> tags to start and end the chapter.
        3. Use <SUBCHAPTER></SUBCHAPTER> tags to start and end the subchapter.
        4. Use <EXERCISES></EXERCISES> tags to start and end the exercises/end of material section.
        5. Use <TITLE>x</TITLE> tags to enclose the title of each chapter, subchapter, and exercise, where x is the title.
        6. Use <PAGE>y</PAGE> tags to enclose the starting page number of each chapter, subchapter, and exercise, where y is the page number where the chapter, subchapter, or exercise starts.

        Here is an example of how an example TOC could look like:

        <TOC>
        <CHAPTER>
            <TITLE>Introduction</TITLE>
            <PAGE>3</PAGE>
            <SUBCHAPTER>
                <TITLE>Managing a Production Facility</TITLE>
                <PAGE>3</PAGE>
            </SUBCHAPTER>
            <SUBCHAPTER>
                <TITLE>The Linear Programming Problem</TITLE>
                <PAGE>6</PAGE>
            </SUBCHAPTER>
            <EXERCISES>
                <TITLE>Exercises</TITLE>
                <PAGE>8</PAGE>
            </EXERCISES>
        </CHAPTER>
        ...
        </TOC>

        Now, it is your turn to analyze the following text and extract the TOC in the exact format specified above. Only output the table of contents for all chapters, nothing else. Do not use any other tags than the ones specified above.
        INPUT: 
        {text}

        OUTPUT:
        """
        
        try:
            response = self.model.generate_content(prompt.format(text=text, num_chapters=num_chapters))
            return response.text
        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")

    def parse_toc_xml(self, xml_string: str, page_labels: List[str]) -> Dict[str, Any]:
        """Parse the XML table of contents into a structured format.
        Returns a dictionary containing chapter information and their structure.
        
        Args:
            xml_string: The XML string containing table of contents
            page_labels: List of page labels from the PDF
        """
        try:
            # Add root element to make it valid XML
            xml_string = f"<TOC>{xml_string}</TOC>"
            root = ET.fromstring(xml_string)
            
            toc_structure = {
                "chapters": []
            }
            
            for chapter in root.findall('CHAPTER'):
                # Get raw page numbers from XML
                chapter_page = int(chapter.find('PAGE').text)
                exercises_page = None
                exercises = chapter.find('EXERCISES')
                if exercises is not None:
                    exercises_page = int(exercises.find('PAGE').text)
                
                # Calculate offsets
                chapter_offset = page_labels.index(str(chapter_page)) + 1 - chapter_page
                exercises_offset = None
                if exercises_page is not None:
                    exercises_offset = page_labels.index(str(exercises_page)) + 1 - exercises_page
                
                chapter_info = {
                    "title": chapter.find('TITLE').text.strip(),
                    "page": chapter_page,
                    "actual_page": chapter_page + chapter_offset,
                    "subchapters": [],
                    "exercises_page": exercises_page,
                    "actual_exercises_page": exercises_page + exercises_offset if exercises_page is not None else None
                }
                
                # Get all subchapters
                for subchapter in chapter.findall('SUBCHAPTER'):
                    subchapter_page = int(subchapter.find('PAGE').text)
                    subchapter_offset = page_labels.index(str(subchapter_page)) + 1 - subchapter_page
                    
                    subchapter_info = {
                        "title": subchapter.find('TITLE').text.strip(),
                        "page": subchapter_page,
                        "actual_page": subchapter_page + subchapter_offset
                    }
                    chapter_info["subchapters"].append(subchapter_info)
                
                toc_structure["chapters"].append(chapter_info)
            
            return toc_structure
        
        except ET.ParseError as e:
            raise Exception(f"Invalid XML format: {str(e)}")
        except Exception as e:
            raise Exception(f"Error parsing TOC XML: {str(e)}")

    def get_or_create_toc(self) -> Dict[str, Any]:
        """Get existing TOC or create a new one if it doesn't exist."""
        # Generate the TOC file path
        pdf_filename = os.path.basename(self.pdf_path).split('.')[0]
        toc_path = os.path.join(os.path.dirname(self.pdf_path), f'toc_{pdf_filename}.json')
        
        # Try to load existing TOC file
        if os.path.exists(toc_path):
            try:
                with open(toc_path, 'r') as f:
                    toc = json.load(f)
                logger.info(f"Loaded existing TOC from {toc_path}")
                return toc
            except Exception as e:
                logger.warning(f"Error loading existing TOC: {str(e)}")
        
        # If no existing file or error loading, create new TOC
        logger.info("Creating new TOC...")
         # Extract text from PDF
        print("Extracting text from PDF...")
        text = self.extract_text_from_pdf()

        # formatting with <PAGE x> tags
        text_with_pages = [f"<PAGE {i + 1}>\n{page_text}\n</PAGE {i + 1}>\n\n" for i, page_text in enumerate(text)]
        input_text = "".join(text_with_pages)

        # Find the pages that contain the table of contents
        print("Finding table of contents pages...")
        num_chapters, toc_pages = self.find_table_of_contents_pages(input_text)

        # get text for each toc page
        toc_text = [text[i-1] if i-1 >= 0 else "" for i in toc_pages]
        toc_text = "\n".join(toc_text)

        toc_text = self.process_toc_batch_with_gemini(toc_text, num_chapters)

        # only keep content in <TOC> tags
        toc_text = re.search(r'<TOC>([\s\S]*?)</TOC>', toc_text).group(1)
        print(toc_text)

        parsed_toc = self.parse_toc_xml(toc_text, self.get_page_labels())
        print(parsed_toc)

        # Clean the parsed TOC
        toc_structure = clean_unicode(parsed_toc)
        print(toc_structure)
        
        # Save the new TOC
        try:
            with open(toc_path, 'w') as f:
                json.dump(toc_structure, f, indent=2)
            logger.info(f"Saved new TOC to {toc_path}")
        except Exception as e:
            logger.warning(f"Error saving TOC: {str(e)}")
        
        return toc_structure
    
def clean_unicode(obj):
    """Recursively clean unicode characters from a dictionary/list structure"""
    if isinstance(obj, dict):
        return {key: clean_unicode(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [clean_unicode(item) for item in obj]
    elif isinstance(obj, str):
        # Replace specific problematic characters
        cleaned = obj.replace('\ufb01', 'fi')  # Replace 'ﬁ'
        cleaned = cleaned.replace('\ufb02', 'fl')  # Replace 'ﬂ'
        cleaned = cleaned.replace('\u00b4', "'")   # Replace '´'
        cleaned = cleaned.replace('\u2019', "'")   # Replace '''
        cleaned = cleaned.replace('\u2013', "-")   # Replace '–'
        cleaned = cleaned.replace('\n', " ") # Replace new line
        # Add any other specific replacements as needed
        
        # Remove any remaining non-ASCII characters
        cleaned = ''.join(char if ord(char) < 128 else ' ' for char in cleaned)
        return cleaned
    return obj