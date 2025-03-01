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

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Set to DEBUG to see all messages
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # Output to console
        logging.FileHandler('textbook_processing.log')  # Also save to a file
    ]
)

logger = logging.getLogger(__name__)


class NewTextbookProcessor:
    def __init__(self, pdf_path: str, api_key: str, custom_page_labels: List[str] = None, extra_top_padding: int = 0):
        self.pdf_path = pdf_path
        self.pdf_document = fitz.open(pdf_path)
        self.pdf_filename = os.path.basename(pdf_path)
        
        # Initialize extractors
        self.toc_extractor = TableOfContentsExtractor(api_key, pdf_path, custom_page_labels)
        self.exercise_extractor = ExerciseExtractor(api_key, pdf_path, extra_top_padding)

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
            if (chapter["title"] not in processed_chapters)
        ]
        
        # Limit chapters if max_chapters is specified
        if max_chapters is not None:
            chapters_to_process = chapters_to_process[:max_chapters]
        
        # Process remaining chapters with progress bar
        for chapter in tqdm(chapters_to_process, desc="Processing chapters"):
            try:
                # Use pre-calculated actual exercise page numbers
                exercises_start = chapter["actual_exercises_page"]
                
                if exercises_start is None:
                    exercises_start = chapter["actual_page"] # start at the beginning of the chapter

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
                chapter_exercises = self._process_exercise_pages(exercises_start, exercises_end, chapter["title"], chapter["page"]) # adding the page in case gemini finds the actual page numbers
                
                # Add chapter exercises to main list
                exercises_list.extend(chapter_exercises)
                
                # Save progress after each chapter
                self.exercise_extractor.save_exercises(exercises_list)
                
            except Exception as e:
                logger.error(f"Error processing chapter {chapter['title']}: {str(e)}")
                continue
        
        return exercises_list

    def _process_exercise_pages(self, exercises_start: int, exercises_end: int, chapter_title: str, chapter_page: int) -> List[Dict[str, Any]]:
        """Process a single page containing exercises"""
        try:
            logger.debug(f"Processing chapter {chapter_title} from page {exercises_start} to {exercises_end}")
            pages = []
            for page_num in range(exercises_start, exercises_end + 1):
                page = self.pdf_document[page_num - 1]
                pages.append(page)
                logger.debug(f"Added page {page_num} with dimensions: {page.rect}")
            return self.exercise_extractor.process_exercise_pages(pages, chapter_title, chapter_page)
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
                chapter_exercises_list = [
                    ex for ex in exercises_list
                    if ex["chapter_title"] == chapter["title"]
                ]

                offset = False
                if chapter.get("actual_exercises_page", None) is None:
                    chapter["actual_exercises_page"] = exercises_list[0]["start_page"] + chapter["actual_page"] - 1
                    offset = True
                
                # Create exercise entries for this chapter
                chapter_exercises = []
                for ex in chapter_exercises_list:
                    # if it does not exist, use the first exercise page
                    start_page = ex["start_page"]
                    end_page = ex["end_page"]
                    if offset:
                        start_page += chapter["actual_page"] - 1
                        end_page += chapter["actual_page"] - 1
                    else:
                        start_page += chapter["actual_exercises_page"] - 1
                        end_page += chapter["actual_exercises_page"] - 1

                    chapter_exercises.append({
                        "title": ex["number"],
                        "start_page": start_page,
                        "end_page": end_page,
                        "image_path": ex["image_path"],
                        "text_content": ex["text_content"]
                    })
                
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

    def upload_to_supabase(self, class_id: str, supabase: Client, old_textbook_id: str = None) -> Tuple[str, List[str], List[List[str]]]:
        """Uploads the processed textbook data to Supabase or fetches from existing textbook
        
        Args:
            class_id: The ID of the class to upload the textbook to
            supabase: Initialized Supabase client
            old_textbook_id: Optional ID of existing textbook to copy data from
            
        Returns:
            Tuple[str, List[str], List[List[str]]]: The textbook ID, chapter IDs, and exercise IDs
        """
        try:
            if old_textbook_id:
                logger.info(f"Using existing textbook data from ID: {old_textbook_id}")
                
                textbook_id = old_textbook_id
                
                # Fetch existing chapters
                old_chapters = supabase.table('chapters').select('*').eq('textbook', old_textbook_id).order('chapter_number').execute()
                
                # Map to store old chapter ID to new chapter ID
                chapter_id_mapping = {}
                chapters_id = []
                exercises_id = []
                
                # Create new chapters based on old ones
                for old_chapter in tqdm(old_chapters.data, desc="Copying chapters"):
                    chapter_id_mapping[old_chapter['id']] = old_chapter['id']
                    
                    # Fetch exercises for this old chapter
                    old_exercises = supabase.table('exercises').select('*').eq('chapter', old_chapter['id']).order('exercise_number').execute()
                    
                    # Create new exercises based on old ones
                    chapter_exercise_ids = []
                    for old_exercise in old_exercises.data:
                        chapter_exercise_ids.append(old_exercise['id'])
                    
                    exercises_id.append(chapter_exercise_ids)
                    chapters_id.append(old_chapter['id'])
                
                logger.info(f"Successfully copied textbook data from {old_textbook_id} to {textbook_id}")
                
            else:
                # Original implementation for creating new textbook data
                combined_data = self.create_combined_textbook_json()
                
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
            # get all of the chapters data
            chapters_data = supabase.table('chapters').select('*').eq('textbook', textbook_id).execute()
            chapters_data = chapters_data.data

            # create a mapping of page number to chapter id
            page_to_chapter_mapping = {}
            for chapter in chapters_data:
                for page_num in range(chapter['start_page'], chapter['end_page'] + 1):
                    page_to_chapter_mapping[page_num] = chapter['id']
            
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

    def upload_exercise_images(self, class_id: str, textbook_id: str, chapters_id: List[str], exercises_id: List[List[str]], supabase: Client, upload_images: bool = True) -> None:
        """Updates existing documents with exercise IDs and uploads exercise images to Supabase storage
        
        Args:
            class_id: The class ID
            textbook_id: The textbook ID
            chapters_id: The chapters ID (list)
            exercises_id: The exercises ID (2D list, matching chapters)
            supabase: Initialized Supabase client
            upload_images: Whether to upload exercise images
        """
        try:
            # Get the combined data that contains exercise information
            combined_data = self.create_combined_textbook_json()
            
            # First, get all existing documents for this textbook
            existing_docs = supabase.table('documents').select('*').eq('textbook', textbook_id).execute()
            existing_docs_map = {doc['page']: doc for doc in existing_docs.data}
            
            # Create mapping to collect exercises by page
            page_exercises_map = {}  # Will store page_num -> {exercises: [], chapter: str}
            exercise_image_map = {}  # Will store exercise_id -> {image_path, doc_id}
            
            # First, assign chapters to all pages
            page_to_chapter_map = {}  # Maps page number to chapter ID
            
            # Create a mapping of page ranges to chapter IDs
            for chapter_data, chapter_id in zip(combined_data['chapters'], chapters_id):
                start_page = chapter_data['start_page']
                end_page = chapter_data.get('end_page')
                
                # If end_page is None, use the next chapter's start_page - 1 or the last page
                if end_page is None:
                    chapter_idx = combined_data['chapters'].index(chapter_data)
                    if chapter_idx < len(combined_data['chapters']) - 1:
                        end_page = combined_data['chapters'][chapter_idx + 1]['start_page'] - 1
                    else:
                        end_page = self.pdf_document.page_count
                
                # Assign this chapter to all pages in its range
                for page_num in range(start_page, end_page + 1):
                    page_to_chapter_map[page_num] = chapter_id
            
            # Now process exercises and add them to the appropriate pages
            for chapter_data, chapter_id, chapter_exercises_ids in zip(combined_data['chapters'], chapters_id, exercises_id):
                for exercise, exercise_id in zip(chapter_data.get('exercises', []), chapter_exercises_ids):
                    page_num = exercise['start_page']
                    
                    # Initialize page entry if not exists
                    if page_num not in page_exercises_map:
                        page_exercises_map[page_num] = {
                            'exercises': [],
                            'chapter': chapter_id,
                            'text': ''  # Will concatenate text from all exercises
                        }
                    
                    # Add exercise to the page
                    page_exercises_map[page_num]['exercises'].append(exercise_id)
                    
                    # Concatenate text content
                    if page_exercises_map[page_num]['text']:
                        page_exercises_map[page_num]['text'] += "\n\n" + exercise['text_content']
                    else:
                        page_exercises_map[page_num]['text'] = exercise['text_content']
                    
                    # Store image mapping for later use
                    if page_num in existing_docs_map:
                        doc_id = existing_docs_map[page_num]['id']
                        exercise_image_map[exercise_id] = {
                            'image_path': exercise['image_path'],
                            'doc_id': doc_id
                        }
            
            # Prepare documents to upsert - first for pages with exercises
            documents_to_upsert = []
            for page_num, page_data in page_exercises_map.items():
                if page_num in existing_docs_map:
                    doc = existing_docs_map[page_num]
                    documents_to_upsert.append({
                        'id': doc['id'],
                        'page': page_num,
                        'textbook': textbook_id,
                        'exercises': page_data['exercises'],  # Array of exercise IDs
                        'chapter': page_data['chapter'],
                        'text': page_data['text']
                    })
            
            # Then for all other pages that need chapter assignments
            for page_num, doc in existing_docs_map.items():
                # Skip pages we've already processed (those with exercises)
                if page_num in page_exercises_map:
                    continue
                
                # If this page has a chapter assignment, update it
                if page_num in page_to_chapter_map:
                    documents_to_upsert.append({
                        'id': doc['id'],
                        'page': page_num,
                        'textbook': textbook_id,
                        'chapter': page_to_chapter_map[page_num],
                        # Keep existing text and exercises (if any)
                        'text': doc.get('text', ''),
                        'exercises': doc.get('exercises', [])
                    })
            
            # Bulk upsert documents
            if documents_to_upsert:
                # Process in smaller batches to avoid conflicts
                batch_size = 50
                for i in range(0, len(documents_to_upsert), batch_size):
                    batch = documents_to_upsert[i:i+batch_size]
                    updated_docs = supabase.table('documents').upsert(batch).execute()
                    logger.info(f"Updated batch of {len(batch)} documents with chapter/exercise IDs")
                
                if upload_images:
                    # Upload images using the updated documents
                    for exercise_id, exercise_data in tqdm(exercise_image_map.items(), desc="Uploading exercise images"):
                        # Get image from original path
                        original_path = exercise_data['image_path']
                        image_full_path = os.path.join(os.path.dirname(self.pdf_path), 
                                                    f'exercises_{self.pdf_filename.split(".")[0]}', 
                                                    original_path)
                        
                        with open(image_full_path, 'rb') as f:
                            img_data = f.read()
                        
                        # Upload to Supabase storage
                        file_path = f"{class_id}/{textbook_id}/{exercise_id}/{exercise_data['doc_id']}.png"
                        supabase.storage.from_('exercises').upload(
                            file_path,
                            img_data,
                            file_options={"content-type": "image/png"}
                        )
                    
                    logger.info("Successfully uploaded all exercise images")
            else:
                logger.info("No documents to update")
            
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


    # custom page labels for chvatal textbook. nothing for the first 16 entries. Then 1 to the end for the rest. But keep everything as a string.
    # c_page_labels = [str(i) for i in range(1, 484)]
    # c_page_labels = ['0' for _ in range(16)] + c_page_labels

    # processor = NewTextbookProcessor(textbook_path, api_key, custom_page_labels=c_page_labels, extra_top_padding=10)
    processor = NewTextbookProcessor(textbook_path, api_key)
    # Process textbook and get ID
    exercises = processor.extract_exercises()
    combined_data = processor.create_combined_textbook_json()
    textbook_id, chapters_id, exercises_id = processor.upload_to_supabase(class_id, supabase, old_textbook_id="abd70059-0f1d-4c17-82a5-9e034356f21c")
    # print(textbook_id, chapters_id, exercises_id)
    
    # Upload images
    # processor.create_documents_and_upload_textbook_images(class_id, textbook_id, supabase)
    processor.upload_exercise_images(class_id, textbook_id, chapters_id, exercises_id, supabase, upload_images=False)