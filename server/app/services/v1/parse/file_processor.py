from typing import List, Dict, Any, Optional, Callable, Union
import base64
import re
from app.services.base_processor import BaseProcessor, CleanedResponse, Message
import os
import tempfile
import requests
from PIL import Image
import io
import google.generativeai as genai

class FileProcessor(BaseProcessor):
    def __init__(self, course_title: str, file_title: str, file_type: str):
        super().__init__()
        self.course_title = course_title
        self.file_title = file_title
        self.file_type = file_type
        self.notes: Dict[str, Dict[int, CleanedResponse]] = {}
        self.conversation_history: List[Message] = []

    def get_file_from_gemini(self, file_name: str) -> Any:
        # Get the file from Gemini
        response = genai.get_file(file_name)
        if response.state.name == "ACTIVE":
            return response
        else:
            return None

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
            has_image = self.file_type in ['pdf', 'image', 'video']
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
            additional_files = []

            file_context = self.get_file_from_gemini(document.get('file_name'))
            if file_context:
                additional_files.append(file_context)
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
            response = await self.robust_generate(None, message, model="gemini-2.0-flash-lite", additional_files=additional_files)
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
        file_names: List[str],
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
                additional_files = []
                
                # For audio/video, use the Gemini file_name
                if self.file_type in ['audio', 'video']:
                    for file_name in file_names:
                        file_context = self.get_file_from_gemini(file_name)
                        if file_context:
                            additional_files.append(file_context)
                # For images and PDFs, use the image from Supabase
                elif image and self.file_type in ['pdf', 'image']:
                    base64_image = base64.b64encode(image).decode('utf-8')
                    message_content.append({
                        "type": "image_url",
                        "image_url": f"data:image/png;base64,{base64_image}"
                    })
                
                # Add appropriate prompt based on file type
                prompt = self._get_prompt_for_file_type(document)
                print(f"Prompt for document {document_id}:", prompt)
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
                response = await self.robust_generate(None, message, model="gemini-2.0-flash-lite", additional_files=additional_files)
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
    
    def _get_base_prompt(self) -> str:
        example_description = '''This document presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points. The proof is outlined, focusing on one direction of the implication. It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex. The underlining highlights the key steps and conclusions of the proof. The notation "pf" indicates "proof," and the double-headed arrow indicates the "if and only if" nature of the theorem. The term "conv. comb." is an abbreviation for "convex combination." The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''

        instructions = f'''Provide a detailed description of the content, in the context of the course: ${self.course_title}.

        Describe what you see, including specific details that would not be known unless you were given the context of the slide. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX notation (enclosed in $ signs) to describe any mathematical content you see on the slide.

        Here is an example of a good description:

        {example_description}'''

        return instructions
    
    def _get_additional_prompt(self) -> str:
        return """In addition, you should be concise and to the point, and not be too specific for the one page, since the document may continue.
        
        Here is an example to show how you should output your answer: 
    
        This document continues the proof of Theorem 10.1 from the previous page, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof."""
    
    def _get_prompt_for_file_type(self, document: Dict[str, Any]) -> str:
        """Generate an appropriate prompt based on the file type"""
        
        base_prompt = self._get_base_prompt()
        additional_prompt = self._get_additional_prompt()
        
        if self.file_type == 'pdf':
            page_number = document.get('page', 1)
            return f"{base_prompt}\n\n{additional_prompt}\n\nNow it is your turn. This is page {page_number} of a PDF document. Follow the above instructions: "
        
        elif self.file_type == 'audio':
            start_time = int(document.get('start_time', 0))
            end_time = int(document.get('end_time', 0))
            # Handle None values by defaulting to 0
            start_time = 0 if start_time is None else start_time
            end_time = 0 if end_time is None else end_time
            start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
            end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
            
            return f"{base_prompt}\n\n{additional_prompt}\n\nNow it is your turn. This is an audio segment from {start_time_fmt} to {end_time_fmt}. Follow the above instructions: "
        
        elif self.file_type in ['video']:
            start_time = int(document.get('start_time', 0))
            end_time = int(document.get('end_time', 0))
            # Handle None values by defaulting to 0
            start_time = 0 if start_time is None else start_time
            end_time = 0 if end_time is None else end_time
            start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
            end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
            
            return f"{base_prompt}\n\n{additional_prompt}\n\nNow it is your turn. This is a video segment from {start_time_fmt} to {end_time_fmt}. Follow the above instructions: "
        
        elif self.file_type == 'image':
            return f"{base_prompt}\n\n{additional_prompt}\n\nNow it is your turn. This is an image. Follow the above instructions: "
        
        else:
            return f"{base_prompt}\n\n{additional_prompt}\n\nNow it is your turn. Follow the above instructions: "