# will go from a pdf (which will be converted to text)/textual content to detailed outline of homework.
import os
import re
import fitz  # PyMuPDF
import google.generativeai as genai
from typing import Dict, Any, List, Tuple
import json
import logging
from problems_extractor import ProblemsExtractor
from supabase import create_client, ClientOptions, Client
from dotenv import load_dotenv
from tqdm import tqdm

from table_of_contents_extractor import TableOfContentsExtractor

load_dotenv()

logger = logging.getLogger(__name__)

class NewHomeworkProcessor:
    def __init__(self, homework_folder: str, api_key: str):
        """Initialize processor with a homework folder path
        
        Args:
            homework_folder: Path to folder containing homework files (PDF/txt)
            api_key: API key for Gemini
        """
        self.homework_folder = homework_folder
        self.api_key = api_key
        
        # Create homework.json in the parent directory of homework folder
        self.class_folder = os.path.dirname(homework_folder)
        self.homework_json_path = os.path.join(self.class_folder, 'homework.json')
        
        # Get list of all homework files
        self.homework_files = []
        for filename in os.listdir(homework_folder):
            if filename.endswith('.pdf') or filename.endswith('.txt'):
                self.homework_files.append(os.path.join(homework_folder, filename))
        
        logger.info(f"Found {len(self.homework_files)} homework files in {homework_folder}")

    def process_all_homework(self, class_id: str, supabase: Client, max_homeworks: int = None) -> List[Dict[str, Any]]:
        """Process all homework files in the folder"""
        try:
            # Load existing homework data
            homework_list = self._load_existing_homework()
            processed_files = {hw.get('source_file') for hw in homework_list}
            
            # Filter files that haven't been processed
            files_to_process = [f for f in self.homework_files if f not in processed_files]
            
            if not files_to_process:
                logger.info("All homework files have been processed")
                return homework_list
            
            # Limit homework files if max_homeworks is specified
            if max_homeworks is not None:
                files_to_process = files_to_process[:max_homeworks]
            
            # Process each unprocessed file
            with tqdm(total=len(files_to_process), desc="Processing homework files") as pbar:
                for file_path in files_to_process:
                    try:
                        # Initialize document based on file type
                        if file_path.endswith('.pdf'):
                            pdf_document = fitz.open(file_path)
                            text_content = None
                        else:
                            pdf_document = None
                            with open(file_path, 'r') as f:
                                text_content = f.read()
                        
                        # Process the homework
                        homework_data = self._process_single_homework(
                            file_path=file_path,
                            pdf_document=pdf_document,
                            text_content=text_content,
                            class_id=class_id,
                            supabase=supabase
                        )
                        
                        # Add source file information
                        homework_data['source_file'] = file_path
                        
                        # Add to list and save progress
                        homework_list.append(homework_data)
                        self._save_homework_list(homework_list)
                        
                        # Clean up
                        if pdf_document:
                            pdf_document.close()
                            
                    except Exception as e:
                        logger.error(f"Error processing {file_path}: {str(e)}")
                        continue
                        
                    pbar.update(1)
            
            return homework_list
            
        except Exception as e:
            logger.error(f"Error in process_all_homework: {str(e)}")
            raise

    def _process_single_homework(self, file_path: str, pdf_document: fitz.Document, 
                               text_content: str, class_id: str, supabase: Client) -> Dict[str, Any]:
        """Process a single homework file"""
        try:
            # Initialize problems extractor
            problems_extractor = ProblemsExtractor(self.api_key)
            
            # Get textbook info from database
            raw_textbook_info = supabase.table("textbooks").select("*").eq("class", class_id).execute().data
            textbook_info = "\n".join(f"{t['textbook_number']}. {t['title']}" for t in raw_textbook_info)

            # Create folder for homework images if PDF
            if pdf_document:
                homework_name = os.path.splitext(os.path.basename(file_path))[0]
                images_folder = os.path.join(os.path.dirname(file_path), f'images_{homework_name}')
                os.makedirs(images_folder, exist_ok=True)

            # Combine homework info
            homework_info = []
            page_texts = {}  # Store page texts for later matching
            
            if pdf_document:
                for page_num, page in enumerate(pdf_document):
                    text = page.get_text()
                    page_texts[page_num] = text
                    homework_info.append(f"PDF Content: {text}")
            
            if text_content:
                homework_info.append(f"Text Content: {text_content}")

            combined_info = textbook_info + "\n" + "\n".join(homework_info)

            # Extract problems
            homework_data = problems_extractor.extract_exercises_from_text(combined_info)
            
            # If PDF document, process 'given' sections to extract images
            if pdf_document:
                for problem_idx, problem in enumerate(homework_data.get('problems', [])):
                    # Use 1-based problem numbering
                    problem_number = str(problem_idx + 1)
                    
                    for page_num, page_text in page_texts.items():
                        page = pdf_document[page_num]
                        
                        # First find all problem number markers on the page
                        problem_markers = []
                        number_pattern = r'\b\d+\.'  # Pattern to match numbers followed by period
                        
                        # Get text blocks with their formatting
                        blocks = page.get_text("dict").get("blocks", [])
                        for block in blocks:
                            for line in block.get("lines", []):
                                for span in line.get("spans", []):
                                    text = span.get("text", "").strip()
                                    if re.search(number_pattern, text):
                                        logger.debug(f"Found problem marker: {text} at y={span['bbox'][1]}")
                                        problem_markers.append({
                                            'number': text.strip(),
                                            'y': span["bbox"][1]  # y-coordinate of the start
                                        })
                        
                        # Sort markers by y-coordinate
                        problem_markers.sort(key=lambda x: x['y'])
                        logger.debug(f"Problem markers on page {page_num}: {problem_markers}")
                        
                        # Process each part in the problem
                        for part_idx, part in enumerate(problem.get('parts', [])):
                            if 'given' in part:
                                given_text = part['given']
                                # Clean up the given text for better matching
                                clean_given = re.sub(r'\s+', ' ', given_text).strip()
                                
                                # Try to find the text in the page
                                text_instances = page.search_for(clean_given[:50])  # Search first 50 chars to handle long text
                                if text_instances:
                                    # Get the first instance
                                    rect = text_instances[0]
                                    y1 = rect.y0
                                    
                                    logger.debug(f"Found given text for problem {problem_number}, part {part_idx} at y={y1}")
                                    
                                    # Find which problem section this belongs to
                                    section_start = 0
                                    section_end = page.rect.height
                                    
                                    # Find the problem section boundaries
                                    for i, marker in enumerate(problem_markers):
                                        if marker['y'] <= y1:
                                            section_start = marker['y']
                                            if i + 1 < len(problem_markers):
                                                section_end = problem_markers[i + 1]['y']
                                            logger.debug(f"Text belongs to section starting at y={section_start}, ending at y={section_end}")
                                    
                                    # Add padding
                                    padding = 10
                                    clip_rect = fitz.Rect(
                                        0,  # Start from left edge
                                        max(0, section_start - padding),
                                        page.rect.width,  # Extend to right edge
                                        min(page.rect.height, section_end + padding)
                                    )
                                    
                                    # Render the region as an image
                                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip_rect)
                                    image_filename = f'problem_{problem_number}_part_{part_idx + 1}_given.png'
                                    image_path = os.path.join(images_folder, image_filename)
                                    pix.save(image_path)
                                    
                                    # Add image path to the part data
                                    part['given_image'] = os.path.relpath(image_path, os.path.dirname(file_path))
                                    logger.debug(f"Saved image for problem {problem_number}, part {part_idx + 1}: {image_path}")
            
            return homework_data
            
        except Exception as e:
            logger.error(f"Error processing homework file {file_path}: {str(e)}")
            raise

    def upload_to_supabase(self, class_id: str, supabase: Client, page_labels: List[str]) -> List[str]:
        """Upload all processed homework to Supabase"""
        try:
            # find all textbooks
            textbook_response = supabase.table('textbooks').select('*').eq('class', class_id).execute()
            textbooks = textbook_response.data
            # Get all processed homework
            homework_list = self._load_existing_homework()
            # sort homework_list by due_date
            homework_list = sorted(homework_list, key=lambda x: x['due_date'])
            homework_ids = []
            
            # Upload each homework with progress bar
            with tqdm(total=len(homework_list), desc="Uploading homework") as pbar:
                for i, homework_data in enumerate(homework_list):
                    # Create homework entry
                    homework_response = supabase.table('homeworks').insert({
                        'class': class_id,
                        'due': homework_data.get('due_date'),
                        'title': homework_data.get('title'),
                        'homework_number': i + 1,
                        'parse_status': 'complete'
                    }).execute()
                    
                    homework_id = homework_response.data[0]['id']
                    homework_ids.append(homework_id)
                    
                    # Upload problems with nested progress
                    problems = homework_data.get('problems', [])

                    with tqdm(total=len(problems), desc=f"Uploading problems for {homework_data.get('title')}") as problem_pbar:
                        for i, problem in enumerate(problems):
                            # Upload parts
                            for j, part in enumerate(problem.get('parts', [])):
                                # Check if this is a textbook reference or a given problem
                                if 'textbook' in part:
                                    # This is a textbook reference - search for existing exercise
                                    textbook_number = int(part['textbook'].get('number'))
                                    textbook_id = next((t['id'] for t in textbooks if t['textbook_number'] == textbook_number), None)

                                    if part['textbook'].get('exercise'):
                                        exercise_name = part['textbook'].get('exercise')

                                        # remove any parentheses (and what is inside them) from the exercise name
                                        exercise_name = re.sub(r'\(.*?\)', '', exercise_name)
                                        
                                        # Search for existing exercise by name and textbook number
                                        existing_exercise = supabase.table('exercises').select('id').eq('title', exercise_name).execute()
                                        
                                        if existing_exercise.data:
                                            # Exercise exists, update it
                                            exercise_id = existing_exercise.data[0]['id']
                                            supabase.table('exercises').update({
                                                'homework': homework_id,
                                                'problem_number': i + 1,
                                                'info': problem.get('info') if problem.get('info') else '',
                                                'problem_part_number': j + 1,
                                            }).eq('id', exercise_id).execute()

                                            # Find documents that contain this exercise in their exercises array
                                            # Note: This requires a contains operator which might not be directly available
                                            # We'll fetch documents and filter them in Python
                                            all_docs = supabase.table('documents').select('*').execute().data
                                            matching_docs = []
                                            
                                            for doc in all_docs:
                                                exercises = doc.get('exercises', [])
                                                if exercise_id in exercises:
                                                    matching_docs.append(doc)
                                            
                                            # Update each document to add this homework to its homeworks array
                                            for doc in matching_docs:
                                                # Get current homeworks array or initialize empty array
                                                current_homeworks = doc.get('homeworks', [])
                                                
                                                # Add new homework ID if not already present
                                                if homework_id not in current_homeworks:
                                                    current_homeworks.append(homework_id)
                                                    
                                                    # Update document with new homeworks array
                                                    supabase.table('documents').update({
                                                        'homeworks': current_homeworks,
                                                        'processed': True
                                                    }).eq('id', doc['id']).execute()
                                        else:
                                            print(f"Could not find exercise: {exercise_name}")

                                    if part['textbook'].get('page'):
                                        page = part['textbook'].get('page')
                                        for i, label in enumerate(page_labels):
                                            if label == str(page):
                                                actual_page = i + 1
                                                break
                                        # Get documents for this textbook and page
                                        docs = supabase.table('documents').select('*').eq('textbook', textbook_id).eq('page', actual_page).execute()
                                        
                                        # Update each document to add this homework to its homeworks array
                                        for doc in docs.data:
                                            # Get current homeworks array or initialize empty array
                                            current_homeworks = doc.get('homeworks', [])
                                            
                                            # Add new homework ID if not already present
                                            if homework_id not in current_homeworks:
                                                current_homeworks.append(homework_id)
                                                
                                                # Update document with new homeworks array
                                                supabase.table('documents').update({
                                                    'homeworks': current_homeworks,
                                                    'processed': True
                                                }).eq('id', doc['id']).execute()

                                else:
                                    # Exercise doesn't exist, create it
                                    exercise_response = supabase.table('exercises').insert({
                                        'homework': homework_id,
                                        'problem_number': i + 1,
                                        'info': problem.get('info') if problem.get('info') else '',
                                        'problem_part_number': j + 1,
                                        'given': part.get('given') if part.get('given') else '',
                                        'title': exercise_name
                                    }).execute()
                                    exercise_id = exercise_response.data[0]['id']
                                    
                                    # Create document for exercise with homeworks array
                                    supabase.table('documents').insert({
                                        'page': 1, # leave for now.
                                        'text': '', # leave for now.
                                        'description': '', # leave for now.
                                        'exercises': [exercise_id],  # Initialize as array with current exercise
                                        'homeworks': [homework_id],  # Initialize as array with current homework
                                        'processed': True, # set this to be true for now.
                                    }).execute()
                            
                            problem_pbar.update(1)
                    
                    pbar.update(1)
            
            logger.info(f"Successfully uploaded {len(homework_ids)} homework assignments to Supabase")
            return homework_ids
            
        except Exception as e:
            logger.error(f"Error uploading to Supabase: {str(e)}")
            raise

    def _load_existing_homework(self) -> List[Dict[str, Any]]:
        """Load existing homework data from the combined JSON file."""
        try:
            if os.path.exists(self.homework_json_path):
                with open(self.homework_json_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading existing homework data: {str(e)}")
        return []

    def _save_homework_list(self, homework_list: List[Dict[str, Any]]):
        """Save the entire homework list to file."""
        try:
            with open(self.homework_json_path, 'w') as f:
                json.dump(homework_list, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving homework list: {str(e)}")
            raise

if __name__ == "__main__":
    # Example usage
    homework_folder = "/Users/ashoksaravanan/Coding/ScribeLec/server/uploads/ma421/homework"
    api_key = os.getenv('GOOGLE_API_KEY')
    class_id = "c770c9bb-4de1-44be-aacb-b4bea3efbacf" 

    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase = create_client(supabase_url, supabase_private_key, options=opts)

    # Initialize processor with homework folder
    processor = NewHomeworkProcessor(homework_folder, api_key)
    
    # # Process all homework files
    # homework_data = processor.process_all_homework(class_id, supabase, max_homeworks=1)
    # print(f"Processed {len(homework_data)} homework assignments")

    # get the page labels
    # get the pdf path
    pdf_path = "/Users/ashoksaravanan/Coding/ScribeLec/server/uploads/Vanderbei.pdf"
    toc_extractor = TableOfContentsExtractor(api_key, pdf_path)
    page_labels = toc_extractor.get_page_labels()
    
    # # Upload to Supabase
    homework_ids = processor.upload_to_supabase(class_id, supabase, page_labels)
    print(f"Uploaded homework with IDs: {homework_ids}")