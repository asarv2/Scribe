# config.py
import os
import torch
from typing import Tuple
import threading
from transformers import AutoModelForCausalLM, AutoProcessor

class ModelManager:
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelManager, cls).__new__(cls)
                cls._instance.model_name = "microsoft/Phi-4-multimodal-instruct"
                cls._instance.model = None
                cls._instance.processor = None
                cls._instance.generation_config = None
                # Add prompt structure
                cls._instance.user_prompt = '<|user|>'
                cls._instance.assistant_prompt = '<|assistant|>'
                cls._instance.prompt_suffix = '<|end|>'
        return cls._instance
    
    def __init__(self):
        # The initialization is done in __new__
        pass

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
        with self._lock:
            # Return existing model if already loaded
            if self.model is not None and self.processor is not None:
                return self.model, self.processor
                
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

            self.model = model
            self.processor = processor
            return model, processor
    
    def get_model(self) -> Tuple[AutoModelForCausalLM, AutoProcessor]:
        if self.model is None or self.processor is None:
            self.model, self.processor = self.load_model()
        return self.model, self.processor

# Initialize model manager
model_manager = ModelManager()