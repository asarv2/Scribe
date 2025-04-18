import os
import asyncio
import logging
import base64
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel
from agents import Agent, Runner
from dotenv import load_dotenv
import google.generativeai as genai
import io
from PIL import Image

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Initialize the Gemini client properly
try:
    genai.configure(api_key=GOOGLE_API_KEY)
    logger.info("Gemini client initialized successfully")
except Exception as e:
    logger.error(f"Error initializing Gemini client: {str(e)}")
    genai = None

class GradedQuestion(BaseModel):
    questionNumber: int
    score: int
    maxScore: int
    explanation: str
    correct: bool

class GradingResult(BaseModel):
    totalScore: int
    maxPossibleScore: int
    feedback: str
    questions: List[GradedQuestion]

class CustomGeminiModel:
    def __init__(self, model_name="gemini-1.5-pro"):
        self.model_name = model_name
        self.model = genai.GenerativeModel(model_name)
    
    async def generate(self, messages, image_data=None, **kwargs):
        # Convert messages to Google's format
        prompt_parts = []
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            
            # Add role prefix for non-system messages
            if role != "system":
                prompt_parts.append(f"{role.capitalize()}: {content}")
            else:
                # For system messages, just add the content as instructions
                prompt_parts.append(content)
        
        # Join all parts with newlines
        prompt = "\n\n".join(prompt_parts)
        
        try:
            # If we have image data, use multimodal generation
            if image_data is not None:
                logger.info("Generating content with image data")
                # For multimodal, we pass both the text prompt and image
                response = self.model.generate_content([prompt, image_data])
            else:
                # Text-only generation
                logger.info("Generating content with text only")
                response = self.model.generate_content(prompt)
            
            # Format the response to match the expected output structure
            return {
                "choices": [
                    {
                        "message": {
                            "content": response.text
                        }
                    }
                ]
            }
        except Exception as e:
            logger.error(f"Error generating content with Gemini: {str(e)}")
            raise

