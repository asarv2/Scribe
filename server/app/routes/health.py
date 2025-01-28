from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)

@health_bp.route('/', methods=['GET'])
def health():
    """Check if the server is healthy."""
    try:
        return jsonify({"status": "healthy"}), 200
    except Exception as error:
        # Error handling logic
        return jsonify({
            "error": str(error),
            "name": type(error).__name__
        }), 500