import os
import json
from typing import List, Tuple, Dict, Any
import google.generativeai as genai
from pypdf import PdfReader
import re
from dotenv import load_dotenv
import xml.etree.ElementTree as ET
from tqdm import tqdm
from supabase import Client, ClientOptions, create_client

load_dotenv()

class TOCExtractor:
    def __init__(self, api_key: str, pdf_path: str):
        """Initialize the TOC extractor with Gemini API key."""
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-001')
        self.reader = PdfReader(pdf_path)
        self.num_pages = len(self.reader.pages)



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
            
            # Add 1 to end_page to make it inclusive
            for page_num in range(start_page, end_page + 1):
                page_text = self.reader.pages[page_num - 1].extract_text()
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

    def parse_toc_xml(self, xml_string: str) -> Dict[str, Any]:
        """Parse the XML table of contents into a structured format.
        Returns a dictionary containing chapter information and their structure."""
        try:
            # Add root element to make it valid XML
            xml_string = f"<TOC>{xml_string}</TOC>"
            root = ET.fromstring(xml_string)
            
            toc_structure = {
                "chapters": []
            }
            
            for chapter in root.findall('CHAPTER'):
                chapter_info = {
                    "title": chapter.find('TITLE').text.strip(),
                    "page": int(chapter.find('PAGE').text),
                    "subchapters": [],
                    "exercises_page": None
                }
                
                # Get all subchapters
                for subchapter in chapter.findall('SUBCHAPTER'):
                    subchapter_info = {
                        "title": subchapter.find('TITLE').text.strip(),
                        "page": int(subchapter.find('PAGE').text)
                    }
                    chapter_info["subchapters"].append(subchapter_info)
                
                # Get exercises page if it exists
                exercises = chapter.find('EXERCISES')
                if exercises is not None:
                    chapter_info["exercises_page"] = int(exercises.find('PAGE').text)
                
                toc_structure["chapters"].append(chapter_info)
            
            return toc_structure
        
        except ET.ParseError as e:
            raise Exception(f"Invalid XML format: {str(e)}")
        except Exception as e:
            raise Exception(f"Error parsing TOC XML: {str(e)}")
        

    def get_exercise_pages(self, text: str, chapter_title: str) -> Tuple[int, int]:
        """Get the pages of the exercises for a given chapter"""
        prompt = """
        You are an expert at extracting individual exercises from a textbook. The title of the chapter is "{chapter_title}".

        Please analyze the following text and extract the individual exercises in this exact format:
        1. Enclose your response in <CHAPTER> </CHAPTER> tags.
        2. Use <EXERCISE> and </EXERCISE> tags to start and end the exercises.
        3. Use <TYPE>x</TYPE> tags to enclose the type of exercise, where x is the type of exercise.
        4. Use <TITLE>y</TITLE> tags to enclose the title of each exercise, where y is the title.
        5. Use <PAGE>z</PAGE> tags to enclose the starting page number of each exercise, where z is the page number where the exercise starts.

        Here is an example of how an example exercises could look like:

        <CHAPTER>
        <EXERCISE>
            <TITLE>1.1</TITLE>
            <TYPE>Supplementary Exercises</TYPE>
            <PAGE>30</PAGE>
        </EXERCISE>
        <EXERCISE>
            <TITLE>1.2</TITLE>
            <TYPE>Supplementary Exercises</TYPE>
            <PAGE>31</PAGE>
        </EXERCISE>
        ...
        </CHAPTER>

        Now, it is your turn to analyze the following text and extract the exercises in the exact format specified above. Only output the exercises for the given chapter, nothing else. Do not use any other tags than the ones specified above. 

        If you see any leading exercises, ignore them, as they are probably a part of the subchapter exercises, not the chapter exercises. Look for a title like "Exercises" (the most main title) to start the exercises, do not include things like Projects or Explorations.
        INPUT: 
        {text}

        OUTPUT:

        """
        try:
            response = self.model.generate_content(prompt.format(text=text, chapter_title=chapter_title))
            return response.text

        except Exception as e:
            raise Exception(f"Error processing with Gemini: {str(e)}")

    def parse_exercise_xml(self, xml_string: str) -> Dict[str, Dict]:
        """Parse the XML exercises into a structured format.
        Returns a dictionary containing chapter information and their structure."""
        try:
            root = ET.fromstring(xml_string)
            
            exercise_structure = {
                "exercises": []
            }

            for exercise in root.findall('EXERCISE'):
                exercise_info = {
                    "title": exercise.find('TITLE').text.strip(),
                    "page": int(exercise.find('PAGE').text),
                    "type": exercise.find('TYPE').text.strip()
                }
                exercise_structure["exercises"].append(exercise_info)

            return exercise_structure
        
        except Exception as e:
            raise Exception(f"Error parsing exercise XML: {str(e)}")


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

