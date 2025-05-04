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
from typing import Literal
import httpx

# Get logger for this module
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/figure")
async def download_figure_get(
    request: Request,
    figure_ids: list[str] = Query(...),
    chat_id: str | None      = Query(None),
    format: Literal["png", "pdf", "latex"] = Query(...),
    zip: bool = Query(False)
):
    supabase = get_supabase()

    # ----- validate chat / figures -----------------------------------------
    chat = supabase.table("chats").select("*").eq("id", chat_id).execute().data
    if not chat:
        raise HTTPException(404, "Chat not found")
    class_id = chat[0]["class"]

    figs = supabase.table("figures").select("*").in_("id", figure_ids).execute().data
    if not figs:
        raise HTTPException(404, "Figures not found")

    downloader = FigureDownloader(figs)

    # ----- dispatch ---------------------------------------------------------
    if format == "png":
        if zip:
            path, fname = await downloader.zip_pngs(class_id)
            mtype = "application/zip"
        else:
            path, fname = await downloader.combine_pngs(class_id)
            mtype = "image/png"

    elif format == "latex":
        if zip:
            path, fname = downloader.zip_latexs()
            mtype = "application/zip"
        else:
            path, fname = downloader.combine_latex()
            mtype = "application/x-tex"

    elif format == "pdf":
        path, fname = downloader.combine_pdf()     # new helper below
        mtype = "application/pdf"

    else:
        raise HTTPException(400, "format must be png, pdf, or latex")

    return FileResponse(
        path,
        filename=fname,
        media_type=mtype,
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )

@router.get("/summary")
async def download_summary_get(
    request: Request,
    summary_ids: list[str] = Query(...),
    chat_id: str = Query(...),
    format: Literal["pdf", "latex"] = Query(...),
    zip: bool = Query(False)               # ← NEW
):
    """Download summaries for given summary IDs using GET method."""
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
    
    # ───── fetch all figures that any summary refers to ────────────────────
    needed_fig_ids = {fid for s in summaries for fid in s["figures"]}
    if needed_fig_ids:
        figs_resp = supabase_client.table("figures")\
                    .select("*").in_("id", list(needed_fig_ids)).execute()
        fig_map = {f["id"]: f for f in figs_resp.data}
    else:
        fig_map = {}

    doc_ids = {m.group(1).strip()
           for s in summaries
           for m in re.finditer(r"<DOCUMENT>(.*?)</DOCUMENT>", s["content"])}
    if doc_ids:
        docs_resp = supabase_client.table("documents")\
                .select("*").in_("id", list(doc_ids)).execute()
        files_to_fetch = {d["file"] for d in docs_resp.data}
        files_resp = supabase_client.table("files").select("*").in_("id", list(files_to_fetch)).execute()
        files = files_resp.data
        doc_map = {d["id"]: d for d in docs_resp.data}
    else:
        files = []
        doc_map = {}
    

    dl = SummaryDownloader(summaries, fig_map, doc_map, files,
                                class_id=chat_data.get('class', ''),
                                chat_id=chat_id)

    if zip:                                             # ↙ zip branch
        if format == "pdf":
            path, fname = dl.zip_pdfs(chat_title)
            mtype = "application/zip"
        else:                                           # latex
            path, fname = dl.zip_latexs(chat_title)
            mtype = "application/zip"
    else:                                               # combined doc
        if format == "pdf":
            path = dl.download_pdf(chat_title)
            fname = f"{chat_title}.pdf"
            mtype = "application/pdf"
        else:
            path = dl.download_latex(chat_title)
            fname = f"{chat_title}.tex"
            mtype = "application/x-tex"

    return FileResponse(path, filename=fname, media_type=mtype,
                        headers={"Content-Disposition": f"attachment; filename={fname}"})

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