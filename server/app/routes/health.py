from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health():
    """Parse a lecture and return the documents."""
    try:
        return jsonify({"status": "healthy"}), 200
    except Exception as error:
        # Error handling logic
        return jsonify({
            "error": str(error),
            "name": type(error).__name__
        }), 500