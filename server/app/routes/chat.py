from fastapi import APIRouter, HTTPException, Request, Form
from datetime import datetime
import logging
import traceback
from app.extensions import get_supabase
from app.services.chat.main import ChatProcessor
from app.services.chat.models import Documents, fetch_chat_context, get_mapped_references
from app.services.chat.google import GoogleFiles
router = APIRouter()

logger = logging.getLogger(__name__)

@router.post('/message')
async def handle_chat(
    request: Request,
    chat_id: str = Form(...),
    message_id: str = Form(...)
):
    """Handle chat for a class with streaming support."""
    try:
        supabase_client = get_supabase()
        logger.info("Starting handle-chat function...")
        # Mark message as generating
        supabase_client.table("messages").update({
            "generation_status": "generating",
            "generation_error": "",
            "last_generation_attempt": datetime.now().isoformat()
        }).eq("id", message_id).execute()

        # Get chat and class info
        chat_response = supabase_client.table("chats").select("*").eq("id", chat_id).single().execute()
        chat = chat_response.data
        trace_id = chat.get('trace')
        class_id = chat.get('class')
        profile_id = chat.get('profile')

        class_response = supabase_client.table("classes").select(
            "title, course_description"
        ).eq("id", class_id).single().execute()
        class_title = class_response.data.get('title')

        # Get all messages for this generation, ordered by creation time
        messages_response = supabase_client.table("messages").select("*").order("created_at", desc=False).eq("chat", chat_id).execute()
        messages = messages_response.data

        # Get the current message and format past messages for context
        current_message = next((msg for msg in messages if msg['id'] == message_id), None)
        past_messages = [(msg['id'], msg['bare_question'], msg.get('bare_response', '')) for msg in messages if msg['id'] != message_id]

        # Get resource IDs from the message
        file_ids = current_message.get('files', []) or []
        document_ids = current_message.get('documents', []) or []

        # Fetch chat context
        chat_context = await fetch_chat_context(supabase_client, chat_id)
        figures = chat_context.get('figures', [])
        summaries = chat_context.get('summaries', [])
        questions = chat_context.get('questions', [])
        references = chat_context.get('references', [])

        # get the mapped references
        mapped_references, text_description, ordered_file_ids, ordered_document_ids = await get_mapped_references(supabase_client, file_ids, document_ids, references)
        logger.info(f"Text description: {text_description}")

        # to call the agents
        documents = Documents(references=mapped_references, class_id=class_id, profile_id=profile_id, message_id=message_id, chat_id=chat_id, figures=figures, summaries=summaries, questions=questions)

        # Fetch google file ids
        google_files = GoogleFiles(ordered_file_ids, ordered_document_ids, supabase_client)
        google_file_ids = google_files.get_files()
        google_document_ids = google_files.get_documents()
        google_ids = google_file_ids + google_document_ids

        total_response = ""
        async def update_callback(chunk: str):
            nonlocal total_response
            total_response += chunk
            
            # Update Supabase with the sanitized version
            supabase_client.table("messages").update({
                "bare_response": total_response,
                "response": total_response,
                "generation_status": "generating"
            }).eq("id", message_id).execute()
            
            return chunk
        
        async def remove_callback(chunk: str):
            total_response = total_response.replace(chunk, '')

            # Update Supabase with the sanitized version
            supabase_client.table("messages").update({
                "bare_response": total_response,
                "response": total_response,
                "generation_status": "generating"
            }).eq("id", message_id).execute()

            return chunk
        
        async def update_trace_id(chat_id: str, trace_id: str):
            supabase_client.table("chats").update({
                "trace": trace_id
            }).eq("id", chat_id).execute()

        async def update_chat_usage(chat_id: str, profile_id: str, input_tokens: int, output_tokens: int):
            supabase_client.table("usage").insert({
                "chat": chat_id,
                "profile": profile_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }).execute()

        # Initialize processor and response
        processor = ChatProcessor(
            prompt_type=chat['chat_type'],
            course_title=class_title,
            question=current_message['bare_question'],
            past_messages=past_messages,
            trace_id=trace_id,
            stream_callback=update_callback,
            remove_callback=remove_callback,
            update_trace_id=update_trace_id,
            update_chat_usage=update_chat_usage
        )

        try:
            await processor.process_message(
                chat_id=chat_id,
                google_ids=google_ids,
                documents=documents,
                reference_description=text_description
            )

            # update the status of the message to completed
            supabase_client.table("messages").update({
                "generation_status": "complete",
                "generation_error": ""
            }).eq("id", message_id).execute()

            return {"status": "success", "message_id": message_id}

        except Exception as error:
            # throw the error to the outside block
            raise error
    except Exception as error:
        logger.error(f"Error in generate-chat function: {error}")

        # Update message status to error
        supabase_client.table("messages").update({
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