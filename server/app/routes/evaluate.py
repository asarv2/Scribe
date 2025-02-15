import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import traceback
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
        response = supabase.table("evals_lecture").insert({
            "lecture": request.lecture_id,
            "latency": latency_ms,
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
        response = supabase.table("evals_textbook").insert({
            "textbook": request.textbook_id,
            "latency": latency_ms,
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

@router.post('/homework')
async def evaluate_homework(request: EvaluationRequest):
    """Evaluate a homework and return the documents."""
    try:
        # get textbook
        homework = supabase.table("homeworks").select("*").eq("id", request.homework_id).execute()
        print(f"Homework: {homework}")
        
        # latency
        created_at = datetime.strptime(homework.data[0]['created_at'], "%Y-%m-%dT%H:%M:%S.%f%z")
        created_at_timestamp = created_at.timestamp()
        end_time = time.time()
        latency_ms = (end_time - created_at_timestamp) * 1000
        print(f"Latency: {latency_ms} ms")

        # uploading to supabase
        response = supabase.table("evals_homework").insert({
            "homework": request.homework_id,
            "latency": latency_ms,
        }).execute()
        print(f"Evaluation uploaded: {response}")
        
    except Exception as e:
        print(f"Error uploading evaluation to Supabase:")
        print(f"Homework ID: {request.homework_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error uploading evaluation: {type(e).__name__} - {str(e)}')
    
    return {'message': 'Evaluation uploaded'}

@router.post('/message')
async def evaluate_message(request: EvaluationRequest):
    """Evaluate a message and return the documents."""
    try:
        # get message
        message = supabase.table("messages").select("*").eq("id", request.message_id).execute()
        print(f"Message: {message}")
        
        # latency
        created_at = datetime.strptime(message.data[0]['created_at'], "%Y-%m-%dT%H:%M:%S.%f%z")
        created_at_timestamp = created_at.timestamp()
        end_time = time.time()
        latency_ms = (end_time - created_at_timestamp) * 1000
        print(f"Latency: {latency_ms} ms")

        # uploading to supabase
        response = supabase.table("evals_message").insert({
            "message": request.message_id,
            "latency": latency_ms,
        }).execute()
        print(f"Evaluation uploaded: {response}")
        
    except Exception as e:
        print(f"Error uploading evaluation to Supabase:")
        print(f"Message ID: {request.message_id}")
        print(f"Error details: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Traceback: ", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f'Error uploading evaluation: {type(e).__name__} - {str(e)}')
    
    return {'message': 'Evaluation uploaded'}
