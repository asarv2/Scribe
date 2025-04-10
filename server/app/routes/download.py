from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Form, Response, Query
from fastapi.responses import FileResponse
from app.extensions import supabase, ONEDRIVE_FILES_DIR
from pydantic import BaseModel
import traceback
import os
from app.services.download.summary_downloader import SummaryDownloader
from app.services.download.questions_downloader import QuestionsDownloader
import re
import httpx

router = APIRouter()

@router.get('/summary')
async def download_summary_get(
    request: Request,
    summary_id: str = Query(...),
    chat_id: str = Query(...),
    format: str = Query(...),  # 'pdf', 'latex', or 'text'
):
    """Download a summary for a given summary ID using GET method."""
    try:
        # Get chat data
        chat_response = supabase.table("chats").select("*").eq("id", chat_id).execute()

        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        chat_data = chat_response.data[0]
        chat_title = chat_data.get('name', 'Summary')


        # get all messages for this chat
        messages_response = supabase.table("messages").select("*").eq("chat", chat_id).execute()

        if not messages_response.data:
            raise HTTPException(status_code=404, detail="Messages not found")
        
        
        
        # Get summary data
        summary_response = supabase.table("summaries").select("*").eq("id", summary_id).execute()
        
        if not summary_response.data:
            raise HTTPException(status_code=404, detail="Summary not found")
        
        summary_data = summary_response.data[0]
        
        # Get all summaries for this chat to determine position/number
        all_summaries_response = supabase.table("summaries").select("*").in_("message", [message.get('id') for message in messages_response.data]).execute()
        all_summaries = all_summaries_response.data
        
        # Sort all summaries by created_at to determine their position/number
        all_summaries.sort(key=lambda s: s.get('created_at', ''))
        
        # Find the position of this summary
        summary_position = None
        for idx, s in enumerate(all_summaries):
            if s.get('id') == summary_id:
                summary_position = idx + 1
                break
        
        # Create a suffix based on the summary position
        suffix = f"Summary{summary_position}" if summary_position else "Summary"
        
        # Create document title
        document_title = f"{chat_title} {suffix}"
        
        # Create Summary object
        summary = {
            "id": summary_id,
            "preamble": summary_data.get('preamble', ''),
            "content": summary_data.get('body', ''),  # Note: 'body' in DB, 'content' in Summary type
            "conclusion": summary_data.get('conclusion', ''),
            "lecture_references": summary_data.get('lecture_references', []),
            "chapter_references": summary_data.get('chapter_references', []),
            "chapter_exercise_references": summary_data.get('chapter_exercise_references', []),
            "homework_exercise_references": summary_data.get('homework_exercise_references', []),
            "figures": summary_data.get('figures', [])
        }
        
        # Create downloader
        downloader = SummaryDownloader(summary)
        
        # Generate file based on format
        if format == 'pdf':
            filepath = downloader.download_pdf()
            media_type = 'application/pdf'
            filename = f"{document_title}.pdf"
        elif format == 'latex':
            filepath = downloader.download_latex()
            media_type = 'application/x-tex'
            filename = f"{document_title}.tex"
        elif format == 'text':
            filepath = downloader.download_text()
            media_type = 'text/plain'
            filename = f"{document_title}.txt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail="Failed to generate file")
        
        # Clean filename for safe download
        filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
            
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type=media_type
        )

    except Exception as e:
        print("Error in download-summary-get function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )

@router.get('/questions')
async def download_questions_get(
    request: Request,
    chat_id: str = Query(...),
    question_ids: list[str] = Query(...),
    format: str = Query(...),  # 'pdf', 'latex', or 'text'
):
    """Download questions for a given questions ID using GET method."""
    try:
        # Get chat data
        chat_response = supabase.table("chats").select("*").eq("id", chat_id).execute()

        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        chat_data = chat_response.data[0]
        chat_title = chat_data.get('name', 'Questions')

        # get messages
        messages_response = supabase.table("messages").select("*").eq("chat", chat_id).execute()

        if not messages_response.data:
            raise HTTPException(status_code=404, detail="Messages not found")
        
        messages_data = messages_response.data

        # get all question ids from messages
        all_message_ids = [message.get('id') for message in messages_data]
        all_questions_response = supabase.table("questions").select("*").in_("message", all_message_ids).execute()
        
        if not all_questions_response.data:
            raise HTTPException(status_code=404, detail="Questions not found")
        
        all_questions = all_questions_response.data
        
        # Sort all questions by created_at to determine their position/number
        all_questions.sort(key=lambda q: q.get('created_at', ''))
        
        # Create a mapping of question_id to question number
        question_numbers = {q.get('id'): idx + 1 for idx, q in enumerate(all_questions)}
        
        # Get questions data for the selected questions
        questions_response = supabase.table("questions").select("*").in_("id", question_ids).execute()
        
        if not questions_response.data:
            raise HTTPException(status_code=404, detail="Questions not found")
        
        # Format questions data for the downloader
        questions_data = []
        for question in questions_response.data:
            frq_question = question.get('frq', False)  # Default to frq if type not specified
            
            if not frq_question:
                # MCQ question
                mcq_question = {
                    "id": question.get('id'),
                    "question_type": "mcq",  # Add explicit question_type field
                    "question": question.get('problem', ''),
                    "options": question.get('options', []),
                    "answers": question.get('answers', []),
                    "explanations": question.get('explanations', []),
                    "tags": question.get('tags', []),
                    "lecture_references": question.get('lecture_references', []),
                    "chapter_references": question.get('chapter_references', []),
                    "chapter_exercise_references": question.get('chapter_exercise_references', []),
                    "homework_exercise_references": question.get('homework_exercise_references', []),
                    "figures": question.get('figures', [])
                }
                questions_data.append([mcq_question])
            else:
                # FRQ question
                frq_question = {
                    "id": question.get('id'),
                    "question_type": "frq",  # Add explicit question_type field
                    "question": question.get('problem', ''),
                    "solution": question.get('solution', ''),
                    "tags": question.get('tags', []),
                    "lecture_references": question.get('lecture_references', []),
                    "chapter_references": question.get('chapter_references', []),
                    "chapter_exercise_references": question.get('chapter_exercise_references', []),
                    "homework_exercise_references": question.get('homework_exercise_references', []),
                    "figures": question.get('figures', [])
                }
                questions_data.append([frq_question])
        
        # Create a suffix based on the question numbers
        selected_question_numbers = [question_numbers.get(qid) for qid in question_ids if qid in question_numbers]
        selected_question_numbers.sort()
        
        if len(selected_question_numbers) == 1:
            # Single question
            suffix = f"Q{selected_question_numbers[0]}"
        elif len(selected_question_numbers) > 1:
            # Multiple questions
            suffix = f"Q{selected_question_numbers[0]}-Q{selected_question_numbers[-1]}"
        else:
            suffix = "Questions"
        
        # Create document title
        document_title = f"{chat_title} {suffix}"
        
        # Create downloader
        downloader = QuestionsDownloader(questions_data, document_title)
        
        # Generate file based on format
        if format == 'pdf':
            filepath = downloader.download_pdf()
            media_type = 'application/pdf'
            filename = f"{document_title}.pdf"
        elif format == 'latex':
            filepath = downloader.download_latex()
            media_type = 'application/x-tex'
            filename = f"{document_title}.tex"
        elif format == 'text':
            filepath = downloader.download_text()
            media_type = 'text/plain'
            filename = f"{document_title}.txt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail="Failed to generate file")
        
        # Clean filename for safe download
        filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
            
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type=media_type
        )

    except Exception as e:
        print("Error in download-questions-get function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )
    


async def get_valid_access_token(onedrive_id: str) -> str:
    """
    Get a valid access token for OneDrive, refreshing if necessary.
    Returns the access token string.
    """
    # Get response from supabase
    response = supabase.table("onedrive").select("*").eq("id", onedrive_id).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="OneDrive connection not found")
    
    onedrive_data = response.data[0]
    access_token = onedrive_data.get("provider_token", "")
    refresh_token = onedrive_data.get("refresh_token", "")
    expires_at = onedrive_data.get("expires_at")
    
    # Check if token is expired or will expire soon (within 5 minutes)
    current_time = datetime.now().timestamp()
    token_expired = not expires_at or current_time >= (expires_at - 300)  # 5 minutes buffer
    
    if token_expired and refresh_token:
        try:
            # Get client credentials from environment
            client_id = os.getenv("MICROSOFT_CLIENT_ID")
            client_secret = os.getenv("MICROSOFT_CLIENT_SECRET")
            redirect_uri = os.getenv("MICROSOFT_REDIRECT_URI")
            
            if not client_id or not client_secret:
                raise ValueError("Microsoft OAuth credentials not configured")
            
            # Refresh the token
            token_url = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
            refresh_data = {
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "redirect_uri": redirect_uri,
                "grant_type": "refresh_token"
            }
            
            async with httpx.AsyncClient() as client:
                token_response = await client.post(token_url, data=refresh_data)
                token_response.raise_for_status()
                token_data = token_response.json()
                
                # Extract new tokens
                new_access_token = token_data.get("access_token")
                new_refresh_token = token_data.get("refresh_token", refresh_token)  # Use old refresh token if not provided
                expires_in = token_data.get("expires_in", 3600)  # Default to 1 hour
                
                # Calculate new expiration time
                new_expires_at = datetime.now().timestamp() + expires_in
                
                # Update tokens in database
                supabase.table("onedrive").update({
                    "provider_token": new_access_token,
                    "refresh_token": new_refresh_token,
                    "expires_at": new_expires_at
                }).eq("id", onedrive_id).execute()
                
                return new_access_token
        except Exception as e:
            print(f"Error refreshing token: {str(e)}")
            # If refresh fails, try to use the existing token anyway
            if access_token:
                return access_token
            raise HTTPException(
                status_code=401, 
                detail=f"Failed to refresh OneDrive access token: {str(e)}"
            )
    
    # Return existing token if it's valid or if refresh failed
    if not access_token:
        raise HTTPException(status_code=401, detail="No valid OneDrive access token available")
    
    return access_token

