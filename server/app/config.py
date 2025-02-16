# config.py
import os

# Get BASE_DIR from environment variable (set in main.py)
BASE_DIR = os.environ.get('BASE_DIR')

# Define uploads directory path
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')

# Create uploads directory if it doesn't exist
os.makedirs(UPLOADS_DIR, exist_ok=True)

# make messages directory if it doesn't exist, under the uploads directory
MESSAGES_DIR = os.path.join(UPLOADS_DIR, 'messages')
os.makedirs(MESSAGES_DIR, exist_ok=True)