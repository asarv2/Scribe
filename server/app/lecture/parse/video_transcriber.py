import whisper
import torch

class VideoTranscriber:
    def __init__(self):
        # Check if CUDA is available
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        
        # Load model with specified device
        self.model = whisper.load_model("base").to(self.device)

    def transcribe_video(self, file_path):
        result = self.model.transcribe(file_path)
        return result["text"]