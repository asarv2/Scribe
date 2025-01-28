import time
from flask import Blueprint, request
import traceback
from langchain_google_genai import ChatGoogleGenerativeAI
from app.services.evaluate.accuracy import GeminiDecisionMaker, generate_llm_quality_report
from app.services.evaluate.adherence import adherenceEvaluator
from app.services.evaluate.certainty import CertaintyEvaluator
from app.services.evaluate.complexity import ComplexityEvaluator
from app.extensions import supabase
evaluate_bp = Blueprint('evaluate', __name__)

@evaluate_bp.route('/lecture', methods=['POST'])
def evaluate_lecture():
    """Evaluate a lecture and return the documents."""
    data = request.get_json()
    lecture_id = data['lecture_id']
    
    try:
        # get lecture
        lecture = supabase.table("lectures").select("*").eq("id", lecture_id).execute()
        print(f"Lecture: {lecture}")
        
        # latency
        start_time = lecture.data[0]['created_at']
        end_time = time.time()
        latency_seconds = end_time - start_time
        latency_ms = latency_seconds * 1000
        print(f"Latency: {latency_ms} ms")

        # uploading to supabase
        response = supabase.table("evaluations").insert({
            "lecture": lecture_id,
            "latency": latency_ms,
            "certainty": 0,
            "certainty_explanation": "Not implemented",
            "complexity": 0,
            "complexity_explanation": "Not implemented",
            "adherence": 0,
            "adherence_explanation": "Not implemented",
            "accuracy": 0,
            "accuracy_explanation": "Not implemented",
            "novelty": 0,
            "novelty_explanation": "Not implemented",
            "clarity": 0,
            "clarity_explanation": "Not implemented"
        }).execute()
        print(f"Evaluation uploaded: {response}")
        
    except Exception as e:
        print(f"Error uploading evaluation to Supabase:")
        print(f"Lecture ID: {lecture_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        return f'Error uploading evaluation: {type(e).__name__} - {str(e)}', 500
    
    return 'Evaluation uploaded', 200


@evaluate_bp.route('/generation', methods=['POST'])
def evaluate_generation():
    """Evaluate a generation and return the documents."""
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

        # get generation
        generation = supabase.table("generations").select("*").eq("id", generation_id).execute()
        print(f"Generation: {generation}")
        
        # latency
        start_time = generation.data[0]['created_at']
        end_time = time.time()
        latency_seconds = end_time - start_time
        latency_ms = latency_seconds * 1000
        print(f"Latency: {latency_ms} ms")
        
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
            "latency": latency_ms,
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
        print(f"Evaluation uploaded: {response}")
        
    except Exception as e:
        print(f"Error uploading evaluation to Supabase:")
        print(f"Generation ID: {generation_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        return f'Error uploading evaluation: {type(e).__name__} - {str(e)}', 500
    
    return 'Evaluation uploaded', 200

