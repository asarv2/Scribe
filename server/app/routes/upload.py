from flask import Blueprint, request, jsonify, url_for
import requests
from werkzeug.utils import secure_filename
import asyncio
from datetime import datetime
import os
from app.extensions import supabase
from app.extensions import app
from app.models.storage import ProgressFileStorage

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/video', methods=['POST'])
def upload_video():
    """Handle video upload and initiate processing"""
    print("Upload video request received")
    if 'video' not in request.files:
        return jsonify({'error': 'No video file'}), 400

    video_file = request.files['video']
    print(f"Video file received: {video_file.filename}")
    lecture_id = request.form['lecture_id']
    
    if video_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Create lecture-specific directory
        lecture_dir = os.path.join(app.config['UPLOAD_FOLDER'], lecture_id)
        os.makedirs(lecture_dir, exist_ok=True)
        
        # Save video as video.mp4
        video_path = os.path.join(lecture_dir, "video.mp4")

        def update_progress(progress: float):
            print(f"Upload progress: {progress:.1f}%")
            supabase.table("lectures").update({
                "upload_progress": progress,
                "upload_error": None,
                "last_upload_attempt": datetime.now().isoformat()
            }).eq("id", lecture_id).execute()

        progress_storage = ProgressFileStorage(video_file, "video.mp4", update_progress)
        progress_storage.save(video_path)

        print(f"Video file saved to: {video_path}")

        # Make HTTP request to batch endpoint
        try:
            request_body = {
                "video_path": video_path,
                "lecture_id": lecture_id
            }
            
            parse_url = url_for('parse.parse_video', _external=True)
            response = requests.post(parse_url, json=request_body)
            print(f"Parse response: {response.json()}")

            if response.status_code != 200:
                print("Warning: Parse processing request failed:", response.json())
            else:
                print("Parse processing initiated")
            
            return jsonify({"results": response.json()}), 200
        
        except Exception as e:
            print(f"Error calling parse_video: {e}")
            return jsonify({'error': str(e)}), 500

    except Exception as e:
        print(f"Error uploading video: {e}")
        supabase.table("lectures").update({
            "upload_error": str(e),
            "last_upload_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()
        return jsonify({'error': str(e)}), 500