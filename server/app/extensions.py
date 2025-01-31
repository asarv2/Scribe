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

if os.getenv('DOCKER_ENV'):
    print("Initializing DeepSeek model in Docker environment...")
    try:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        deepseek_model = AutoModelForCausalLM.from_pretrained(
            "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
            trust_remote_code=True
        ).to(device)
        deepseek_tokenizer = AutoTokenizer.from_pretrained("deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")
        print(f"DeepSeek model initialized on device: {device}")
    except Exception as e:
        print(f"Failed to initialize DeepSeek model: {e}")
        deepseek_model = None
        deepseek_tokenizer = None

