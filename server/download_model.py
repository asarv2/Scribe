import os
import sys

# Add the server directory to Python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

from app.config import model_manager

def main():
    print("Starting model download...")
    try:
        # Print the model path
        print(f"Model will be downloaded to: {model_manager.local_model_path}")
        
        # Ensure directory exists
        os.makedirs(model_manager.local_model_path, exist_ok=True)
        print(f"Download directory created/verified")
        
        # Download the model
        model_manager.download_model()
        
        # Verify the download
        if os.path.exists(model_manager.local_model_path):
            print(f"Contents of {model_manager.local_model_path}:")
            print(os.listdir(model_manager.local_model_path))
        
        print("Model downloaded successfully!")
    except Exception as e:
        print(f"Error downloading model: {str(e)}")
        sys.exit(1)

# Run regardless of how the script is called
main()