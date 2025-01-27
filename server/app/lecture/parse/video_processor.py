from typing import List
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
import torch
from moviepy.editor import VideoFileClip
from PIL import Image
import numpy as np
import whisper

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

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
        # Load model with specified device
        self.model = whisper.load_model("base").to(self.device)


    def transcribe_video(self, file_path):
        """
        Transcribe the video by calling the whisper api.
        """
        result = self.model.transcribe(file_path)
        return result["text"]
    
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