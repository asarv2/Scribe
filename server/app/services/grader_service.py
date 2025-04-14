"""
Service for processing assignment grading requests using the GraderAgent
"""
import sys
import os
import logging
import base64
from typing import Optional, Dict, Any, Union
import asyncio
import concurrent.futures

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add the agents directory to the path so we can import our grader agent
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../")))

try:
    from server.agents.grader import get_grader_agent, GradingResult
    logger.info("Successfully imported grader agent")
except ImportError as e:
    logger.error(f"Error importing grader agent: {str(e)}")
    raise

def _run_grader_in_thread(
    file_content: Union[str, bytes], 
    file_type: str, 
    additional_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Function to run in a separate thread that handles grading
    This function creates its own event loop
    """
    try:
        # Create a new event loop for this thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Get grader and process the file
        grader = get_grader_agent()
        result = grader.grade_file(
            file_content=file_content,
            file_type=file_type,
            additional_context=additional_context
        )
        
        # Convert Pydantic model to dict
        return result.dict()
    except Exception as e:
        logger.error(f"Error in thread processing: {str(e)}")
        # Return fallback response
        return {
            "totalScore": 0,
            "maxPossibleScore": 100,
            "feedback": f"Error processing assignment: {str(e)}. Please try again.",
            "questions": [
                {
                    "questionNumber": 1,
                    "score": 0,
                    "maxScore": 100,
                    "explanation": "Could not process this question due to a technical error.",
                    "correct": False
                }
            ]
        }
    finally:
        # Clean up the event loop
        try:
            loop.close()
        except:
            pass

async def grade_assignment(
    file_content: Union[str, bytes],
    file_type: str,
    additional_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Grade an assignment using the AI grader agent
    """
    try:
        logger.info(f"Grading assignment of type: {file_type}")
        logger.info(f"Additional context: {additional_context}")
        
        # For debugging, check content type
        content_type = "string" if isinstance(file_content, str) else "bytes"
        content_length = len(file_content)
        logger.info(f"File content received as {content_type}, length: {content_length}")
        
        # Process different file types
        if "image" in file_type:
            # Handle image content properly
            logger.info("Processing image for grading")
            
            # If file_content is a string, ensure it's base64 encoded
            if isinstance(file_content, str):
                # Check if it already has data:image/ prefix
                if not file_content.startswith('data:') and not file_content.startswith('base64,'):
                    # Assume it's already base64 encoded
                    logger.info("Base64 image without data URI prefix")
                else:
                    logger.info("Base64 image with data URI prefix")
            else:
                # Convert bytes to base64 string for model input
                logger.info("Converting image bytes to base64")
                file_content = base64.b64encode(file_content).decode('utf-8')
        
        elif "pdf" in file_type:
            # Handle PDF content
            logger.info("Processing PDF for grading")
            if isinstance(file_content, bytes):
                # For debugging
                logger.info(f"PDF byte content size: {len(file_content)} bytes")
                # Convert to base64 for processing
                file_content = base64.b64encode(file_content).decode('utf-8')
                logger.info("PDF converted to base64 string")
            elif isinstance(file_content, str) and file_content.startswith('data:application/pdf'):
                logger.info("PDF received as data URI")
            else:
                logger.info("PDF received as base64 string")
        
        # Use a standard ThreadPoolExecutor to run our synchronous grading function
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result_dict = await asyncio.get_event_loop().run_in_executor(
                executor,
                _run_grader_in_thread,
                file_content,
                file_type,
                additional_context
            )
        
        logger.info("Successfully graded assignment")
        return result_dict
    except Exception as e:
        logger.error(f"Error grading assignment: {str(e)}")
        # Return a fallback response in case of error
        return {
            "totalScore": 0,
            "maxPossibleScore": 100,
            "feedback": f"Error processing assignment: {str(e)}. Please try again.",
            "questions": [
                {
                    "questionNumber": 1,
                    "score": 0,
                    "maxScore": 100,
                    "explanation": "Could not process this question due to a technical error.",
                    "correct": False
                }
            ]
        }