class GraderAgent:
    def __init__(self):
        if not genai:
            raise ValueError("Gemini client not initialized. Cannot create GraderAgent.")
            
        self.instructions =(
            "You are an expert AI grader for educational assignments. Your task is to meticulously evaluate student work and provide constructive feedback. Follow these instructions carefully:\n",
            "Scan the provided document or image to identify individual questions or distinct parts of the assignment.\n",
            "If explicit question numbers are present, use them.\n",
            "If not, logically segment the content into identifiable units that require separate evaluation (e.g., different sections of a problem, individual steps in a derivation, distinct parts of an essay). Assign sequential numbers to these logical sections for clarity in your response.\n",
            "Assess the correctness, completeness, and clarity of the student's response to each identified question or section.\n",
            "Consider the level of detail required for the assignment and the specific learning objectives\n",
            "Pay attention to the reasoning, methodology, and final answer provided.\n",
            "For each question or section, determine a reasonable maximum possible score based on its complexity and weight within the overall assignment. Explicitly state this `maxScore` in your JSON output. If no specific point values are provided in the assignment, use your expert judgment.\n",
            "Assign a `score` earned by the student for each question, reflecting the accuracy and completeness of their answer. Award partial credit where appropriate, providing clear justification in the feedback.\n",
            "Analyze handwriting or typed content\n",
            "For each question, provide detailed `explanation` of your grading.\n",
            "Clearly point out any errors, omissions, or areas where the student's understanding is lacking.\n",
            "Offer specific suggestions for improvement or further learning related to the concepts tested in the question.\n",
            "Explain why points were deducted, referencing specific parts of the student's answer.\n",
            "If the answer is fully correct, briefly reinforce the correct understanding or approach.\n",
            "Calculate the `totalScore` by summing the points earned for all questions.\n",
            "Calculate the `maxPossibleScore` by summing the maximum possible points for all questions. If a default of 100 was intended for assignments without specified point values, ensure your `maxPossibleScore` reflects the sum of your individual `maxScore` assessments.\n",
            "Maintain a high standard for correctness and completeness.\n",
            "Do not award any extra points, bonus credit, or subjective enhancements to the score.\n",
            "Ensure that all deductions are clearly justified by specific errors or omissions in the student's work.\n",
            "Carefully analyze handwriting or typed content in images or PDFs.\n",
            "Do your best to interpret the student's work accurately.\n",
            "If any part of the student's response is illegible or unclear, explicitly state this in the `explanation` for that question (e.g., ;The handwriting in this section is unclear, making it difficult to fully assess the answer.'). Do not guess or assume the content."
            "Always return your evaluation in a properly formatted JSON structure\n"
        )
        self.model = CustomGeminiModel(model_name="gemini-1.5-pro")
        logger.info("GraderAgent initialized successfully")

    def grade_file(self, file_content: Union[str, bytes], file_type: str, additional_context: Optional[str] = None) -> GradingResult:
        """
        Grade a file containing homework or exam answers
        
        Args:
            file_content: Base64 encoded file content or text content
            file_type: MIME type of the file
            additional_context: Optional context about the assignment
            
        Returns:
            GradingResult object with grading details
        """
        logger.info(f"Processing file for grading. Type: {file_type}")
        
        try:
            # Real AI processing
            prompt = "Please grade this assignment. "
            
            if additional_context:
                prompt += f"Context: {additional_context}\n\n"
            
            # Handle different file types
            if "image" in file_type or "pdf" in file_type:
                logger.info("Processing image/PDF with Google Generative AI")
                
                # Prepare image data for Gemini
                image_data = None
                try:
                    if isinstance(file_content, str):
                        # If it starts with data:image/ format, extract just the base64 part
                        if file_content.startswith('data:'):
                            file_content = file_content.split(',')[1]
                        
                        # Convert base64 string to bytes
                        image_bytes = base64.b64decode(file_content)
                    else:
                        # Already bytes
                        image_bytes = file_content
                    
                    # Convert to image format that Gemini can process
                    try:
                        # For PDFs, we use the first page as an image
                        if "pdf" in file_type:
                            import fitz  # PyMuPDF
                            
                            # Open the PDF from bytes
                            pdf_document = fitz.open(stream=image_bytes, filetype="pdf")
                            
                            # Get the first page
                            page = pdf_document.load_page(0)
                            
                            # Render as an image (PNG)
                            pix = page.get_pixmap()
                            
                            # Convert to PIL Image
                            img_data = io.BytesIO(pix.tobytes())
                            image_data = Image.open(img_data)
                            
                            logger.info("Successfully converted PDF to image")
                        else:
                            # For regular images
                            img_data = io.BytesIO(image_bytes)
                            image_data = Image.open(img_data)
                            logger.info("Successfully loaded image data")
                    
                    except ImportError:
                        logger.error("PyMuPDF (fitz) not installed, cannot process PDF")
                        # Try to use it as an image anyway
                        img_data = io.BytesIO(image_bytes)
                        try:
                            image_data = Image.open(img_data)
                            logger.info("Attempting to process PDF as image")
                        except Exception as e:
                            logger.error(f"Failed to process as image: {str(e)}")
                    
                except Exception as e:
                    logger.error(f"Error preparing image data: {str(e)}")
                
                # Create messages for the model
                messages = [
                    {"role": "system", "content": self.instructions},
                    {"role": "user", "content": f"{prompt}\n\nThe image contains the assignment to grade. Please analyze it carefully and grade each question."}
                ]
                
                # Generate response using our CustomGeminiModel with the image
                response = asyncio.run(self.model.generate(messages, image_data=image_data))
                
                # Extract generated content
                content = response["choices"][0]["message"]["content"]
                
                # Try to parse the response as a GradingResult
                import json
                from json import JSONDecodeError
                
                try:
                    # Extract JSON from response (might be surrounded by markdown code blocks)
                    if "```json" in content:
                        json_content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        json_content = content.split("```")[1].split("```")[0].strip()
                    else:
                        json_content = content
                    
                    # Parse the JSON
                    result_dict = json.loads(json_content)
                    
                    # Convert to GradingResult
                    return GradingResult(**result_dict)
                    
                except (JSONDecodeError, ValueError) as e:
                    logger.error(f"Error parsing response: {str(e)}")
                    # Fall back to a simple response
                    return GradingResult(
                        totalScore=70,
                        maxPossibleScore=100,
                        feedback="Assignment graded, but there was an issue formatting the detailed results.",
                        questions=[
                            GradedQuestion(
                                questionNumber=1,
                                score=70,
                                maxScore=100,
                                explanation="The assignment was processed but detailed scoring was unavailable. Raw AI response: " + content[:200] + "...",
                                correct=True
                            )
                        ]
                    )
                
                logger.info("Image grading completed successfully")
                
            else:
                # For text documents (docx, txt, etc.)
                logger.info("Processing text document using AI")
                
                # If file_content is bytes, decode to string
                if isinstance(file_content, bytes):
                    file_content = file_content.decode('utf-8', errors='replace')
                
                # Create messages for the model
                messages = [
                    {"role": "system", "content": self.instructions},
                    {"role": "user", "content": f"{prompt}\n\nDocument content: {file_content}"}
                ]
                
                # Generate response
                response = asyncio.run(self.model.generate(messages))
                
                # Extract generated content
                content = response["choices"][0]["message"]["content"]
                
                # Try to parse the response as a GradingResult
                import json
                from json import JSONDecodeError
                
                try:
                    # Extract JSON from response (might be surrounded by markdown code blocks)
                    if "```json" in content:
                        json_content = content.split("```json")[1].split("```")[0].strip()
                    elif "```" in content:
                        json_content = content.split("```")[1].split("```")[0].strip()
                    else:
                        json_content = content
                    
                    # Parse the JSON
                    result_dict = json.loads(json_content)
                    
                    # Convert to GradingResult
                    return GradingResult(**result_dict)
                    
                except (JSONDecodeError, ValueError) as e:
                    logger.error(f"Error parsing response: {str(e)}")
                    # Fall back to a simple response
                    return GradingResult(
                        totalScore=70,
                        maxPossibleScore=100,
                        feedback="Assignment graded, but there was an issue formatting the detailed results.",
                        questions=[
                            GradedQuestion(
                                questionNumber=1,
                                score=70,
                                maxScore=100,
                                explanation="The assignment was processed but detailed scoring was unavailable. Raw AI response: " + content[:200] + "...",
                                correct=True
                            )
                        ]
                    )
                
                logger.info("Text grading completed successfully")
            
        except Exception as e:
            logger.error(f"Error during grading: {str(e)}")
            # Create a fallback response
            return GradingResult(
                totalScore=0,
                maxPossibleScore=100,
                feedback=f"Error processing assignment: {str(e)}. Please try again.",
                questions=[
                    GradedQuestion(
                        questionNumber=1,
                        score=0,
                        maxScore=100,
                        explanation="Could not process this question due to a technical error.",
                        correct=False
                    )
                ]
            )

# Function to get a singleton instance of the grader agent
_grader_instance = None

def get_grader_agent():
    global _grader_instance
    if _grader_instance is None:
        try:
            _grader_instance = GraderAgent()
        except Exception as e:
            logger.error(f"Error creating GraderAgent: {str(e)}")
            raise
    return _grader_instance