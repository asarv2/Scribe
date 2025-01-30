import multiprocessing

# Server socket
bind = "0.0.0.0:5000"

# Worker processes - recommended formula for concurrent requests
workers = multiprocessing.cpu_count() * 2 + 1

# Use gevent worker for async support
worker_class = 'gevent'
worker_connections = 1000

# Basic timeout config
timeout = 300

def when_ready(server):
    print(f"Gunicorn server is ready. Running {workers} workers with gevent")