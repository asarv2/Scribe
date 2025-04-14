import google.generativeai as genai
import xml.etree.ElementTree as ET
import re
import logging
import json
import os
from typing import Dict, Any, List
from tqdm import tqdm
import fitz
from PIL import Image
import io

logger = logging.getLogger(__name__)

class ExerciseExtractor:
    def __init__(self, api_key: str, pdf_path: str, extra_top_padding: int = 0):
        """Initialize the exercise extractor with Gemini API key."""
        self.pdf_path = pdf_path
        self.pdf_filename = os.path.basename(pdf_path).split('.')[0]
        # Create main exercises folder with textbook name
        self.exercises_folder = os.path.join(os.path.dirname(pdf_path), f'exercises_{self.pdf_filename}')
        # Place exercises.json at the root of the exercises folder
        self.output_path = os.path.join(self.exercises_folder, 'exercises.json')
        
        # Create exercises folder
        os.makedirs(self.exercises_folder, exist_ok=True)
        
        # Initialize Gemini
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-001')
        self.extra_top_padding = extra_top_padding
    def extract_exercises_from_text(self, chapter_title: str, text: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract exercises from text using Gemini."""
        prompt = """
        You are an expert at extracting individual exercises from a textbook. The title of the chapter is "{chapter_title}".

        Please analyze the following text and extract the individual exercises in this exact format:
        1. Enclose your response in <CHAPTER> </CHAPTER> tags.
        2. Use <EXERCISE> and </EXERCISE> tags to start and end the exercises.
        3. Use <TITLE>x</TITLE> tags to enclose the title of each exercise, where x is the title.
        4. Use <PAGE>y</PAGE> or <PAGE>y-z</PAGE> tags to enclose the starting page number of each exercise, where y is the page number where the exercise starts and z is the page number where the exercise ends.

        The input text contains multiple pages marked with <PAGE x> and </PAGE x> tags. Use these markers to determine the correct page numbers for each exercise. If an exercise spans multiple pages, use the page range format (e.g., <PAGE>2-3</PAGE>).

        Here is an example of how exercises could look like:

        <CHAPTER>
        <EXERCISE>
            <TITLE>1.1</TITLE>
            <PAGE>30</PAGE>
        </EXERCISE>
        <EXERCISE>
            <TITLE>1.2</TITLE>
            <PAGE>31-32</PAGE>
        </EXERCISE>
        </CHAPTER>

        Now, it is your turn to analyze the following text and extract the exercises in the exact format specified above. Only output the exercises for the given chapter, nothing else. Do not use any other tags than the ones specified above. 

        If you see any leading exercises, ignore them, as they are probably a part of the subchapter exercises, not the chapter exercises. Look for a title like "Exercises" (the most main title) to start the exercises, do not include things like Projects or Explorations. Remember that each <EXERCISE> tag should only contain one exercise.

        INPUT: 
        {text}

        OUTPUT:

        """
        print(prompt.format(chapter_title=chapter_title, text=text))
        
        try:
            response = self.model.generate_content(prompt.format(chapter_title=chapter_title, text=text))
            print(response.text.strip())
            return self._parse_exercise_xml(response.text.strip())
        except Exception as e:
            logger.error(f"Error extracting exercises: {str(e)}")
            return {"exercises": []}

    def _parse_exercise_xml(self, xml_string: str) -> Dict[str, List[Dict[str, Any]]]:
        """Parse the XML exercise response into a structured format."""
        try:
            # Check if xml_string is empty or invalid
            if not xml_string or not xml_string.strip():
                return {"exercises": []}

            # Clean up incomplete XML by finding complete exercises
            exercise_pattern = r'<EXERCISE>.*?</EXERCISE>'
            complete_exercises = re.findall(exercise_pattern, xml_string, re.DOTALL)
            
            # Create a new valid XML string with only complete exercises
            cleaned_xml = f"<CHAPTER>{''.join(complete_exercises)}</CHAPTER>"
            
            root = ET.fromstring(cleaned_xml)
            
            exercise_structure = {
                "exercises": []
            }

            for exercise in root.findall('EXERCISE'):
                try:
                    title_elem = exercise.find('TITLE')
                    page_elem = exercise.find('PAGE')

                    if title_elem is None or page_elem is None:
                        continue

                    # Additional validation for element text
                    if not all(elem.text and elem.text.strip() for elem in [title_elem, page_elem]):
                        continue

                    # Handle page ranges (e.g., "32-33")
                    page_text = page_elem.text.strip()
                    if '-' in page_text:
                        start_page, end_page = map(int, page_text.split('-'))
                        exercise_info = {
                            "title": title_elem.text.strip(),
                            "start_page": start_page,
                            "end_page": end_page
                        }
                    else:
                        exercise_info = {
                            "title": title_elem.text.strip(),
                            "start_page": int(page_text),
                            "end_page": int(page_text)
                        }
                    exercise_structure["exercises"].append(exercise_info)
                except (AttributeError, ValueError) as e:
                    continue
            print(exercise_structure)
            return exercise_structure
            
        except ET.ParseError as e:
            logger.error(f"Invalid XML format: {str(e)}")
            return {"exercises": []}
        except Exception as e:
            logger.error(f"Error parsing exercise XML: {str(e)}")
            return {"exercises": []}

    def load_existing_exercises(self) -> List[Dict[str, Any]]:
        """Load existing exercises from file if it exists."""
        try:
            if os.path.exists(self.output_path):
                with open(self.output_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading existing exercises: {str(e)}")
        return []

    def save_exercises(self, exercises: List[Dict[str, Any]]) -> None:
        """Save exercises to file."""
        try:
            with open(self.output_path, 'w') as f:
                json.dump(exercises, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving exercises: {str(e)}")

    def process_exercise_pages(self, pages: List['fitz.Page'], chapter_title: str, chapter_page: int) -> List[Dict[str, Any]]:
        """Process multiple pages containing exercises"""
        print(f"Starting to process {len(pages)} pages for chapter: {chapter_title}")
        # Create chapter folder
        chapter_folder = os.path.join(self.exercises_folder, self._sanitize_filename(chapter_title))
        os.makedirs(chapter_folder, exist_ok=True)
        
        # Combine text from all pages with page markers
        combined_text = ""
        for i, page in enumerate(pages):
            page_num = i + 1
            page_text = page.get_text()
            combined_text += f"\n<PAGE {page_num}>\n{page_text}\n</PAGE {page_num}>\n"
        
        # Extract exercise information using Gemini
        exercises = self.extract_exercises_from_text(chapter_title, combined_text)
        print(f"Gemini identified {len(exercises['exercises'])} exercises for chapter {chapter_title}")
        
        # Create a dictionary to store exercise parts
        exercise_parts = {}
        
        # Track which exercises were successfully found
        found_exercises = set()
        
        # First pass: collect all parts of each exercise
        for page_idx, page in enumerate(pages):
            page_num = page_idx + 1
            
            # # Print page text for debugging
            # self.print_page_text(page, page_num)
            
            # Get all exercise titles and their positions for current page
            exercise_positions = []
            for exercise in exercises["exercises"]:
                # Only process exercises that should appear on this page
                if exercise["start_page"] <= page_num <= exercise["end_page"]:
                    logger.debug(f"Looking for exercise {exercise['title']} on page {page_num}")
                    # Try different search patterns
                    triangle_title = f"△{exercise['title']}"
                    text_instances = page.search_for(triangle_title)
                    if not text_instances:
                        # Try without triangle
                        text_instances = page.search_for(exercise["title"])
                    if not text_instances:
                        # Try just the number
                        exercise_number = exercise["title"].split('.')[-1]
                        text_instances = page.search_for(f"{exercise_number}")
                        logger.debug(f"Searching for '{exercise_number}' instead of '{exercise['title']}'")
                    if text_instances:
                        logger.debug(f"Found {len(text_instances)} instances of {exercise['title']} on page {page_num}")
                        # Get all instances and filter for valid exercise starts
                        valid_positions = []
                        for inst in text_instances:
                            # Get the text block containing this instance
                            surrounding_text = page.get_text("dict", clip=(
                                max(0, inst.x0 - 100),  # Look a bit before
                                max(0, inst.y0 - 20),   # Look a bit above
                                inst.x1 + 100,          # Look a bit after
                                inst.y1 + 20            # Look a bit below
                            ))
                            
                            # Print surrounding text for debugging
                            logger.debug(f"Surrounding text for {exercise['title']}: {surrounding_text}")
                            
                            # Check if this is a valid exercise start:
                            # 1. Should be at start of line or after newline
                            # 2. Should not be in a reference or hyperlink
                            # 3. Should be followed by exercise text
                            is_valid = False  # Initialize as False
                            for block in surrounding_text["blocks"]:
                                for line in block["lines"]:
                                    for span in line["spans"]:
                                        # Check if this span contains our number
                                        if (span["bbox"][0] <= inst.x0 <= span["bbox"][2] and 
                                            span["bbox"][1] <= inst.y0 <= span["bbox"][3]):
                                            # Check if it's at start of line
                                            logger.debug(f"Span text: '{span['text']}', color: {span['color']}")
                                            if (span["text"].strip().startswith(exercise["title"]) or 
                                                span["text"].strip().startswith(f"△{exercise['title']}") or
                                                span["text"].strip().endswith(exercise["title"])) and span['color'] != 255:
                                                valid_positions.append(inst.y0)
                                                is_valid = True
                                                logger.debug(f"Valid position found for {exercise['title']} at y={inst.y0}")
                                            else:
                                                logger.debug(f"Invalid position for {exercise['title']}: text='{span['text']}', color={span['color']}")
                            
                            if not is_valid:
                                logger.debug(f"No valid position found for instance of {exercise['title']} at ({inst.x0}, {inst.y0})")
                        
                        if valid_positions:
                            # Use the first valid position (after sorting)
                            y1 = min(valid_positions)
                            logger.debug(f"Selected y1={y1} for {exercise['title']} on page {page_num}")
                        elif page_num > exercise["start_page"]:
                            # This is a continuation page, start from top
                            y1 = 0
                            logger.debug(f"Using y1=0 for continuation of {exercise['title']} on page {page_num}")
                        else:
                            # Skip if we can't find a valid position
                            logger.debug(f"Skipping {exercise['title']} on page {page_num}: no valid positions found")
                            continue
                    elif page_num > exercise["start_page"]:
                        # This is a continuation page, start from top
                        y1 = 0
                        logger.debug(f"Using y1=0 for continuation of {exercise['title']} on page {page_num} (no instances found)")
                    else:
                        # Skip if we can't find the title on the first page
                        logger.debug(f"Skipping {exercise['title']} on page {page_num}: title not found on page")
                        continue
                    
                    exercise_positions.append({
                        "title": exercise["title"],
                        "y1": y1,
                        "start_page": exercise["start_page"],
                        "end_page": exercise["end_page"]
                    })
            
            # Process each exercise on the current page
            for i, exercise in enumerate(exercise_positions):
                y1 = exercise["y1"]
                
                # For y2, use next exercise's y1 or find next section
                if i < len(exercise_positions) - 1:
                    y2 = exercise_positions[i + 1]["y1"]
                else:
                    if page_num < exercise["end_page"]:
                        y2 = page.rect.height
                    else:
                        # Get text blocks with their formatting
                        blocks = page.get_text("dict").get("blocks", [])
                        y2 = page.rect.height  # Default to page height
                        
                        # Look for the next bold text after our exercise
                        try:
                            for block in blocks:
                                if not isinstance(block, dict):
                                    continue
                                for line in block.get("lines", []):
                                    for span in line.get("spans", []):
                                        if not isinstance(span, dict) or "bbox" not in span:
                                            continue
                                        # Check if span is after our exercise and is bold
                                        if (span["bbox"][1] > y1 and 
                                            isinstance(span.get("font", ""), str) and 
                                            span.get("font", "").lower().find("bold") != -1):
                                            # Found bold text, use its y position as boundary
                                            potential_y2 = span["bbox"][1]
                                            if potential_y2 > y1:  # Ensure it's after our exercise
                                                y2 = min(y2, potential_y2)  # Take the earliest bold section
                        except Exception as e:
                            logger.warning(f"Error finding bold text boundary: {str(e)}")
                        
                        # If no bold section found, use the last text block
                        if y2 == page.rect.height and blocks:
                            try:
                                valid_blocks = [b for b in blocks if isinstance(b, dict) and "bbox" in b]
                                if valid_blocks:
                                    last_block = max(valid_blocks, key=lambda b: b["bbox"][3])
                                    y2 = last_block["bbox"][3]
                            except Exception as e:
                                logger.warning(f"Error finding last text block: {str(e)}")
                
                # Skip if y2 <= y1 (invalid region)
                if y2 <= y1:
                    continue
                
                logger.debug(f"Exercise {exercise['title']} on page {page_num}: y1={y1}, y2={y2}")
                
                # Extract text from the exercise region
                exercise_text = page.get_text("text", clip=(0, y1, page.rect.width, y2))
                
                # Crop and save full exercise region
                exercise_image = self._crop_exercise_region(page, y1, y2)
                
                # Store both image and text along with page number
                exercise_key = f"{chapter_title}_{exercise['title']}"
                if exercise_key not in exercise_parts:
                    exercise_parts[exercise_key] = []
                exercise_parts[exercise_key].append({
                    "image": exercise_image,
                    "text": exercise_text,
                    "page_num": page_num,
                    "start_page": exercise["start_page"],
                    "end_page": exercise["end_page"]
                })
                
                # Mark this exercise as found
                found_exercises.add(exercise_key)
        
        # Second pass: handle exercises that weren't found by using whole pages
        for exercise in exercises["exercises"]:
            exercise_key = f"{chapter_title}_{exercise['title']}"
            
            # Skip if we already found this exercise
            if exercise_key in found_exercises:
                continue
            
            logger.info(f"Falling back to whole page for exercise {exercise['title']} (pages {exercise['start_page']}-{exercise['end_page']})")
            
            # For each page this exercise should be on
            for page_num in range(exercise["start_page"], exercise["end_page"] + 1):
                # Adjust for 0-based indexing
                page_idx = page_num - 1
                
                # Skip if page is out of range
                if page_idx < 0 or page_idx >= len(pages):
                    logger.warning(f"Page {page_num} is out of range for exercise {exercise['title']}")
                    
                    # Try to map the page number using the chapter's starting page
                    if 'chapter_page' in locals() or 'chapter_page' in globals():
                        # Calculate the offset from the chapter's starting page
                        relative_page_idx = page_num - chapter_page
                        
                        # Check if this relative page index is valid
                        if 0 <= relative_page_idx < len(pages):
                            logger.info(f"Mapped page {page_num} to relative page index {relative_page_idx} using chapter start page {chapter_page}")
                            page_idx = relative_page_idx

                            # Map the start and end page relative to chapter_page
                            mapped_start_page = exercise["start_page"] - chapter_page + 1
                            mapped_end_page = exercise["end_page"] - chapter_page + 1
                            
                            # Ensure mapped pages are within valid range
                            mapped_start_page = max(0, mapped_start_page)
                            mapped_end_page = min(len(pages) - 1, mapped_end_page)
                            
                            # Update the exercise with mapped page numbers
                            exercise["start_page"] = mapped_start_page
                            exercise["end_page"] = mapped_end_page
                        else:
                            logger.warning(f"Relative page index {relative_page_idx} is still out of range")
                            continue
                    else:
                        # If we don't have chapter_actual_page, we can't map
                        logger.warning("No chapter_actual_page available for mapping")
                        continue
                
                # Double-check that page_idx is valid before accessing
                if page_idx < 0 or page_idx >= len(pages):
                    logger.warning(f"Final page_idx {page_idx} is still out of range")
                    continue
                    
                page = pages[page_idx]
                
                # Get the whole page text
                exercise_text = page.get_text("text")
                
                # Get the whole page as an image
                exercise_image = self._crop_exercise_region(page, 0, page.rect.height)
                
                # Store both image and text
                if exercise_key not in exercise_parts:
                    exercise_parts[exercise_key] = []
                
                exercise_parts[exercise_key].append({
                    "image": exercise_image,
                    "text": exercise_text,
                    "page_num": page_num,
                    "start_page": exercise["start_page"],
                    "end_page": exercise["end_page"]
                })
        
        # Third pass: combine images and texts, create final exercise entries
        all_exercises = []
        
        # Make sure we process ALL exercises identified by Gemini
        for exercise in exercises["exercises"]:
            exercise_key = f"{chapter_title}_{exercise['title']}"
            
            # If we have parts for this exercise, process them
            if exercise_key in exercise_parts and exercise_parts[exercise_key]:
                # Sort parts by page number
                parts = exercise_parts[exercise_key]
                parts.sort(key=lambda x: x["page_num"])
                
                # Get exercise details from first part
                first_part = parts[0]
                
                # Combine images if exercise spans multiple pages
                if len(parts) > 1:
                    combined_image = self._combine_exercise_images([p["image"] for p in parts])
                else:
                    combined_image = parts[0]["image"]
                
                # Combine text content
                combined_text = "\n".join(p["text"].strip() for p in parts)
                
                # Save image to chapter folder
                image_filename = f'exercise_{exercise["title"]}.png'
                image_path = os.path.join(chapter_folder, image_filename)
                with open(image_path, 'wb') as f:
                    if isinstance(combined_image, bytes):
                        f.write(combined_image)
                    else:
                        combined_image.save(f, format='PNG')
                
                # Create relative path for JSON
                relative_image_path = os.path.relpath(image_path, self.exercises_folder)
                
                all_exercises.append({
                    "chapter_title": chapter_title,
                    "number": exercise["title"],
                    "start_page": first_part["start_page"],
                    "end_page": first_part["end_page"],
                    "pages": [p["page_num"] for p in parts],
                    "image_path": relative_image_path,
                    "additional_image_paths": [],
                    "text_content": combined_text
                })
            else:
                # If we couldn't find any parts for this exercise, use the pages identified by Gemini
                logger.warning(f"No parts found for exercise {exercise['title']} - using full pages identified by Gemini")
                
                # Get the pages this exercise should be on
                exercise_pages = []
                for page_num in range(exercise["start_page"], exercise["end_page"] + 1):
                    # Adjust for 0-based indexing
                    page_idx = page_num - 1
                    
                    # Skip if page is out of range
                    if page_idx < 0 or page_idx >= len(pages):
                        logger.warning(f"Page {page_num} is out of range for exercise {exercise['title']}")
                        continue
                        
                    page = pages[page_idx]
                    
                    # Get the whole page text
                    exercise_text = page.get_text("text")
                    
                    # Get the whole page as an image
                    exercise_image = self._crop_exercise_region(page, 0, page.rect.height)
                    
                    exercise_pages.append({
                        "image": exercise_image,
                        "text": exercise_text,
                        "page_num": page_num
                    })
                
                if exercise_pages:
                    # Combine images if exercise spans multiple pages
                    if len(exercise_pages) > 1:
                        combined_image = self._combine_exercise_images([p["image"] for p in exercise_pages])
                    else:
                        combined_image = exercise_pages[0]["image"]
                    
                    # Combine text content
                    combined_text = "\n".join(p["text"].strip() for p in exercise_pages)
                    
                    # Save image to chapter folder
                    image_filename = f'exercise_{exercise["title"]}.png'
                    image_path = os.path.join(chapter_folder, image_filename)
                    with open(image_path, 'wb') as f:
                        if isinstance(combined_image, bytes):
                            f.write(combined_image)
                        else:
                            combined_image.save(f, format='PNG')
                    
                    # Create relative path for JSON
                    relative_image_path = os.path.relpath(image_path, self.exercises_folder)
                    
                    all_exercises.append({
                        "chapter_title": chapter_title,
                        "number": exercise["title"],
                        "start_page": exercise["start_page"],
                        "end_page": exercise["end_page"],
                        "pages": [p["page_num"] for p in exercise_pages],
                        "image_path": relative_image_path,
                        "additional_image_paths": [],
                        "text_content": combined_text
                    })
                else:
                    # If we couldn't find any pages for this exercise, create a placeholder
                    logger.warning(f"No pages found for exercise {exercise['title']} - creating placeholder")
                    
                    # Create a placeholder image (white 1x1 pixel)
                    placeholder_image = Image.new('RGB', (1, 1), color='white')
                    img_byte_arr = io.BytesIO()
                    placeholder_image.save(img_byte_arr, format='PNG')
                    
                    # Save placeholder image
                    image_filename = f'exercise_{exercise["title"]}.png'
                    image_path = os.path.join(chapter_folder, image_filename)
                    with open(image_path, 'wb') as f:
                        f.write(img_byte_arr.getvalue())
                    
                    # Create relative path for JSON
                    relative_image_path = os.path.relpath(image_path, self.exercises_folder)
                    
                    all_exercises.append({
                        "chapter_title": chapter_title,
                        "number": exercise["title"],
                        "start_page": exercise["start_page"],
                        "end_page": exercise["end_page"],
                        "pages": [exercise["start_page"]],  # Just use start page as placeholder
                        "image_path": relative_image_path,
                        "additional_image_paths": [],
                        "text_content": f"Exercise {exercise['title']} (content not found)"
                    })
        
        print(f"Finished processing chapter {chapter_title}, found {len(all_exercises)} exercises")
        return all_exercises

    def _find_images_in_region(self, page: 'fitz.Page', y1: float, y2: float) -> List[bytes]:
        """Find images that overlap with the specified vertical region"""
        try:
            images = []
            # First try the standard image extraction
            for img in page.get_images(full=True):  # Add full=True to get more image info
                try:
                    xref = img[0]
                    # Try to get image info first
                    image_info = page.parent.xref_get_image(xref)
                    if not image_info:
                        continue
                        
                    bbox = page.get_image_bbox(xref)
                    if bbox and (y1 <= bbox.y1 <= y2 or y1 <= bbox.y0 <= y2):
                        base_image = page.parent.extract_image(xref)
                        if base_image and base_image["image"]:
                            images.append(base_image["image"])
                except Exception as e:
                    logger.debug(f"Standard image extraction failed: {str(e)}, trying alternative method")
                    try:
                        # Alternative: render the region as an image
                        clip_rect = fitz.Rect(0, y1, page.rect.width, y2)
                        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip_rect)
                        img_bytes = pix.tobytes("png")
                        if img_bytes:
                            images.append(img_bytes)
                    except Exception as e2:
                        logger.warning(f"Alternative image extraction also failed: {str(e2)}")
                    continue
                
            return images
        except Exception as e:
            logger.error(f"Error finding images in region: {str(e)}")
            return []

    def _crop_exercise_region(self, page: 'fitz.Page', y1: float, y2: float) -> bytes:
        """Crop the page to the exercise region and return as image"""
        try:
            # Apply extra top padding if specified
            y1 = max(0, y1 - self.extra_top_padding)
            
            # Ensure y1 and y2 are within page bounds
            y1 = max(0, min(y1, page.rect.height))
            y2 = max(0, min(y2, page.rect.height))
            
            # Create rectangle for full width, exercise height
            rect = fitz.Rect(0, y1, page.rect.width, y2)
            
            # Get the pixmap for this region with higher resolution
            matrix = fitz.Matrix(2, 2)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=matrix, clip=rect)
            
            # Convert to PIL Image and then to bytes
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG', optimize=True)
            
            return img_byte_arr.getvalue()
        except Exception as e:
            logger.error(f"Error during image cropping: {str(e)}")
            # Return a minimal valid PNG if there's an error
            img = Image.new('RGB', (1, 1), color='white')
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            return img_byte_arr.getvalue()

    def _combine_exercise_images(self, image_bytes_list: List[bytes]) -> Image.Image:
        """Combine multiple exercise images vertically into a single image."""
        # Convert bytes to PIL Images
        images = []
        for img_bytes in image_bytes_list:
            if isinstance(img_bytes, bytes):
                img = Image.open(io.BytesIO(img_bytes))
            else:
                img = img_bytes
            images.append(img)
        
        # Calculate dimensions for combined image
        max_width = max(img.width for img in images)
        total_height = sum(img.height for img in images)
        
        # Create new image with white background
        combined_image = Image.new('RGB', (max_width, total_height), 'white')
        
        # Paste images one after another
        y_offset = 0
        for img in images:
            # Center image horizontally if smaller than max width
            x_offset = (max_width - img.width) // 2
            combined_image.paste(img, (x_offset, y_offset))
            y_offset += img.height
        
        # Convert to bytes
        img_byte_arr = io.BytesIO()
        combined_image.save(img_byte_arr, format='PNG')
        return combined_image

    def _sanitize_filename(self, filename: str) -> str:
        """Convert a string into a valid filename."""
        # Replace invalid characters with underscores
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        # Remove leading/trailing spaces and periods
        filename = filename.strip('. ')
        return filename

    def print_page_text(self, page, page_num):
        """Print the raw text of a page for debugging"""
        text = page.get_text("text")
        logger.debug(f"===== PAGE {page_num} TEXT =====")
        logger.debug(text)
        logger.debug("===== END PAGE TEXT =====")
        
        # Also print text blocks with their formatting
        blocks = page.get_text("dict").get("blocks", [])
        logger.debug(f"===== PAGE {page_num} BLOCKS =====")
        for i, block in enumerate(blocks):
            if isinstance(block, dict) and "lines" in block:
                for j, line in enumerate(block["lines"]):
                    if isinstance(line, dict) and "spans" in line:
                        for k, span in enumerate(line["spans"]):
                            if isinstance(span, dict):
                                logger.debug(f"Block {i}, Line {j}, Span {k}: '{span.get('text', '')}', "
                                            f"font: {span.get('font', 'unknown')}, "
                                            f"color: {span.get('color', 'unknown')}, "
                                            f"bbox: {span.get('bbox', 'unknown')}")
        logger.debug("===== END PAGE BLOCKS =====")