def main(pdf_filename: str):
    # Replace with your Gemini API key
    API_KEY = os.getenv('GOOGLE_API_KEY')

    # Define base directory and uploads path
    if not os.getenv('DOCKER_ENV'):
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    else:
        BASE_DIR = '/app'
    
    UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
    
    # Get PDF path from uploads directory
    pdf_path = os.path.join(UPLOADS_DIR, pdf_filename)

    # Check if file exists
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at {pdf_path}")
    
    # Initialize the extractor
    extractor = TOCExtractor(API_KEY, pdf_path)
    

    try:
            
        # Extract text from PDF
        print("Extracting text from PDF...")
        text = extractor.extract_text_from_pdf()

        # formatting with <PAGE x> tags
        text_with_pages = [f"<PAGE {i + 1}>\n{page_text}\n</PAGE {i + 1}>\n\n" for i, page_text in enumerate(text)]
        input_text = "".join(text_with_pages)

        # Find the pages that contain the table of contents
        print("Finding table of contents pages...")
        num_chapters, toc_pages = extractor.find_table_of_contents_pages(input_text)

        # get text for each toc page
        toc_text = [text[i-1] if i-1 >= 0 else "" for i in toc_pages]
        toc_text = "\n".join(toc_text)

        toc_text = extractor.process_toc_batch_with_gemini(toc_text, num_chapters)

        # only keep content in <TOC> tags
        toc_text = re.search(r'<TOC>([\s\S]*?)</TOC>', toc_text).group(1)
        print(toc_text)

        parsed_toc = extractor.parse_toc_xml(toc_text)
        print(parsed_toc)

        # Clean the parsed TOC
        cleaned_toc = clean_unicode(parsed_toc)
        print(cleaned_toc)

        # save to table_of_contents.json
        output_path = os.path.join(UPLOADS_DIR, f'table_of_contents_{pdf_filename}.json')
        with open(output_path, 'w') as f:
            json.dump(cleaned_toc, f)    
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")


def main2(pdf_filename: str):
    # Replace with your Gemini API key
    API_KEY = os.getenv('GOOGLE_API_KEY')

    # Define base directory and uploads path
    if not os.getenv('DOCKER_ENV'):
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    else:
        BASE_DIR = '/app'
    
    UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
    
    # Get PDF path from uploads directory
    pdf_path = os.path.join(UPLOADS_DIR, pdf_filename)

    # Check if file exists
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at {pdf_path}")
    
    # Initialize the extractor
    extractor = TOCExtractor(API_KEY, pdf_path)

    page_labels = extractor.get_page_labels()
    
    # Try to load existing TOC file
    toc_path = os.path.join(UPLOADS_DIR, f'toc_{pdf_filename}.json')
    if os.path.exists(toc_path):
        with open(toc_path, 'r') as f:
            toc = json.load(f)
    else:
        # If no existing file, read from the initial XML TOC
        toc = extractor.read_xml_toc(os.path.join(UPLOADS_DIR, f'table_of_contents_{pdf_filename}.json'))

    # Create progress bar for chapters
    for i, chapter in tqdm(enumerate(toc['chapters']), total=len(toc['chapters']), desc="Processing chapters"):
        # Skip if chapter already has exercises
        if 'exercises' in chapter and chapter['exercises']:
            print(f"Skipping {chapter['title']} - already processed")
            continue

        chapter_title = chapter['title']
        supposed_start = chapter['page']
        supposed_exercises_start = chapter['exercises_page']

        # Calculate offset and actual pages for chapter
        offset = page_labels.index(str(supposed_start)) + 1 - supposed_start
        chapter['start_page'] = supposed_start + offset
        
        # Calculate end page for chapter (start of next chapter or exercises)
        if i < len(toc['chapters']) - 1:
            chapter['end_page'] = toc['chapters'][i + 1]['page'] - 1 + offset
        else:
            chapter['end_page'] = supposed_exercises_start - 1 + offset

        # Handle subchapters
        for j, subchapter in enumerate(chapter['subchapters']):
            supposed_sub_start = subchapter['page']
            sub_offset = page_labels.index(str(supposed_sub_start)) + 1 - supposed_sub_start
            subchapter['start_page'] = supposed_sub_start + sub_offset
            
            # End page is start of next subchapter or chapter exercises
            if j < len(chapter['subchapters']) - 1:
                subchapter['end_page'] = chapter['subchapters'][j + 1]['page'] - 1 + sub_offset
            else:
                subchapter['end_page'] = supposed_exercises_start - 1 + sub_offset
            
            # Remove redundant page attribute
            del subchapter['page']

        # Handle exercises
        exercises_start = supposed_exercises_start + offset
        
        # Determine exercises end page
        if i < len(toc['chapters']) - 1:
            exercises_end = toc['chapters'][i + 1]['page'] - 1 + offset
        else:
            next_section_index = len(page_labels)
            while (next_section_index > 0 and 
                    not page_labels[next_section_index - 1].isdigit()):
                next_section_index -= 1
            exercises_end = int(page_labels[next_section_index - 1]) + offset

        # Extract and format exercise text
        exercise_text = extractor.extract_text_from_pdf(exercises_start, exercises_end)
        exercise_pages = [f"<PAGE {i + exercises_start}>\n{page_text}\n</PAGE {i + exercises_start}>\n\n" 
                         for i, page_text in enumerate(exercise_text)]
        exercise_pages = "".join(exercise_pages)

        # Get exercise structure from Gemini
        exercise_xml = extractor.get_exercise_pages(exercise_pages, chapter_title)
        parsed_exercises = extractor.parse_exercise_xml(exercise_xml)
        
        # Add exercises to chapter with proper page numbers
        chapter['exercises'] = []
        for exercise in parsed_exercises['exercises']:
            supposed_ex_page = exercise['page']
            try:
                ex_offset = page_labels.index(str(supposed_ex_page)) + 1 - supposed_ex_page
            except ValueError:
                ex_offset = 0
            chapter['exercises'].append({
                'title': f"{exercise['title']} ({exercise['type']})",
                'start_page': supposed_ex_page + ex_offset,
                'end_page': supposed_ex_page + ex_offset
            })

        # Remove redundant page and exercises_page attributes from chapter
        del chapter['page']
        del chapter['exercises_page']

        # Save progress after each chapter
        with open(toc_path, 'w') as f:
            json.dump(toc, f, indent=2)

    return toc


