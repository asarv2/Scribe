# class used to process a textbook, using the pdf filename and pymupdf to extract the text/images. 
# also uses gemini to extract the exercises from the textbook. 

import os
import fitz  # PyMuPDF
import google.generativeai as genai
from typing import Dict, Any, List, Tuple
import json
import re
from PIL import Image
import io
from table_of_contents_extractor import TableOfContentsExtractor
import xml.etree.ElementTree as ET
from tqdm import tqdm
import logging
from exercise_extractor import ExerciseExtractor
from supabase import create_client, ClientOptions, Client

logger = logging.getLogger(__name__)


class NewTextbookProcessor:
    def __init__(self, pdf_path: str, api_key: str):
        self.pdf_path = pdf_path
        self.pdf_document = fitz.open(pdf_path)
        self.pdf_filename = os.path.basename(pdf_path)
        
        # Initialize extractors
        self.toc_extractor = TableOfContentsExtractor(api_key, pdf_path)
        self.exercise_extractor = ExerciseExtractor(api_key, pdf_path)

    def extract_exercises(self, max_chapters: int = None) -> List[Dict[str, Any]]:
        """Main method to extract exercises from the textbook
        
        Args:
            max_chapters: Optional maximum number of chapters to process
        """
        # Get TOC structure (either from cache or create new)
        toc_structure = self.toc_extractor.get_or_create_toc()
        
        # Get page labels for last chapter calculation
        page_labels = self.toc_extractor.get_page_labels()
        
        # Try to load existing exercises
        exercises_list = self.exercise_extractor.load_existing_exercises()
        processed_chapters = {ex["chapter_title"] for ex in exercises_list}
        
        # Filter chapters that need processing
        chapters_to_process = [
            chapter for chapter in toc_structure["chapters"]
            if ("actual_exercises_page" in chapter and 
                chapter["actual_exercises_page"] is not None and 
                chapter["title"] not in processed_chapters)
        ]
        
        # Limit chapters if max_chapters is specified
        if max_chapters is not None:
            chapters_to_process = chapters_to_process[:max_chapters]
        
        # Process remaining chapters with progress bar
        for chapter in tqdm(chapters_to_process, desc="Processing chapters"):
            try:
                # Use pre-calculated actual exercise page numbers
                exercises_start = chapter["actual_exercises_page"]
                
                # Determine exercises end page using actual pages
                chapter_idx = toc_structure["chapters"].index(chapter)
                if chapter_idx < len(toc_structure["chapters"]) - 1:
                    exercises_end = toc_structure["chapters"][chapter_idx + 1]["actual_page"] - 1
                else:
                    next_section_index = len(page_labels)
                    while (next_section_index > 0 and 
                           not page_labels[next_section_index - 1].isdigit()):
                        next_section_index -= 1
                    exercises_end = int(page_labels[next_section_index - 1])
                
                # process all pages at once for a chapter
                chapter_exercises = self._process_exercise_pages(exercises_start, exercises_end, chapter["title"])
                
                # Add chapter exercises to main list
                exercises_list.extend(chapter_exercises)
                
                # Save progress after each chapter
                self.exercise_extractor.save_exercises(exercises_list)
                
            except Exception as e:
                logger.error(f"Error processing chapter {chapter['title']}: {str(e)}")
                continue
        
        return exercises_list

    def _process_exercise_pages(self, exercises_start: int, exercises_end: int, chapter_title: str) -> List[Dict[str, Any]]:
        """Process a single page containing exercises"""
        try:
            logger.debug(f"Processing chapter {chapter_title} from page {exercises_start} to {exercises_end}")
            pages = []
            for page_num in range(exercises_start, exercises_end + 1):
                page = self.pdf_document[page_num - 1]
                pages.append(page)
                logger.debug(f"Added page {page_num} with dimensions: {page.rect}")
            return self.exercise_extractor.process_exercise_pages(pages, chapter_title)
        except Exception as e:
            logger.error(f"Error in _process_exercise_pages: {str(e)}", exc_info=True)
            return []

    def create_combined_textbook_json(self) -> Dict[str, Any]:
        """Creates a combined JSON file containing chapter information and exercises"""
        try:
            # Get base filename without extension
            base_filename = os.path.splitext(self.pdf_filename)[0]
            
            # Load TOC structure
            toc_structure = self.toc_extractor.get_or_create_toc()
            
            # Load exercises
            exercises_list = self.exercise_extractor.load_existing_exercises()
            
            # Create chapters list with exercises
            chapters = []
            for chapter in toc_structure["chapters"]:
                # Get chapter exercises
                chapter_exercises = [
                    {
                        "title": ex["number"],
                        "start_page": ex["start_page"] + chapter["actual_exercises_page"] - 1,
                        "end_page": ex["end_page"] + chapter["actual_exercises_page"] - 1,
                        "image_path": ex["image_path"],
                        "text_content": ex["text_content"]
                    }
                    for ex in exercises_list
                    if ex["chapter_title"] == chapter["title"]
                ]
                
                chapter_data = {
                    "title": chapter["title"],
                    "start_page": chapter["actual_page"],
                    "end_page": chapter.get("actual_exercises_page", None),  # Use exercises page as end if available
                    "exercises": chapter_exercises
                }
                chapters.append(chapter_data)
            
            # Create final structure
            combined_data = {
                "textbook_name": base_filename,
                "chapters": chapters
            }
            
            # Save to file
            output_filename = f"textbook_{base_filename}.json"
            output_path = os.path.join(os.path.dirname(self.pdf_path), output_filename)
            
            with open(output_path, 'w') as f:
                json.dump(combined_data, f, indent=2)
            
            return combined_data
            
        except Exception as e:
            logger.error(f"Error creating combined textbook JSON: {str(e)}", exc_info=True)
            raise

    def upload_to_supabase(self, class_id: str, supabase: Client) -> Tuple[str, str, str]:
        """Uploads the processed textbook data to Supabase
        
        Args:
            class_id: The ID of the class to upload the textbook to
            supabase: Initialized Supabase client
            
        Returns:
            str: The created textbook ID
        """
        try:
            # Get the combined data
            combined_data = self.create_combined_textbook_json()
            
            # Create textbook entry
            textbook_response = supabase.table('textbooks').insert({
                'class': class_id,
                'title': combined_data['textbook_name'],
                'pages': self.pdf_document.page_count,
            }).execute()
            
            textbook_id = textbook_response.data[0]['id']
            logger.info(f"Created textbook with ID: {textbook_id}")
            
            # Upload chapters and exercises
            chapters_id = []
            exercises_id = []
            for i, chapter in tqdm(enumerate(combined_data['chapters']), desc="Uploading chapters"):
                # Create chapter
                chapter_response = supabase.table('chapters').insert({
                    'title': chapter['title'],
                    'start_page': chapter['start_page'],
                    'end_page': chapter['end_page'],
                    'textbook': textbook_id,
                    'chapter_number': i + 1
                }).execute()
                
                chapter_id = chapter_response.data[0]['id']
                chapters_id.append(chapter_id)
                

                # Upload exercises for this chapter
                exercise_ids = []
                for j, exercise in enumerate(chapter.get('exercises', [])):
                    exercise_response = supabase.table('exercises').insert({
                        'title': exercise['title'],
                        'start_page': exercise['start_page'],
                        'end_page': exercise['end_page'],
                        'chapter': chapter_id,
                        'exercise_number': j + 1
                    }).execute()

                    exercise_id = exercise_response.data[0]['id']
                    exercise_ids.append(exercise_id)
                
                exercises_id.append(exercise_ids)
            logger.info(f"Successfully uploaded textbook data to Supabase")
            return textbook_id, chapters_id, exercises_id
            
        except Exception as e:
            logger.error(f"Error uploading to Supabase: {str(e)}")
            raise

    def create_documents_and_upload_textbook_images(self, class_id: str, textbook_id: str, supabase: Client, max_pages: int = None) -> None:
        """Creates document entries and uploads page images to Supabase storage
        
        Args:
            class_id: The class ID
            textbook_id: The textbook ID
            supabase: Initialized Supabase client
        """
        try:
            # Create documents entries for all pages
            documents_to_insert = []
            for page_num in range(self.pdf_document.page_count):
                if max_pages is not None and page_num >= max_pages:
                    break
                page = self.pdf_document[page_num]
                
                # Extract text from page
                text = page.get_text()
                
                # Create document entry
                documents_to_insert.append({
                    'textbook': textbook_id,
                    'page': page_num + 1,  # 1-based page numbering
                    'text': text,
                    'description': '',
                    'processed': True # can change later if we want LLM to describe the page.
                })
            
            # Bulk insert documents
            documents_response = supabase.table('documents').insert(documents_to_insert).execute()
            logger.info(f"Created {len(documents_response.data)} document entries")
            
            # Upload page images
            for doc in tqdm(documents_response.data, desc="Uploading page images"):
                page_num = doc['page'] - 1  # Convert back to 0-based for PyMuPDF
                page = self.pdf_document[page_num]
                
                # Convert page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))  # 300 DPI
                img_data = pix.tobytes()
                
                # Upload to Supabase storage
                file_path = f"{class_id}/{textbook_id}/{doc['id']}.png"
                supabase.storage.from_('textbooks').upload(
                    file_path,
                    img_data,
                    file_options={"content-type": "image/png"}
                )
                
            logger.info("Successfully uploaded all page images")
            
        except Exception as e:
            logger.error(f"Error creating documents and uploading images: {str(e)}")
            raise

    def upload_exercise_images(self, class_id: str, chapters_id: List[str], exercises_id: List[List[str]], supabase: Client) -> None:
        """Uploads exercise images to Supabase storage using combined data
        
        Args:
            class_id: The class ID
            chapters_id: The chapters ID (list)
            exercises_id: The exercises ID (2D list, matching chapters)
            supabase: Initialized Supabase client
        """
        try:
            # Get the combined data that contains exercise information
            combined_data = self.create_combined_textbook_json()
            
            # Prepare documents for bulk insertion
            documents_to_insert = []
            
            # Create mapping of exercise data for later use
            exercise_mapping = {}  # Will store exercise_id -> {image_path, chapter_id} mapping
            
            # Iterate through chapters and their exercises to prepare documents
            for chapter_data, chapter_id, chapter_exercises_ids in zip(combined_data['chapters'], chapters_id, exercises_id):
                for exercise, exercise_id in zip(chapter_data.get('exercises', []), chapter_exercises_ids):
                    # Create document entry
                    documents_to_insert.append({
                        'page': exercise['start_page'],
                        'text': exercise['text_content'],
                        'chapter': chapter_id,
                        'exercise': exercise_id,
                        'description': '',
                        'processed': True # can change later if we want LLM to describe the page.
                    })
                    
                    # Store mapping for later use
                    exercise_mapping[exercise_id] = {
                        'image_path': exercise['image_path'],
                        'chapter_id': chapter_id
                    }
            
            # Bulk insert documents
            documents_response = supabase.table('documents').insert(documents_to_insert).execute()
            logger.info(f"Created {len(documents_response.data)} exercise documents")
            
            # Upload images using the created documents
            for document in tqdm(documents_response.data, desc="Uploading exercise images"):
                exercise_id = document['exercise']
                exercise_data = exercise_mapping[exercise_id]
                
                # Get image from original path
                original_path = exercise_data['image_path']
                image_full_path = os.path.join(os.path.dirname(self.pdf_path), f'exercises_{self.pdf_filename.split(".")[0]}', original_path)
                
                with open(image_full_path, 'rb') as f:
                    img_data = f.read()
                
                # Upload to Supabase storage using the original image path structure
                file_path = f"{class_id}/{exercise_id}/{document['id']}.png"
                supabase.storage.from_('exercises').upload(
                    file_path,
                    img_data,
                    file_options={"content-type": "image/png"}
                )
            
            logger.info("Successfully uploaded all exercise images")
            
        except Exception as e:
            logger.error(f"Error uploading exercise images: {str(e)}")
            raise

if __name__ == "__main__": 
    textbook_path = "/Users/ashoksaravanan/Coding/ScribeLec/server/uploads/Vanderbei.pdf"
    api_key = os.getenv('GOOGLE_API_KEY')
    class_id = "c770c9bb-4de1-44be-aacb-b4bea3efbacf"  # Replace with actual class ID

    # Initialize Supabase client
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase = create_client(supabase_url, supabase_private_key, options=opts)

    processor = NewTextbookProcessor(textbook_path, api_key)
    # Process textbook and get ID
    exercises = processor.extract_exercises()
    combined_data = processor.create_combined_textbook_json()
    textbook_id, chapters_id, exercises_id = processor.upload_to_supabase(class_id, supabase)
    
    # Upload images
    processor.create_documents_and_upload_textbook_images(class_id, textbook_id, supabase)
    processor.upload_exercise_images(class_id, chapters_id, exercises_id, supabase)