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