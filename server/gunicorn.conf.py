# Gunicorn configuration file
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1  # Recommended formula for CPU-bound tasks
worker_class = 'gevent'
worker_connections = 1000
timeout = 300
keepalive = 2
max_requests = 0
max_requests_jitter = 0

# Logging
accesslog = '-'  # Log to stdout
errorlog = '-'   # Log to stderr
loglevel = 'debug'  # Increased log level for debugging
capture_output = True
enable_stdio_inheritance = True

# Process naming
proc_name = 'gunicorn_scribe'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Debugging
reload = False
preload_app = True  # Changed to True to load app once
check_config = True

# SSL
keyfile = None
certfile = None

# Server hooks
def on_starting(server):
    print("Starting Gunicorn server...")
    # Import here to avoid circular imports
    from gevent import monkey
    monkey.patch_all()

def on_reload(server):
    print("Reloading Gunicorn server...")

def when_ready(server):
    print("Gunicorn server is ready. Listening on", bind)

def worker_abort(worker):
    print(f"Worker {worker.pid} aborted with error")

def worker_exit(server, worker):
    print(f"Worker {worker.pid} exited with code {worker.exitcode}")