def main3(pdf_filename: str):
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

    # Define base directory and uploads path
    if not os.getenv('DOCKER_ENV'):
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

    # Define base directory and uploads path
    if not os.getenv('DOCKER_ENV'):
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    else:
        BASE_DIR = '/app'
    
    UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads') 

    # Get PDF path from uploads directory
    pdf_path = os.path.join(UPLOADS_DIR, pdf_filename)

    # Check if file exists
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at {pdf_path}")
    
    # get table of contents
    toc_path = os.path.join(UPLOADS_DIR, f'toc_{pdf_filename}.json')
    with open(toc_path, 'r') as f:
        toc = json.load(f)
    
    # upload chapters to supabase
    for i, chapter in enumerate(toc['chapters']):
        response = supabase.table('chapters').insert({
            'title': chapter['title'],
            'start_page': chapter['start_page'],
            'end_page': chapter['end_page'],
            'chapter_number': i + 1,
            'textbook': 'f945ef59-cabe-40e1-b38f-17e05400cb7e'
        }).execute()
        chapter['id'] = response.data[0]['id']

    # upload subchapters to supabase
    for chapter in toc['chapters']:
        for j, subchapter in enumerate(chapter['subchapters']):
            supabase.table('subchapters').insert({
                'title': subchapter['title'],
                'start_page': subchapter['start_page'],
                'end_page': subchapter['end_page'],
                'subchapter_number': j + 1,
                'chapter': chapter['id']
            }).execute()

    # upload exercises to supabase
    for chapter in toc['chapters']:
        for j, exercise in enumerate(chapter['exercises']):
            supabase.table('exercises').insert({
                'title': exercise['title'],
                'start_page': exercise['start_page'],
                'end_page': exercise['end_page'],
                'exercise_number': j + 1,
                'chapter': chapter['id']
            }).execute()

if __name__ == "__main__":
    # main('LinAlg.pdf')
    main2('V.pdf')
    # main3('LinAlg.pdf')

    # # Define base directory and uploads path
    # if not os.getenv('DOCKER_ENV'):
    #     BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    # else:
    #     BASE_DIR = '/app'
    
    # UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
    
    # # Get PDF path from uploads directory
    # pdf_path = os.path.join(UPLOADS_DIR, 'LinAlg.pdf')

    # API_KEY = os.getenv('GOOGLE_API_KEY')
    # extractor = TOCExtractor(API_KEY, pdf_path)
    # print(extractor.get_page_labels())
