import os
import sys
# Add app directory to Python path for local development
if not os.getenv('DOCKER_ENV'):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = '/app'

from app.extensions import app
from app.routes.parse import parse_bp
from app.routes.evaluate import evaluate_bp
from app.routes.health import health_bp
from app.routes.batch import batch_bp

app.register_blueprint(health_bp, url_prefix='/health')
app.register_blueprint(parse_bp, url_prefix='/parse')
app.register_blueprint(evaluate_bp, url_prefix='/evaluate')
app.register_blueprint(batch_bp, url_prefix='/batch')

@app.route('/')
def index():
    return "<h1>Hello World, this is the Scribe API.</h1>"


if __name__ == "__main__":
    print("Server starting up...")
    if os.getenv('DOCKER_ENV'):
        app.run(host='0.0.0.0', port=5000, debug=False) # Set debug to False
    else:
        app.run(host='0.0.0.0', port=8000, debug=False)  # Set debug to False
