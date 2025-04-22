import os
import logging

logger = logging.getLogger(__name__)

# Server socket
bind = "0.0.0.0:5000"  # Always use port 5000 in Docker

# Worker configuration - always use 4 workers
workers = 4
logger.info(f"Using {workers} workers")

# Disable preloading to avoid CUDA initialization in master process
preload_app = False

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

def on_starting(server):
    """Log when the master process is starting."""
    logger.info("Gunicorn master process is starting")

def post_fork(server, worker):
    # Simple worker ID assignment based on PID
    worker_id = worker.pid
    logger.info(f"Worker started with PID {worker_id}")