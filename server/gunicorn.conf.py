# Gunicorn configuration file
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = 1  # Single worker for rate limiting
worker_class = 'gevent'
worker_connections = 1000
timeout = 300
keepalive = 2

# Logging
accesslog = '/var/log/gunicorn/access.log'
errorlog = '/var/log/gunicorn/error.log'
loglevel = 'info'

# Process naming
proc_name = 'gunicorn_scribe'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

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

def worker_exit(server, worker):
    from datetime import datetime
    print(f"Worker exited: {datetime.now()}")
