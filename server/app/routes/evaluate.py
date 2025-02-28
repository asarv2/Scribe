import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import traceback
from app.extensions import supabase
from datetime import datetime
from app.services.chat.topic_processor import TopicProcessor

# Define request models
class EvaluationRequest(BaseModel):
    lecture_id: str | None = None
    textbook_id: str | None = None
    generation_id: str | None = None
    message_id: str | None = None

router = APIRouter()

@router.post('/lecture')
async def evaluate_lecture(request: EvaluationRequest):
    """Evaluate a lecture and return the documents."""
    try:
        # get lecture
        lecture = supabase.table("lectures").select("*").eq("id", request.lecture_id).execute()
        
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
        chat = supabase.table("chats").select("*").eq("id", message.data[0]['chat']).execute()
        # get all messages, using the chat id of the initial message
        messages_response = supabase.table("messages").select("*").order("created_at", desc=False).eq("chat", chat.data[0]['id']).execute()
        messages = messages_response.data

        # Get the first message (the one we need to process)
        current_message = next((msg for msg in messages if msg['id'] == request.message_id), None)
        if not current_message:
            raise HTTPException(status_code=404, detail="Message not found")

        # Format past messages for context
        past_messages = [(msg['id'], msg['bare_question'], msg.get('bare_response', '')) for msg in messages if msg['id'] != request.message_id]

        # fetch topics from 'faq' table
        topics = supabase.table("faq").select("*").eq("class", chat.data[0]['class']).execute()
        topics_prompt = [f"TOPIC {i+1}: {topic['topic']}" for i, topic in enumerate(topics.data)]
        topics_uuid = {i+1: (topic['id'], topic['topic']) for i, topic in enumerate(topics.data)}

        # prompt model to group the message into topics of questions being asked
        processor = TopicProcessor(
            topics_prompt, 
            current_message['bare_question'],
            request.message_id,
            past_messages
        )

        # Add await here
        response = await processor.process_message()

        # get dict of uuids of topics and their updated counts
        cleaned_result = processor.clean_result(response, topics_uuid)
        print(f"Cleaned result: {cleaned_result}")

        # Prepare topics for updating
        topics_to_update = []
        new_topics = []

        for topic_id, topic_name, count in cleaned_result:
            if topic_id:  # Existing topic
                # Find the existing topic and increment its count
                existing_topic = next((t for t in topics.data if t['id'] == topic_id), None)
                if existing_topic:
                    topics_to_update.append({
                        "id": topic_id,
                        "messages": existing_topic['messages'] + [request.message_id],
                        "count": existing_topic['count'] + count,
                        "class": chat.data[0]['class']
                    })
            else:  # New topic
                new_topics.append({
                    "topic": topic_name,
                    "messages": [request.message_id],
                    "count": count,
                    "class": chat.data[0]['class']
                })

        # Update existing topics
        if topics_to_update:
            supabase.table("faq").upsert(topics_to_update).execute()

        # Insert new topics
        if new_topics:
            supabase.table("faq").insert(new_topics).execute()

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
