import os
from dotenv import load_dotenv
from supabase.client import Client, create_client, ClientOptions

# Load environment variables from .env file
load_dotenv()

# Add error checking for required environment variables
supabase_url = os.getenv("SUPABASE_URL")
if not supabase_url:
    raise ValueError("SUPABASE_URL environment variable is not set")

supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
if not supabase_private_key:
    raise ValueError("SUPABASE_PRIVATE_KEY environment variable is not set")

print("Loaded environment variables")

# Initialize Supabase client
opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)
print("Supabase client initialized")

# Set upload folder based on environment
UPLOAD_FOLDER = "/app/uploads" if os.getenv('DOCKER_ENV') else os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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

