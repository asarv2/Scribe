from fastapi import APIRouter, HTTPException, Request, Form
from datetime import datetime
import traceback
from app.extensions import supabase
from app.services.chat.main import ChatProcessor
from app.services.chat.models import Documents, fetch_file_resources, fetch_chat_context

router = APIRouter()

@router.post('/chat')
async def handle_chat(
    request: Request,
    chat_id: str = Form(...),
    message_id: str = Form(...)
):
    """Handle chat for a class with streaming support."""
    try:
        print("Starting handle-chat function...")
        # Mark message as generating
        supabase.table("messages").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("id", message_id).execute()

        # Get chat and class info
        chat_response = supabase.table("chats").select("*").eq("id", chat_id).single().execute()
        chat = chat_response.data
        class_id = chat.get('class')

        class_response = supabase.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase.table("messages").select("*").order("created_at", desc=False).eq("chat", chat_id).execute()
        messages = messages_response.data

        # Get the current message and format past messages for context
        current_message = next((msg for msg in messages if msg['id'] == message_id), None)
        past_messages = [(msg['id'], msg['bare_question'], msg.get('bare_response', '')) for msg in messages if msg['id'] != message_id]

        # Get resource IDs from the message
        file_ids = current_message.get('files', []) or []

        # Fetch chat context
        chat_context = await fetch_chat_context(supabase, chat_id)
        figures = chat_context.get('figures', [])
        summaries = chat_context.get('summaries', [])
        questions = chat_context.get('questions', [])
        references = chat_context.get('references', [])

        # Fetch resources and their documents
        file_resources = await fetch_file_resources(supabase, file_ids, class_id, chat_id, message_id, figures, summaries, questions, references)
        context = file_resources.get('context', '')
        documents = file_resources.get('documents', {})
        google_file_ids = file_resources.get('google_file_ids', [])

        total_response = ""
        async def update_callback(chunk: str):
            nonlocal total_response
            total_response += chunk
            
            # Update Supabase with the sanitized version
            supabase.table("messages").update({
                "bare_response": total_response,
                "response": total_response,
                "generation_status": "generating"
            }).eq("id", message_id).execute()
            
            return chunk
        
        async def remove_callback(chunk: str):
            total_response = total_response.replace(chunk, '')

            # Update Supabase with the sanitized version
            supabase.table("messages").update({
                "bare_response": total_response,
                "response": total_response,
                "generation_status": "generating"
            }).eq("id", message_id).execute()

            return chunk

        # Initialize processor and response
        processor = ChatProcessor(
            prompt_type=chat['type'],
            course_title=class_title,
            question=current_message['bare_question'],
            past_messages=past_messages,
            google_file_ids=google_file_ids,
            stream_callback=update_callback,
            remove_callback=remove_callback
        )

        try:
            await processor.process_message(
                chat_id=chat_id,
                complete_context=context,
                documents=documents,
            )

            # update the status of the message to completed
            supabase.table("messages").update({
                "generation_status": "complete",
                "generation_error": ""
            }).eq("id", message_id).execute()

            return {"status": "success", "message_id": message_id}

        except Exception as error:
            # throw the error to the outside block
            raise error
    except Exception as error:
        print("Error in generate-chat function:", {
            "name": type(error).__name__,
            "message": str(error),
            "stack": traceback.format_exc()
        })

        # Update message status to error
        supabase.table("messages").update({
            "generation_status": "error",
            "generation_error": str(error),
        }).eq("id", message_id).execute()
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(error),
                "stack": traceback.format_exc(),
                "name": type(error).__name__
            }
        )