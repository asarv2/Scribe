import os
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

def download_deepseek_model():
    """
    Downloads the DeepSeek model and tokenizer, saving them to the local models directory.
    """
    model_path = os.path.join(os.path.dirname(__file__), "deepseek-r1-7b")
    
    print(f"Checking if model already exists at {model_path}...")
    if os.path.exists(model_path):
        print("Model already exists locally. Skipping download.")
        return
    
    print("Downloading DeepSeek model and tokenizer...")
    try:
        # Download and save the model
        print("Downloading model...")
        model = AutoModelForCausalLM.from_pretrained(
            "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
            trust_remote_code=True
        )
        
        print("Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
        )
        
        # Create the directory if it doesn't exist
        os.makedirs(model_path, exist_ok=True)
        
        print(f"Saving model to {model_path}")
        model.save_pretrained(model_path)
        
        print(f"Saving tokenizer to {model_path}")
        tokenizer.save_pretrained(model_path)
        
        print("Successfully downloaded and saved DeepSeek model and tokenizer!")
        
        # Free up memory
        del model
        del tokenizer
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
    except Exception as e:
        print(f"Error downloading model: {e}")
        raise

if __name__ == "__main__":
    download_deepseek_model()