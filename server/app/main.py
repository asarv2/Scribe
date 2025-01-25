import traceback
from flask import Flask, request
from flask_cors import CORS
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from werkzeug.utils import secure_filename
from app.lecture.parse.video_processor import VideoProcessor
import json
import torch
from supabase.client import Client, create_client, ClientOptions
from dotenv import load_dotenv

from app.lecture.evaluate.accuracy import GeminiDecisionMaker, generate_llm_quality_report
from app.lecture.evaluate.adherence import adherenceEvaluator
from app.lecture.evaluate.certainty import CertaintyEvaluator
from app.lecture.evaluate.complexity import ComplexityEvaluator

load_dotenv()

# Configure upload folder with absolute path
BASE_DIR = '/services/scribe'
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

app = Flask(__name__)
# Enable all origins and methods
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("Server starting up...") # Direct print for immediate feedback

# device = "cuda" if torch.cuda.is_available() else "cpu"
# video_processor = VideoProcessor()
# print("Initialized VideoProcessor")  # Direct print

@app.route('/')
@app.route('/health')
def health():
    return {"status": "healthy"}, 200

@app.route('/parse-video', methods=['POST'])
def parse_video():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    video_processor = VideoProcessor()
    print("Initialized VideoProcessor")  # Direct print

    if 'video_chunk' not in request.files or 'audio_chunk' not in request.files:
        print("Missing video or audio chunk in request")
        return 'Missing video or audio chunk', 400
    
    video_chunk = request.files['video_chunk']
    audio_chunk = request.files['audio_chunk']
    chunk_number = int(request.form['chunk_number'])
    total_chunks = int(request.form['total_chunks'])
    lecture_id = request.form['lecture_id']
    class_id = request.form['class_id']
    original_filename = request.form['filename']
    
    if video_chunk.filename == '' or audio_chunk.filename == '':
        print("Empty filename received")
        return 'No selected file', 400
        
    if video_chunk and audio_chunk and allowed_file(original_filename):
        # Save both chunks
        video_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{lecture_id}_video_{chunk_number}.mp4")
        audio_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{lecture_id}_audio_{chunk_number}.wav")
        
        print(f"Saving chunks to: {video_path} and {audio_path}")
        
        video_chunk.save(video_path)
        audio_chunk.save(audio_path)
        
        try:
            # Use audio file for transcription
            transcript = video_processor.transcribe_video(audio_path)
            # Use video file for frame extraction
            photos = video_processor.process_video(video_path)
            documents = video_processor.generate_documents(photos, transcript)
            
            return json.dumps({
                'chunk': chunk_number,
                'total': total_chunks,
                'documents': documents
            }), 200
        except Exception as e:
            print(f"Error processing files: {str(e)}")
            import traceback
            traceback.print_exc()
            return f'Error processing files: {str(e)}', 500
        finally:
            # Clean up both files
            if os.path.exists(video_path):
                os.remove(video_path)
            if os.path.exists(audio_path):
                os.remove(audio_path)
    
    return 'Invalid file type', 400


@app.route('/parse-lecture', methods=['POST'])
def parse_lecture():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    video_processor = VideoProcessor()
    print("Initialized VideoProcessor")  # Direct print
    
    lecture_id = request.form['lecture_id']
    class_id = request.form['class_id']
    original_filename = request.form['filename']
    video_processor.parse_lecture(lecture_id, class_id, original_filename)
    return 'Lecture parsed', 200


@app.route("/evaluate", methods=["POST"])
def evaluate():
    data = request.get_json()
    generation_id = data['generation_id']
    class_id = data['class_id']
    
    try:
        # creating supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
        opts = ClientOptions().replace(schema="prod")
        supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)
        print("Supabase client created")
        
        llm = ChatGoogleGenerativeAI(
            model='gemini-1.5-flash',
            temperature=0, 
            max_tokens=None, 
            timeout=None, 
            max_retries=2
        )
        
        # certainty
        certainty_evaluator = CertaintyEvaluator(supabase, generation_id, class_id)
        print("Certainty evaluator created")
        certainty_score, certainty_explanation = certainty_evaluator.evaluate_certainty()
        print(f"Certainty score and explanation calculated: Score: {certainty_score}, Explanation: {certainty_explanation}")
        # accuracy
        gemini_decision_maker = GeminiDecisionMaker(supabase, generation_id, class_id)
        print("Gemini decision maker created")
        accuracy_explanation, accuracy_score = generate_llm_quality_report(gemini_decision_maker, expected_question_count=3)
        print(f"Accuracy score and explanation calculated: Score: {accuracy_score}, Explanation: {accuracy_explanation}")
        
        # adherence
        adherence_evaluator = adherenceEvaluator(generation_id)
        print("Adherence evaluator created")
        adherence_explanation, adherence_score = adherence_evaluator.evaluate_adherence()
        print(f"Adherence score and explanation calculated: Score: {adherence_score}, Explanation: {adherence_explanation}")
        
        # complexity
        complexity_evaluator = ComplexityEvaluator(supabase, llm, generation_id, class_id)
        print("Complexity evaluator created")
        complexity_explanation, complexity_score = complexity_evaluator.evaluate_complexity()
        print(f"Complexity score and explanation calculated: Score: {complexity_score}, Explanation: {complexity_explanation}")
        
        # novelty
        novelty_explanation, novelty_score = "Not implemented", 0
        print(f"Novelty score and explanation calculated: Score: {novelty_score}, Explanation: {novelty_explanation}")
        
        # clarity
        clarity_explanation, clarity_score = "Not implemented", 0
        print(f"Clarity score and explanation calculated: Score: {clarity_score}, Explanation: {clarity_explanation}")
        
        
            
        # uploading to supabase
        response = supabase.table("evaluations").insert({
            "generation": generation_id,
            "certainty": certainty_score,
            "certainty_explanation": certainty_explanation,
            "complexity": complexity_score,
            "complexity_explanation": complexity_explanation,
            "adherence": adherence_score,
            "adherence_explanation": adherence_explanation,
            "accuracy": accuracy_score,
            "accuracy_explanation": accuracy_explanation,
            "novelty": novelty_score,
            "novelty_explanation": novelty_explanation,
            "clarity": clarity_score,
            "clarity_explanation": clarity_explanation
        }).execute()
        
    except Exception as e:
        print(f"Error uploading evaluation to Supabase:")
        print(f"Generation ID: {generation_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        return f'Error uploading evaluation: {type(e).__name__} - {str(e)}', 500
    
    return 'Evaluation uploaded', 200



if __name__ == "__main__":
    print("Server starting up...")
    app.run(host='0.0.0.0', port=5000, debug=False)  # Set debug to False