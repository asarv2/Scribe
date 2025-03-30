import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Supabase client only if credentials are available
supabase = None
if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_PRIVATE_KEY"):
    from supabase.client import Client, create_client, ClientOptions
    opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
    supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_PRIVATE_KEY"), options=opts)
    print("Supabase client initialized")
else:
    print("Warning: Supabase credentials not found, running without database")

# Set paths based on environment
BASE_FOLDER = "/app" if os.getenv('DOCKER_ENV') else os.path.dirname(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_FOLDER, "uploads")
MODEL_CACHE_DIR = os.path.join(BASE_FOLDER, "model_cache")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

# make messages directory if it doesn't exist, under the uploads directory
MESSAGES_DIR = os.path.join(UPLOAD_FOLDER, 'messages')
os.makedirs(MESSAGES_DIR, exist_ok=True)

# make evaluations directory if it doesn't exist, under the uploads directory
EVALUATIONS_DIR = os.path.join(UPLOAD_FOLDER, 'evaluations')
os.makedirs(EVALUATIONS_DIR, exist_ok=True)

# make chats directory if it doesn't exist, under the uploads directory
CHATS_DIR = os.path.join(UPLOAD_FOLDER, 'chats')
os.makedirs(CHATS_DIR, exist_ok=True)

# make courses directory if it doesn't exist, under the uploads directory
COURSES_DIR = os.path.join(UPLOAD_FOLDER, 'courses')
os.makedirs(COURSES_DIR, exist_ok=True)

# make figures directory if it doesn't exist, under the uploads directory
FIGURES_DIR = os.path.join(UPLOAD_FOLDER, 'figures')
os.makedirs(FIGURES_DIR, exist_ok=True)

# make questions directory if it doesn't exist, under the uploads directory
QUESTIONS_DIR = os.path.join(UPLOAD_FOLDER, 'questions')
os.makedirs(QUESTIONS_DIR, exist_ok=True)

# make summaries directory if it doesn't exist, under the uploads directory
SUMMARIES_DIR = os.path.join(UPLOAD_FOLDER, 'summaries')
os.makedirs(SUMMARIES_DIR, exist_ok=True)

# make files directory if it doesn't exist, under the uploads directory
FILES_DIR = os.path.join(UPLOAD_FOLDER, 'files')
os.makedirs(FILES_DIR, exist_ok=True)

