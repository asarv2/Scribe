from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Form, Response, Query
from fastapi.responses import FileResponse
from app.extensions import get_supabase
from pydantic import BaseModel
import traceback
import os
import logging
from app.services.download.summary import SummaryDownloader
from app.services.download.questions import QuestionsDownloader
from app.services.download.grade import GradeDownloader
from app.services.download.figure import FigureDownloader
import re
import httpx


# Get logger for this module
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get('/figure')
async def download_figure_get(
    request: Request,
    figure_ids: list[str] = Query(...),
    chat_id: str = Query(None),
    format: str = Query(...),  # 'png', 'pdf', or 'latex'
):
    """Download figures for given figure IDs using GET method."""
    try:
        supabase_client = get_supabase()
        
        # Get chat data
        chat_response = supabase_client.table("chats").select("*").eq("id", chat_id).execute()

        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")

        class_id = chat_response.data[0].get('class')

        # Get questions data for the selected questions
        figures_response = supabase_client.table("figures").select("*").in_("id", figure_ids).execute()
        
        if not figures_response.data:
            raise HTTPException(status_code=404, detail="Figures not found")
        
        figures = [{
            "id": figure.get('id'),
            "title": figure.get('title', 'Figure'),
            "code": figure.get('code', ''),
            "references": figure.get('references', [])
        } for figure in figures_response.data]
        
        # Create downloader with all figures
        downloader = FigureDownloader(figures)

         # Get titles for the selected questions
        figure_titles = []
        for figure in figures:
            # Use the title attribute instead of the problem text
            title = figure.get('title', '')
            if not title:
                # Fall back to problem text if title is empty
                problem_text = figure.get('code', '')
                title = problem_text[:30].strip()
                if len(problem_text) > 30:
                    title += "..."
            figure_titles.append(title)
        
        # Create a combined title
        if len(figure_titles) == 1:
            combined_title = figure_titles[0]
        elif len(figure_titles) == 2:
            combined_title = f"{figure_titles[0]} and {figure_titles[1]}"
        else:
            combined_title = f"{figure_titles[0]}, {figure_titles[1]} and more"
        
        if format == 'png':
            # For PNG, create a zip file with all figures
            zip_result = await downloader.create_png_zip(class_id, chat_id, combined_title)
            
            if not zip_result or not os.path.exists(zip_result[0]):
                raise HTTPException(status_code=500, detail="Failed to create PNG zip file")
            
            zip_path, filename = zip_result
            
            return FileResponse(
                path=zip_path,
                filename=filename,
                media_type='application/zip',
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        elif format == 'pdf':
            # Generate PDF file with all figures
            pdf_result = downloader.download_pdf(combined_title)
            
            if not pdf_result or not os.path.exists(pdf_result[0]):
                raise HTTPException(status_code=500, detail=f"Failed to generate PDF file")
            
            filepath, filename = pdf_result
            
            return FileResponse(
                path=filepath,
                filename=filename,
                media_type='application/pdf',
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        elif format == 'latex':
            # Generate LaTeX file with all figures
            latex_result = downloader.download_latex(combined_title)
            
            if not latex_result or not os.path.exists(latex_result[0]):
                raise HTTPException(status_code=500, detail=f"Failed to generate LaTeX file")
            
            filepath, filename = latex_result
            
            return FileResponse(
                path=filepath,
                filename=filename,
                media_type='application/x-tex',
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Supported formats: 'png', 'pdf', 'latex'")

    except Exception as e:
        logger.error(f"Error in download-figure-get function: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )

@router.get('/summary')
async def download_summary_get(
    request: Request,
    summary_ids: list[str] = Query(...),
    chat_id: str = Query(...),
    format: str = Query(...),  # 'pdf', 'latex', or 'text'
):
    """Download summaries for given summary IDs using GET method."""
    try:
        supabase_client = get_supabase()
        # Get chat data
        chat_response = supabase_client.table("chats").select("*").eq("id", chat_id).execute()

        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        chat_data = chat_response.data[0]
        chat_title = chat_data.get('name', 'Summary')

        # Get summary data for all requested summaries
        summaries_response = supabase_client.table("summaries").select("*").in_("id", summary_ids).execute()
        
        if not summaries_response.data:
            raise HTTPException(status_code=404, detail="Summaries not found")
        
        # Create Summary objects
        summaries = []
        summary_titles = []
        
        for summary_data in summaries_response.data:
            title = summary_data.get('title', 'Summary')
            summary_titles.append(title)
            
            summary = {
                "id": summary_data.get('id'),
                "title": title,
                "preamble": summary_data.get('preamble', ''),
                "content": summary_data.get('body', ''),  # Note: 'body' in DB, 'content' in Summary type
                "conclusion": summary_data.get('conclusion', ''),
                "references": summary_data.get('references', []),
                "figures": summary_data.get('figures', [])
            }
            summaries.append(summary)
        
        # Create a combined title
        if len(summary_titles) == 1:
            combined_title = summary_titles[0]
        elif len(summary_titles) == 2:
            combined_title = f"{summary_titles[0]} and {summary_titles[1]}"
        else:
            combined_title = f"{summary_titles[0]}, {summary_titles[1]} and more"
        
        # Create downloader with all summaries
        downloader = SummaryDownloader(summaries)
        
        # Generate file based on format
        if format == 'pdf':
            filepath = downloader.download_pdf(combined_title)
            media_type = 'application/pdf'
            filename = f"{combined_title}.pdf"
        elif format == 'latex':
            filepath = downloader.download_latex(combined_title)
            media_type = 'application/x-tex'
            filename = f"{combined_title}.tex"
        elif format == 'text':
            filepath = downloader.download_text(combined_title)
            media_type = 'text/plain'
            filename = f"{combined_title}.txt"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")
        
        logger.info(f"Generated filepath: {filepath}")
        logger.info(f"File exists check: {os.path.exists(filepath) if filepath else 'No filepath returned'}")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail=f"Failed to generate file at {filepath}")
        
        # Clean filename for safe download
        filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
            
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Error in download-summary-get function: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
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
        supabase_client = get_supabase()

        # Get questions data for the selected questions
        questions_response = supabase_client.table("questions").select("*").in_("id", question_ids).execute()
        
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
        
        # Replace print statements with logger
        logger.info(f"Generated filepath: {filepath}")
        logger.info(f"File exists check: {os.path.exists(filepath) if filepath else 'No filepath returned'}")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail=f"Failed to generate file at {filepath}")
        
        # Clean filename for safe download
        filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
            
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        # Replace print statements with logger
        logger.error(f"Error in download-questions-get function: {e}")

        raise HTTPException(
            status_code=500,
            detail={
                "error": str(e),
                "stack": traceback.format_exc(),
                "name": type(e).__name__
            }
        )
    
@router.get('/grade')
async def download_grade_get(
    request: Request,
    grade_id: str = Query(...),
    chat_id: str = Query(...),
    format: str = Query(...),  # 'pdf', 'latex', or 'text'
):
    """Download a grade for a given grade ID using GET method."""
    try:
        supabase_client = get_supabase()
        # Get chat data
        chat_response = supabase_client.table("chats").select("*").eq("id", chat_id).execute()

        if not chat_response.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        chat_data = chat_response.data[0]
        chat_title = chat_data.get('name', 'Grade')

        # get all messages for this chat
        messages_response = supabase_client.table("messages").select("*").eq("chat", chat_id).execute()

        if not messages_response.data:
            raise HTTPException(status_code=404, detail="Messages not found")
        
        
        
        # Get grade data
        grade_response = supabase_client.table("grades").select("*").eq("id", grade_id).execute()
        
        if not grade_response.data:
            raise HTTPException(status_code=404, detail="Grade not found")
        
        grade_data = grade_response.data[0]

        title = grade_data.get('title', 'Grade')
        
        # Create Grade object
        grade = {
            "id": grade_id,
            "title": title,
            "results": grade_data.get('results', ''),
            "feedback": grade_data.get('feedback', ''),
            "references": grade_data.get('references', []),
            "figures": grade_data.get('figures', [])
        }
        
        # Create downloader
        downloader = GradeDownloader(grade)
        
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
        
        # Replace print statements with logger
        logger.info(f"Generated filepath: {filepath}")
        logger.info(f"File exists check: {os.path.exists(filepath) if filepath else 'No filepath returned'}")
        
        if not filepath or not os.path.exists(filepath):
            raise HTTPException(status_code=500, detail=f"Failed to generate file at {filepath}")
        
        # Clean filename for safe download
        filename = re.sub(r'[^\w\s.-]', '', filename).replace(' ', '_')
            
        return FileResponse(
            path=filepath,
            filename=filename,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        # Replace print statements with logger
        logger.error(f"Error in download-grade-get function: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise