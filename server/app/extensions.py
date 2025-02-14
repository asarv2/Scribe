import os
from dotenv import load_dotenv
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from supabase.client import Client, create_client, ClientOptions

load_dotenv()
print("Loaded environment variables")

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)
print("Supabase client initialized")

# Set upload folder based on environment
UPLOAD_FOLDER = "/app/uploads" if os.getenv('DOCKER_ENV') else os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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
        
except Exception as e:
    print(f"Failed to initialize DeepSeek model: {e}")
    deepseek_model = None
    deepseek_tokenizer = None

