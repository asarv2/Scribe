# config.py
import os
import torch
import threading
from transformers import AutoModelForCausalLM, AutoProcessor, GenerationConfig
import time
import gc
from app.extensions import MODEL_CACHE_DIR
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
                
                # Define cache locations
                cls._instance.cache_dir = MODEL_CACHE_DIR  # Local directory to cache the model
                cls._instance.model_save_path = os.path.join(cls._instance.cache_dir, "phi4_model")
                cls._instance.processor_save_path = os.path.join(cls._instance.cache_dir, "phi4_processor")
                
                # Create cache directory if it doesn't exist
                os.makedirs(cls._instance.cache_dir, exist_ok=True)
                
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

    def load_model(self):
        """Load model from cache if available, otherwise download and cache"""
        with self._lock:
            # Return existing model if already loaded
            if self.model is not None and self.processor is not None:
                return self.model, self.processor
                
            total_free_gb = self.get_gpu_memory()
            if total_free_gb < 20:
                raise RuntimeError("Insufficient GPU memory. Need at least 20GB available. Found: " + str(total_free_gb))

            # Force garbage collection before loading model
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.memory.empty_cache()
            
            # Check if model and processor are already saved locally
            if os.path.exists(self.model_save_path) and os.path.exists(self.processor_save_path):
                print("Loading model and processor from local cache...")
                load_start = time.time()
                
                # Always load processor from original path to ensure compatibility
                self.processor = AutoProcessor.from_pretrained(
                    self.model_name,
                    trust_remote_code=True,
                    use_fast=False
                )
                
                # Load model from local cache
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_save_path,
                    device_map="auto",
                    max_memory={0: "12GiB", 1: "12GiB"},
                    torch_dtype="auto",
                    trust_remote_code=True,
                    _attn_implementation='flash_attention_2',
                )
                
                load_time = time.time() - load_start
                print(f"Model loaded from cache in {load_time:.2f} seconds")
            else:
                print("Downloading model and processor from Hugging Face hub...")
                download_start = time.time()
                
                # Load processor from HF hub
                self.processor = AutoProcessor.from_pretrained(
                    self.model_name,
                    trust_remote_code=True,
                    use_fast=False,
                )
                
                # Load model from HF hub
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_name,
                    device_map="auto",
                    max_memory={0: "12GiB", 1: "12GiB"},
                    torch_dtype="auto",
                    trust_remote_code=True,
                    _attn_implementation='flash_attention_2',
                    cache_dir=self.cache_dir
                )
                
                download_time = time.time() - download_start
                print(f"Model downloaded in {download_time:.2f} seconds")
                
                # Save model locally for faster loading next time
                print("Saving model to local cache...")
                save_start = time.time()
                self.model.save_pretrained(self.model_save_path)
                save_time = time.time() - save_start
                print(f"Model saved to cache in {save_time:.2f} seconds")
            
            # Load generation config
            self.generation_config = GenerationConfig.from_pretrained(self.model_name)
            
            # Enable performance optimizations
            if torch.cuda.is_available():
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
                torch.backends.cudnn.benchmark = True
            
            return self.model, self.processor
    
    def get_model(self):
        if self.model is None or self.processor is None:
            self.model, self.processor = self.load_model()
        return self.model, self.processor

    def warm_up_model(self):
        """Warm up the model to optimize first inference"""
        if self.model is None or self.processor is None:
            self.model, self.processor = self.load_model()
            
        print("Warming up model...")
        warm_up_start = time.time()
        
        with torch.no_grad():
            # Use a simple prompt for warm-up
            warm_up_text = f"{self.user_prompt}Describe a lecture slide.{self.prompt_suffix}{self.assistant_prompt}"
            warm_up_inputs = self.processor(text=warm_up_text, return_tensors='pt').to(self.model.device)
            _ = self.model(**warm_up_inputs)
            
        warm_up_time = time.time() - warm_up_start
        print(f"Model warm-up completed in {warm_up_time:.2f} seconds")

# Initialize model manager
model_manager = ModelManager()