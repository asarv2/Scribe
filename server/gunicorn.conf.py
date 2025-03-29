# Server socket
bind = "0.0.0.0:5000"

# Worker configuration
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

def post_fork(server, worker):
    # Simple worker ID assignment based on PID
    worker_id = worker.pid
    print(f"Worker started with PID {worker_id}")