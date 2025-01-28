from typing import List, Dict, Any, Optional, Union, Callable
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
import torch
from moviepy.editor import VideoFileClip
from PIL import Image
import numpy as np
import whisper
from langchain_core.messages import AIMessage, HumanMessage
import base64
import io
import os
from app.services.base_processor import BaseProcessor

class VideoProcessor(BaseProcessor):
    def __init__(self, course_title: str, video_name: str, video_path: str):
        super().__init__()
        self.course_title = course_title
        self.conversation_history: List[Union[HumanMessage, AIMessage]] = []
        self.video_name = video_name
        self.video_path = video_path
        # Initialize whisper model
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        self.model = whisper.load_model("base").to(self.device)

    def clean_response(
        self,
        response: str,
    ) -> Dict[str, Any]:
        import re
        
        # Extract timestamp
        timestamp_match = re.search(r'<TIMESTAMP>(.*?)</TIMESTAMP>', response, re.DOTALL)
        timestamp = int(timestamp_match.group(1).strip()) if timestamp_match else 1
        
        # Extract description
        description_match = re.search(r'<DESCRIPTION>(.*?)</DESCRIPTION>', response, re.DOTALL)
        description = description_match.group(1).strip() if description_match else ""

        cleaned_response = {
            "timestamp": timestamp,
            "description": description
        }

        print(f"Cleaned response: {cleaned_response}")
        return cleaned_response

    async def process_chunk(
        self,
        images: List[Image.Image],
        transcript: str,
    ) -> Dict[str, Any]:
        try:
            # Convert images to base64
            base64_images = []
            for img in images:
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                img_byte_arr = img_byte_arr.getvalue()
                base64_image = base64.b64encode(img_byte_arr).decode('utf-8')
                base64_images.append({
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                })
            
            # Create message content
            message_content = [
                *base64_images,
                {
                    "type": "text",
                    "text": self._get_base_prompt() + "\n\n" + transcript
                }
            ]

            message = HumanMessage(content=message_content)
            self.conversation_history.append(message)

            # Generate response using AI
            response = await self.robust_generate(message)
            self.conversation_history.append(AIMessage(content=response))

            return self.clean_response(response)

        except Exception as error:
            print(f"Error processing chunk: {error}")
            raise

    def _get_base_prompt(self) -> str:
        example_timestamp = '''
        <TIMESTAMP>45</TIMESTAMP>'''

        example_description = '''
        <DESCRIPTION>In this lecture segment, the professor explains the concept of convex sets in linear programming. The key moment occurs at timestamp 45, where they illustrate this using a detailed example on the whiteboard. They begin by defining what makes a set convex, emphasizing that a line segment between any two points in the set must lie entirely within the set. The professor then works through several examples, showing both convex and non-convex sets, and explains why this property is crucial for optimization problems. They particularly focus on how convexity ensures that local optima are also global optima, making the optimization process more reliable. Throughout the explanation, they use multiple visual aids and mathematical notations to reinforce the concepts.</DESCRIPTION>'''

        instructions = f'''Follow these instructions carefully to analyze the video frames from the video: {self.video_name}. This is in the context of the course: {self.course_title}.

        1. Identify the most important moment in the lecture by specifying the frame number (1-60) where the key concept or explanation occurs. Use <TIMESTAMP> and </TIMESTAMP> tags to enclose this number. Example:
        {example_timestamp}

        2. Provide a detailed description of the lecture content, focusing on the main concepts, explanations, and their significance. Be specific about what was taught and how it relates to the course material. Use <DESCRIPTION> and </DESCRIPTION> tags to enclose the description. Example:
        {example_description}

        Remember to maintain academic language and incorporate any mathematical concepts using clear explanations. Focus on the educational content and its significance in the broader context of the course.'''

        return instructions
    
    async def process_video(self, after_generate: Callable):
        """
        Process video file in chunks and generate documents
        """
        try:
            # Load video
            video = VideoFileClip(self.video_path)
            duration = video.duration
            
            # Process in 60-second chunks
            chunk_duration = 60
            for chunk_idx in range(int(duration // chunk_duration) + 1):
                start_time = chunk_idx * chunk_duration
                end_time = min((chunk_idx + 1) * chunk_duration, duration)
                
                # Extract frames and audio for this chunk
                frames = self._extract_frames(video, start_time, end_time)
                audio_chunk = self._extract_audio(video, start_time, end_time)
                
                # Process chunk
                transcript = self._transcribe_video(audio_chunk)
                
                # Convert frames to PIL Images and process
                pil_frames = [Image.fromarray(frame) for frame in frames]
                response = await self.process_chunk(pil_frames, transcript)
                
                # Convert the selected frame to bytes
                frame_idx = response["timestamp"] - 1  # Convert 1-based to 0-based index
                if 0 <= frame_idx < len(pil_frames):
                    selected_frame = pil_frames[frame_idx]
                    img_byte_arr = io.BytesIO()
                    selected_frame.save(img_byte_arr, format='PNG')
                    img_bytes = img_byte_arr.getvalue()
                else:
                    # Fallback to first frame if timestamp is invalid
                    img_byte_arr = io.BytesIO()
                    pil_frames[0].save(img_byte_arr, format='PNG')
                    img_bytes = img_byte_arr.getvalue()

                # Call the callback function
                after_generate(
                    transcript,
                    response["description"],
                    chunk_idx,
                    img_bytes
                )

        finally:
            # Clean up
            video.close()
            # if os.path.exists(self.video_path):
            #     os.remove(self.video_path)

    def _extract_frames(self, video: VideoFileClip, start_time: float, end_time: float) -> List[np.ndarray]:
        """Extract one frame per second from the video chunk"""
        frames = []
        for t in range(int(start_time), int(end_time)):
            frame = video.get_frame(t)
            frames.append(frame)
        return frames

    def _extract_audio(self, video: VideoFileClip, start_time: float, end_time: float) -> str:
        """Extract audio chunk and save to temporary file"""
        # Get lecture directory from video path
        lecture_dir = os.path.dirname(self.video_path)
        temp_audio_path = os.path.join(lecture_dir, f"audio_{start_time}_{end_time}.wav")
        try:
            audio_chunk = video.subclip(start_time, end_time).audio
            if audio_chunk:
                audio_chunk.write_audiofile(temp_audio_path, fps=16000)
                return temp_audio_path
            else:
                return None
        except Exception as e:
            print(f"Error extracting audio: {e}")
            raise

    def _transcribe_video(self, audio_path: str | None) -> str:
        """Transcribe the audio using Whisper"""
        try:
            if audio_path is None:
                return ""
            result = self.model.transcribe(audio_path)
            
            # Save transcript to file
            lecture_dir = os.path.dirname(self.video_path)
            transcript_path = os.path.join(lecture_dir, "transcript.txt")
            
            # Append to transcript file with timestamp
            with open(transcript_path, 'a', encoding='utf-8') as f:
                timestamp = os.path.basename(audio_path).split('_')[1]  # Get start time from filename
                f.write(f"\n[Time: {timestamp}s]\n{result['text']}\n")
            
            return result["text"]
        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
