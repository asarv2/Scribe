# will go from a pdf (which will be converted to text)/textual content to detailed outline of homework.
from datetime import datetime
import os
import re
import fitz  # PyMuPDF
import google.generativeai as genai
from typing import Dict, Any, List, Tuple
import json
import logging
from app.services.upload.problems_extractor import ProblemsExtractor
from supabase import create_client, ClientOptions, Client
from dotenv import load_dotenv
from tqdm import tqdm
import docx2txt
from app.services.upload.table_of_contents_extractor import TableOfContentsExtractor

load_dotenv()

logger = logging.getLogger(__name__)

class HomeworkExtractor:
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

    def _process_single_homework(self, file_path: str, textbook_info: str) -> Dict[str, Any]:
        """Process a single homework file"""
        try:
            # Initialize problems extractor
            problems_extractor = ProblemsExtractor(self.api_key)

            pdf_document = None
            text_content = None

            # determine if the file is a pdf or a txt
            if file_path.endswith('.pdf'):
                pdf_document = fitz.open(file_path)
            elif file_path.endswith('.txt'):
                with open(file_path, 'r') as f:
                    text_content = f.read()
            elif file_path.endswith('.docx'):
                text_content = docx2txt.process(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_path}")
            
            # Combine homework info
            homework_info = []
            
            if pdf_document:
                for page in pdf_document:
                    text = page.get_text()
                    homework_info.append(f"PDF Content: {text}")
            
            if text_content:
                homework_info.append(f"Text Content: {text_content}")

            combined_info = textbook_info + "\n" + "\n".join(homework_info)

            # Extract problems
            homework_data = problems_extractor.extract_exercises_from_text(combined_info)

            # Extract images
            result_data = problems_extractor.extract_problem_images(
                homework_data, 
                pdf_document, 
                file_path
            )
            
            # Add document structure to homework data
            homework_data['document_structure'] = result_data.get('document_structure', {})
            
            return homework_data
            
        except Exception as e:
            logger.error(f"Error processing homework file {file_path}: {str(e)}")
            raise

    def upload_to_supabase(self, class_id: str, homework_id: str, homework_data: Dict[str, Any], supabase: Client, page_labels: List[str] = None):
        """Upload all processed homework to Supabase"""
        try:

            # find all textbooks
            textbook_response = supabase.table('textbooks').select('*').eq('class', class_id).execute()
            textbooks = textbook_response.data
            
             # Upload problems with nested progress
            problems = homework_data.get('problems', [])

            updates = {}

            title = homework_data.get('title')
            due_date = homework_data.get('due_date')

            if title is not None and title != "":
                updates['title'] = title

            if due_date is not None and due_date != "" and due_date.lower() != "n/a":
                # check if due date is valid parseable date
                try:
                    due_date = datetime.strptime(due_date, '%Y-%m-%d')
                    updates['due'] = due_date
                except ValueError:
                    logger.warning(f"Invalid due date: {due_date}")

            # update the homework with the proper title and due date
            supabase.table('homeworks').update(updates).eq('id', homework_id).execute()

            with tqdm(total=len(problems), desc=f"Uploading problems for {homework_data.get('title')}") as problem_pbar:
                for j, problem in enumerate(problems):
                    # Upload parts
                    for k, part in enumerate(problem.get('parts', [])):
                        # Check if this is a textbook reference or a given problem
                        if 'textbook' in part:
                            # This is a textbook reference - search for existing exercise
                            textbook_number = int(part['textbook'].get('number', 0))
                            textbook_id = next((t['id'] for t in textbooks if t.get('textbook_number') == textbook_number), None)

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
                                        'problem_number': j + 1,
                                        'info': problem.get('info') if problem.get('info') else '',
                                        'problem_part_number': k + 1,
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
                                                'homeworks': current_homeworks
                                            }).eq('id', doc['id']).execute()
                                else:
                                    print(f"Could not find exercise: {exercise_name}")
                            # for now no page labels, but must come from the textbook
                            if part['textbook'].get('page') and page_labels:
                                page = part['textbook'].get('page')
                                actual_page = None
                                # Safely convert page labels to strings for comparison
                                for i, label in enumerate(page_labels):
                                    if str(label) == str(page):
                                        actual_page = i + 1
                                        break
                                
                                # Only proceed if we found a valid page
                                if actual_page is not None and textbook_id is not None:
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
                                                'homeworks': current_homeworks
                                            }).eq('id', doc['id']).execute()

                        else:
                            # Exercise doesn't exist, create it
                            # Define exercise_name with a default value
                            exercise_name = f"Problem {j+1}.{k+1}"
                            
                            # Prepare exercise data
                            exercise_data = {
                                'homework': homework_id,
                                'problem_number': j + 1,
                                'info': problem.get('info') if problem.get('info') else '',
                                'problem_part_number': k + 1,
                                'given': part.get('given') if part.get('given') else '',
                                'title': exercise_name,
                                'text': part.get('text_content') if part.get('text_content') else ''
                            }
                            
                            # Add image URL if available
                            if 'image_path' in part and part['image_path']:
                                try:
                                    image_path = part['image_path']
                                    
                                    # Check if file exists
                                    full_image_path = os.path.join(self.class_folder, homework_id, image_path)
                                    if os.path.exists(full_image_path):
                                        # Create the exercise first to get the exercise_id
                                        exercise_response = supabase.table('exercises').insert(exercise_data).execute()
                                        exercise_id = exercise_response.data[0]['id']
                                        
                                        # Upload image to Supabase storage
                                        with open(full_image_path, 'rb') as f:
                                            image_data = f.read()
                                        
                                        # Create a unique path for the image in storage using class_id/exercise_id.png
                                        storage_path = f"{class_id}/{exercise_id}.png"
                                        
                                        # Upload to storage
                                        supabase.storage.from_("exercises").upload(
                                            path=storage_path,
                                            file=image_data,
                                            file_options={"content-type": "image/png"}
                                        )
                                        
                                        
                                        # Create document for exercise with homeworks array
                                        supabase.table('documents').insert({
                                            'page': 1, # leave for now.
                                            'text': '', # leave for now.
                                            'description': '', # leave for now.
                                            'exercises': [exercise_id],  # Initialize as array with current exercise
                                            'homeworks': [homework_id],  # Initialize as array with current homework
                                            'processed': True, # set this to be true for now.
                                        }).execute()
                                    else:
                                        logger.warning(f"Image file not found: {full_image_path}")
                                        # If no image, just create the exercise normally
                                        exercise_response = supabase.table('exercises').insert(exercise_data).execute()
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
                                except Exception as e:
                                    logger.error(f"Error uploading image for exercise {exercise_name}: {str(e)}")
                                    print(f"Error uploading image for exercise {exercise_name}: {str(e)}")
                                    # If there was an error with the image, still create the exercise without the image
                                    exercise_response = supabase.table('exercises').insert(exercise_data).execute()
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
                            else:
                                # No image, just create the exercise
                                exercise_response = supabase.table('exercises').insert(exercise_data).execute()
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
    homework_folder = "/Users/ashoksaravanan/Coding/ScribeLec/server/classes/cs182/homeworks"
    api_key = os.getenv('GOOGLE_API_KEY')
    class_id = "45d629b6-9138-45f9-ab79-2a089f665890" 

    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase = create_client(supabase_url, supabase_private_key, options=opts)

    # Initialize processor with homework folder
    processor = HomeworkExtractor(homework_folder, api_key)
    
    # # Process all homework files
    homework_data = processor.process_all_homework(class_id, supabase)
    print(f"Processed {len(homework_data)} homework assignments")

    # get the page labels
    # get the pdf path
    pdf_path = "/Users/ashoksaravanan/Coding/ScribeLec/server/classes/cs182/textbooks/Discrete.pdf"
    toc_extractor = TableOfContentsExtractor(api_key, pdf_path)
    page_labels = toc_extractor.get_page_labels()
    
    # # Upload to Supabase
    homework_ids = processor.upload_to_supabase(class_id, supabase, page_labels)
    print(f"Uploaded homework with IDs: {homework_ids}")