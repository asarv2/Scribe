from typing import Dict, List, Any, Tuple
from supabase import Client
import fitz
import re
import xml.etree.ElementTree as ET
import json
import os
import io
import google.generativeai as genai
import logging
from PIL import Image
import copy

logger = logging.getLogger(__name__)


class ProblemsExtractor:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def extract_exercises_from_text(self, text: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract exercises from text using Gemini."""
        prompt = """
        You are an expert at extracting problems from a homework assignment.

        Please analyze the following text and extract the individual problems in this exact format:
        1. Enclose your response in <HOMEWORK> </HOMEWORK> tags.

        2. Use <TITLE>a</TITLE> tags to enclose the title of the homework, where a is the title of the homework.

        3. Use a <DUE>b</DUE> tag to enclose the due date of the homework, where b is the due date in the format month-day-year. An example is <DUE>02-25-2025</DUE>.

        4. Use <PROBLEM> and </PROBLEM> tags to start and end each of the problems. Enclose the problem information in these tags.

            5. Use <PROBLEM_NAME>c</PROBLEM_NAME> tags to enclose the title of the problem, where c is the title of the problem. An example is <PROBLEM_NAME>Problem 1</PROBLEM_NAME>.
            
            6. For each part in the given problem, use <PART> and </PART> tags. Enclose the part information in these tags. If no parts are given, just use a singular <PART> </PART> tag. An example is <PART> </PART>.

            7. Within each <PART> tag, use the following tags to enclose the information for the textbooks used, pages needed, exercises required, or other additional information:

                8. Use <PART_NAME>d</PART_NAME> tags to enclose the subtitle of the problem, where d is the subtitle of the problem. An example is <PART_NAME>(a)</PART_NAME>. If there is only one part or you are just citing a page number that does not have a subtitle question, omit the <PART_NAME> tag.

                9. Use <TEXTBOOK> and </TEXTBOOK> tags to enclose the information for the textbooks used. The name and textbook numbers for the course will be given to you so you know which textbook number to use.

                    10. Use <TEXTBOOK_NUMBER>e</TEXTBOOK_NUMBER> tags to enclose the textbook number, where e is the textbook number.

                    11. Use <EXERCISE>f</EXERCISE> tags to enclose the information for the exercises needed, where f is the name of the exercise. Avoid using the word "Exercise" or "Exercise f" in the <EXERCISE> tag.
                    
                    12. Use <PAGE>g</PAGE> or <PAGE>g-h</PAGE> tags to enclose the starting page number of each problem, where g is the page number where the problem starts and h is the page number where the problem ends. If the problem spans multiple pages, use the page range format (e.g., <PAGE>2-3</PAGE>).
                
                13. Use <GIVEN></GIVEN> tags to enclose the information for the given information in the problem. This is distinct from additional information, and should only be used for the information that is part of the problem statement.

            14. Use <INFO></INFO> tags to enclose the additional information/instructions in the problem. This is distinct from the given information, and should only be used for the information that is not part of the problem statement.

        Here is an example of what a response could look like:

        Given: 

        Textbook Name: Linear Programming, Foundations and Extensions, 5th edition, Robert J. Vanderbei, Springer. [V]
        Textbook Number: 1

        Textbook Name: Understanding and Using Linear Programming, Jiri Matousek and Bernd Gartner, Springer. [MG]
        Textbook Number: 2

        Textbook Name: Linear Programming, Vasek Chvatal. [C]
        Textbook Number: 3


        Output: 

        <HOMEWORK>
            <TITLE>Homework 10</TITLE>
            <DUE>02-25-2025</DUE>
            <PROBLEM>
                <PROBLEM_NAME>Problem 1</PROBLEM_NAME>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <PAGE>10</PAGE>
                        <EXERCISE>1.2</EXERCISE>
                    </TEXTBOOK>
                </PART>
            </PROBLEM>
            <PROBLEM>
                <PROBLEM_NAME>Problem 2</PROBLEM_NAME>
                <PART>
                    <PART_NAME>(a)</PART_NAME>
                    <GIVEN>Find the maximum value of z = 2x + 3y subject to the following constraints:</GIVEN>
                </PART>
                <PART>
                    <PART_NAME>(b)</PART_NAME>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>2.1</EXERCISE>
                    </TEXTBOOK>
                </PART>
                <PART>
                    <PART_NAME>(c)</PART_NAME>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>2.2</EXERCISE>
                    </TEXTBOOK>
                </PART>
                <PART>
                    <PART_NAME>(d)</PART_NAME>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>2.5</EXERCISE>
                    </TEXTBOOK>
                </PART>
                <INFO>
                    Use simplex method to solve 2.1, 2.2, 2.5, following the procedure in p.11-14. For 2.2 and 2.5, you also need to draw in R^2 the feasible set and also the sequence of vertices you go through during the simplex method. For your graphs, use one page for each problem. See p.21 for an example of such a graph. For 2.10, you can use whatever method. If you can "visualize" the geometry of the problem, even in R^4, then the solution is extremely simple.
                </INFO>
            </PROBLEM>
            <PROBLEM>
                <PROBLEM_NAME>Problem 3</PROBLEM_NAME>
                <PART>
                    <TEXTBOOK>
                        <TEXTBOOK_NUMBER>1</TEXTBOOK_NUMBER>
                        <EXERCISE>3.1</EXERCISE>
                    </TEXTBOOK>
                </PART>
            </PROBLEM>
        </HOMEWORK>

        Now, it is your turn to analyze the following text and extract the homework info and problems in the exact format specified above. Only output the homework info and problems, nothing else. Do not use any other tags than the ones specified above. 

        INPUT: 
        {text}

        OUTPUT:

        """
        
        try:
            # Initialize Gemini
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel('gemini-2.0-flash-001')
            
            # Format the prompt with textbook info and input text
            formatted_prompt = prompt.format(text=text)
            response = model.generate_content(formatted_prompt)
            print(response.text.strip())
            
            return self._parse_homework_xml(response.text.strip())
        except Exception as e:
            logger.error(f"Error extracting exercises: {str(e)}")
            return {"problems": []}

    def extract_problem_images(self, homework_data: Dict[str, Any], pdf_document: fitz.Document, 
                              file_path: str) -> Dict[str, Any]:
        """
        Extract images for each problem part from the PDF document.
        
        Args:
            homework_data: The structured homework data
            pdf_document: The PDF document object
            file_path: Path to the PDF file
            
        Returns:
            Updated homework data with image paths
        """
        if not pdf_document:
            return homework_data
        
        try:
            # Create folder for homework images
            homework_name = os.path.splitext(os.path.basename(file_path))[0]
            images_folder = os.path.join(os.path.dirname(file_path), f'images_{homework_name}')
            os.makedirs(images_folder, exist_ok=True)
            
            # Process each problem in the homework data
            for problem_idx, problem in enumerate(homework_data.get("problems", [])):
                problem_name = problem.get("name", f"Problem_{problem_idx+1}")
                logger.info(f"Processing {problem_name}")
                
                # Search for problem in the document
                problem_images = []
                problem_text = []
                problem_pages = []
                
                # Try different search patterns for the problem
                search_patterns = [
                    problem_name,
                    problem_name.replace("Problem ", ""),
                    f"Problem {problem_name.split()[-1]}" if "Problem" not in problem_name else None
                ]
                search_patterns = [p for p in search_patterns if p]
                
                found_problem = False
                problem_start_page = None
                problem_start_y = None
                
                # First, find the problem location
                for page_idx in range(len(pdf_document)):
                    page = pdf_document[page_idx]
                    
                    # Try each search pattern
                    for pattern in search_patterns:
                        text_instances = page.search_for(pattern)
                        if text_instances:
                            found_problem = True
                            logger.debug(f"Found {pattern} on page {page_idx+1}")
                            
                            # Get the y-coordinate of the problem title
                            y1 = min(inst.y0 for inst in text_instances)
                            problem_start_page = page_idx
                            problem_start_y = y1
                            break
                    
                    if found_problem:
                        break
                
                # If problem was found, process the whole problem and its parts
                if found_problem:
                    # Extract whole problem image first (for fallback)
                    self._extract_whole_problem_image(problem, problem_start_page, pdf_document, 
                                                    images_folder, file_path, problem_idx, 
                                                    homework_data)
                    
                    # Now try to extract individual part images if parts exist
                    if problem.get("parts"):
                        self._extract_part_images(problem, problem_start_page, problem_start_y, 
                                                pdf_document, images_folder, file_path)
                else:
                    logger.warning(f"Could not find {problem_name} in the document")
            
            return homework_data
        
        except Exception as e:
            logger.error(f"Error extracting problem images: {str(e)}")
            return homework_data

    def _extract_whole_problem_image(self, problem: Dict[str, Any], start_page_idx: int, 
                                   pdf_document: fitz.Document, images_folder: str, 
                                   file_path: str, problem_idx: int, homework_data: Dict[str, Any]) -> None:
        """Extract image for the whole problem (as fallback)."""
        problem_name = problem.get("name", f"Problem_{problem_idx+1}")
        problem_images = []
        problem_text = []
        problem_pages = []
        
        # Instead of trying to find the problem on the page, just use the entire page(s)
        # First, check if we already have page information from previous processing
        if "pages" in problem and problem["pages"]:
            # Use the existing page information
            for page_num in problem["pages"]:
                # Convert from 1-indexed to 0-indexed
                page_idx = page_num - 1
                if 0 <= page_idx < len(pdf_document):
                    page = pdf_document[page_idx]
                    # Get the entire page as an image
                    problem_image = self._get_full_page_image(page)
                    problem_images.append(problem_image)
                    problem_text.append(page.get_text("text"))
                    problem_pages.append(page_num)
        else:
            # If no page information, fall back to the original method starting from start_page_idx
            page = pdf_document[start_page_idx]
            
            # Get the y-coordinate of the problem title
            search_patterns = [
                problem_name,
                problem_name.replace("Problem ", ""),
                f"Problem {problem_name.split()[-1]}" if "Problem" not in problem_name else None
            ]
            search_patterns = [p for p in search_patterns if p]
            
            found_problem = False
            for pattern in search_patterns:
                text_instances = page.search_for(pattern)
                if text_instances:
                    found_problem = True
                    # Just use the entire page
                    problem_image = self._get_full_page_image(page)
                    problem_images.append(problem_image)
                    problem_text.append(page.get_text("text"))
                    problem_pages.append(start_page_idx + 1)
                    break
            
            if not found_problem:
                # If we couldn't find the problem, still use the entire page as fallback
                problem_image = self._get_full_page_image(page)
                problem_images.append(problem_image)
                problem_text.append(page.get_text("text"))
                problem_pages.append(start_page_idx + 1)
                
                # Also check the next page as a heuristic
                if start_page_idx + 1 < len(pdf_document):
                    next_page = pdf_document[start_page_idx + 1]
                    problem_image = self._get_full_page_image(next_page)
                    problem_images.append(problem_image)
                    problem_text.append(next_page.get_text("text"))
                    problem_pages.append(start_page_idx + 2)
        
        # If we found the problem, save the images and update the homework data
        if problem_images:
            # Combine images if problem spans multiple pages
            if len(problem_images) > 1:
                combined_image = self._combine_problem_images(problem_images)
            else:
                combined_image = problem_images[0]
            
            # Save the combined image
            image_filename = f"{self._sanitize_filename(problem_name)}.png"
            image_path = os.path.join(images_folder, image_filename)
            
            with open(image_path, 'wb') as f:
                if isinstance(combined_image, bytes):
                    f.write(combined_image)
                else:
                    combined_image.save(f, format='PNG')
            
            # Create relative path for JSON
            relative_image_path = os.path.relpath(image_path, os.path.dirname(file_path))
            
            # Update the problem with image path and text
            problem["image_path"] = relative_image_path
            problem["pages"] = problem_pages
            problem["text_content"] = "\n".join(problem_text)

    def _get_full_page_image(self, page: 'fitz.Page') -> bytes:
        """Get the entire page as an image."""
        try:
            # Create a high-resolution image of the entire page
            matrix = fitz.Matrix(2, 2)  # 2x zoom for better quality
            pix = page.get_pixmap(matrix=matrix)
            
            # Convert to PIL Image and then to bytes
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG', optimize=True)
            
            return img_byte_arr.getvalue()
        except Exception as e:
            logger.error(f"Error getting full page image: {str(e)}")
            # Return a minimal valid PNG if there's an error
            img = Image.new('RGB', (1, 1), color='white')
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format='PNG')
            return img_byte_arr.getvalue()

    def _extract_part_images(self, problem: Dict[str, Any], start_page_idx: int, 
                            problem_start_y: float, pdf_document: fitz.Document, 
                            images_folder: str, file_path: str) -> None:
        """Extract images for individual parts of a problem."""
        problem_name = problem.get("name", "")
        
        # Process each part
        for part_idx, part in enumerate(problem.get("parts", [])):
            part_name = part.get("name")
            part_given = part.get("given", "")
            
            if not part_name and not part_given:
                continue
            
            part_images = []
            part_text = []
            part_pages = []
            found_part = False
            
            # Look for the part starting from the problem's page
            for page_idx in range(start_page_idx, len(pdf_document)):
                page = pdf_document[page_idx]
                
                # First try to find by part name
                if part_name:
                    text_instances = page.search_for(part_name)
                    if text_instances:
                        # Get the y-coordinate of the part
                        y1 = min(inst.y0 for inst in text_instances)
                        
                        # If this is the first page of the problem and the part is above the problem start,
                        # it might be a false positive (e.g., part name appears in problem statement)
                        if page_idx == start_page_idx and y1 < problem_start_y:
                            # Try another instance if available
                            valid_instances = [inst for inst in text_instances if inst.y0 >= problem_start_y]
                            if valid_instances:
                                y1 = min(inst.y0 for inst in valid_instances)
                                found_part = True
                                logger.debug(f"Found part {part_name} on page {page_idx+1} by name")
                            else:
                                continue
                        else:
                            found_part = True
                            logger.debug(f"Found part {part_name} on page {page_idx+1} by name")
                
                # If not found by name and we have given text, try to find by given text
                if not found_part and part_given:
                    # Try to find a unique identifying phrase from the given text
                    # Take first 30-50 characters or first sentence, whichever is shorter
                    search_text = part_given.strip().split('\n')[0]
                    if len(search_text) > 50:
                        search_text = search_text[:50]
                    
                    # Clean up the search text to improve matching
                    search_text = search_text.strip()
                    if len(search_text) > 10:  # Only search if we have enough text
                        text_instances = page.search_for(search_text[:30])
                        if text_instances:
                            found_part = True
                            y1 = min(inst.y0 for inst in text_instances)
                            logger.debug(f"Found part for {problem_name} on page {page_idx+1} by given text")
                
                if found_part:
                    # For y2, look for the next part or end of page
                    y2 = page.rect.height  # Default to end of page
                    
                    # Look for the next part on the same page
                    next_part_idx = part_idx + 1
                    if next_part_idx < len(problem.get("parts", [])):
                        # Make sure we have a valid next part before trying to access it
                        parts = problem.get("parts", [])
                        if next_part_idx < len(parts):
                            next_part = parts[next_part_idx]
                            next_part_name = next_part.get("name")
                            if next_part_name:
                                next_instances = page.search_for(next_part_name)
                                if next_instances:
                                    next_y1 = min(inst.y0 for inst in next_instances)
                                    if next_y1 > y1:  # Only if it's after our part
                                        y2 = min(y2, next_y1)
                        
                        # Also try to find next part by its given text
                        next_part_given = next_part.get("given", "")
                        if next_part_given:
                            search_text = next_part_given.strip().split('\n')[0]
                            if len(search_text) > 50:
                                search_text = search_text[:50]
                            
                            search_text = search_text.strip()
                            if len(search_text) > 10:
                                next_instances = page.search_for(search_text[:30])
                                if next_instances:
                                    next_y1 = min(inst.y0 for inst in next_instances)
                                    if next_y1 > y1:  # Only if it's after our part
                                        y2 = min(y2, next_y1)
                
                    # Also check for next problem
                    try:
                        problem_name_parts = problem.get("name", "").split()
                        if problem_name_parts:
                            next_problem_idx = problem_name_parts[-1]
                            next_problem_idx = int(next_problem_idx) + 1
                            next_problem_pattern = f"Problem {next_problem_idx}"
                            next_instances = page.search_for(next_problem_pattern)
                            if next_instances:
                                next_y1 = min(inst.y0 for inst in next_instances)
                                if next_y1 > y1:  # Only if it's after our part
                                    y2 = min(y2, next_y1)
                    except (ValueError, IndexError):
                        pass
                    
                    # Extract text and image for this part
                    part_text.append(page.get_text("text", clip=(0, y1, page.rect.width, y2)))
                    part_image = self._crop_problem_region(page, y1, y2, padding=((20 if not part_name else 40) if part_idx == 0 else 5))
                    part_images.append(part_image)
                    part_pages.append(page_idx + 1)
                    break  # Found the part on this page, move to the next part
            
            # If we found the part, save the image and update the part data
            if part_images:
                # Combine images if part spans multiple pages
                if len(part_images) > 1:
                    combined_image = self._combine_problem_images(part_images)
                else:
                    combined_image = part_images[0]
                
                # Save the combined image
                part_identifier = part_name if part_name else f"part_{part_idx+1}"
                part_filename = f"{self._sanitize_filename(problem_name)}_{self._sanitize_filename(part_identifier)}.png"
                part_image_path = os.path.join(images_folder, part_filename)
                
                with open(part_image_path, 'wb') as f:
                    if isinstance(combined_image, bytes):
                        f.write(combined_image)
                    else:
                        combined_image.save(f, format='PNG')
                
                # Create relative path for JSON
                relative_image_path = os.path.relpath(part_image_path, os.path.dirname(file_path))
                
                # Update the part with image path and text
                part["image_path"] = relative_image_path
                part["pages"] = part_pages
                part["text_content"] = "\n".join(part_text)
            else:
                # Fallback to the original method if we couldn't find the part
                self._fallback_part_extraction(problem, part, part_idx, start_page_idx, pdf_document, 
                                              images_folder, file_path)

    def _fallback_part_extraction(self, problem: Dict[str, Any], part: Dict[str, Any], part_idx: int,
                                 start_page_idx: int, pdf_document: fitz.Document, 
                                 images_folder: str, file_path: str) -> None:
        """Fallback method to extract part images using full pages."""
        problem_name = problem.get("name", "")
        part_name = part.get("name", "")
        
        logger.info(f"Using fallback extraction for part {part_name} of {problem_name}")
        
        # Check if the problem has page information
        if "pages" in problem and problem["pages"]:
            part_images = []
            part_text = []
            part_pages = []
            
            # Use all the pages from the problem
            for page_num in problem["pages"]:
                # Convert from 1-indexed to 0-indexed
                page_idx = page_num - 1
                if 0 <= page_idx < len(pdf_document):
                    page = pdf_document[page_idx]
                    
                    # Get the entire page as an image
                    part_image = self._get_full_page_image(page)
                    part_images.append(part_image)
                    part_text.append(page.get_text("text"))
                    part_pages.append(page_num)
            
            # If we found pages, save the image and update the part data
            if part_images:
                # Combine images if part spans multiple pages
                if len(part_images) > 1:
                    combined_image = self._combine_problem_images(part_images)
                else:
                    combined_image = part_images[0]
                
                # Save the combined image
                part_identifier = part_name if part_name else f"part_{part_idx+1}"
                part_filename = f"{self._sanitize_filename(problem_name)}_{self._sanitize_filename(part_identifier)}.png"
                part_image_path = os.path.join(images_folder, part_filename)
                
                with open(part_image_path, 'wb') as f:
                    if isinstance(combined_image, bytes):
                        f.write(combined_image)
                    else:
                        combined_image.save(f, format='PNG')
                
                # Create relative path for JSON
                relative_image_path = os.path.relpath(part_image_path, os.path.dirname(file_path))
                
                # Update the part with image path and text
                part["image_path"] = relative_image_path
                part["pages"] = part_pages
                part["text_content"] = "\n".join(part_text)
                return
        
        # If no page information in the problem, try the original approach
        # but use full pages instead of cropped regions
        part_images = []
        part_text = []
        part_pages = []
        
        # Try to find the part in the document
        for page_idx in range(len(pdf_document)):
            page = pdf_document[page_idx]
            
            # Try different variations of the part name
            if part_name:
                search_variations = [
                    part_name,
                    f"({part_name.strip('()')})",  # Try with/without parentheses
                    part_name.strip('()'),
                    f"{problem_name} {part_name}",
                    f"{part_name}."  # Sometimes parts end with a period
                ]
                
                for variation in search_variations:
                    text_instances = page.search_for(variation)
                    if text_instances:
                        logger.debug(f"Found part {part_name} on page {page_idx+1}")
                        
                        # Use the entire page
                        part_image = self._get_full_page_image(page)
                        part_images.append(part_image)
                        part_text.append(page.get_text("text"))
                        part_pages.append(page_idx + 1)
                        break
            
            if part_images:
                break  # Found the part, no need to check other pages
        
        # If we still couldn't find the part, use the problem's start page
        if not part_images and start_page_idx < len(pdf_document):
            page = pdf_document[start_page_idx]
            part_image = self._get_full_page_image(page)
            part_images.append(part_image)
            part_text.append(page.get_text("text"))
            part_pages.append(start_page_idx + 1)
        
        # Save the image and update the part data
        if part_images:
            # Combine images if part spans multiple pages
            if len(part_images) > 1:
                combined_image = self._combine_problem_images(part_images)
            else:
                combined_image = part_images[0]
            
            # Save the combined image
            part_identifier = part_name if part_name else f"part_{part_idx+1}"
            part_filename = f"{self._sanitize_filename(problem_name)}_{self._sanitize_filename(part_identifier)}.png"
            part_image_path = os.path.join(images_folder, part_filename)
            
            with open(part_image_path, 'wb') as f:
                if isinstance(combined_image, bytes):
                    f.write(combined_image)
                else:
                    combined_image.save(f, format='PNG')
            
            # Create relative path for JSON
            relative_image_path = os.path.relpath(part_image_path, os.path.dirname(file_path))
            
            # Update the part with image path and text
            part["image_path"] = relative_image_path
            part["pages"] = part_pages
            part["text_content"] = "\n".join(part_text)
        else:
            logger.warning(f"Could not find part {part_name} for {problem_name} even with fallback")

    def _process_problem_parts(self, problem: Dict[str, Any], pdf_document: fitz.Document, 
                              start_page_idx: int, problem_images: List, problem_text: List, 
                              problem_pages: List) -> None:
        """Process parts of a problem that might be on subsequent pages."""
        for part in problem.get("parts", []):
            part_name = part.get("name")
            if not part_name:
                continue
            
            # Look for the part in subsequent pages
            for page_idx in range(start_page_idx, len(pdf_document)):
                page = pdf_document[page_idx]
                
                # Search for the part name
                text_instances = page.search_for(part_name)
                if text_instances:
                    logger.debug(f"Found part {part_name} on page {page_idx+1}")
                    
                    # Get the y-coordinate of the part
                    y1 = min(inst.y0 for inst in text_instances)
                    
                    # For y2, look for the next part or end of page
                    y2 = page.rect.height  # Default to end of page
                    
                    # Look for the next part on the same page
                    next_part_idx = problem.get("parts", []).index(part) + 1
                    if next_part_idx < len(problem.get("parts", [])):
                        next_part = problem["parts"][next_part_idx]
                        next_part_name = next_part.get("name")
                        if next_part_name:
                            next_instances = page.search_for(next_part_name)
                            if next_instances:
                                next_y1 = min(inst.y0 for inst in next_instances)
                                if next_y1 > y1:  # Only if it's after our part
                                    y2 = min(y2, next_y1)
                    
                    # Extract text and image for this part
                    problem_text.append(page.get_text("text", clip=(0, y1, page.rect.width, y2)))
                    problem_image = self._crop_problem_region(page, y1, y2)
                    problem_images.append(problem_image)
                    problem_pages.append(page_idx + 1)
                    break  # Found the part on this page, move to the next part

    def _crop_problem_region(self, page: 'fitz.Page', y1: float, y2: float, padding: int = 5) -> bytes:
        """Crop the page to the problem region and return as image."""
        try:
            # Apply some padding
            y1 = max(0, y1 - padding)  # 5 pixels padding at top
            y2 = min(page.rect.height, y2) 
            
            # Create rectangle for full width, problem height
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

    def _combine_problem_images(self, image_bytes_list: List[bytes]) -> Image.Image:
        """Combine multiple problem images vertically into a single image."""
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

    def _parse_homework_xml(self, xml_string: str) -> Dict[str, List[Dict[str, Any]]]:
        """Parse the XML homework response into a structured format."""
        try:
            # Check if xml_string is empty or invalid
            if not xml_string or not xml_string.strip():
                return {"problems": []}

            # Clean up incomplete XML by finding complete problems
            problem_pattern = r'<PROBLEM>.*?</PROBLEM>'
            complete_problems = re.findall(problem_pattern, xml_string, re.DOTALL)
            
            # Include the title and due date sections if they exist
            title_pattern = r'<TITLE>.*?</TITLE>'
            due_date_pattern = r'<DUE>.*?</DUE>'
            
            title_match = re.search(title_pattern, xml_string, re.DOTALL)
            due_date_match = re.search(due_date_pattern, xml_string, re.DOTALL)
            
            title_section = title_match.group(0) if title_match else ""
            due_date_section = due_date_match.group(0) if due_date_match else ""
            
            cleaned_xml = f"<HOMEWORK>{title_section}{due_date_section}{''.join(complete_problems)}</HOMEWORK>"
            
            root = ET.fromstring(cleaned_xml)
            
            homework_structure = {
                "title": None,
                "due_date": None,
                "problems": []
            }

            # Extract title if present
            title_elem = root.find('TITLE')
            if title_elem is not None and title_elem.text:
                homework_structure["title"] = title_elem.text.strip()

            # Extract due date if present
            due_date_elem = root.find('DUE')
            if due_date_elem is not None and due_date_elem.text:
                homework_structure["due_date"] = due_date_elem.text.strip()

            # Process each problem
            for problem in root.findall('PROBLEM'):
                problem_info = {
                    "name": None,
                    "parts": [],
                    "info": None,
                }
                
                # Extract problem name if present
                problem_name = problem.find('PROBLEM_NAME')
                if problem_name is not None and problem_name.text:
                    problem_info["name"] = problem_name.text.strip()

                # Extract parts
                for part in problem.findall('PART'):
                    part_info = {}
                    
                    # Extract part name if present
                    part_name = part.find('PART_NAME')
                    if part_name is not None and part_name.text:
                        part_info["name"] = part_name.text.strip()
                    
                    # Extract textbook information if present
                    textbook = part.find('TEXTBOOK')
                    if textbook is not None:
                        textbook_info = {}
                        
                        textbook_num = textbook.find('TEXTBOOK_NUMBER')
                        if textbook_num is not None and textbook_num.text:
                            textbook_info["number"] = textbook_num.text.strip()
                        
                        exercise = textbook.find('EXERCISE')
                        if exercise is not None and exercise.text:
                            textbook_info["exercise"] = exercise.text.strip()
                        
                        page = textbook.find('PAGE')
                        if page is not None and page.text:
                            textbook_info["page"] = page.text.strip()
                        
                        if textbook_info:
                            part_info["textbook"] = textbook_info

                    # Extract given information if present
                    given = part.find('GIVEN')
                    if given is not None and given.text:
                        part_info["given"] = given.text.strip()

                    if part_info:
                        problem_info["parts"].append(part_info)

                # Extract additional information if present
                info = problem.find('INFO')
                if info is not None and info.text:
                    problem_info["info"] = info.text.strip()

                if problem_info["parts"] or problem_info["info"]:
                    homework_structure["problems"].append(problem_info)

            return homework_structure
            
        except ET.ParseError as e:
            logger.error(f"Invalid XML format: {str(e)}")
            return {"problems": []}
        except Exception as e:
            logger.error(f"Error parsing homework XML: {str(e)}")
            return {"problems": []}

    def save_homework(self, homework_data: Dict[str, Any], output_path: str) -> None:
        """Save homework data to JSON file."""
        try:
            with open(output_path, 'w') as f:
                json.dump(homework_data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving homework data: {str(e)}")

    def load_homework(self, input_path: str) -> Dict[str, Any]:
        """Load homework data from JSON file."""
        try:
            if os.path.exists(input_path):
                with open(input_path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading homework data: {str(e)}")
        return {"problems": []}
    


if __name__ == "__main__":

    api_key = os.getenv('GOOGLE_API_KEY')

    file_path = "/Users/ashoksaravanan/Coding/ScribeLec/server/classes/cs182/homeworks/Sp25_HW6.pdf"

    # read in the homework.json file
    with open("/Users/ashoksaravanan/Coding/ScribeLec/server/classes/cs182/homework.json", "r") as f:
        all_homework_data = json.load(f)
    homework_data = all_homework_data[0]

    # read in the pdf document
    pdf_document = fitz.open(file_path)

    # extract the problems from the homework
    extractor = ProblemsExtractor(api_key)
    result_data = extractor.extract_problem_images(homework_data, pdf_document, file_path)


