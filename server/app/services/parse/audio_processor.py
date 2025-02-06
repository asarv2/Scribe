import whisper
import torch
import tempfile

class AudioProcessor():
    def __init__(self):
        super().__init__()
        # Initialize whisper model
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {self.device}")
        self.model = whisper.load_model("base").to(self.device)

    def transcribe(self, audio_bytes: bytes) -> str:
        # Create a temporary file to store the audio
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=True) as temp_audio:
            # Write the audio bytes to the temporary file
            temp_audio.write(audio_bytes)
            temp_audio.flush()  # Ensure all data is written
            
            # Load and transcribe the audio
            audio = whisper.load_audio(temp_audio.name)
            result = self.model.transcribe(audio)
            return result["text"]
