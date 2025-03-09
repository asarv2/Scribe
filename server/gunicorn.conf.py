# Server socket
bind = "0.0.0.0:5000"

# For GPU workloads, we want fewer workers
workers = 1  # Reduce to 1 worker to avoid memory issues

# Use uvicorn worker for FastAPI
worker_class = 'uvicorn.workers.UvicornWorker'

# Threads per worker
threads = 4

# Longer timeout for GPU operations
timeout = 600

# Keep-alive settings
keepalive = 65

import os

def when_ready(server):
    print(f"Gunicorn server is ready. Running {workers} workers")

def on_starting(server):
    # Set environment variable to identify the first worker
    os.environ['GUNICORN_WORKER_ID'] = '0'