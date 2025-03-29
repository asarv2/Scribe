from typing import List, Dict, Any, Optional, Callable
import base64
from app.services.base_processor import BaseProcessor, CleanedResponse, Message
from app.config import model_manager, MODEL_REGISTRY
import concurrent.futures
import asyncio
import google.generativeai as genai
import torch
import gc

class LectureProcessor(BaseProcessor):
    def __init__(self, course_title: str):
        super().__init__()
        self.course_title = course_title
        self.notes: Dict[str, Dict[int, CleanedResponse]] = {}
        self.conversation_history: List[Message] = []

    def parse_bbox(self, bbox: str) -> List[int]:
        bbox = bbox.strip().replace('[', '').replace(']', '')
        try:
            ymin, xmin, ymax, xmax = map(
                lambda x: int(x.strip()),
                bbox.split(',')
            )
            return [ymin, xmin, ymax, xmax]
        except:
            print(f"Warning: Could not parse bbox {bbox}, using default values")
            return [0, 0, 1000, 1000]

    def clean_response(
        self,
        response: str,
        lecture_name: str,
        page_number: int,
        text: str
    ) -> CleanedResponse:
        cleaned_response = CleanedResponse(
            page=page_number,
            description=response.strip(),
            text=text
        )

        if lecture_name not in self.notes:
            self.notes[lecture_name] = {}
        self.notes[lecture_name][page_number] = cleaned_response

        return cleaned_response
    
    async def process_slides(
        self,
        lecture_name: str,
        num_slides: int,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedResponse], None],
    ) -> List[CleanedResponse]:
        try:
            # Determine the content type based on the first document
            content_type = documents[0].get('type', 'pdf_page') if documents else 'pdf_page'
            
            if content_type in ['audio_chunk', 'video_chunk']:
                return await self._process_audio_video(lecture_name, documents, after_generate)
            else:
                return await self._process_pdf_slides(lecture_name, num_slides, documents, after_generate)
        except Exception as error:
            print("Error processing content:", error)
            raise error
    
    async def _process_pdf_slides(
        self,
        lecture_name: str,
        num_slides: int,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedResponse], None],
    ) -> List[CleanedResponse]:
        """Process PDF slides"""
        try:
            # Prepare all prompts and images
            images = []
            prompts = []
            page_numbers = []
            text_contents = []
            
            for document in documents:
                # Get prompts
                base_prompt = self._get_base_prompt()
                additional_prompt = self._get_additional_prompt(document['page'], num_slides)
                combined_prompt = base_prompt + "\n\n" + additional_prompt
                
                images.append(document['image'])
                prompts.append(combined_prompt)
                page_numbers.append(document['page'])
                text_contents.append(document['text'])
            
            results = []
            # In non-private mode, use Gemini by default
            print("Processing PDF slides using Gemini")
            for i in range(len(images)):
                try:
                    base64_image = base64.b64encode(images[i]).decode('utf-8')
                    
                    message = Message(content=[
                        {
                            "type": "image_url",
                            "image_url": f"data:image/png;base64,{base64_image}"
                        },
                        {
                            "type": "text",
                            "text": prompts[i]
                        },
                        *([] if not text_contents[i] else [{"type": "text", "text": text_contents[i]}])
                    ])

                    self.conversation_history.append(message)
                    
                    response = await self.robust_generate(
                        None,
                        message,
                        model="gemini-2.0-flash-lite"
                    )
                    
                    if not response:
                        raise Exception(f"Empty response from Gemini for page {page_numbers[i]}")
                    
                    print(f"Successfully processed page {page_numbers[i]} with Gemini")
                    
                    self.conversation_history.append(Message(content=[{"type": "text", "text": response}]))
                    
                    result = self.clean_response(
                        response,
                        lecture_name,
                        page_numbers[i],
                        text_contents[i]
                    )
                    results.append(result)
                    await after_generate(result)
                except Exception as e:
                    print(f"Error processing page {page_numbers[i]}: {str(e)}")
                    result = self.clean_response(
                        f"Error: {str(e)}",
                        lecture_name,
                        page_numbers[i],
                        text_contents[i]
                    )
                    results.append(result)
                    await after_generate(result)
            
            return results
        except Exception as error:
            print("Error processing PDF:", error)
            raise error
    
    async def _process_audio_video(
        self,
        lecture_name: str,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedResponse], None],
    ) -> List[CleanedResponse]:
        """Process audio or video chunks with resource-aware processing"""
        try:
            # Sort documents by page/chunk number to ensure proper ordering
            documents.sort(key=lambda x: x.get('page', x.get('chunk_num', 0)))
            
            content_type = "video" if documents[0].get('type', '') == 'video_chunk' else "audio"
            
            # Determine processing approach based on available resources
            is_cpu_only = not torch.cuda.is_available()
            available_models = len(MODEL_REGISTRY["whisper_models"]) if MODEL_REGISTRY["whisper_initialized"] else 1
            
            # Use sequential processing for CPU-only environments with 1 model
            if is_cpu_only and available_models <= 1:
                print(f"Processing {len(documents)} {content_type} chunks sequentially (CPU-only mode)")
                results = []
                for i, document in enumerate(documents):
                    print(f"Processing {content_type} chunk {i+1}/{len(documents)}")
                    result = await self._process_audio_video_chunk(document, lecture_name, after_generate)
                    results.append(result)
                    print(f"Finished processing chunk {i+1}/{len(documents)}")
                    
                    # Force garbage collection after each chunk in CPU mode
                    gc.collect()
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
            else:
                # Use concurrent processing for GPU or multiple CPU models
                max_workers = min(available_models, len(documents))
                print(f"Processing {len(documents)} {content_type} chunks with {max_workers} concurrent workers")
                
                # Create tasks for each document
                tasks = []
                for document in documents:
                    task = self._process_audio_video_chunk(document, lecture_name, after_generate)
                    tasks.append(task)
                
                # Process chunks concurrently with asyncio
                results = await asyncio.gather(*tasks)
            
            # Sort results by page number to maintain order
            results.sort(key=lambda x: x.page)
            
            return results
        except Exception as error:
            print(f"Error processing {content_type}:", error)
            raise error

    async def _process_audio_video_chunk(
        self,
        document: Dict[str, Any],
        lecture_name: str,
        after_generate: Callable[[CleanedResponse], None],
    ) -> CleanedResponse:
        """Process a single audio or video chunk"""
        try:
            # Extract document information
            chunk_num = document.get('page', 0)
            text_content = document.get('text', '')
            file_name = document.get('file_name', '')
            content_type = "video" if document.get('type', '') == 'video_chunk' else "audio"
            
            # Format start and end times
            start_time = document.get('start_time', 0)
            end_time = document.get('end_time', 0)
            
            # Handle None values
            start_time = 0 if start_time is None else start_time
            end_time = 0 if end_time is None else end_time
            
            # Format times as MM:SS
            start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
            end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
            
            # Generate prompt based on content type
            prompt = self._get_media_prompt(content_type, chunk_num, start_time_fmt, end_time_fmt)
            
            # Prepare message content
            message_content = []
            additional_files = []
            
            # For video, include the image if available
            if content_type == "video" and "image" in document and document["image"]:
                base64_image = base64.b64encode(document["image"]).decode('utf-8')
                message_content.append({
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                })
            
            # For audio/video, use the Gemini file_name if available
            if file_name:
                try:
                    file_context = self._get_file_from_gemini(file_name)
                    if file_context:
                        additional_files.append(file_context)
                        print(f"Successfully retrieved file from Gemini: {file_name}")
                    else:
                        print(f"File not found in Gemini: {file_name}")
                except Exception as e:
                    print(f"Error getting file from Gemini: {str(e)}")
            
            # Add prompt to message
            message_content.append({
                "type": "text",
                "text": prompt
            })
            
            # Add transcription if available
            if text_content:
                message_content.append({
                    "type": "text",
                    "text": f"Transcription: {text_content}"
                })
            
            # Create message
            message = Message(content=message_content)
            
            # Generate response using Gemini
            try:
                model = "gemini-2.0-flash-lite"
                response = await self.robust_generate(None, message, model=model, additional_files=additional_files)
                
                if not response:
                    response = f"Failed to generate description for {content_type} segment {chunk_num}."
                    print(f"Warning: Empty response for {content_type} chunk {chunk_num}")
            except Exception as e:
                print(f"Error generating response for {content_type} chunk {chunk_num}: {str(e)}")
                response = f"Error processing {content_type} segment {chunk_num}: {str(e)}"
            
            # Create result
            result = self.clean_response(
                response,
                lecture_name,
                chunk_num,
                text_content
            )
            
            # Call the after_generate callback
            await after_generate(result)
            
            return result
        except Exception as e:
            print(f"Error processing chunk {document.get('page', 0)}: {str(e)}")
            result = self.clean_response(
                f"Error: {str(e)}",
                lecture_name,
                document.get('page', 0),
                document.get('text', '')
            )
            await after_generate(result)
            return result
    
    def _get_file_from_gemini(self, file_name: str) -> Any:
        """Get a file from Gemini by name"""
        try:
            response = genai.get_file(file_name)
            if response.state.name == "ACTIVE":
                return response
        except Exception as e:
            print(f"Error getting file from Gemini: {str(e)}")
        return None
    
    def _get_media_prompt(self, content_type: str, chunk_num: int, start_time: str, end_time: str) -> str:
        """Generate a prompt for audio or video content"""
        base = f"You are analyzing content from the course: {self.course_title}."
        
        if content_type == "audio":
            return f"""{base}

This is audio segment {chunk_num} from {start_time} to {end_time}. 

Based on the transcription provided, please summarize the key points discussed in this segment. Identify any important concepts, definitions, or examples mentioned. Format your response as a detailed description that would be helpful for a student reviewing this lecture.

Be specific about the content and include any technical terms, formulas, or concepts mentioned. Use LaTeX notation (enclosed in $ signs) for any mathematical content."""
        
        else:  # video
            return f"""{base}

This is video segment {chunk_num} from {start_time} to {end_time}.

Based on the visual content and transcription provided, please describe what you see in the frame and summarize the key points discussed in this segment. Identify any important concepts, definitions, or examples shown or mentioned. Format your response as a detailed description that would be helpful for a student reviewing this lecture.

Be specific about both the visual elements and the spoken content. Include any technical terms, formulas, or concepts mentioned. Use LaTeX notation (enclosed in $ signs) for any mathematical content."""

    def _get_base_prompt(self) -> str:
        example_description = '''This slide presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points. The proof is outlined, focusing on one direction of the implication. It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex. The underlining highlights the key steps and conclusions of the proof. The notation "pf" indicates "proof," and the double-headed arrow indicates the "if and only if" nature of the theorem. The term "conv. comb." is an abbreviation for "convex combination." The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''

        instructions = f'''Provide a detailed description of the content from the lecture slides, in the context of the course: ${self.course_title}.

        Describe what you see, including specific details that would not be known unless you were given the context of the slide. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX notation (enclosed in $ signs) to describe any mathematical content you see on the slide.

        Here is an example of a good description:

        {example_description}'''

        return instructions

    def _get_additional_prompt(self, page_number: int, num_pages: int) -> str:
        example_description = '''This slide continues the proof of Theorem 10.1 from the previous slide, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof.'''

        prompt = (
            f"Use the previous slide's description to help you understand the context of the current slide. "
            f"Here is an example of a good description:\n\n"
            f"{example_description}\n\n"
            f"Now it's your turn. Please describe SLIDE {page_number} of {num_pages}: "
        )

        return prompt