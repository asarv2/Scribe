# config.py
import os
import torch
import threading
from transformers import AutoModelForCausalLM, AutoProcessor, GenerationConfig
import time
import gc
from app.extensions import MODEL_CACHE_DIR

# Global model registry - single source of truth
MODEL_REGISTRY = {
    "model": None,
    "processor": None,
    "initialized": False,
    "lock": threading.Lock()
}

class ModelManager:
    def __init__(self):
        self.model_path = "microsoft/Phi-4-multimodal-instruct"
        self.cache_dir = MODEL_CACHE_DIR
        self.model_save_path = os.path.join(self.cache_dir, "phi4_model")
        
        # Create cache directory if it doesn't exist
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Prompt templates
        self.user_prompt = "<|user|>\n"
        self.assistant_prompt = "<|assistant|>\n"
        self.prompt_suffix = "\n"

    def get_gpu_memory(self) -> float:
        """Get combined available GPU memory"""
        try:
            if not torch.cuda.is_available():
                return 0
                
            total_free_memory = 0
            for i in range(torch.cuda.device_count()):
                free_memory = torch.cuda.get_device_properties(i).total_memory - torch.cuda.memory_allocated(i)
                total_free_memory += free_memory
                
            return total_free_memory / 1024**3  # Convert to GB
        except Exception as e:
            print(f"Error getting GPU memory: {e}")
            return 0
    
    def get_model(self):
        """Get model from global registry or load it if not available"""
        global MODEL_REGISTRY
        
        # If model is already loaded in registry, return it
        if MODEL_REGISTRY["initialized"]:
            return MODEL_REGISTRY["model"], MODEL_REGISTRY["processor"]
        
        # Use lock to prevent multiple workers from loading the model simultaneously
        with MODEL_REGISTRY["lock"]:
            # Check again in case another thread loaded the model while waiting
            if MODEL_REGISTRY["initialized"]:
                return MODEL_REGISTRY["model"], MODEL_REGISTRY["processor"]
            
            # Check if this is a GPU worker or if GPU is available
            is_gpu_worker = os.environ.get('GPU_WORKER') == 'true'
            has_gpu = torch.cuda.is_available()
            
            if not (is_gpu_worker and has_gpu):
                raise RuntimeError("Model loading requires GPU worker with available GPU")
            
            total_free_gb = self.get_gpu_memory()
            if total_free_gb < 20:
                raise RuntimeError("Insufficient GPU memory. Need at least 20GB available. Found: " + str
                (total_free_gb))
            
            print("Downloading model and processor from Hugging Face hub...")
            start_time = time.time()

            # Force garbage collection before loading model
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.memory.empty_cache()

            # Check if model is already saved locally
            if os.path.exists(self.model_save_path):
                print("Loading model from local cache...")
                processor = AutoProcessor.from_pretrained(self.model_path, trust_remote_code=True, use_fast=False)
                model = AutoModelForCausalLM.from_pretrained(
                    self.model_save_path,
                    device_map="auto",
                    max_memory={0: "12GiB", 1: "12GiB"},
                    torch_dtype="auto",
                    trust_remote_code=True,
                    _attn_implementation='flash_attention_2',
                )
                
                load_time = time.time() - start_time
                print(f"Model loaded from cache in {load_time:.2f} seconds")
            else:
                # Download model from Hugging Face
                processor = AutoProcessor.from_pretrained(self.model_path, trust_remote_code=True, use_fast=False)
                model = AutoModelForCausalLM.from_pretrained(
                    self.model_path,
                    device_map="auto",
                    max_memory={0: "12GiB", 1: "12GiB"},
                    torch_dtype="auto",
                    trust_remote_code=True,
                    _attn_implementation='flash_attention_2',
                    cache_dir=self.cache_dir
                )
                
                download_time = time.time() - start_time
                print(f"Model downloaded in {download_time:.2f} seconds")
                
                # Save model locally for faster loading next time
                print("Saving model to local cache...")
                save_start = time.time()
                model.save_pretrained(self.model_save_path)
                print(f"Model saved to cache in {time.time() - save_start:.2f} seconds")
            
            
            # Store in global registry
            MODEL_REGISTRY["model"] = model
            MODEL_REGISTRY["processor"] = processor
            MODEL_REGISTRY["initialized"] = True
            
            # Enable performance optimizations
            if torch.cuda.is_available():
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
                torch.backends.cudnn.benchmark = True
            
            # Run garbage collection to free memory
            gc.collect()
            torch.cuda.empty_cache()
            
            return model, processor
    
    def warm_up_model(self):
        """Warm up the model with a simple inference to optimize first real request"""
        if not MODEL_REGISTRY["initialized"]:
            return
            
        print("Warming up model...")
        warm_up_start = time.time()
        
        model = MODEL_REGISTRY["model"]
        processor = MODEL_REGISTRY["processor"]
        
        with torch.no_grad():
            # Use a simple prompt for warm-up
            warm_up_text = f"{self.user_prompt}Describe a lecture slide.{self.prompt_suffix}{self.assistant_prompt}"
            warm_up_inputs = processor(text=warm_up_text, return_tensors='pt').to(model.device)
            _ = model(**warm_up_inputs)
            
        warm_up_time = time.time() - warm_up_start
        print(f"Model warm-up completed in {warm_up_time:.2f} seconds")

# Initialize model manager
model_manager = ModelManager()