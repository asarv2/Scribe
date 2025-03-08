import os
import sys

# Add the server directory to Python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.config import model_manager

if __name__ == "__main__":
    print("Starting model download...")
    try:
        model_manager.download_model()
        print("Model downloaded successfully!")
    except Exception as e:
        print(f"Error downloading model: {str(e)}")
        sys.exit(1) 