async def download_file_from_onedrive(onedrive_id: str, onedrive_file_id: str) -> tuple[str, str]:
    """
    Download a file from OneDrive given its file ID.
    Returns a tuple of (local_file_path, original_filename)
    """
    # Check if file already exists locally
    local_file_path = os.path.join(ONEDRIVE_FILES_DIR, onedrive_file_id)
    metadata_path = f"{local_file_path}.meta"
    
    # If file exists, return the cached version
    if os.path.exists(local_file_path) and os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                original_filename = f.read().strip()
            return local_file_path, original_filename
        except Exception as e:
            print(f"Error reading metadata, will re-download: {str(e)}")
            # If there's an error reading metadata, continue to download again
    
    try:
        # Get access token from environment or request it using client credentials
        access_token = await get_valid_access_token(onedrive_id)
        
        # Download file from OneDrive/Graph API
        download_url = f"https://graph.microsoft.com/v1.0/me/drive/items/{onedrive_file_id}/content"
        headers = {"Authorization": f"Bearer {access_token}"}
        
        async with httpx.AsyncClient() as client:
            # Get file metadata first to determine filename
            metadata_response = await client.get(
                f"https://graph.microsoft.com/v1.0/me/drive/items/{onedrive_file_id}",
                headers=headers
            )
            metadata_response.raise_for_status()
            metadata = metadata_response.json()
            original_filename = metadata.get("name", f"file_{onedrive_file_id}")
            
            # Download the actual file
            download_response = await client.get(download_url, headers=headers)
            download_response.raise_for_status()
            
            # Save the file
            with open(local_file_path, "wb") as f:
                f.write(download_response.content)
            
            # Save metadata (original filename)
            with open(metadata_path, "w") as f:
                f.write(original_filename)
            
            return local_file_path, original_filename
    except Exception as e:
        print(f"Error downloading file from OneDrive: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to download file from OneDrive: {str(e)}"
        )

