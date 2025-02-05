import multiprocessing

# Server socket
bind = "0.0.0.0:5000"

# For GPU workloads, we want fewer workers
workers = 2  # Start with 2 workers since GPU operations are heavy

# Use uvicorn worker for better async support
worker_class = 'uvicorn.workers.UvicornWorker'

# Threads per worker
threads = 4

# Longer timeout for GPU operations
timeout = 300

# Keep-alive settings
keepalive = 65

def when_ready(server):
    print(f"Gunicorn server is ready. Running {workers} workers with uvicorn")