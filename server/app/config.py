# config.py
import os
from typing import Optional, Tuple, TYPE_CHECKING

from app.extensions import MODELS_FOLDER

if TYPE_CHECKING:
    from transformers import AutoModelForCausalLM, AutoProcessor

class ModelManager:
    def __init__(self):
        self.model = None
        self.processor = None
        self.generation_config = None
        self.model_name = "microsoft/Phi-4-multimodal-instruct"
        self.local_model_path = os.path.join(MODELS_FOLDER, "phi-4-multimodal-instruct")
        # Add prompt structure
        self.user_prompt = '<|user|>'
        self.assistant_prompt = '<|assistant|>'
        self.prompt_suffix = '<|end|>'

    def download_model(self) -> None:
        """Download the model from HuggingFace"""
        try:
            from transformers import AutoModelForCausalLM, AutoProcessor, GenerationConfig

            print(f"Downloading model to {self.local_model_path}...")
            
            # Download processor
            processor = AutoProcessor.from_pretrained(
                self.model_name,
                trust_remote_code=True
            )
            processor.save_pretrained(self.local_model_path)

            # Download model
            model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype="auto",
                trust_remote_code=True
            )
            model.save_pretrained(self.local_model_path)

            # Download generation config
            generation_config = GenerationConfig.from_pretrained(self.model_name)
            generation_config.save_pretrained(self.local_model_path)
            
            print("Model downloaded successfully")
            
        except Exception as e:
            print(f"Error downloading model: {str(e)}")
            raise

    def load_model(self) -> Tuple[Optional['AutoModelForCausalLM'], Optional['AutoProcessor']]:
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoProcessor, GenerationConfig
            from transformers import BitsAndBytesConfig

            device = "cuda" if torch.cuda.is_available() else "cpu"
            
            if device == "cuda":
                try:
                    import flash_attn  # type: ignore
                    import accelerate # type: ignore
                    _ = flash_attn.__version__
                    attn_implementation = "flash_attention_2"
                except ImportError:
                    print("Warning: GPU detected but flash-attention not installed. Using eager implementation.")
                    attn_implementation = "eager"
            else:
                print("Warning: Running on CPU. This model performs best with NVIDIA GPUs")
                attn_implementation = "eager"

            if not os.path.exists(self.local_model_path):
                print("Model not found locally. Downloading...")
                self.download_model()

            print(f"Loading model from {self.local_model_path}...")
            
            # Configure 4-bit quantization
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
            )

            # Load processor from local path
            self.processor = AutoProcessor.from_pretrained(
                self.local_model_path,
                trust_remote_code=True
            )

            # Load model with quantization
            self.model = AutoModelForCausalLM.from_pretrained(
                self.local_model_path,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True,
                quantization_config=quantization_config,
                _attn_implementation=attn_implementation
            )

            # Load generation config
            self.generation_config = GenerationConfig.from_pretrained(self.model_name)

            if device == "cuda":
                self.model.cuda()
                
            print("Model loaded successfully")
            return self.model, self.processor

        except Exception as e:
            print(f"Error loading model: {str(e)}")
            self.model = None
            self.processor = None
            raise

    def get_model(self) -> Tuple[Optional['AutoModelForCausalLM'], Optional['AutoProcessor']]:
        if self.model is None or self.processor is None:
            return self.load_model()
        return self.model, self.processor
    
# Initialize model manager
model_manager = ModelManager()