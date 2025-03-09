# Server socket
bind = "0.0.0.0:5000"

# Use multiple workers but designate only one for GPU tasks
workers = 4  # Adjust based on your CPU cores

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

def post_fork(server, worker):
    # Assign worker IDs
    worker_id = server.worker_processes.index(worker.pid)
    os.environ['GUNICORN_WORKER_ID'] = str(worker_id)
    
    # Only the first worker loads the GPU model
    if worker_id == 0:
        os.environ['GPU_WORKER'] = 'true'
    else:
        os.environ['GPU_WORKER'] = 'false'
    
    print(f"Worker {worker_id} started with PID {worker.pid}, GPU enabled: {worker_id == 0}")