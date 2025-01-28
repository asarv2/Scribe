from flask import Flask
from flask_cors import CORS
from supabase.client import Client, create_client, ClientOptions
import os
from dotenv import load_dotenv

load_dotenv()
print("Loaded environment variables")

# Initialize Flask app
app = Flask(__name__)
print("Flask app initialized")

# set the app to be an ASGI app
app.config['ASGI_APPLICATION'] = True

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

