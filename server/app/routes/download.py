from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Form, Response, Query
from fastapi.responses import FileResponse
from app.extensions import supabase
from pydantic import BaseModel
import traceback
import os
from app.services.download.summary_downloader import SummaryDownloader
from app.services.download.questions_downloader import QuestionsDownloader

router = APIRouter()

@router.get('/summary')
async def download_summary_get(
    request: Request,
    summary_id: str = Query(...),
    format: str = Query(...),  # 'pdf', 'latex', or 'text'
):
    """Download a summary for a given summary ID using GET method."""
    try:
        # Get summary data
        summary_response = supabase.table("summaries").select("*").eq("id", summary_id).execute()

        
        if not summary_response.data:
            raise HTTPException(status_code=404, detail="Summary not found")
        
        summary_data = summary_response.data[0]
        
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
            filename = f"{summary_id}.pdf"
        elif format == 'latex':
            filepath = downloader.download_latex()
            media_type = 'application/x-tex'
            filename = f"{summary_id}.tex"
        elif format == 'text':
            filepath = downloader.download_text()
            media_type = 'text/plain'
            filename = f"{summary_id}.txt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail="Failed to generate file")
            
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
    message_id: str = Query(...),
    format: str = Query(...),  # 'pdf', 'latex', or 'text'
):
    """Download questions for a given questions ID using GET method."""
    try:
        # Get questions data
        questions_response = supabase.table("questions").select("*").eq("message", message_id).execute()

        
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
        
        # Create downloader
        downloader = QuestionsDownloader(questions_data)
        
        # Generate file based on format
        if format == 'pdf':
            filepath = downloader.download_pdf()
            media_type = 'application/pdf'
            filename = f"{message_id}.pdf"
        elif format == 'latex':
            filepath = downloader.download_latex()
            media_type = 'application/x-tex'
            filename = f"{message_id}.tex"
        elif format == 'text':
            filepath = downloader.download_text()
            media_type = 'text/plain'
            filename = f"{message_id}.txt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail="Failed to generate file")
            
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