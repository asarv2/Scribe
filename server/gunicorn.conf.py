# Basic configuration
bind = "0.0.0.0:5000"
workers = 3
threads = 3
worker_class = "gthread"
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging
errorlog = "-"
accesslog = "-"
loglevel = "info"
capture_output = True
enable_stdio_inheritance = True

def worker_exit(server, worker):
    from datetime import datetime
    print(f"Worker exited: {datetime.now()}")

def on_starting(server):
    print("Gunicorn starting...")
