# does not work, still need to fix.
import os
import re
import fitz  # PyMuPDF
from typing import Dict, Any, List, Tuple
import json
import logging
from supabase import create_client, ClientOptions, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class LectureExtractor:
    def __init__(self, file_path: str):
        """Initialize processor with a lecture file path
        
        Args:
            file_path: Path to the lecture file (PDF)
        """
        self.file_path = file_path
        
        logger.info(f"Initialized LectureExtractor for file: {file_path}")

    def extract_pdf_content(self) -> Tuple[List[Dict[str, Any]], int]:
        """Extract text and image data from PDF pages
        
        Returns:
            Tuple[List[Dict[str, Any]], int]: List of dictionaries containing page text and image data, and page count
        """
        try:
            pdf_document = fitz.open(self.file_path)
            page_count = len(pdf_document)
            
            pages_content = []
            for page_num in range(page_count):
                page = pdf_document[page_num]
                page_text = page.get_text()
                
                # Render page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                img_bytes = pix.tobytes("png")
                
                pages_content.append({
                    'page_num': page_num + 1,
                    'text': page_text,
                    'image': img_bytes
                })
            
            # Clean up
            pdf_document.close()
            return pages_content, page_count

        except Exception as e:
            logger.error(f"Error extracting PDF content: {str(e)}")
            raise

    def upload_to_supabase(self, pages_content: List[Dict[str, Any]], class_id: str, lecture_id: str, supabase: Client):
        """Process lecture and upload to Supabase
        
        Args:
            pages_content: List of dictionaries containing page text and image data
            class_id: ID of the class
            lecture_id: ID of the lecture
            supabase: Supabase client
        """
        try:
            # Upload each page to the documents table and store page images
            for page_data in pages_content:
                # Upload page text to documents table
                document_response = supabase.table('documents').insert({
                    'lecture': lecture_id,
                    'page': page_data['page_num'],
                    'text': page_data['text'],
                    'processed': False
                }).execute()
                
                document_id = document_response.data[0]['id']
                
                # Upload image to Supabase storage
                storage_path = f"{class_id}/{lecture_id}/{document_id}.png"
                supabase.storage.from_("lectures").upload(
                    path=storage_path,
                    file=page_data['image'],
                    file_options={"content-type": "image/png"}
                )

        except Exception as e:
            logger.error(f"Error uploading to Supabase: {str(e)}")
            raise

# if __name__ == "__main__":
#     # Example usage
#     lectures_folder = "/Users/ashoksaravanan/Coding/ScribeLec/server/classes/cs182/lectures"
#     api_key = os.getenv('GOOGLE_API_KEY')
#     class_id = "45d629b6-9138-45f9-ab79-2a089f665890" 

#     # Initialize Supabase client
#     supabase_url = os.getenv("SUPABASE_URL")
#     supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
#     opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
#     supabase = create_client(supabase_url, supabase_private_key, options=opts)

#     processor = LectureExtractor(lectures_folder, api_key)
#     # lecture_list = processor.process_all_lectures(class_id, supabase)
#     # print(lecture_list)
#     processor.upload_to_supabase(class_id, supabase, already_uploaded=1)