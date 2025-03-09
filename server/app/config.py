# config.py
import os
import torch
from typing import Tuple
from transformers import AutoModelForCausalLM, AutoProcessor

class ModelManager:
    def __init__(self):
        self.model_name = "microsoft/Phi-4-multimodal-instruct"
        self.model = None
        self.processor = None
        self.generation_config = None
        # Add prompt structure
        self.user_prompt = '<|user|>'
        self.assistant_prompt = '<|assistant|>'
        self.prompt_suffix = '<|end|>'
        

    def get_gpu_memory(self) -> float:
        """Get combined available GPU memory"""
        try:
            if not torch.cuda.is_available():
                return 0
                
            total_free_memory = 0
            for i in range(torch.cuda.device_count()):
                free_memory = torch.cuda.get_device_properties(i).total_memory - torch.cuda.memory_allocated(i)
                total_free_memory += free_memory
            
            # Convert bytes to GB
            total_free_gb = total_free_memory / (1024**3)
            return total_free_gb
            
        except Exception as e:
            print(f"Error checking GPU memory: {e}")
            return 0

    def load_model(self) -> Tuple[AutoModelForCausalLM, AutoProcessor]:
        """Load model if sufficient GPU memory is available"""
        total_free_gb = self.get_gpu_memory()
        if total_free_gb < 20:
            raise RuntimeError("Insufficient GPU memory. Need at least 20GB available. Found: " + str(total_free_gb))

        processor = AutoProcessor.from_pretrained(
            self.model_name,
            trust_remote_code=True
        )

        model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            device_map="auto",
            max_memory={0: "12GiB", 1: "12GiB"},
            torch_dtype="auto",
            trust_remote_code=True,
            _attn_implementation='flash_attention_2'
        )

        return model, processor

# Initialize model manager
model_manager = ModelManager()