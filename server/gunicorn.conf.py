import multiprocessing
multiprocessing.set_start_method('spawn', force=True)  # Ensure subprocesses use spawn for CUDA safety :contentReference[oaicite:9]{index=9}

import os
import torch
import logging

logger = logging.getLogger(__name__)
has_gpu = torch.cuda.is_available()

# Server socket
bind = "0.0.0.0:5000"  # Listen on Docker port 5000 :contentReference[oaicite:10]{index=10}

# Worker configuration
if has_gpu:
    workers = 1  # Single worker to avoid VRAM oversubscription :contentReference[oaicite:11]{index=11}
    logger.info("GPU detected - using single worker mode")
else:
    workers = 4  # Adjust based on CPU cores
    logger.info(f"No GPU detected - using {workers} workers")

# Preload application before forking (disabled to avoid CUDA context issues)
preload_app = False  # Avoid preloading model in master process :contentReference[oaicite:12]{index=12}

# Use Uvicorn worker for FastAPI ASGI
worker_class = 'uvicorn.workers.UvicornWorker'  # Use Uvicorn event loop :contentReference[oaicite:13]{index=13}

# Threads per worker
threads = 4  # Allows multiple concurrent requests per worker :contentReference[oaicite:14]{index=14}

# Timeout and keep-alive
timeout = 1800     # 30 minutes for long tasks :contentReference[oaicite:15]{index=15}
keepalive = 65     # Keep connections alive for 65 seconds :contentReference[oaicite:16]{index=16}

# Logging configuration
accesslog = "-"   # Log access to stdout :contentReference[oaicite:17]{index=17}
errorlog = "-"    # Log errors to stdout :contentReference[oaicite:18]{index=18}
loglevel = "info"
logconfig = None

def when_ready(server):
    logger.info(f"Gunicorn server is ready. Running {workers} workers")
    if has_gpu:
        logger.info("GPU detected - running in single-worker mode for GPU operations")
    else:
        logger.info("No GPU detected - running in multi-worker mode")

def post_fork(server, worker):
    """Load model in worker if on CPU (avoiding master preloading)"""
    logger.info(f"Worker started with PID {worker.pid}")
    if not has_gpu:
        logger.info(f"Worker {worker.pid}: Initializing Whisper model (CPU mode)...")
        try:
            from app.config import model_manager
            model_manager.initialize_whisper_model()
            logger.info(f"Worker {worker.pid}: Whisper model initialized")
        except Exception as e:
            logger.error(f"Worker {worker.pid}: Failed to initialize Whisper model: {e}")
