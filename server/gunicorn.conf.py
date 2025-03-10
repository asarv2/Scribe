# Server socket
bind = "0.0.0.0:5000"

# Use multiple workers but designate only one for GPU tasks
workers = 4  # Adjust based on your CPU cores

# Use uvicorn worker for FastAPI
worker_class = 'uvicorn.workers.UvicornWorker'

# Threads per worker
threads = 4

# Longer timeout for GPU operations
timeout = 1800  # 30 minutes

# Keep-alive settings
keepalive = 65

import os

# Set a persistent file-based lock in a shared location
GPU_LOCK_FILE = "/var/run/gpu_worker.lock"

def when_ready(server):
    print(f"Gunicorn server is ready. Running {workers} workers")

def on_starting(server):
    # Reset worker counter
    global worker_count
    worker_count = 0

def post_fork(server, worker):
    # Simple worker ID assignment based on PID
    worker_id = worker.pid
    
    # Only the first worker to create the lock file gets GPU access
    if not os.path.exists(GPU_LOCK_FILE):
        try:
            with open(GPU_LOCK_FILE, 'w') as f:
                f.write(str(worker_id))
            os.environ['GPU_WORKER'] = 'true'
            is_gpu = True
        except:
            os.environ['GPU_WORKER'] = 'false'
            is_gpu = False
    else:
        os.environ['GPU_WORKER'] = 'false'
        is_gpu = False
    
    print(f"Worker started with PID {worker_id}, GPU enabled: {is_gpu}")