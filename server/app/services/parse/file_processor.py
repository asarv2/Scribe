from typing import List, Dict, Any, Optional, Callable, Union
import base64
import re
from app.services.base_processor import BaseProcessor, CleanedResponse, Message
import os
import tempfile
import requests
from PIL import Image
import io

class FileProcessor(BaseProcessor):
    def __init__(self, course_title: str, file_title: str, file_type: str):
        super().__init__()
        self.course_title = course_title
        self.file_title = file_title
        self.file_type = file_type
        self.notes: Dict[str, Dict[int, CleanedResponse]] = {}
        self.conversation_history: List[Message] = []

    def clean_response(
        self,
        response: str,
        document_id: str,
        page_number: int,
        text: str,
    ) -> CleanedResponse:
        cleaned_response = CleanedResponse(
            page=page_number,
            description=response.strip(),  # Treat entire response as description
            text=text
        )

        if document_id not in self.notes:
            self.notes[document_id] = {}
        self.notes[document_id][page_number] = cleaned_response

        return cleaned_response

    async def process_document(
        self,
        document: Dict[str, Any],
        storage_url: Optional[str] = None,
    ) -> CleanedResponse:
        try:
            document_id = document.get('id')
            page_number = document.get('page', 1)
            text = document.get('text', '')
            file_id = document.get('file')
            
            # Determine if we need to fetch an image
            has_image = self.file_type in ['pdf', 'image', 'video', 'video_audio']
            image_bytes = None
            
            if has_image and storage_url:
                # Construct the image URL
                image_url = f"{storage_url}/{document_id}.png"
                
                # Download the image
                response = requests.get(image_url)
                if response.status_code == 200:
                    image_bytes = response.content
            
            # Prepare the message based on file type
            message_content = []
            
            # Add image if available
            if image_bytes:
                base64_image = base64.b64encode(image_bytes).decode('utf-8')
                message_content.append({
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                })
            
            # Add appropriate prompt based on file type
            prompt = self._get_prompt_for_file_type(document)
            message_content.append({
                "type": "text",
                "text": prompt
            })
            
            # Add text content if available
            if text:
                message_content.append({
                    "type": "text", 
                    "text": f"Transcribed text: {text}"
                })
            
            message = Message(content=message_content)
            
            # Add message to conversation history
            self.conversation_history.append(message)
            
            # Generate response using AI
            model = "gemini-2.0-flash-lite"
            response = await self.robust_generate(None, message, model=model)
            print(f"Response for document {document_id}:", response)
            
            if response:
                # Add AI response to conversation history
                self.conversation_history.append(Message(content=[{"type": "text", "text": response}]))
            
            return self.clean_response(
                response,
                document_id,
                page_number,
                text
            )
            
        except Exception as error:
            print(f"Error processing document {document.get('id')}:", error)
            raise error

    async def process_documents(
        self,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedResponse], None]
    ) -> List[CleanedResponse]:
        try:
            results = []
            for document in documents:
                document_id = document.get('id')
                page_number = document.get('page', 1)
                text = document.get('text', '')
                image = document.get('image')
                
                # Prepare the message based on file type
                message_content = []
                
                # Add image if available
                if image:
                    base64_image = base64.b64encode(image).decode('utf-8')
                    message_content.append({
                        "type": "image_url",
                        "image_url": f"data:image/png;base64,{base64_image}"
                    })
                
                # Add appropriate prompt based on file type
                prompt = self._get_prompt_for_file_type(document)
                message_content.append({
                    "type": "text",
                    "text": prompt
                })
                
                # Add text content if available
                if text:
                    message_content.append({
                        "type": "text", 
                        "text": f"Transcribed text: {text}"
                    })
                
                message = Message(content=message_content)
                
                # Add message to conversation history
                self.conversation_history.append(message)
                
                # Generate response using AI
                model = "gemini-2.0-flash-lite"
                response = await self.robust_generate(None, message, model=model)
                print(f"Response for document {document_id}:", response)
                
                if response:
                    # Add AI response to conversation history
                    self.conversation_history.append(Message(content=[{"type": "text", "text": response}]))
                
                result = self.clean_response(
                    response,
                    document_id,
                    page_number,
                    text
                )
                
                results.append(result)
                await after_generate(result)
            
            return results
        except Exception as error:
            print("Error processing documents:", error)
            raise error

    def _get_prompt_for_file_type(self, document: Dict[str, Any]) -> str:
        """Generate an appropriate prompt based on the file type"""
        
        base_prompt = f"You are analyzing content from the course: {self.course_title}, file: {self.file_title}."
        
        if self.file_type == 'pdf':
            page_number = document.get('page', 1)
            return f"{base_prompt}\n\nThis is page {page_number} of a PDF document. Please provide a detailed description of what you see on this page. Include any key concepts, formulas, diagrams, or important information. Use LaTeX notation (enclosed in $ signs) for any mathematical content."
        
        elif self.file_type == 'audio':
            start_time = document.get('start_time', 0)
            end_time = document.get('end_time', 0)
            start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
            end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
            
            return f"{base_prompt}\n\nThis is an audio segment from {start_time_fmt} to {end_time_fmt}. Based on the transcription provided, please summarize the key points discussed in this segment. Identify any important concepts, definitions, or examples mentioned."
        
        elif self.file_type in ['video', 'video_audio']:
            start_time = document.get('start_time', 0)
            end_time = document.get('end_time', 0)
            start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
            end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
            
            return f"{base_prompt}\n\nThis is a video segment from {start_time_fmt} to {end_time_fmt}. Based on the visual content and transcription provided, please describe what you see in the frame and summarize the key points discussed in this segment. Identify any important concepts, definitions, or examples shown or mentioned."
        
        elif self.file_type == 'image':
            return f"{base_prompt}\n\nThis is an image. Please provide a detailed description of what you see. Include any text, diagrams, charts, or visual elements present in the image. If there are any mathematical formulas or equations, please transcribe them using LaTeX notation (enclosed in $ signs)."
        
        else:
            return f"{base_prompt}\n\nPlease analyze this content and provide a detailed description of what you observe. Include any key information, concepts, or details that would be relevant for a student in this course."