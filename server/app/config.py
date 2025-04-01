# config.py
import os
import torch
import threading
import time
import gc
from app.extensions import MODEL_CACHE_DIR

# Global model registry - single source of truth
MODEL_REGISTRY = {
    "whisper_models": [],
    "whisper_initialized": False,
    "whisper_lock": threading.Lock()
}

class ModelManager:
    def __init__(self):
        # Whisper model settings
        self.cache_dir = MODEL_CACHE_DIR
        self.whisper_cache_dir = os.path.join(self.cache_dir, "whisper_models")
        
        # Create cache directories if they don't exist
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.whisper_cache_dir, exist_ok=True)
        
        # Whisper configuration
        self.num_whisper_instances = 10 if torch.cuda.is_available() else 1
        self.whisper_model_size = 'tiny.en'

    def _get_gpu_memory(self) -> float:
        """Get available GPU memory"""
        try:
            if not torch.cuda.is_available():
                return 0
                
            free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
            return free_memory / 1024**3  # Convert to GB
        except Exception as e:
            print(f"Error getting GPU memory: {e}")
            return 0
    
    def initialize_whisper_models(self):
        """Initialize multiple Whisper models"""
        global MODEL_REGISTRY
        
        # If models are already loaded in registry, return them
        if MODEL_REGISTRY["whisper_initialized"]:
            return MODEL_REGISTRY["whisper_models"]
        
        # Use lock to prevent multiple workers from loading the models simultaneously
        with MODEL_REGISTRY["whisper_lock"]:
            # Check again in case another thread loaded the models while waiting
            if MODEL_REGISTRY["whisper_initialized"]:
                return MODEL_REGISTRY["whisper_models"]
            
            has_gpu = torch.cuda.is_available()
            device = "cuda" if has_gpu else "cpu"
            
            # Import whisper here to avoid loading it unnecessarily
            import whisper
            
            # Determine model size and number of instances based on available resources
            if has_gpu:
                available_memory = self._get_gpu_memory()
                print(f"Available GPU memory: {available_memory:.2f} GB")
                
                # Adjust number of instances based on available memory
                if available_memory < self.num_whisper_instances:
                    self.num_whisper_instances = max(1, int(available_memory))
                    print(f"Adjusted number of Whisper instances to {self.num_whisper_instances} based on available memory")
            else:
                # Use only one tiny model on CPU
                self.num_whisper_instances = 1
                print("Running on CPU: Using single tiny Whisper model")
            
            print(f"Initializing {self.num_whisper_instances} Whisper {self.whisper_model_size} models...")
            start_time = time.time()
            
            # Force garbage collection before loading models
            gc.collect()
            if has_gpu:
                torch.cuda.empty_cache()
            
            # Load the models
            whisper_models = []
            for i in range(self.num_whisper_instances):
                print(f"Loading Whisper model {i+1}/{self.num_whisper_instances}...")
                model_start = time.time()
                
                # Load model with appropriate device placement
                whisper_model = whisper.load_model(
                    self.whisper_model_size, 
                    download_root=self.whisper_cache_dir
                ).to(device)
                
                # Set model to evaluation mode
                whisper_model.eval()
                
                whisper_models.append(whisper_model)
                print(f"Model {i+1} loaded in {time.time() - model_start:.2f} seconds")
                
                # Run garbage collection between model loads
                gc.collect()
                if has_gpu:
                    torch.cuda.empty_cache()
            
            load_time = time.time() - start_time
            print(f"All {self.num_whisper_instances} Whisper models loaded in {load_time:.2f} seconds")
            
            # Store in global registry
            MODEL_REGISTRY["whisper_models"] = whisper_models
            MODEL_REGISTRY["whisper_initialized"] = True
            
            return whisper_models
    
    def get_whisper_model(self, index=None):
        """Get a specific Whisper model or a random one if index is None"""
        if not MODEL_REGISTRY["whisper_initialized"]:
            self.initialize_whisper_models()
        
        models = MODEL_REGISTRY["whisper_models"]
        if not models:
            raise RuntimeError("No Whisper models available")
        
        if index is None or index >= len(models):
            # Return a random model for load balancing
            import random
            return models[random.randint(0, len(models) - 1)]
        
        return models[index]

# Initialize model manager
model_manager = ModelManager()

# Load models at startup
try:
    print("Loading Whisper models at startup...")
    whisper_models = model_manager.initialize_whisper_models()
    print(f"Successfully loaded {len(whisper_models)} Whisper models")
except Exception as e:
    print(f"Warning: Could not load Whisper models on startup: {str(e)}")