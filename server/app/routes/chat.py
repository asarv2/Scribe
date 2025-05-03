from fastapi import APIRouter, HTTPException, Request, Form
from datetime import datetime
import logging
import traceback
from app.extensions import get_supabase
from app.services.chat.main import ChatProcessor
from app.services.chat.models.main import Documents, ChatAgents, Reference
from app.services.chat.utils.references import fetch_chat_context, get_mapped_references
from app.services.chat.utils.outcomes import get_mapped_outcomes
from typing import List
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
        teacher = chat.get('teacher') # boolean
        used_files = chat.get('used_files', [])
        used_documents = chat.get('used_documents', [])

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

        # ——— NEW: build a 2D list of mapped references for each past message ———
        past_references: List[List[Reference]] = []
        for msg in messages:
            if msg['id'] != message_id:
                f_ids = msg.get('files') or []
                d_ids = msg.get('documents') or []
                
                # reuse your mapping helper
                past_references_for_msg, _ = await get_mapped_references(
                    supabase_client,
                    f_ids,
                    d_ids
                )
                past_references.append(past_references_for_msg)

        # Get resource IDs from the message
        file_ids = current_message.get('files', []) or []
        document_ids = current_message.get('documents', []) or []

        # Fetch chat context
        chat_context = await fetch_chat_context(supabase_client, chat_id, class_id)
        figures = chat_context.get('figures', [])
        summaries = chat_context.get('summaries', [])
        questions = chat_context.get('questions', [])
        outcomes = chat_context.get('outcomes', [])

        all_file_ids = used_files + file_ids
        all_document_ids = used_documents + document_ids

        # get the mapped references
        references_list, mapped_references = await get_mapped_references(supabase_client, all_file_ids, all_document_ids)

        # get the mapped outcomes   
        mapped_outcomes, full_outcome_description, outcomes_description = await get_mapped_outcomes(supabase_client, class_id, outcomes)

        # to call the agents
        documents = Documents(references=mapped_references, outcomes=mapped_outcomes, class_id=class_id, profile_id=profile_id, message_id=message_id, chat_id=chat_id, figures=figures, summaries=summaries, questions=questions, used_files=used_files, used_documents=used_documents)

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
        
        async def update_trace_id(chat_id: str, trace_id: str):
            supabase_client.table("chats").update({
                "trace": trace_id
            }).eq("id", chat_id).execute()

        async def update_chat_usage(chat_id: str, profile_id: str, input_tokens: int, output_tokens: int, cached_input_tokens: int):
            supabase_client.table("usage").insert({
                "chat": chat_id,
                "profile": profile_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cached_input_tokens": cached_input_tokens
            }).execute()

        async def update_chat_title(chat_id: str, title: str):
            response = supabase_client.table("chats").update({
                "name": title
            }).eq("id", chat_id).execute()
            return response.data[0]['trace']
        

        async def update_end_agent(message_id: str, end_agent: ChatAgents):
            supabase_client.table("messages").update({
                "end_agent": end_agent
            }).eq("id", message_id).execute()

        async def update_chat_files(chat_id: str, used_files: List[str], used_documents: List[str]):
            supabase_client.table("chats").update({
                "used_files": used_files,
                "used_documents": used_documents
            }).eq("id", chat_id).execute()

        # Initialize processor and response
        processor = ChatProcessor(
            chat_id=chat_id,
            teacher=teacher,
            starting_agent=current_message['start_agent'],
            course_title=class_title,
            all_file_ids=all_file_ids,
            all_document_ids=all_document_ids,
            references_mapping=mapped_references,
            references=references_list,
            question=current_message['bare_question'],
            past_messages=past_messages,
            past_references=past_references,
            trace_id=trace_id,
            stream_callback=update_callback,
            update_trace_id=update_trace_id,
            update_chat_usage=update_chat_usage,
            update_chat_title=update_chat_title,
            update_end_agent=update_end_agent,
            update_chat_files=update_chat_files,
            full_outcome_description=full_outcome_description
        )

        try:
            await processor.process_message(
                chat_id=chat_id,
                outcomes_description=outcomes_description,
                documents=documents
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
        # print the stack trace
        logger.error(f"Error in generate-chat function: {error}")
        logger.error(f"Stack trace: {traceback.format_exc()}")

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