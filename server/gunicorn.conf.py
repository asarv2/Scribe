import os
import torch
import multiprocessing

# Set the start method to 'spawn' for CUDA compatibility
multiprocessing.set_start_method('spawn', force=True)

# Determine if GPU is available
has_gpu = torch.cuda.is_available()

# Server socket
bind = "0.0.0.0:5000"

# Worker configuration
if has_gpu:
    # Use a single worker for GPU operations
    workers = 1
else:
    # Use multiple workers when no GPU is available
    workers = 4  # Adjust based on your CPU cores

# Use uvicorn worker for FastAPI
worker_class = 'uvicorn.workers.UvicornWorker'

# Threads per worker
threads = 4

# Longer timeout for operations
timeout = 1800  # 30 minutes

# Keep-alive settings
keepalive = 65

def when_ready(server):
    print(f"Gunicorn server is ready. Running {workers} workers")
    if has_gpu:
        print("GPU detected - running in single-worker mode for GPU operations")
    else:
        print("No GPU detected - running in multi-worker mode")

def post_fork(server, worker):
    # Simple worker ID assignment based on PID
    worker_id = worker.pid
    print(f"Worker started with PID {worker_id}")