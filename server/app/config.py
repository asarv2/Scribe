# config.py
import os
import time
import torch
import gc
import logging
from app.extensions import MODEL_CACHE_DIR

# Get logger
logger = logging.getLogger(__name__)

# Global model registry - single source of truth
MODEL_REGISTRY = {
    "whisper_model": None,
    "whisper_initialized": False
}

class ModelManager:
    def __init__(self):
        # Whisper model settings
        self.cache_dir = MODEL_CACHE_DIR
        self.whisper_cache_dir = os.path.join(self.cache_dir, "whisper_models")
        
        # Create cache directories if they don't exist
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.whisper_cache_dir, exist_ok=True)
        
        # Whisper configuration - default to tiny.en model
        self.whisper_model_size = 'tiny.en'

    def _get_gpu_memory(self) -> float:
        """Get available GPU memory in GB"""
        try:
            if not torch.cuda.is_available():
                return 0
                
            free_memory = torch.cuda.get_device_properties(0).total_memory - torch.cuda.memory_allocated(0)
            return free_memory / 1024**3  # Convert to GB
        except Exception as e:
            logger.error(f"Error getting GPU memory: {e}")
            return 0
    
    def initialize_whisper_model(self):
        """Initialize a single Whisper model"""
        global MODEL_REGISTRY
        
        # If model is already loaded in registry, return it
        if MODEL_REGISTRY["whisper_initialized"]:
            logger.info("Using already initialized Whisper model")
            return MODEL_REGISTRY["whisper_model"]
        
        has_gpu = torch.cuda.is_available()
        device = "cuda" if has_gpu else "cpu"
        
        # Import whisper here to avoid loading it unnecessarily
        import whisper
        
        logger.info(f"Initializing Whisper {self.whisper_model_size} model on {device}...")
        start_time = time.time()
        
        # Force garbage collection before loading model
        gc.collect()
        if has_gpu:
            torch.cuda.empty_cache()
            available_memory = self._get_gpu_memory()
            logger.info(f"Available GPU memory: {available_memory:.2f} GB")
        
        # Load the model
        whisper_model = whisper.load_model(
            self.whisper_model_size, 
            download_root=self.whisper_cache_dir
        ).to(device)
        
        # Set model to evaluation mode
        whisper_model.eval()
        
        load_time = time.time() - start_time
        logger.info(f"Whisper model loaded in {load_time:.2f} seconds")
        
        # Store in global registry
        MODEL_REGISTRY["whisper_model"] = whisper_model
        MODEL_REGISTRY["whisper_initialized"] = True
        
        return whisper_model
    
    def get_whisper_model(self):
        """Get the global Whisper model instance"""
        if not MODEL_REGISTRY["whisper_initialized"]:
            self.initialize_whisper_model()
        
        model = MODEL_REGISTRY["whisper_model"]
        if not model:
            raise RuntimeError("No Whisper model available")
        
        # Ensure model is in eval mode and on the correct device
        model.eval()
        
        # Check if model is on the expected device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        if next(model.parameters()).device.type != device:
            logger.warning(f"Model was on {next(model.parameters()).device.type}, moving to {device}")
            model = model.to(device)
            MODEL_REGISTRY["whisper_model"] = model
        
        return model

# Initialize model manager
model_manager = ModelManager()

# Don't load model at startup - let each worker initialize it when needed
# This prevents CUDA initialization issues with forked processes