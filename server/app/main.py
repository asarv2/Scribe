import os
import sys

# Add app directory to Python path for local development
if not os.getenv('DOCKER_ENV'):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = '/app'

from flask import jsonify
from flask_cors import CORS
from app.extensions import app, supabase_url, supabase_private_key
from app.routes.parse import parse_bp
from app.routes.evaluate import evaluate_bp
from app.routes.batch import batch_bp
from app.routes.generate import generate_bp
from app.routes.upload import upload_bp
# Enable CORS for all routes
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
print("CORS enabled for all routes")

# Add configuration validation
if not supabase_url or not supabase_private_key:
    raise ValueError("Missing required Supabase configuration. Please check your .env file.")

app.register_blueprint(parse_bp, url_prefix='/parse')
app.register_blueprint(evaluate_bp, url_prefix='/evaluate')
app.register_blueprint(batch_bp, url_prefix='/batch')
app.register_blueprint(generate_bp, url_prefix='/generate')
app.register_blueprint(upload_bp, url_prefix='/upload')

@app.route('/')
def index():
    return "<h1>This is the Scribe API.</h1>"

@app.route('/health', methods=['GET'], strict_slashes=False)
def health():
    """Check if the server is healthy."""
    try:
        return jsonify({"status": "healthy"}), 200
    except Exception as error:
        # Errorjsonifyng logic
        return jsonify({
            "error": str(error),
            "name": type(error).__name__
        }), 500

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
