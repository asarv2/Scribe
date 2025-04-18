from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Form, Response, Query
from fastapi.responses import FileResponse
from app.extensions import supabase, ONEDRIVE_FILES_DIR
from pydantic import BaseModel
import traceback
import os
from app.services.download.summary import SummaryDownloader
from app.services.download.questions import QuestionsDownloader
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

        title = summary_data.get('title', 'Summary')
        
        # Create Summary object
        summary = {
            "id": summary_id,
            "title": title,
            "preamble": summary_data.get('preamble', ''),
            "content": summary_data.get('body', ''),  # Note: 'body' in DB, 'content' in Summary type
            "conclusion": summary_data.get('conclusion', ''),
            "references": summary_data.get('references', []),
            "figures": summary_data.get('figures', [])
        }
        
        # Create downloader
        downloader = SummaryDownloader(summary)
        
        # Generate file based on format
        if format == 'pdf':
            filepath = downloader.download_pdf()
            media_type = 'application/pdf'
            filename = f"{title}.pdf"
        elif format == 'latex':
            filepath = downloader.download_latex()
            media_type = 'application/x-tex'
            filename = f"{title}.tex"
        elif format == 'text':
            filepath = downloader.download_text()
            media_type = 'text/plain'
            filename = f"{title}.txt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")
        
        # Add debug logging
        print(f"Generated filepath: {filepath}")
        print(f"File exists check: {os.path.exists(filepath) if filepath else 'No filepath returned'}")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail=f"Failed to generate file at {filepath}")
        
        # Clean filename for safe download
        filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
            
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type=media_type
        )

    except Exception as e:
        # Add better error logging
        print(f"Error in download-summary-get function: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise

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
                    "title": question.get('title', ''),
                    "question_type": "mcq",  # Add explicit question_type field
                    "question": question.get('problem', ''),
                    "options": question.get('options', []),
                    "answers": question.get('answers', []),
                    "explanations": question.get('explanations', []),
                    "references": question.get('references', []),
                    "figures": question.get('figures', [])
                }
                questions_data.append([mcq_question])
            else:
                # FRQ question
                frq_question = {
                    "id": question.get('id'),
                    "title": question.get('title', ''),
                    "question_type": "frq",  # Add explicit question_type field
                    "question": question.get('problem', ''),
                    "solution": question.get('solution', ''),
                    "references": question.get('references', []),
                    "figures": question.get('figures', [])
                }
                questions_data.append([frq_question])
        
        # Create a suffix based on the question numbers
        selected_question_numbers = [question_numbers.get(qid) for qid in question_ids if qid in question_numbers]
        selected_question_numbers.sort()
        
        # Get titles for the selected questions
        question_titles = []
        for question in questions_response.data:
            # Use the title attribute instead of the problem text
            title = question.get('title', '')
            if not title:
                # Fall back to problem text if title is empty
                problem_text = question.get('problem', '')
                title = problem_text[:30].strip()
                if len(problem_text) > 30:
                    title += "..."
            question_titles.append(title)
        
        # Create a combined title
        if len(question_titles) == 1:
            combined_title = question_titles[0]
        elif len(question_titles) == 2:
            combined_title = f"{question_titles[0]} and {question_titles[1]}"
        else:
            combined_title = f"{question_titles[0]}, {question_titles[1]} and more"
        
        # Create document title and directory ID
        document_title = combined_title
        # Use the first question ID as the directory ID if multiple questions
        directory_id = question_ids[0] if question_ids else "unknown"
        
        # Create downloader with the directory ID
        downloader = QuestionsDownloader(questions_data, document_title, directory_id)
        
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
        
        # Add debug logging
        print(f"Generated filepath: {filepath}")
        print(f"File exists check: {os.path.exists(filepath) if filepath else 'No filepath returned'}")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail=f"Failed to generate file at {filepath}")
        
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