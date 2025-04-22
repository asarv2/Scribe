import multiprocessing
multiprocessing.set_start_method('spawn', force=True)  # Ensure subprocesses use spawn for CUDA safety

import os
import torch
import logging

logger = logging.getLogger(__name__)
has_gpu = torch.cuda.is_available()

# Server socket
bind = "0.0.0.0:5000"  # Listen on Docker port 5000

# Worker configuration
if has_gpu:
    workers = 1  # Single worker to avoid VRAM oversubscription
    logger.info("GPU detected - using single worker mode")
else:
    workers = 4  # Adjust based on CPU cores
    logger.info(f"No GPU detected - using {workers} workers")

# Preload application before forking (disabled to avoid CUDA context issues)
preload_app = False  # Avoid preloading model in master process

# Use Uvicorn worker for FastAPI ASGI
worker_class = 'uvicorn.workers.UvicornWorker'  # Use Uvicorn event loop

# Threads per worker
threads = 4  # Allows multiple concurrent requests per worker

# Timeout and keep-alive
timeout = 1800     # 30 minutes for long tasks
keepalive = 65     # Keep connections alive for 65 seconds

# Logging configuration
accesslog = "-"   # Log access to stdout
errorlog = "-"    # Log errors to stdout
loglevel = "info"
logconfig = None

def when_ready(server):
    logger.info(f"Gunicorn server is ready. Running {workers} workers")
    if has_gpu:
        logger.info("GPU detected - running in single-worker mode for GPU operations")
    else:
        logger.info("No GPU detected - running in multi-worker mode")

def post_fork(server, worker):
    """Load model in worker if needed (avoiding master preloading)"""
    logger.info(f"Worker started with PID {worker.pid}")
    # Don't initialize the model here - let it be initialized on first use
    # This avoids CUDA initialization issues
