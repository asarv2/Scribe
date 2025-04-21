import os
import torch
import logging

logger = logging.getLogger(__name__)
# Determine if GPU is available
has_gpu = torch.cuda.is_available()

# Server socket
bind = "0.0.0.0:5000"  # Always use port 5000 in Docker

# Worker configuration
if has_gpu:
    # Use a single worker for GPU operations
    workers = 1
    logger.info("GPU detected - using single worker mode")
else:
    # Use multiple workers when no GPU is available
    workers = 4  # Adjust based on your CPU cores
    logger.info(f"No GPU detected - using {workers} workers")

# Preload application before forking workers
preload_app = True

# Use uvicorn worker for FastAPI
worker_class = 'uvicorn.workers.UvicornWorker'

# Threads per worker
threads = 4

# Longer timeout for operations
timeout = 1800  # 30 minutes

# Keep-alive settings
keepalive = 65

# Logging configuration
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log errors to stdout
loglevel = "info"
logconfig = None  # Use default logging config

def when_ready(server):
    logger.info(f"Gunicorn server is ready. Running {workers} workers")
    if has_gpu:
        logger.info("GPU detected - running in single-worker mode for GPU operations")
    else:
        logger.info("No GPU detected - running in multi-worker mode")

def on_starting(server):
    """Log when the master process is starting."""
    logger.info("Gunicorn master process is starting")
    
    # Always preload the Whisper model in the master process
    try:
        # Import here to avoid circular imports
        from app.config import model_manager
        logger.info("Preloading Whisper model in master process...")
        model_manager.initialize_whisper_model()
        logger.info(f"Whisper model preloaded successfully in master process (GPU: {has_gpu})")
    except Exception as e:
        logger.error(f"Failed to preload Whisper model in master process: {str(e)}")

def post_fork(server, worker):
    # Simple worker ID assignment based on PID
    worker_id = worker.pid
    logger.info(f"Worker started with PID {worker_id}")
    
    # For CPU mode with multiple workers, initialize Whisper model in each worker
    if not has_gpu:
        logger.info(f"Worker {worker_id}: Initializing Whisper model (CPU mode)...")
        try:
            # Import here to avoid circular imports
            from app.config import model_manager
            model_manager.initialize_whisper_model()
            logger.info(f"Worker {worker_id}: Successfully initialized Whisper model")
        except Exception as e:
            logger.error(f"Worker {worker_id}: Failed to initialize Whisper model: {str(e)}")
