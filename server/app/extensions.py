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

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)

print("Supabase client initialized")