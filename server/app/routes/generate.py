from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import traceback
from typing import Dict, List, Any, Union, Optional
from pydantic import BaseModel
from app.extensions import supabase
from app.services.chat.chat_processor import ChatProcessor, ChatMessage
import json
import asyncio

router = APIRouter()

class ChatRequest(BaseModel):
    chat_id: str
    message_id: str

@router.post('/chat')
async def handle_message(request: ChatRequest):
    """Handle chat for a class with streaming support."""
    try:
        print("Starting handle-chat function...")
        chat_id = request.chat_id
        message_id = request.message_id

        # Mark message as generating
        supabase.table("messages").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("id", message_id).execute()

        chat_response = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        chat = chat_response.data
        class_id = chat.get('class')

        # Get class info
        class_response = supabase.table("classes").select(
            "title, course_description, map"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get all lectures
        lectures_response = supabase.table("lectures").select("*").eq("class", class_id).execute()
        all_lectures = lectures_response.data or []

        # Get all textbooks
        textbooks_response = supabase.table("textbooks").select("*").eq("class", class_id).execute()
        all_textbooks = textbooks_response.data or []

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase.table("messages").select("*").order("created_at", desc=True).eq("chat", chat_id).execute()
        messages = messages_response.data

        # Get the first message (the one we need to process)
        current_message = next((msg for msg in messages if msg['id'] == message_id), None)
        
        # Format past messages for context
        past_messages = [(msg['id'], msg['question'], msg.get('response', '')) for msg in messages if msg['id'] != message_id]

        # Get documents for the current message
        current_documents_response = supabase.table("documents").select("*").in_("id", current_message.get('documents', [])).execute()
        current_documents = current_documents_response.data or []

        # Format the context for the current message
        message_context = []
        for doc in current_documents:
            if doc.get('lecture') is not None:
                lecture_name = next((l.get('name') for l in all_lectures if l.get('id') == doc.get('lecture')), None)
                content = f"LECTURE {lecture_name} SLIDE {doc.get('page')}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                message_context.append(content)
            elif doc.get('textbook') is not None:
                textbook_name = next((t.get('title') for t in all_textbooks if t.get('id') == doc.get('textbook')), None)
                content = f"TEXTBOOK {textbook_name} PAGE {doc.get('page')}\nContent: {doc.get('text')}\nDescription: {doc.get('description')}\n"
                message_context.append(content)

        async def stream_generator():
            try:
                processor = ChatProcessor(
                    course_title=class_title,
                    message_id=message_id,
                    question=current_message['question'],
                    past_messages=past_messages
                )

                total_response = ""

                async def stream_callback(chunk: str):
                    nonlocal total_response
                    total_response += chunk  
                    # Return the chunk as a string, not a dict
                    return chunk

                async for chunk in processor.process_message(
                    complete_context="\n".join(message_context),
                    all_lectures=all_lectures,
                    all_textbooks=all_textbooks,
                    all_documents=current_documents,
                    stream_callback=stream_callback
                ):
                    # Properly format the chunk as a SSE message
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n".encode('utf-8')

                # Clean the response and extract document references
                cleaned_result = processor.clean_result(
                    total_response,
                    all_lectures,
                    all_textbooks,
                    current_documents
                )

                # Update the message in Supabase with the complete response
                supabase.table("messages").update({
                    "response": cleaned_result['response'],
                    "documents": cleaned_result['documents'],
                    "generation_status": "complete",
                    "generation_error": ""
                }).eq("id", message_id).execute()

                # Send completion event
                yield f"data: {json.dumps({'done': True})}\n\n".encode('utf-8')

            except Exception as error:
                error_data = {
                    "error": str(error),
                    "stack": traceback.format_exc(),
                    "name": type(error).__name__
                }
                yield f"data: {json.dumps({'error': error_data})}\n\n".encode('utf-8')
                
                # Update message status to error
                supabase.table("messages").update({
                   "generation_status": "complete",
                    "generation_error": str(error),
                }).eq("id", message_id).execute()

        return StreamingResponse(
            stream_generator(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        )

    except Exception as error:
        print("Error in generate-chat function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(error),
                "stack": traceback.format_exc(),
                "name": type(error).__name__
            }
        )
        

        
        



