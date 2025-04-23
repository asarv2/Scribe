import os
import logging
from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Initialize variables
supabase_client = None
gemini_client = None

# Set paths based on environment
BASE_FOLDER = "/app" if os.getenv('DOCKER_ENV') else os.path.dirname(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_FOLDER, "uploads")
MODEL_CACHE_DIR = os.path.join(BASE_FOLDER, "model_cache")
QUESTIONS_DIR = os.path.join(UPLOAD_FOLDER, 'questions')
SUMMARIES_DIR = os.path.join(UPLOAD_FOLDER, 'summaries')
GRADES_DIR = os.path.join(UPLOAD_FOLDER, 'grades')
CHUNKS_DIR = os.path.join(UPLOAD_FOLDER, 'chunks')

# Create directories without logging
def create_directories():
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
    os.makedirs(QUESTIONS_DIR, exist_ok=True)
    os.makedirs(SUMMARIES_DIR, exist_ok=True)
    os.makedirs(GRADES_DIR, exist_ok=True)
    os.makedirs(CHUNKS_DIR, exist_ok=True)
# Always create directories (this is safe and idempotent)
create_directories()

# Initialize clients function - will be called explicitly when needed
def initialize_clients():
    global supabase_client, gemini_client
    
    # Initialize Supabase client only if credentials are available
    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_PRIVATE_KEY") and supabase_client is None:
        from supabase.client import Client, create_client, ClientOptions
        opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
        supabase_client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_PRIVATE_KEY"), options=opts)
        logger.info("Supabase client initialized")
    elif supabase_client is None and (os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_PRIVATE_KEY")):
        logger.warning("Warning: Incomplete Supabase credentials, running without database")
    
    # Creating the gemini client
    if os.getenv("GOOGLE_API_KEY") and gemini_client is None:
        gemini_client = AsyncOpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=os.getenv("GOOGLE_API_KEY"))
    elif gemini_client is None and os.getenv("GOOGLE_API_KEY"):
        logger.warning("Warning: Google API key not found, running without Gemini client")

# Get supabase client
def get_supabase():
    global supabase_client
    if supabase_client is None:
        initialize_clients()
    return supabase_client

# Get gemini client
def get_gemini():
    global gemini_client
    if gemini_client is None:
        initialize_clients()
    return gemini_client