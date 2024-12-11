from dotenv import load_dotenv
load_dotenv()
import argparse

from langchain_core.messages import HumanMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    trim_messages,
)
import base64
import io
import os
from pdf2image import convert_from_path
import fitz
import time

llm = ChatGoogleGenerativeAI(
    model = 'gemini-1.5-flash-8b',
    temperature = 0,
    max_tokens = None,
    timeout = 15,
    max_retries = 2,
)


def prepare_conversation_history(messages, max_tokens=1048576):
    """
    Prepare and trim the conversation history to fit within token limits.
    
    Args:
        conversation_history: List of messages in the conversation
        max_tokens: Maximum tokens allowed
    
    Returns:
        List of trimmed messages
    """
    # Trim messages to fit within the token limit
    trimmed_messages = trim_messages(
        messages,
        strategy="last",
        token_counter=llm,
        max_tokens=max_tokens,
        allow_partial=True,
    )
    print(f"\nTrimmed conversation history to {len(trimmed_messages)} messages from {len(messages)} messages")
    print(f"Total tokens: {llm.get_num_tokens_from_messages(trimmed_messages)}")
    return trimmed_messages

def extract_text_content(file_path: str) -> list[str]:
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

def encode_image(image):
    """Convert image to base64 string"""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    image_bytes = buffer.getvalue()
    return base64.b64encode(image_bytes).decode('utf-8')

