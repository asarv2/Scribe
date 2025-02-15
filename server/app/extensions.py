import os
from dotenv import load_dotenv
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

