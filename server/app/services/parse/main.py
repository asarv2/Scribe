from typing import List, Dict, Any, Optional, Callable, Union
import base64
import re
import os
import tempfile
import requests
from PIL import Image
import io
import google.generativeai as genai
from google.generativeai.types import File
from agents import Agent, OpenAIChatCompletionsModel, Runner, trace
from app.extensions import gemini_client
from app.services.parse.prompts import get_parse_prompt, get_file_type_prompt
from app.services.parse.models import CleanedResponse, ParseOutput
from agents.items import TResponseInputItem

class FileProcessor(object):
    def __init__(self, course_title: str, file_title: str, file_type: str):
        super().__init__()
        self.course_title = course_title
        self.file_title = file_title
        self.file_type = file_type
        self.chat_history = []


        # creating parse agent
        parse_system_prompt = get_parse_prompt(course_title)
        self.parse_agent = Agent(
            name="Parse Agent",
            instructions=parse_system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash-lite",
                openai_client=gemini_client,
            ),
            output_type=ParseOutput
        )

    def get_file_from_gemini(self, file_name: str) -> File | None:
        # Get the file from Gemini
        try:
            response = genai.get_file(file_name)
            if response.state.name == "ACTIVE":
                return response
            else:
                error_info = ""
                if hasattr(response, "error") and response.error:
                    error_code = getattr(response.error, "code", "Unknown")
                    error_message = getattr(response.error, "message", "No details available")
                    
                    # Try to extract detailed error information
                    error_details = []
                    if hasattr(response.error, "details") and response.error.details:
                        for detail in response.error.details:
                            if hasattr(detail, "@type"):
                                error_details.append(f"Type: {detail['@type']}")
                            # Add any other relevant fields from the detail object
                            error_details_str = ", ".join(error_details) if error_details else "No details"
                            error_info = f" (Code: {error_code}, Message: {error_message}, Details: {error_details_str})"
                    else:
                        error_info = f" (Code: {error_code}, Message: {error_message})"
                
                # Get additional metadata if available
                metadata_info = ""
                if hasattr(response, "updateTime"):
                    metadata_info += f", Last updated: {response.updateTime}"
                if hasattr(response, "sizeBytes"):
                    metadata_info += f", Size: {response.sizeBytes} bytes"
                
                print(f"File {file_name} is not active. Status: {response.state.name}{error_info}{metadata_info}")
                
                # For error code 3 (INVALID_ARGUMENT), provide more specific guidance
                if error_code == 3:
                    print(f"This may indicate an issue with the file format or content. Please verify the file is valid and in a supported format.")
                
                return None
        except Exception as e:
            print(f"Error retrieving file {file_name}: {str(e)}")
            return None

    def format_conversation(self, document: Dict[str, Any], images: List[str], additional_files: List[File], add_current=True) -> list[TResponseInputItem]:
        """Format the conversation history into context"""
        # Initialize with system message regardless of chat history
        context_summary = [{"role": "system", "content": str(f"You are a helpful assistant.")}]
        
        # # Add chat history if it exists
        for message in self.chat_history:
            context_summary.append({"role": "assistant", "content": str(message)})

        if add_current:
            current_context = []
            if images:
                current_context.extend([{"type": "input_image", "image_url": f"data:image/jpeg;base64,{image}", "detail": "low"} for image in images])
            
            # if additional_files:
            #     current_context.extend(additional_files)  # list of file objects

            current_prompt = get_file_type_prompt(self.file_type, document)
            current_context.append({"type": "input_text", "text": current_prompt})

            context_summary.append({"role": "user", "content": current_context})
        return context_summary

    async def process_documents(
        self,
        documents: List[Dict[str, Any]],
        file_names: List[str],
        after_generate: Callable[[CleanedResponse], None]
    ) -> List[CleanedResponse]:
        try:
            results = []
            with trace("Parse Documents"):
                for document in documents:
                    document_id = document.get('id')
                    page_number = document.get('page', 1)
                    text = document.get('text', '')
                    image = document.get('image')
                    
                    # Prepare the message based on file type
                    images = []
                    additional_files = []
                    
                    # For audio/video, use the Gemini file_name
                    if self.file_type in ['audio', 'video']:
                        for file_name in file_names:
                            file_context = self.get_file_from_gemini(file_name)
                            if file_context:
                                additional_files.append(file_context)
                    # For images and PDFs, use the image from Supabase
                    elif image and self.file_type in ['pdf', 'image']:
                        # Resize and compress the image before base64 encoding
                        try:
                            # Convert bytes to PIL Image
                            img = Image.open(io.BytesIO(image))
                            
                            # Resize image if it's too large (e.g., max dimension 800px)
                            max_size = 800
                            if max(img.size) > max_size:
                                ratio = max_size / max(img.size)
                                new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                                img = img.resize(new_size, Image.LANCZOS)
                            
                            # Save as compressed JPEG
                            buffer = io.BytesIO()
                            img.convert('RGB').save(buffer, format="JPEG", quality=90)
                            compressed_image = buffer.getvalue()
                            
                            # Base64 encode the compressed image
                            base64_image = base64.b64encode(compressed_image).decode('utf-8')
                            images.append(base64_image)
                            
                            print(f"Image compressed from {len(image)} bytes to {len(compressed_image)} bytes")
                        except Exception as e:
                            print(f"Error compressing image: {e}")
                            # Fall back to text-only if image processing fails
                    
                    # Format conversation context
                    conversation_context = self.format_conversation(document, images, additional_files)

                    # Generate response using AI
                    raw_response = await Runner.run(self.parse_agent, input=conversation_context)
                    response = raw_response.final_output.description
                    print(f"Response for document {document_id}:", response)
                    
                    if response:
                        # Add AI response to conversation history
                        self.chat_history.append(response)
                    
                    result = CleanedResponse(
                        page=page_number,
                        description=response,
                        text=text
                    )
                    
                    results.append(result)
                    await after_generate(result)
            
            return results
        except Exception as error:
            print("Error processing documents:", error)
            raise error