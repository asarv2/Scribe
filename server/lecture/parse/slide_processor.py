import copy
import json
import re
from ..base_processor import BaseProcessor
import argparse
import base64
import io
import os
from pdf2image import convert_from_path
import fitz
import time
from langchain_core.messages import HumanMessage, AIMessage, trim_messages
from PIL import Image, ImageDraw

class SlideProcessor(BaseProcessor):
    def __init__(self, notes_dir: str, handwritten: bool = False, *args, **kwargs):
        """
        Initialize the SlideProcessor.
        
        Args:
            notes_dir: Directory containing the notes
            handwritten: Whether processing handwritten notes
        """
        super().__init__(*args, **kwargs)
        self.notes_dir = notes_dir
        self.handwritten = handwritten
        
        os.makedirs(os.path.join(self.output_dir, self.course_code), exist_ok=True)
        self.json_output_file = os.path.join(self.output_dir, self.course_code, "notes.json")
        
        # Create lectures directory if it doesn't exist
        os.makedirs(os.path.join(self.output_dir, self.course_code, "lectures"), exist_ok=True)
        self.lectures_output_dir = os.path.join(self.output_dir, self.course_code, "lectures")
        # check if notes.json exists
        if os.path.exists(self.json_output_file) and not self.regenerate:
            with open(self.json_output_file, "r") as file:
                self.notes = json.load(file)
            self.conversation_history = []
            for lecture_name in self.notes.keys():
                for page_number  in self.notes[lecture_name].keys():
                    response = self.unparse_response(self.notes[lecture_name][page_number])
                    self.conversation_history.extend([
                        HumanMessage(content=[{"type": "text", "text": f"Slide {page_number} of {len(self.notes[lecture_name])}"}]),
                        AIMessage(content=response)
                    ])
        else:
            self.notes = {}
            self.conversation_history = []
            
    def unparse_response(self, structured_response: dict):
        """Unparse response into a string that AI generated."""
        latex = structured_response["latex"]
        figures = self.unparse_figures(structured_response["figures"])
        description = structured_response["description"]
        return f"<LATEX>{latex}</LATEX>\n\n{figures}\n\n<DESCRIPTION>{description}</DESCRIPTION>"
            
    def unparse_figures(self, figures: list[dict]):
        """Unparse figures into a string"""
        return "\n".join([f"<FIGURE {self.unparse_bbox(figure['bbox'])}>{figure['description']}</FIGURE>" for figure in figures])
    
    def parse_bbox(self, bbox: str):
        """Parse 4 coordinates [ymin, xmin, ymax, xmax]"""
        
        bbox = bbox.strip('[] ')
        
        # Split by comma and convert to floats, handling any internal whitespace
        try:
            ymin, xmin, ymax, xmax = map(lambda x: float(x.strip()), bbox.split(','))
        except ValueError:
            # If parsing fails, return default values
            print(f"Warning: Could not parse bbox {bbox}, using default values")
            return [0, 0, 1000, 1000]
        return [ymin, xmin, ymax, xmax]
    
    def unparse_bbox(self, bbox: list[int]):
        """Unparse bbox into a string. bbox is [ymin, xmin, ymax, xmax]"""
        return f"[{bbox[0]}, {bbox[1]}, {bbox[2]}, {bbox[3]}]"
        
    def draw_grid_on_image(
        self,
        image,
        grid_rows=20,
        grid_cols=20,
        line_color=(255, 255, 255, 5),  # Very faint grey, almost white with very low opacity
        line_width=1
    ):
        """
        Draw a faint black grid on the image with coordinate markings.
        Coordinates start at the top-left (0,0).
        
        Args:
            image: PIL Image object
            grid_rows: Number of horizontal grid divisions
            grid_cols: Number of vertical grid divisions
            line_color: RGBA color for the grid lines (very faint transparent black)
            line_width: Width of the grid lines
        """
        # Convert image to RGBA if not already, so we can use transparency
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        draw = ImageDraw.Draw(image)
        width, height = image.size
        
        # Calculate step sizes
        col_step = width / grid_cols
        row_step = height / grid_rows

        # Calculate legend box size based on grid steps
        font = None
        legend_width = int(col_step)
        legend_height = int(row_step)
        
        # Draw vertical lines and their coordinates at the top
        for c in range(grid_cols + 1):
            x = int(col_step * c)
            draw.line((x, 0, x, height), fill=line_color, width=line_width)
            if x != 0:  # Skip labeling 0
                coord_text = str(x)
                draw.text((x + 2, 2), coord_text, fill=line_color, font=font)

        # Draw horizontal lines and their coordinates at the left
        for r in range(grid_rows + 1):
            y = int(row_step * r)
            draw.line((0, y, width, y), fill=line_color, width=line_width)
            if y != 0:  # Skip labeling 0
                coord_text = str(y)
                draw.text((2, y + 2), coord_text, fill=line_color, font=font)

        # Add legend in upper left corner
        legend_x = 0
        legend_y = 0
        
        # Draw rectangle
        draw.rectangle([(legend_x, legend_y), 
                       (legend_x + legend_width, legend_y + legend_height)], 
                       outline=line_color)
        
        # Draw diagonal line from top-left to bottom-right
        draw.line([(legend_x, legend_y), 
                   (legend_x + legend_width, legend_y + legend_height)], 
                   fill=line_color)
        
        # Position text against edges, similar to grid labels
        x_text_x = legend_x + legend_width - 10  # Offset from right edge
        x_text_y = legend_y               # Align with top
        y_text_x = legend_x + 4                 # Align with left
        y_text_y = legend_y + legend_height - 15 # Offset from bottom
        
        # Add x and y labels in their respective triangles
        draw.text((x_text_x, x_text_y), 
                  "x", fill=(255, 0, 0), font=font) # red color
        draw.text((y_text_x, y_text_y), 
                  "y", fill=(255, 0, 0), font=font) # red color

        return image
    
    def prepare_conversation_history(self, messages, max_tokens=1048576):
        """
        Prepare and trim the conversation history to fit within token limits.
        """
        trimmed_messages = trim_messages(
            messages,
            strategy="last",
            token_counter=self.llm_gemini_flash8b,
            max_tokens=max_tokens,
            allow_partial=True,
        )
        print(f"\nTrimmed conversation history to {len(trimmed_messages)} messages from {len(messages)} messages")
        print(f"Total tokens: {self.llm_gemini_flash8b.get_num_tokens_from_messages(trimmed_messages)}")
        return trimmed_messages

    def extract_text_content(self, file_path: str) -> list[str]:
        """
        Extract text content from each page of a PDF file.
        
        Args:
            file_path: Path to the PDF file.
        
        Returns:
            List of text content for each page.
        """
        text_content = []

        try:
            with fitz.open(file_path) as pdf:
                for page in pdf:
                    text_content.append(page.get_text())
        except Exception as e:
            print(f"Error extracting text from {file_path}: {str(e)}")

        return text_content

    def encode_image(self, image):
        """Convert image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()
        return base64.b64encode(image_bytes).decode('utf-8')
    
    def show_image(self, image):
        """Display image, and wait for user to close window"""
        image.show()
        input("Press Enter to continue...")
        
    def clean_response(self, response: str, lecture_name: str, page_number: int) -> str:
        """Clean the response by removing LaTeX tags and other formatting. Convert into the form of 
        {
            "latex": "..."
            "figures": [
                {
                    "bbox": "[xmin, ymin, xmax, ymax]",
                    "description": "..."
                }
            ],
            "description": "..."
        }
        """
        # extract latex
        latex = re.search(r'<LATEX>(.*?)</LATEX>', response, flags=re.DOTALL)
        if latex:
            latex = latex.group(1)
        else:
            latex = ""
            
        # extract figures. Of form <FIGURE (x1, y1), (x2, y2), (x3, y3), (x4, y4)>(description)</FIGURE>
        figures = re.findall(r'<FIGURE (.*?)>(.*?)</FIGURE>', response, flags=re.DOTALL)
        if figures:
            figures = [
                {
                    "bbox": self.parse_bbox(bbox),
                    "description": description
                }
                for bbox, description in figures
            ]
        else:
            figures = []
        
        # extract description
        description = re.search(r'<DESCRIPTION>(.*?)</DESCRIPTION>', response, flags=re.DOTALL)
        if description:
            description = description.group(1)
        else:
            description = ""
            
        cleaned_response = {
            "latex": latex,
            "figures": figures,
            "description": description
        }
        
        self.notes[lecture_name][page_number] = cleaned_response
        
        return cleaned_response

    def process_slides(self, num_docs=None, num_slides=None):
        """Process slides sequentially with context from previous generations"""
        
        # Filter for PDF files and validate them
        pdf_files = [f for f in os.listdir(self.notes_dir) if f.lower().endswith('.pdf')]
        if num_docs:
            pdf_files = pdf_files[:num_docs]
        
        responses = []
        
        for pdf_file in pdf_files:
            try:
                print(f"Processing {pdf_file}")
                pdf_path = os.path.join(self.notes_dir, pdf_file)
                
                # Validate PDF file
                if not os.path.isfile(pdf_path):
                    print(f"Skipping {pdf_file} - not a valid file")
                    continue
                    
                # Check file size
                if os.path.getsize(pdf_path) == 0:
                    print(f"Skipping {pdf_file} - empty file")
                    continue
                
                lecture_name = pdf_file.replace('.pdf', '')
                
                # Initialize the dictionary for this lecture if it doesn't exist
                if lecture_name not in self.notes:
                    self.notes[lecture_name] = {}
                
                try:
                    images = convert_from_path(pdf_path, dpi=50)   
                    print(f"Extracted {len(images)} images from {pdf_file}")
                    
                    # Initialize text content
                    text_content = []
                    
                    if not self.handwritten:
                        # Extract text content
                        pdf_content = self.extract_text_content(pdf_path)
                        print(f"Extracted text from {len(pdf_content)} pages")
                        
                        # Ensure text content matches number of images
                        if len(pdf_content) != len(images):
                            print(f"Warning: Mismatch between images ({len(images)}) and text content ({len(pdf_content)})")
                            # Take the minimum length to avoid index errors
                            min_length = min(len(images), len(pdf_content))
                            images = images[:min_length]
                            pdf_content = pdf_content[:min_length]
                            print(f"Adjusted to process {min_length} slides")
                        
                        text_content = pdf_content
                    else:
                        # For handwritten notes, create empty text content
                        text_content = ["" for _ in range(len(images))]
                        
                    if num_slides is not None and len(images) > num_slides:
                        images = images[:num_slides]
                        text_content = text_content[:num_slides]
                    
                    
                    # Base prompt
                    if self.handwritten:
                        base_prompt = (
                            f"Follow the 3 instructions carefully to extract the content from the handwritten notes, in the context of the course: "
                            f"{self.course_title}."
                            f"1. Re-create the content exactly as it is written on the slide in LaTeX format, preserving the formatting. Use <LATEX> and </LATEX> tags to enclose the LaTeX content, do not use ```latex or ```.\n"
                            f"Take note of direction of arrows, placement of labels, and other notations. Assume that major math libraries are available, so you can use them to re-create the content. Here is an example:\n\n"
                            f"<LATEX>{{'''\n"
                            f"\\textbf{{Thm 10.1}} \\quad $S$ is convex if and only if\n"
                            f"it contains all conv. comb. of points in $S$\n"
                            f"$pf$ $\\iff$\n\n"
                            f"Suppose $S$ contains all conv. comb. of pts in $S$.\n"
                            f"Then clearly, for any $z_1, z_2 \\in S$\n" 
                            f"\\underline{{tz_1 + (1-t)z_2 \\in S}}\n"
                            f"Conv. comb. of $z_1, z_2$\n"
                            f"\\implies \\underline{{S \\text{{ is convex}}}}\n"
                            f"'''}}</LATEX>\n\n"
                            f"2. Find any important figures on the slides and provide the 4 bounding box coordinates: [ymin, xmin, ymax, xmax]"
                            f"Use <FIGURE> and </FIGURE> tags to enclose the figure coordinates. If there are no figures present, simply do not write any <FIGURE> tags. Example:\n"
                            f"<FIGURE [200, 90, 745, 527]>A description of the figure.</FIGURE>\n\n"
                            f"3. Provide a text based description of what you see, including specific details that "
                            f"would not be known unless you were given the context of the slide. Be very detailed and specific, "
                            f"but make sure to stay concise and to the point. Use LaTeX to describe any mathematical content you see on the slide. Use <DESCRIPTION> and </DESCRIPTION> tags to enclose the description. Example: <DESCRIPTION>{'''This slide presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points.  The proof is outlined, focusing on one direction of the implication.  It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex.  The underlining highlights the key steps and conclusions of the proof.  The notation \"pf\" indicates \"proof,\" and the double-headed arrow indicates the \"if and only if\" nature of the theorem.  The term \"conv. comb.\" is an abbreviation for \"convex combination.\"  The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''}</DESCRIPTION>"
                        )
                    else:
                        base_prompt = f"Extract exactly what is written on the lecture notes, in the context of the course: {self.course_title}. We will provide you with text content from each of the lecture slides as a reference. Output the extracted content in Markdown format, preserving the formatting of the slide. If there are any figures, provide a very detailed description of what you see, taking note of its placement, orientation, and the reason why it is there in the general context of the lecture. Below the generation, provide a description of what you see: include specific details that would not be known unless you were given the context of the slide."
                    
                    for text, image_file, page_number in zip(text_content, images, range(1, len(images) + 1)):
                        if str(page_number) in self.notes[lecture_name]:
                            print(f"Skipping slide {page_number} - output already exists")
                            continue
                            
                        additional_prompt = "Use the previous slide's generation to help you understand the context of the current slide. Remember, you should enclose everything in <LATEX> and </LATEX>, <FIGURE> and </FIGURE>, and <DESCRIPTION> and </DESCRIPTION> tags. Do not include any other formats like ```latex or ```. Here is a complete example of what you should output. INPUT: SLIDE 3 of 15. OUTPUT: " + '''
                            <LATEX>
                            \\textbf{Thm 10.1} \\quad S \\text{ is convex } \\iff \\\\
                            \\text{it contains all conv. comb. of points in } S \\\\
                            pf \\quad \\iff \\\\
                            \\underline{\\text{Suppose } S \\text{ is convex}} \\\\
                            n=2: \\quad z_1, z_2 \\in S \\implies t_1 z_1 + t_2 z_2 \\in S, \\quad t_1, t_2 \\ge 0 \\\\
                            \\quad t_1 + t_2 = 1 \\\\
                            n=3: \\quad z_1, z_2, z_3 \\in S \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 = \\left( t_1 + t_2 \\right) \\left( \\frac{t_1}{t_1 + t_2} z_1 + \\frac{t_2}{t_1 + t_2} z_2 \\right) + t_3 z_3 \\\\
                            t_1 + t_2 + t_3 = 1 \\\\
                            t_1 + t_2 \\ge 0, \\quad t_3 \\ge 0 \\\\
                            \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 \\in S
                            </LATEX>
                            
                            <FIGURE [200, 90, 745, 527]>Theorem 10.1 statement.</FIGURE>
                            <FIGURE [400, 490, 800, 700]>Conclusion of the proof for n=3.</FIGURE>
                            
                            <DESCRIPTION>This slide continues the proof of Theorem 10.1 from the previous slide, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof. The underlining highlights key assumptions and conclusions. The notation "pf" stands for "proof," and "conv. comb." is short for "convex combination." The context of linear programming is crucial because this theorem is fundamental to understanding the properties of feasible regions in linear programming problems, which are often convex sets.</DESCRIPTION>''' + f". Now its your turn. INPUT: SLIDE {page_number} of {len(images)}. OUTPUT: "
                        # Draw grid on image
                        
                        # grid_image = self.draw_grid_on_image(image_file)
                        # self.show_image(image_file)
                        
                        # Encode current image
                        image_base64 = self.encode_image(image_file)
                        
                        # Create message with context from previous responses
                        message_content = [
                            {"type": "text", "text": base_prompt + "\n\n" + additional_prompt},
                            {
                                "type": "image_url",
                                "image_url": f"data:image/png;base64,{image_base64}"
                            }
                        ]
                        
                        # if not handwritten, add the extracted text from the slide
                        if not self.handwritten:
                            if text: # if text is not empty
                                message_content.append({
                                    "type": "text",
                                    "text": text
                                })
                            
                        # Create message and get response
                        message = HumanMessage(content=message_content)
                        self.conversation_history.append(message)
                        
                        
                        while True:
                            try:
                                response = self.llm_gemini_flash8b.generate([self.conversation_history])
                                current_response = response.generations[0][0].text
                                
                                if current_response == "":
                                    raise Exception("Empty response, retrying...")
                                
                                # clean the response
                                cleaned_response = self.clean_response(current_response, lecture_name, page_number)
                                
                                # replacing conversation history last message with the following
                                self.conversation_history.pop()
                                response = self.unparse_response(cleaned_response)
                                self.conversation_history.extend([
                                    HumanMessage(content=[{"type": "text", "text": f"Slide {page_number} of {len(images)}"}]),
                                    AIMessage(content=response)
                                ])
                                
                                # save outputs
                                self.save_notes_json(self.json_output_file)
                                self.save_notes_text(self.lectures_output_dir)
                                self.save_figures_png(self.lectures_output_dir, image_file)
                                self.save_notes_pdf(self.lectures_output_dir) # after figures are saved

                                print(f"\nProcessed Slide {page_number}: {response[:200]}")
                                
                                break  # Exit the loop if successful
                            
                            except Exception as e:
                                if "payload" in str(e).lower():
                                    print("Payload too large, trimming conversation history and retrying...")
                                    self.conversation_history = self.prepare_conversation_history(self.conversation_history)
                                elif "exhausted" in str(e).lower():
                                    print("Exhausted resources, trying again in 5 seconds...")
                                    time.sleep(5)
                                else:
                                    print(f"Error processing slide {page_number}: {str(e)}")
                                    print(f"Full error: {e.__class__.__name__}: {str(e)}")
                                    import traceback
                                    traceback.print_exc()
                                    break  # Exit the loop on non-size-related errors
                            
                    print(f"Processed {pdf_file}.")
                    
                except Exception as e:
                    print(f"Error processing PDF {pdf_file}: {str(e)}")
                    print(f"Full error: {e.__class__.__name__}: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    continue
                    
            except Exception as e:
                print(f"Error reading {pdf_file}: {str(e)}")
                continue

        return responses
    
    def save_notes_json(self, file_path: str):
        with open(file_path, "w") as file:
            json.dump(self.notes, file, indent=4)
            
    def save_figures_png(self, file_path: str, image_file: Image):
        """Save the figures as PNG files.
        
        Args:
            file_path (str): The path to the output directory.
            image_file (Image): The image file to crop the figures from.
        """
        for lecture_name in self.notes.keys():
            os.makedirs(os.path.join(file_path, lecture_name, "figures"), exist_ok=True)
            for page_number in self.notes[lecture_name].keys():
                structured_output = self.notes[lecture_name][page_number]
                for idx, figure in enumerate(structured_output["figures"]):
                    ymin, xmin, ymax, xmax = figure["bbox"]
                    # divide each by 1000
                    ymin, xmin, ymax, xmax = ymin / 1000, xmin / 1000, ymax / 1000, xmax / 1000
                    # multiply xs by image width, ys by image height
                    xmin, ymin, xmax, ymax = xmin * image_file.width, ymin * image_file.height, xmax * image_file.width, ymax * image_file.height
                    cropped = image_file.crop((xmin, ymin, xmax, ymax))
                    cropped.save(os.path.join(file_path, lecture_name, "figures", f"{page_number}.{idx + 1}.png"))
            
    def save_notes_pdf(self, file_path: str):
        """Save the notes as a PDF file and crop each of the figures in the notes.

        Args:
            file_path (str): The path to the output directory.
        """
        # crop each of the figures in the notes
        for lecture_name in self.notes.keys():
            os.makedirs(os.path.join(file_path, lecture_name), exist_ok=True)
            figures = [os.path.join(file_path, lecture_name, "figures", f) for f in os.listdir(os.path.join(file_path, lecture_name, "figures"))]
            figures_dict = {}
            for figure in figures:
                key = figure.split("/")[-1].split(".")[0]
                if key not in figures_dict:
                    figures_dict[key] = []
                figures_dict[key].append(figure)
            # saving latex
            self.save_slide_latex(lecture_name, self.notes[lecture_name], figures_dict)

    def save_notes_text(self, file_path: str):
        """Save all slides for each lecture concatenated into a single notes.txt file.
        Each slide is separated by a newline and labeled with 'SLIDE X' at the top.
        
        Args:
            file_path (str): The path to the output directory.
        """
        for lecture_name in self.notes.keys():
            # Create lecture directory
            lecture_dir = os.path.join(file_path, lecture_name)
            os.makedirs(lecture_dir, exist_ok=True)
            
            # Write all slides to single notes.txt file
            notes_path = os.path.join(lecture_dir, "notes.txt")
            with open(notes_path, "w") as notes_file:
                for page_number in sorted(self.notes[lecture_name].keys()):
                    notes_file.write(f"SLIDE {page_number}\n")
                    structured_output = self.notes[lecture_name][page_number]
                    response = self.unparse_response(structured_output)
                    notes_file.write(response)
                    notes_file.write("\n\n")
                    
    def save_notes_supabase(self):
        """
        Save the notes to supabase. Will insert into the 'slides' table, with the following fields:
        name, note_number, class
        name: the name of the lecture
        note_number: the note number, in the context of all lectures. Should sort all lectures, and use this ordering to determine the note number.
        class: the self.class_id
        """
        for lecture_name in self.notes.keys():
            note_number = sorted(self.notes.keys()).index(lecture_name) + 1
            self.supabase.table("slides").insert({
                "name": lecture_name,
                "note_number": note_number,
                "class": self.class_id
            }).execute()
        print(f"Saved {len(self.notes)} notes to supabase.")
        
    def save_notes_storage_supabase(self):
        """
        Save the notes to supabase storage.
        """
        for lecture_name in self.notes.keys():
            # check if notes.pdf exists
            if not os.path.exists(os.path.join(self.output_dir, self.course_code, "lectures", f"{lecture_name}", "notes.pdf")):
                print(f"Skipping {lecture_name} - notes.pdf does not exist")
                continue
            response = self.supabase.storage.from_("slides").upload(
                file=os.path.join(self.output_dir, self.course_code, "lectures", f"{lecture_name}", "notes.pdf"),
                path=f"{self.course_code}/lectures/{lecture_name}/notes.pdf",
                file_options={"cache-control": "3600", "upsert": "true"},
            )
            print(f"Saved {lecture_name} to supabase storage. Response: {response}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process slides for course notes.")
    parser.add_argument("class_id", type=str, help="The class identifier (e.g., CS243)")
    parser.add_argument("--handwritten", action="store_true", help="Process handwritten notes")
    parser.add_argument("--num_docs", type=int, help="Number of documents to process")
    parser.add_argument("--num_slides", type=int, help="Number of slides to process")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing slides")
    parser.add_argument("--output_dir", type=str, default="./output", help="Directory for output files")

    args = parser.parse_args()
    processor = SlideProcessor(
        class_id=args.class_id,
        output_dir=args.output_dir,
        handwritten=args.handwritten
    )
    responses = processor.process_slides(args.num_docs, args.num_slides, args.overwrite)
    print("Processing complete.")
