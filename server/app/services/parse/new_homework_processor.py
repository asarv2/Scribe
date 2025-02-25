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

            # Combine homework info
            homework_info = []
            
            if pdf_document:
                with tqdm(total=len(pdf_document), desc=f"Processing {os.path.basename(file_path)}") as pbar:
                    for page in pdf_document:
                        homework_info.append(f"PDF Content: {page.get_text()}")
                        pbar.update(1)
            
            if text_content:
                homework_info.append(f"Text Content: {text_content}")

            combined_info = textbook_info + "\n" + "\n".join(homework_info)

            # Extract problems
            homework_data = problems_extractor.extract_exercises_from_text(combined_info)
            
            # # Add metadata
            # homework_data['title'] = os.path.splitext(os.path.basename(file_path))[0]
            
            return homework_data
            
        except Exception as e:
            logger.error(f"Error processing homework file {file_path}: {str(e)}")
            raise

    def upload_to_supabase(self, class_id: str, supabase: Client) -> List[str]:
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
                        'homework_number': i + 1
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
                                                'problem_part_number': j + 1
                                            }).eq('id', exercise_id).execute()

                                            # update the document to be processed
                                            supabase.table('documents').update({
                                                'homework': homework_id,
                                                'processed': True
                                            }).eq('exercise', exercise_id).execute()

                                    if part['textbook'].get('page'):
                                        page = part['textbook'].get('page')
                                        # update the document's homework section. The exercise should already be set in the previous step.
                                        supabase.table('documents').update({
                                            'homework': homework_id,
                                            'processed': True
                                        }).eq('textbook', textbook_id).eq('page', page).execute()

                                else:
                                    # Exercise doesn't exist, create it
                                    exercise_response = supabase.table('exercises').insert({
                                        'homework': homework_id,
                                        'problem_number': i + 1,
                                        'info': problem.get('info') if problem.get('info') else '',
                                        'problem_part_number': j + 1,
                                        'title': exercise_name
                                    }).execute()
                                    exercise_id = exercise_response.data[0]['id']
                                    # Create document for exercise. Later this will become an image. We can have a description of it, as well as the text content.
                                    supabase.table('documents').insert({
                                        'page': 1, # leave for now.
                                        'text': '', # leave for now.
                                        'description': '', # leave for now.
                                        'exercise': exercise_id,
                                        'textbook': textbook_id,
                                        'homework': homework_id,
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

    def create_combined_homework_json(self, homework_id: str, supabase: Client) -> Dict[str, Any]:
        """Creates a combined JSON file containing all homework information
        
        Args:
            homework_id: The ID of the homework to process
            supabase: Initialized Supabase client
            
        Returns:
            Dict containing the combined homework data
        """
        try:
            # Get base filename without extension
            base_filename = self.homework_files[0].split('.')[0] if self.homework_files else "text_homework"
            
            # Get homework details
            homework_response = supabase.table('homework').select('*').eq('id', homework_id).execute()
            homework_data = homework_response.data[0]
            
            # Get all problems for this homework
            problems_response = supabase.table('problems').select('*').eq('homework', homework_id).execute()
            problems = problems_response.data
            
            # Create structure for combined data
            combined_data = {
                "homework_title": homework_data['title'],
                "due_date": homework_data['due_date'],
                "problems": []
            }
            
            # Process each problem
            for problem in problems:
                # Get parts for this problem
                parts_response = supabase.table('problem_parts').select('*').eq('problem', problem['id']).execute()
                parts = parts_response.data
                
                # Get documents for this problem
                documents_response = supabase.table('documents').select('*').eq('problem', problem['id']).execute()
                documents = documents_response.data
                
                problem_data = {
                    "problem_number": problem['problem_number'],
                    "info": problem['info'],
                    "parts": [],
                    "documents": [
                        {
                            "id": doc['id'],
                            "page": doc['page'],
                            "text": doc['text']
                        }
                        for doc in documents
                    ]
                }
                
                # Process each part
                for part in parts:
                    # Get textbook references for this part
                    textbook_refs_response = supabase.table('textbook_references').select('*').eq('part', part['id']).execute()
                    textbook_refs = textbook_refs_response.data
                    
                    part_data = {
                        "part_number": part['part_number'],
                        "part_letter": part['part_letter'],
                        "given": part['given'],
                        "textbook_references": [
                            {
                                "textbook_number": ref['textbook_number'],
                                "exercises": ref['exercises'],
                                "pages": ref['pages']
                            }
                            for ref in textbook_refs
                        ]
                    }
                    problem_data["parts"].append(part_data)
                
                combined_data["problems"].append(problem_data)
            
            # Save to file
            output_filename = f"homework_{base_filename}.json"
            output_path = os.path.join(os.path.dirname(self.homework_files[0] if self.homework_files else ""), output_filename)
            
            with open(output_path, 'w') as f:
                json.dump(combined_data, f, indent=2)
            
            return combined_data
            
        except Exception as e:
            logger.error(f"Error creating combined homework JSON: {str(e)}", exc_info=True)
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
    
    # Process all homework files
    homework_data = processor.process_all_homework(class_id, supabase)
    print(f"Processed {len(homework_data)} homework assignments")
    
    # Upload to Supabase
    homework_ids = processor.upload_to_supabase(class_id, supabase)
    print(f"Uploaded homework with IDs: {homework_ids}")