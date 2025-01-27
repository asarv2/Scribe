import os
import sys
# Add app directory to Python path for local development
if not os.getenv('DOCKER_ENV'):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = '/app'

from flask_cors import CORS
from app.extensions import app, supabase_url, supabase_private_key
from app.routes.parse import parse_bp
from app.routes.evaluate import evaluate_bp
from app.routes.health import health_bp
from app.routes.batch import batch_bp

# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
print("CORS enabled for all routes")

# Add configuration validation
if not supabase_url or not supabase_private_key:
    raise ValueError("Missing required Supabase configuration. Please check your .env file.")

app.register_blueprint(health_bp, url_prefix='/health')
app.register_blueprint(parse_bp, url_prefix='/parse')
app.register_blueprint(evaluate_bp, url_prefix='/evaluate')
app.register_blueprint(batch_bp, url_prefix='/batch')

@app.route('/')
def index():
    return "<h1>This is the Scribe API.</h1>"

# Add error handler for Supabase connection issues
@app.errorhandler(Exception)
def handle_error(error):
    return {"error": str(error)}, 500

if __name__ == "__main__":
    print("Server starting up...")
    print("Supabase connection established...")
    if os.getenv('DOCKER_ENV'):
        app.run(host='0.0.0.0', port=5000, debug=False) # Set debug to False
    else:
        app.run(host='0.0.0.0', port=8000, debug=False)  # Set debug to False
