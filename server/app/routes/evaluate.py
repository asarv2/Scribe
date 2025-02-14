import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import traceback
from app.services.evaluate.accuracy import AccuracyEvaluator
from app.services.evaluate.adherence import AdherenceEvaluator
# from app.services.evaluate.clarity import ClarityEvaluator
from app.services.evaluate.certainty import CertaintyEvaluator
from app.services.evaluate.complexity import ComplexityEvaluator
from app.services.evaluate.novelty import NoveltyEvaluator

from app.extensions import supabase
from datetime import datetime

# Define request models
class EvaluationRequest(BaseModel):
    lecture_id: str | None = None
    textbook_id: str | None = None
    generation_id: str | None = None

router = APIRouter()

@router.post('/lecture')
async def evaluate_lecture(request: EvaluationRequest):
    """Evaluate a lecture and return the documents."""
    try:
        # get lecture
        lecture = supabase.table("lectures").select("*").eq("id", request.lecture_id).execute()
        print(f"Lecture: {lecture}")
        
        # latency
        created_at = datetime.strptime(lecture.data[0]['created_at'], "%Y-%m-%dT%H:%M:%S.%f%z")
        created_at_timestamp = created_at.timestamp()
        end_time = time.time()
        latency_ms = (end_time - created_at_timestamp) * 1000
        print(f"Latency: {latency_ms} ms")

        # uploading to supabase
        response = supabase.table("evaluations").insert({
            "lecture": request.lecture_id,
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
        print(f"Lecture ID: {request.lecture_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error uploading evaluation: {type(e).__name__} - {str(e)}')
    
    return {'message': 'Evaluation uploaded'}

@router.post('/textbook')
async def evaluate_textbook(request: EvaluationRequest):
    """Evaluate a textbook and return the documents."""
    try:
        # get textbook
        textbook = supabase.table("textbooks").select("*").eq("id", request.textbook_id).execute()
        print(f"Textbook: {textbook}")
        
        # latency
        created_at = datetime.strptime(textbook.data[0]['created_at'], "%Y-%m-%dT%H:%M:%S.%f%z")
        created_at_timestamp = created_at.timestamp()
        end_time = time.time()
        latency_ms = (end_time - created_at_timestamp) * 1000
        print(f"Latency: {latency_ms} ms")

        # uploading to supabase
        response = supabase.table("evaluations").insert({
            "textbook": request.textbook_id,
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
        print(f"Textbook ID: {request.textbook_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error uploading evaluation: {type(e).__name__} - {str(e)}')
    
    return {'message': 'Evaluation uploaded'}

@router.post('/generation')
async def evaluate_generation(request: EvaluationRequest):
    """Evaluate a generation and return the documents."""
    try:
        # get generation
        generation = supabase.table("generations").select("*").eq("id", request.generation_id).single().execute()
        print(f"Generation: {generation}")

        if generation.data['type'] != 'chat':
            return {'message': 'Evaluation skipped'}
        
        # latency
        created_at = datetime.strptime(generation.data['created_at'], "%Y-%m-%dT%H:%M:%S.%f%z")
        created_at_timestamp = created_at.timestamp()
        end_time = time.time()
        latency_ms = (end_time - created_at_timestamp) * 1000
        print(f"Latency: {latency_ms} ms")
        
        # # certainty
        # certainty_evaluator = CertaintyEvaluator(supabase, generation_id)
        # print("Certainty evaluator created")
        # certainty_score, certainty_explanation = certainty_evaluator.evaluate_certainty()
        # print(f"Certainty score and explanation calculated: Score: {certainty_score}, Explanation: {certainty_explanation}")
        # # accuracy
        # accuracy_evaluator = AccuracyEvaluator(supabase, generation_id)
        # print("Accuracy evaluator created")
        # accuracy_explanation, accuracy_score = accuracy_evaluator.evaluate_accuracy()
        # print(f"Accuracy score and explanation calculated: Score: {accuracy_score}, Explanation: {accuracy_explanation}")
        
        # # adherence
        # adherence_evaluator = AdherenceEvaluator(supabase, "deepseek-r1-7b", generation_id)
        # print("Adherence evaluator created")
        # adherence_explanation, adherence_score = await adherence_evaluator.evaluate_adherence()
        # print(f"Adherence score and explanation calculated: Score: {adherence_score}, Explanation: {adherence_explanation}")

        # # clarity
        # # clarity_evaluator = ClarityEvaluator(supabase, llm, generation_id)
        # # print("Clarity evaluator created")
        # # clarity_explanation, clarity_score = clarity_evaluator.evaluate_clarity()
        # # print(f"Clarity score and explanation calculated: Score: {clarity_score}, Explanation: {clarity_explanation}")
        
        # # complexity
        # complexity_evaluator = ComplexityEvaluator(supabase, "deepseek-r1-7b", generation_id)
        # print("Complexity evaluator created")
        # complexity_explanation, complexity_score = await complexity_evaluator.evaluate_complexity()
        # print(f"Complexity score and explanation calculated: Score: {complexity_score}, Explanation: {complexity_explanation}")
        
        # # novelty
        # novelty_evaluator = NoveltyEvaluator(supabase, "deepseek-r1-7b", generation_id)
        # print("Novelty evaluator created")
        # novelty_explanation, novelty_score = await novelty_evaluator.evaluate_novelty()
        # print(f"Novelty score and explanation calculated: Score: {novelty_score}, Explanation: {novelty_explanation}")
        
        
        # uploading to supabase
        response = supabase.table("evaluations").insert({
            "generation": request.generation_id,
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
        print(f"Generation ID: {request.generation_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error uploading evaluation: {type(e).__name__} - {str(e)}')
    
    return {'message': 'Evaluation uploaded'}

