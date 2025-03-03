# does not work, still need to fix.
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

from slide_extractor import SlideExtractor

load_dotenv()

logger = logging.getLogger(__name__)

class NewLectureProcessor:
    def __init__(self, lecture_folder: str, api_key: str):
        """Initialize processor with a lecture folder path
        
        Args:
            homework_folder: Path to folder containing homework files (PDF/txt)
            api_key: API key for Gemini
        """
        self.lecture_folder = lecture_folder
        self.api_key = api_key
        
        # Create homework.json in the parent directory of homework folder
        self.class_folder = os.path.dirname(lecture_folder)
        self.lecture_json_path = os.path.join(self.class_folder, 'lecture.json')
        
        # Get list of all homework files
        self.lecture_files = []
        for filename in os.listdir(lecture_folder):
            if filename.endswith('.pdf') or filename.endswith('.txt'):
                self.lecture_files.append(os.path.join(lecture_folder, filename))
        
        logger.info(f"Found {len(self.lecture_files)} lecture files in {lecture_folder}")

    def process_all_lectures(self, class_id: str, supabase: Client, max_lectures: int = None) -> List[Dict[str, Any]]:
        """Process all lecture files in the folder"""
        try:
            # Load existing lecture data
            lecture_list = self._load_existing_lecture()
            processed_files = {lecture.get('source_file') for lecture in lecture_list}
            
            # Filter files that haven't been processed
            files_to_process = [f for f in self.lecture_files if f not in processed_files]
            
            if not files_to_process:
                logger.info("All lecture files have been processed")
                return lecture_list
            
            # Limit homework files if max_homeworks is specified
            if max_lectures is not None:
                files_to_process = files_to_process[:max_lectures]
            
            # Process each unprocessed file
            with tqdm(total=len(files_to_process), desc="Processing lecture files") as pbar:
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
                        
                        # Process the lecture
                        lecture_data = self._process_single_lecture(
                            file_path=file_path,
                            pdf_document=pdf_document,
                            text_content=text_content,
                            class_id=class_id,
                            supabase=supabase
                        )
                        
                        # Add source file information
                        lecture_data['source_file'] = file_path
                        
                        # Add to list and save progress
                        lecture_list.append(lecture_data)
                        self._save_lecture_list(lecture_list)
                        
                        # Clean up
                        if pdf_document:
                            pdf_document.close()
                            
                    except Exception as e:
                        logger.error(f"Error processing {file_path}: {str(e)}")
                        continue
                        
                    pbar.update(1)
            
            return lecture_list
            
        except Exception as e:
            logger.error(f"Error in process_all_lecture: {str(e)}")
            raise

    def _process_single_lecture(self, file_path: str, pdf_document: fitz.Document, 
                               text_content: str, class_id: str, supabase: Client) -> Dict[str, Any]:
        """Process a single lecture file"""
        try:
            # Initialize slide extractor
            slide_extractor = SlideExtractor(self.api_key)
            
            # Get textbook info from database
            raw_textbook_info = supabase.table("textbooks").select("*").eq("class", class_id).execute().data
            textbook_info = "\n".join(f"{t['textbook_number']}. {t['title']}" for t in raw_textbook_info)
            
            # Combine homework info
            homework_info = []
            
            if pdf_document:
                for page in pdf_document:
                    text = page.get_text()
                    homework_info.append(f"PDF Content: {text}")
            
            if text_content:
                homework_info.append(f"Text Content: {text_content}")

            combined_info = textbook_info + "\n" + "\n".join(homework_info)

            # Extract slides
            slide_data = slide_extractor.extract_slides_from_text(combined_info)
            
            return slide_data
            
        except Exception as e:
            logger.error(f"Error processing lecture file {file_path}: {str(e)}")
            raise

    def upload_to_supabase(self, class_id: str, supabase: Client, max_lectures: int = None, already_uploaded: int = 0) -> List[str]:
        """Upload all processed lectures to Supabase"""
        try:
            lecture_ids = []
            
            # Get all PDF files in the lecture folder
            pdf_files = [f for f in os.listdir(self.lecture_folder) if f.endswith('.pdf')]

            skip = already_uploaded
            
            # Upload each lecture with progress bar
            with tqdm(total=len(pdf_files), desc="Uploading lectures") as pbar:
                for i, pdf_filename in enumerate(pdf_files):
                    if skip > 0:
                        skip -= 1
                        continue
                    
                    if max_lectures is not None and i >= max_lectures:
                        break
                    
                    pdf_path = os.path.join(self.lecture_folder, pdf_filename)
                    
                    # Get page count using PyMuPDF
                    pdf_document = fitz.open(pdf_path)
                    page_count = len(pdf_document)
                    
                    # Create lecture entry
                    lecture_title = os.path.splitext(pdf_filename)[0]
                    lecture_response = supabase.table('lectures').insert({
                        'class': class_id,
                        'name': lecture_title,
                        'note_number': i + 1,
                        'pages': page_count,
                        'parse_status': 'error' # so we can re-parse it
                    }).execute()
                    
                    lecture_id = lecture_response.data[0]['id']
                    lecture_ids.append(lecture_id)
                    
                    # Upload each page to the documents table and store page images
                    for page_num in range(page_count):
                        page = pdf_document[page_num]
                        page_text = page.get_text()
                        
                        # Upload page text to documents table
                        document_response = supabase.table('documents').insert({
                            'lecture': lecture_id,
                            'page': page_num + 1,
                            'text': page_text,
                            'processed': False
                        }).execute()
                        
                        document_id = document_response.data[0]['id']
                        
                        # Render page to image
                        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                        img_bytes = pix.tobytes("png")
                        
                        # Upload image to Supabase storage
                        storage_path = f"{class_id}/{lecture_id}/{document_id}.png"
                        supabase.storage.from_("lectures").upload(
                            path=storage_path,
                            file=img_bytes,
                            file_options={"content-type": "image/png"}
                        )
                    
                    # Clean up
                    pdf_document.close()
                    pbar.update(1)
                    
            return lecture_ids
            
        except Exception as e:
            logger.error(f"Error uploading to Supabase: {str(e)}")
            raise

if __name__ == "__main__":
    # Example usage
    lectures_folder = "/Users/ashoksaravanan/Coding/ScribeLec/server/classes/cs182/lectures"
    api_key = os.getenv('GOOGLE_API_KEY')
    class_id = "45d629b6-9138-45f9-ab79-2a089f665890" 

    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase = create_client(supabase_url, supabase_private_key, options=opts)

    processor = NewLectureProcessor(lectures_folder, api_key)
    # lecture_list = processor.process_all_lectures(class_id, supabase)
    # print(lecture_list)
    processor.upload_to_supabase(class_id, supabase, already_uploaded=1)