def process_slides(course, course_title, handwritten=False,num_docs=None, num_slides=None, overwrite=False):
    """Process slides sequentially with context from previous generations"""
    
    output_dir = f'./output/output_{course}'
    
    os.makedirs(output_dir, exist_ok=True)
    notes_dir = f'/Users/ashoksaravanan/Coding/ScribeLec/Server/summary/parse/Notes/Notes_{course}/'
    
    # Filter for PDF files and validate them
    pdf_files = [f for f in os.listdir(notes_dir) if f.lower().endswith('.pdf')]
    if num_docs:
        pdf_files = pdf_files[:num_docs]
    
    responses = []
    
    for pdf_file in pdf_files:
        try:
            pdf_path = os.path.join(notes_dir, pdf_file)
            
            # Validate PDF file
            if not os.path.isfile(pdf_path):
                print(f"Skipping {pdf_file} - not a valid file")
                continue
                
            # Check file size
            if os.path.getsize(pdf_path) == 0:
                print(f"Skipping {pdf_file} - empty file")
                continue
            
            pdf_output_dir = os.path.join(output_dir, pdf_file.replace('.pdf', ''))
            
            try:
                images = convert_from_path(pdf_path, dpi=50)   
                # Initialize text content
                text_content = []
                
                if not handwritten:
                    # Extract text content
                    pdf_content = extract_text_content(pdf_path)
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
                
                
                # Check if all slides already exist
                all_slides_exist = True
                for page_number in range(1, len(images) + 1):
                    slide_file = os.path.join(pdf_output_dir, f"{page_number}.txt")
                    if not os.path.exists(slide_file) or overwrite:
                        all_slides_exist = False
                        break
                        
                if all_slides_exist and not overwrite:
                    print(f"Skipping {pdf_file} - all slides already processed")
                    continue
                    
                # Create subdirectory for PDF file
                os.makedirs(pdf_output_dir, exist_ok=True)
                
                # Base prompt
                if handwritten:
                    base_prompt = f"Extract exactly what is written on the handwritten notes, in the context of the course: {course_title}. Output the content in LaTeX format, preserving the formatting of the slide. For any figures you see, try to re-create them in LaTeX. Take note of direction of arrows, placement of labels, and other notations. Below the generation, provide a description of what you see: include specific details that would not be known unless you were given the context of the slide."
                else:
                    base_prompt = f"Extract exactly what is written on the lecture notes, in the context of the course: {course_title}. We will provide you with text content from each of the lecture slides as a reference. Output the extracted content in Markdown format, preserving the formatting of the slide. If there are any figures, provide a very detailed description of what you see, taking note of its placement, orientation, and the reason why it is there in the general context of the lecture. Below the generation, provide a description of what you see: include specific details that would not be known unless you were given the context of the slide."
                
                conversation_history = []
                pdf_responses = []
                
                for text, image_file, page_number in zip(text_content, images, range(len(images))):
                    page_number += 1
                    # Check if individual slide file exists
                    slide_file = os.path.join(pdf_output_dir, f"{page_number}.txt")
                    if os.path.exists(slide_file) and not overwrite:
                        print(f"Skipping slide {page_number} - output already exists")
                        # Read existing response to maintain context
                        with open(slide_file, "r") as f:
                            current_response = f.read()
                        pdf_responses.append(current_response)
                        conversation_history.extend([
                            HumanMessage(content=[{"type": "text", "text": "Previous slide content"}]),
                            AIMessage(content=current_response)
                        ])
                        continue
                        
                    additional_prompt = f"This is slide {page_number} of {len(images)} slides. Use the previous slide's generation to help you understand the context of the current slide. Output the slide number at the top of your response for clarity."
                    
                    # Encode current image
                    image_base64 = encode_image(image_file)
                    
                    # Create message with context from previous responses
                    message_content = [
                        {"type": "text", "text": base_prompt + "\n\n" + additional_prompt},
                        {
                            "type": "image_url",
                            "image_url": f"data:image/png;base64,{image_base64}"
                        }
                    ]
                    
                    # if not handwritten, add the extracted text from the slide
                    if not handwritten:
                        if text: # if text is not empty
                            message_content.append({
                                "type": "text",
                                "text": text
                            })
                        
                    # Create message and get response
                    message = HumanMessage(content=message_content)
                    conversation_history.append(message)
                    
                    
                    while True:
                        try:
                            response = llm.generate([conversation_history])
                            current_response = response.generations[0][0].text
                            
                            if current_response == "":
                                raise Exception("Empty response, retrying...")
                            
                            pdf_responses.append(current_response)
                            # replacing conversation history last message with the following
                            conversation_history.pop()
                            conversation_history.extend([
                                HumanMessage(content=[{"type": "text", "text": "Previous slide content"}]),
                                AIMessage(content=current_response)
                            ])
                            
                            print(f"\nProcessing Slide {page_number}:")
                            print(current_response[:200])
                            
                            # Save individual response in file
                            with open(slide_file, "w") as f:
                                f.write(current_response)
                            
                            break  # Exit the loop if successful
                        
                        except Exception as e:
                            if "payload" in str(e).lower():
                                print("Payload too large, trimming conversation history and retrying...")
                                conversation_history = prepare_conversation_history(conversation_history)
                            elif "exhausted" in str(e).lower():
                                print("Exhausted resources, trying again in 5 seconds...")
                                time.sleep(5)
                            else:
                                print(f"Error processing slide {page_number}: {str(e)}")
                                break  # Exit the loop on non-size-related errors
                        
                print(f"Processing {pdf_file} complete.")
                # saving concatenated response in file
                output_file = os.path.join(output_dir, f"{pdf_file.replace('.pdf', '')}.txt")
                with open(output_file, "w") as f:
                    f.write("\n\n".join(pdf_responses))
                
                responses.extend(pdf_responses)
                
            except Exception as e:
                print(f"Error processing PDF {pdf_file}: {str(e)}")
                continue
                
        except Exception as e:
            print(f"Error reading {pdf_file}: {str(e)}")
            continue

    return responses


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process slides for course notes.")
    parser.add_argument("course", type=str, help="The course identifier (e.g., CS243)")
    parser.add_argument("course_title", type=str, help="The course title (e.g., AI Basics)")
    parser.add_argument("--handwritten", action="store_true", help="Process handwritten notes")
    parser.add_argument("--num_docs", type=int, help="Number of documents to process")
    parser.add_argument("--num_slides", type=int, help="Number of slides to process")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing slides")

    args = parser.parse_args()
    responses = process_slides(args.course, args.course_title, args.handwritten, args.num_docs, args.num_slides, args.overwrite)
    print("Processing complete.")
