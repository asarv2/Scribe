import traceback
import os
import sys
# Add app directory to Python path for local development
if not os.getenv('DOCKER_ENV'):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.append(BASE_DIR)
else:
    BASE_DIR = '/app'
from datetime import datetime
from flask import Flask, request, jsonify
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
from app.lecture.parse.lecture_processor import LectureProcessor
from app.lecture.parse.textbook_processor import TextbookProcessor

load_dotenv()
    
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

app = Flask(__name__)
# Enable all origins and methods
CORS(app, resources={r"/*": {"origins": "*"}})
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

print("Server starting up...") # Direct print for immediate feedback

# creating supabase client        
supabase_url = os.getenv("SUPABASE_URL")
supabase_private_key = os.getenv("SUPABASE_PRIVATE_KEY")
opts = ClientOptions().replace(schema=os.getenv("SUPABASE_SCHEMA"))
supabase: Client = create_client(supabase_url, supabase_private_key, options=opts)
print("Supabase client created")

@app.route('/')
@app.route('/health')
def health():
    """
    Check if the server is healthy.
    """
    return {"status": "healthy"}, 200

@app.route('/parse-lecture', methods=['POST'])
async def parse_lecture():
    """
    Parse a lecture and return the documents.
    """
    try:
        print("Starting parse-lecture function...")
        data = request.get_json()
        class_id = data.get('class_id')
        lecture_id = data.get('lecture_id')
        handwritten = data.get('handwritten')
        
        print("Request params:", {"class_id": class_id, "lecture_id": lecture_id, "handwritten": handwritten})

        # Update lecture status to parsing
        supabase.table("lectures").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", lecture_id).execute()

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get lecture info
        lecture_response = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
        num_pages = lecture_response.data.get('pages')
        print("Lecture query response:", lecture_response)

        # Get existing documents
        documents_response = supabase.table("documents").select("*").eq("lecture", lecture_id).execute()
        documents = documents_response.data
        if not documents:
            raise Exception("No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print("Documents to process:", documents_to_process)

        # Create new instance of LectureProcessor
        lecture_processor = LectureProcessor(class_title, handwritten)
        print("LectureProcessor created")

        # Process in batches
        batch_size = 20
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images and figures from supabase
            images = []
            figures = []
            
            try:
                for doc in batch:
                    # Download image
                    image_path = f"{class_id}/{lecture_id}/{doc['id']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    response = supabase.storage.from_("lectures").download(image_path)
                    
                    if not response:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response)
                    print(f"Successfully downloaded image {doc['page']}")

                    # Get figures
                    figures_response = supabase.table("figures").select("*").eq("document", doc['id']).execute()
                    figures_data = figures_response.data
                    if not figures_data:
                        print(f"No figures found for document {doc['id']}")
                        figures.append([])
                        continue

                    formatted_figures = [
                        {
                            "bbox": [
                                float(fig['x_min']), 
                                float(fig['y_min']), 
                                float(fig['x_max']), 
                                float(fig['y_max'])
                            ],
                            "description": str(fig['description'])
                        }
                        for fig in figures_data
                    ]
                    figures.append(formatted_figures)

            except Exception as error:
                print("Error in image/figures download process:", error)
                raise error

            print("Total images downloaded:", len(images))

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                    "image_bboxes": figs
                }
                for doc, img, figs in zip(batch, images, figures)
            ]
            print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting lecture processing...")
            
            async def after_generate(result):
                # Find document ID
                document_id = next(
                    (doc['id'] for doc in documents if doc['page'] == result.page),
                    None
                )
                if not document_id:
                    raise Exception(f"Document not found for page {result.page}")

                # Update document
                supabase.table("documents").update({
                    "latex": result.latex,
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()

                # Insert new figures
                figures_data = [
                    {
                        "x_min": figure.bbox[0],
                        "x_max": figure.bbox[2],
                        "y_min": figure.bbox[1],
                        "y_max": figure.bbox[3],
                        "description": figure.description,
                        "document": document_id
                    }
                    for figure in result.figures
                ]
                
                if figures_data:
                    supabase.table("figures").insert(figures_data).execute()
                
                print("Document inserted:", result.description)

            results = await lecture_processor.process_slides(
                class_title,
                num_pages,
                processed_documents,
                after_generate
            )
            print("Lecture processing for batch complete, results:", results)
            batch_results.append(results)

        print("Batch results:", batch_results)

        # Update lecture status to complete
        supabase.table("lectures").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", lecture_id).execute()

        return jsonify({"results": batch_results}), 200

    except Exception as error:
        print("Error in parse-lecture function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update lecture status to error
        supabase.table("lectures").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", lecture_id).execute()

        return jsonify({
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        }), 500
    
@app.route('/parse-textbook', methods=['POST'])
async def parse_textbook():
    """
    Parse a textbook and return the documents.
    """
    try:
        print("Starting parse-textbook function...")
        data = request.get_json()
        class_id = data.get('class_id')
        textbook_id = data.get('textbook_id')
        handwritten = data.get('handwritten')
        
        print("Request params:", {"class_id": class_id, "textbook_id": textbook_id, "handwritten": handwritten})

        # Update textbook status to parsing
        supabase.table("textbooks").update({
            "parse_status": "parsing",
            "parse_error": None,
            "last_parse_attempt": datetime.now().isoformat()
        }).eq("id", textbook_id).execute()

        # Get class title
        class_response = supabase.table("classes").select("*").eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')
        print("Class query response:", class_response)

        # Get textbook info
        textbook_response = supabase.table("textbooks").select("*").eq("id", textbook_id).single().execute()
        num_pages = textbook_response.data.get('pages')
        print("Textbook query response:", textbook_response)

        # Get existing documents
        documents_response = supabase.table("documents").select("*").eq("textbook", textbook_id).execute()
        documents = documents_response.data
        if not documents:
            raise Exception("No documents found")

        # Filter out processed documents
        documents_to_process = [doc for doc in documents if not doc.get('processed', False)]
        print("Documents to process:", documents_to_process)

        # Create new instance of TextbookProcessor
        textbook_processor = TextbookProcessor(class_title, handwritten)
        print("TextbookProcessor created")

        # Process in batches
        batch_size = 20
        batch_results = []
        
        for i in range(0, len(documents_to_process), batch_size):
            batch = documents_to_process[i:i + batch_size]
            print("Processing batch:", batch)

            # Get images and figures from supabase
            images = []
            figures = []
            
            try:
                for doc in batch:
                    # Download image
                    image_path = f"{class_id}/textbooks/{textbook_id}/images/{doc['page']}.png"
                    print(f"Trying to download: {image_path}")
                    
                    response = supabase.storage.from_("slides").download(image_path)
                    
                    if not response.data:
                        print(f"No data received for image {doc['page']}")
                        continue

                    images.append(response.data)
                    print(f"Successfully downloaded image {doc['page']}")

                    # Get figures
                    figures_response = supabase.table("figures").select("*").eq("document", doc['id']).execute()
                    figures_data = figures_response.data
                    if not figures_data:
                        print(f"No figures found for document {doc['id']}")
                        figures.append([])
                        continue

                    formatted_figures = [
                        {
                            "bbox": [
                                float(fig['x_min']), 
                                float(fig['y_min']), 
                                float(fig['x_max']), 
                                float(fig['y_max'])
                            ],
                            "description": str(fig['description'])
                        }
                        for fig in figures_data
                    ]
                    figures.append(formatted_figures)

            except Exception as error:
                print("Error in image/figures download process:", error)
                raise error

            print("Total images downloaded:", len(images))
            print("Images query response:", images)

            # Prepare documents for processing
            processed_documents = [
                {
                    "page": doc["page"],
                    "image": img,
                    "text": doc.get("text", ""),
                    "image_bboxes": figs
                }
                for doc, img, figs in zip(batch, images, figures)
            ]
            print("Processed documents:", processed_documents)

            # Process the batch
            print("Starting textbook processing...")
            
            async def after_generate(result):
                # Find document ID
                document_id = next(
                    (doc['id'] for doc in documents if doc['page'] == result.page),
                    None
                )
                if not document_id:
                    raise Exception(f"Document not found for page {result.page}")

                # Update document
                supabase.table("documents").update({
                    "latex": result.latex,
                    "description": result.description,
                    "processed": True
                }).eq("id", document_id).execute()

                # Insert new figures
                figures_data = [
                    {
                        "x_min": figure.bbox[0],
                        "x_max": figure.bbox[2],
                        "y_min": figure.bbox[1],
                        "y_max": figure.bbox[3],
                        "description": figure.description,
                        "document": document_id
                    }
                    for figure in result.figures
                ]
                
                if figures_data:
                    supabase.table("figures").insert(figures_data).execute()
                
                print("Document inserted:", result.description)

            results = await textbook_processor.process_pages(
                class_title,
                num_pages,
                processed_documents,
                after_generate
            )
            print("Textbook processing for batch complete, results:", results)
            batch_results.append(results)

        print("Batch results:", batch_results)

        # Update textbook status to complete
        supabase.table("textbooks").update({
            "parse_status": "complete",
            "parse_error": None
        }).eq("id", textbook_id).execute()

        return jsonify({"results": batch_results}), 200

    except Exception as error:
        print("Error in parse-textbook function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc(),
        })
        
        # Update textbook status to error
        supabase.table("textbooks").update({
            "parse_status": "error",
            "parse_error": str(error)
        }).eq("id", textbook_id).execute()

        return jsonify({
            "error": str(error),
            "stack": traceback.format_exc(),
            "name": type(error).__name__
        }), 500

@app.route('/parse-video', methods=['POST'])
def parse_video():
    """
    Parse a video and audio chunk and return the documents.
    """
    ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}
    def allowed_file(filename):
        return '.' in filename and \
            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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


@app.route("/evaluate-lecture", methods=["POST"])
def evaluate_lecture():
    data = request.get_json()
    lecture_id = data['lecture_id']
    class_id = data['class_id']
    return "Not implemented", 500


@app.route("/evaluate-generation", methods=["POST"])
def evaluate_generation():
    data = request.get_json()
    generation_id = data['generation_id']
    
    try:
        
        llm = ChatGoogleGenerativeAI(
            model='gemini-1.5-flash',
            temperature=0, 
            max_tokens=None, 
            timeout=None, 
            max_retries=2
        )
        
        # certainty
        certainty_evaluator = CertaintyEvaluator(supabase, generation_id)
        print("Certainty evaluator created")
        certainty_score, certainty_explanation = certainty_evaluator.evaluate_certainty()
        print(f"Certainty score and explanation calculated: Score: {certainty_score}, Explanation: {certainty_explanation}")
        # accuracy
        gemini_decision_maker = GeminiDecisionMaker(supabase, generation_id)
        print("Gemini decision maker created")
        accuracy_explanation, accuracy_score = generate_llm_quality_report(gemini_decision_maker, expected_question_count=3)
        print(f"Accuracy score and explanation calculated: Score: {accuracy_score}, Explanation: {accuracy_explanation}")
        
        # adherence
        adherence_evaluator = adherenceEvaluator(generation_id)
        print("Adherence evaluator created")
        adherence_explanation, adherence_score = adherence_evaluator.evaluate_adherence()
        print(f"Adherence score and explanation calculated: Score: {adherence_score}, Explanation: {adherence_explanation}")
        
        # complexity
        complexity_evaluator = ComplexityEvaluator(supabase, llm, generation_id)
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
    if os.getenv('DOCKER_ENV'):
        app.run(host='0.0.0.0', port=5000, debug=False) # Set debug to False
    else:
        app.run(host='0.0.0.0', port=8000, debug=False)  # Set debug to False
