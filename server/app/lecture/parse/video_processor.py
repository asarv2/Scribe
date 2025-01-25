from typing import List
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from app.lecture.parse.video_transcriber import VideoTranscriber
from moviepy import *
from PIL import Image
import numpy as np

class VideoProcessor:
    def __init__(self):
        load_dotenv()  # Load environment variables
                
        self.response_schema = [{
            "timestamp": "str",
            "latex": "str",
            "figures": [{
                "ymin": "int",
                "ymax": "int",
                "xmin": "int",
                "xmax": "int",
                "description": "str"
            }]
            ,"description": "str"
        }]
        
        self.llm = ChatGoogleGenerativeAI(
            model='gemini-1.5-flash-8b',
            temperature=0, 
            max_tokens=None, 
            timeout=None, 
            max_retries=2
        )
        
        self.base_prompt = """
        You are a video processor that transcribes videos and generates documents from the transcript.
        """
        
        self.transcriber = VideoTranscriber()



    def transcribe_video(self, file_path):
        """
        Transcribe the video by calling the whisper api.
        """
        transcript = self.transcriber.transcribe_video(file_path)
        return transcript
    
    def process_video(self, file_path):
        """
        Process the video by splitting it into frames (1 per second) and returning a list of photos.
        """
        def convert_timestamp(timestamp):
            return f"{timestamp // 60:02d}:{timestamp % 60:02d}"
        
        video = VideoFileClip(file_path)
        frames = []
        for timestamp in range(int(video.duration)):
            # Extract frame at current timestamp
            frame = video.get_frame(timestamp)
            # Convert numpy array to PIL Image
            pil_image = Image.fromarray(np.uint8(frame))
            frames.append((convert_timestamp(timestamp), pil_image))
        
        video.close()
        return frames

    def generate_documents(self, photos: List[tuple[str, Image.Image]], transcript: str):
        """
        Generate documents from the transcript. This will call gemini api and return a list defined by the json_schema.
        """
        # response = self.llm.invoke(
        #     prompt=self.base_prompt,
        #     schema=self.response_schema,
        #     schema_description="A list of documents with the following fields: timestamp, latex, figures, and description."
        # )
        # return response
        return {
            "transcript": transcript,
            "photos": photos
        }