@router.post('/onedrive')
async def download_onedrive_post(
    request: Request,
    onedrive_id: str = Form(...),
    onedrive_file_id: str = Form(...)
):
    """Download a file from OneDrive and return it to the client."""
    try:
        local_file_path, original_filename = await download_file_from_onedrive(onedrive_id, onedrive_file_id)
        
        # Determine media type based on file extension
        file_extension = os.path.splitext(original_filename)[1].lower()
        media_type = 'application/octet-stream'  # Default
        
        # Map common extensions to media types
        if file_extension in ['.pdf']:
            media_type = 'application/pdf'
        elif file_extension in ['.txt']:
            media_type = 'text/plain'
        elif file_extension in ['.doc', '.docx']:
            media_type = 'application/msword'
        elif file_extension in ['.xls', '.xlsx']:
            media_type = 'application/vnd.ms-excel'
        elif file_extension in ['.ppt', '.pptx']:
            media_type = 'application/vnd.ms-powerpoint'
        elif file_extension in ['.jpg', '.jpeg']:
            media_type = 'image/jpeg'
        elif file_extension in ['.png']:
            media_type = 'image/png'
        
        # Clean filename for safe download
        safe_filename = re.sub(r'[^\w\s.-]', '', original_filename).replace(' ', '_')
        
        return FileResponse(
            path=local_file_path,
            filename=safe_filename,
            media_type=media_type
        )
    except Exception as e:
        print("Error in download-onedrive-post function:", {
            "name": type(e).__name__,
            "message": str(e),
            "stack": traceback.format_exc()
        })

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )