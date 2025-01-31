from flask import Flask
from flask_cors import CORS
from supabase.client import Client, create_client, ClientOptions
import os
from dotenv import load_dotenv
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

load_dotenv()
print("Loaded environment variables")

# Initialize Flask app
app = Flask(__name__)
print("Flask app initialized")

# Configure for async operation
app.config['PROPAGATE_EXCEPTIONS'] = True  # Better error handling for async

# set upload folder based on environment
if os.getenv('DOCKER_ENV'):
    app.config['UPLOAD_FOLDER'] = "/app/uploads"
else:
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

print("Supabase client initialized")

# Enable CORS
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Initialize DeepSeek model only in Docker environment
deepseek_model = None
deepseek_tokenizer = None

print("Checking for DeepSeek model...")
model_path = "/app/models/deepseek-r1-7b"

try:
    if os.path.exists(model_path):
        print(f"Loading DeepSeek model from local path: {model_path}")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        deepseek_model = AutoModelForCausalLM.from_pretrained(
            model_path,
            trust_remote_code=True,
            local_files_only=True
        ).to(device)
        deepseek_tokenizer = AutoTokenizer.from_pretrained(
            model_path,
            local_files_only=True
        )
        print(f"DeepSeek model initialized on device: {device}")
    else:
        print("Skipping model download")
        # if os.getenv('DOCKER_ENV'):
        #     print("Local model not found, downloading from Hugging Face...")
        #     device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        #     deepseek_model = AutoModelForCausalLM.from_pretrained(
        #         "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
        #         trust_remote_code=True
        #     ).to(device)
        #     deepseek_tokenizer = AutoTokenizer.from_pretrained(
        #         "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B"
        #     )
            
        #     # Save the model locally for future use
        #     print(f"Saving model to {model_path}")
        #     os.makedirs(model_path, exist_ok=True)
        #     deepseek_model.save_pretrained(model_path)
        #     deepseek_tokenizer.save_pretrained(model_path)

        #     print(f"DeepSeek model initialized on device: {device}")
        # else:
        #     print("Local model not found, not downloading.")
        
except Exception as e:
    print(f"Failed to initialize DeepSeek model: {e}")
    deepseek_model = None
    deepseek_tokenizer = None

