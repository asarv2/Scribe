# Gunicorn configuration file
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = 1
worker_class = 'sync'  # Changed from gevent to sync for debugging
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
preload_app = False
check_config = True

# SSL
keyfile = None
certfile = None

# Server hooks
def on_starting(server):
    print("Starting Gunicorn server...")

def on_reload(server):
    print("Reloading Gunicorn server...")

def when_ready(server):
    print("Gunicorn server is ready. Listening on", bind)

def worker_abort(worker):
    print(f"Worker {worker.pid} aborted with error")

def worker_exit(server, worker):
    print(f"Worker {worker.pid} exited with code {worker.exitcode}")
