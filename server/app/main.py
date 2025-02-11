import os
import sys

from flask import jsonify, send_from_directory

# Add app directory to Python path for local development
if not os.getenv('DOCKER_ENV'):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = '/app'

from app.extensions import app
from app.routes.parse import parse_bp
from app.routes.evaluate import evaluate_bp
from app.routes.generate import generate_bp

# Register blueprints
app.register_blueprint(parse_bp, url_prefix='/parse')
app.register_blueprint(evaluate_bp, url_prefix='/evaluate')
app.register_blueprint(generate_bp, url_prefix='/generate')

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

@app.route('/files/<path:filepath>')
def serve_file(filepath):
    """
    Serve files from the uploads directory.
    Supports nested folder structures through the filepath parameter.
    Access like: /files/folder1/folder2/image.jpg
    """
    uploads_dir = os.path.join(BASE_DIR, 'uploads')
    try:
        return send_from_directory(uploads_dir, filepath)
    except FileNotFoundError:
        return {"error": "File not found"}, 404

# Add error handler for Supabase connection issues
@app.errorhandler(Exception)
def handle_error(error):
    return {"error": str(error)}, 500

if __name__ == "__main__":
    print("Server starting up...")
    print("Supabase connection established...")
    
    port = 5000 if os.getenv('DOCKER_ENV') else 8000
    app.run(host='0.0.0.0', port=port, debug=True)
