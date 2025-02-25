import os
from typing import List, Dict, Any
import xml.etree.ElementTree as ET
import re
from PIL import Image
import logging
import fitz  # PyMuPDF
import io
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExerciseImageProcessor:
    def __init__(self, pdf_filename: str):
        """Initialize the image processor with the PDF filename."""
        if not os.getenv('DOCKER_ENV'):
            self.base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        else:
            self.base_dir = '/app'
        
        self.uploads_dir = os.path.join(self.base_dir, 'uploads')
        self.pdf_path = os.path.join(self.uploads_dir, pdf_filename)
        self.images_dir = os.path.join(self.uploads_dir, f'{pdf_filename}_images')
        self.cropped_dir = os.path.join(self.uploads_dir, f'{pdf_filename}_exercises')
        
        # Create directories if they don't exist
        os.makedirs(self.images_dir, exist_ok=True)
        os.makedirs(self.cropped_dir, exist_ok=True)

    def ensure_page_images_exist(self, required_pages: set) -> None:
        """Ensure all required page images exist."""
        logger.info(f"Checking for required pages: {required_pages}")
        
        # Check which pages need to be converted
        existing_images = set(os.listdir(self.images_dir))
        logger.info(f"Existing images: {existing_images}")
        
        pages_to_convert = set()
        for page_num in required_pages:
            image_name = f'page_{page_num}.png'
            if image_name not in existing_images:
                pages_to_convert.add(page_num)
        
        if pages_to_convert:
            logger.info(f"Converting pages {pages_to_convert} for the image directory {self.images_dir}")
            
            # Convert pages in smaller batches to manage memory
            sorted_pages = sorted(list(pages_to_convert))
            for i in range(0, len(sorted_pages), 5):
                batch = sorted_pages[i:i + 5]
                try:
                    self._convert_pdf_pages_to_images(batch)
                except Exception as e:
                    logger.error(f"Error converting batch {batch}: {str(e)}")

    def _convert_pdf_pages_to_images(self, page_numbers: List[int]) -> None:
        """Convert specific PDF pages to images using PyMuPDF, ensuring 1000x1000 output with white padding."""
        try:
            # Open the PDF file
            pdf_document = fitz.open(self.pdf_path)
            
            for page_num in page_numbers:
                output_path = os.path.join(self.images_dir, f'page_{page_num}.png')
                
                if os.path.exists(output_path):
                    logger.info(f"Page {page_num} already exists at {output_path}")
                    continue
                
                try:
                    # Get the page (adjust for 0-based indexing)
                    page = pdf_document[page_num - 1]
                    
                    # Calculate zoom factor based on the longer dimension
                    zoom_width = 1000.0 / page.rect.width
                    zoom_height = 1000.0 / page.rect.height
                    zoom = min(zoom_width, zoom_height)  # Use smaller zoom to fit everything
                    mat = fitz.Matrix(zoom, zoom)
                    
                    # Get the page's pixmap
                    pix = page.get_pixmap(matrix=mat)
                    
                    # Convert to PIL Image for padding
                    img_data = pix.samples
                    img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
                    
                    # Create new 1000x1000 white image
                    new_img = Image.new('RGB', (1000, 1000), 'white')
                    
                    # Calculate position to paste original image (center it)
                    paste_x = (1000 - img.width) // 2
                    paste_y = (1000 - img.height) // 2
                    
                    # Paste original image onto white background
                    new_img.paste(img, (paste_x, paste_y))
                    
                    # Save the final image
                    new_img.save(output_path, "PNG")
                    
                    logger.info(f"Successfully saved page {page_num} to {output_path}")
                    
                    # Verify the image was saved
                    if not os.path.exists(output_path):
                        raise Exception(f"Image file was not created at {output_path}")
                    
                except Exception as e:
                    logger.error(f"Error processing page {page_num}: {str(e)}")
                    
            # Close the PDF document
            pdf_document.close()
                    
        except Exception as e:
            logger.error(f"Error in PDF processing: {str(e)}")
            raise

    def parse_exercise_xml_with_bounding_boxes(self, xml_string: str) -> Dict[str, Any]:
        """Parse the XML exercises into a structured format including bounding boxes."""
        try:
            if not xml_string or not xml_string.strip():
                logger.warning("Empty XML string received")
                return {"exercises": []}

            exercise_pattern = r'<EXERCISE>.*?</EXERCISE>'
            complete_exercises = re.findall(exercise_pattern, xml_string, re.DOTALL)
            cleaned_xml = f"<CHAPTER>{''.join(complete_exercises)}</CHAPTER>"
            
            root = ET.fromstring(cleaned_xml)
            exercise_structure = {"exercises": []}

            for exercise in root.findall('EXERCISE'):
                try:
                    title_elem = exercise.find('TITLE')
                    bbox_elems = exercise.findall('BBOX')

                    if title_elem is None or not bbox_elems:
                        logger.warning("Missing required elements in exercise")
                        continue

                    # Parse bounding boxes
                    bboxes = []
                    for bbox_elem in bbox_elems:
                        if not bbox_elem.text:
                            continue
                        
                        # Extract page number and coordinates
                        bbox_match = re.match(r'(\d+)\[([\d,\s]+)\]', bbox_elem.text.strip())
                        if bbox_match:
                            page = int(bbox_match.group(1))
                            coords = [int(x) for x in bbox_match.group(2).split(',')]
                            if len(coords) == 4:
                                bboxes.append({
                                    'page': page,
                                    'coords': coords
                                })

                    if not bboxes:
                        logger.warning(f"No valid bounding boxes found for exercise {title_elem.text}")
                        continue

                    exercise_info = {
                        'title': title_elem.text.strip(),
                        'bounding_boxes': bboxes
                    }
                    exercise_structure["exercises"].append(exercise_info)

                except (AttributeError, ValueError) as e:
                    logger.warning(f"Error processing exercise: {str(e)}")
                    continue

            logger.info(f"Successfully parsed {len(exercise_structure['exercises'])} exercises")
            return exercise_structure
        
        except ET.ParseError as e:
            logger.error(f"XML parsing error: {str(e)}")
            return {"exercises": []}
        except Exception as e:
            logger.error(f"Unexpected error parsing exercise XML: {str(e)}")
            return {"exercises": []}
        
    def crop_exercise_images(self, exercise_data: Dict[str, Any]) -> List[str]:
        """Crop images based on exercise bounding boxes and save to new directory."""
        cropped_paths = []
        
        # Get all required pages
        required_pages = set()
        for exercise in exercise_data['exercises']:
            for bbox_data in exercise['bounding_boxes']:
                required_pages.add(bbox_data['page'])
        
        # Ensure all required page images exist
        self.ensure_page_images_exist(required_pages)

        for exercise in exercise_data['exercises']:
            exercise_title = exercise['title'].replace(' ', '_').replace('/', '_')

            for i, bbox_data in enumerate(exercise['bounding_boxes']):
                page = bbox_data['page']
                coords = bbox_data['coords']  # [x_min, y_min, x_max, y_max]
                
                # Clamp coordinates to valid bounds
                coords[0] = max(0, min(coords[0], 1000))  # x_min
                coords[1] = max(0, min(coords[1], 1000))  # y_min
                coords[2] = max(coords[0], min(coords[2], 1000))  # x_max
                coords[3] = max(coords[1], min(coords[3], 1000))  # y_max
                
                source_image_path = os.path.join(self.images_dir, f'page_{page}.png')
                output_filename = f'{exercise_title}_part_{i+1}.png'
                output_path = os.path.join(self.cropped_dir, output_filename)

                try:
                    with Image.open(source_image_path) as img:
                        cropped = img.crop(coords)
                        cropped.save(output_path)
                        cropped_paths.append(output_path)
                        logger.info(f"Successfully cropped and saved: {output_filename}")
                except Exception as e:
                    logger.error(f"Error processing image {source_image_path}: {str(e)}")
                    continue

        return cropped_paths

def process_exercises(pdf_filename: str, xml_string: str) -> List[str]:
    """Main function to process exercises and crop images."""
    processor = ExerciseImageProcessor(pdf_filename)
    
    try:
        # Parse XML and extract exercise data
        exercise_data = processor.parse_exercise_xml_with_bounding_boxes(xml_string)
        
        if not exercise_data['exercises']:
            logger.warning("No exercises found in XML")
            return []
        
        # Crop and save images
        cropped_paths = processor.crop_exercise_images(exercise_data)
        
        return cropped_paths
    except Exception as e:
        logger.error(f"Error in process_exercises: {str(e)}")
        return []
