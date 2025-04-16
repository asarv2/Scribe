# creating the output types
from typing import List, Dict
from agents import AgentHooks, RunContextWrapper, Agent, Tool
from agents.items import TResponseInputItem
from pydantic import BaseModel
import google.generativeai as genai
from google.generativeai.types import File

class MultipleChoiceQuestion(BaseModel):
    question: str
    options: List[str]
    explanations: List[str]
    answer: str

class FreeResponseQuestion(BaseModel):
    question: str
    answer: str

class Documents(BaseModel):
    class_id: str
    chat_id: str
    message_id: str
    references: Dict[int, str] # maps number found in text to the id in supabase
    figures: List[str] = []
    summaries: List[str] = []
    questions: List[str] = []

async def fetch_file_resources(supabase, file_ids, class_id, chat_id, message_id):
    """
    Fetch file resources and their documents.
    
    Returns a dictionary with files and their documents.
    """
    all_files = []
    all_documents = []
    all_google_file_ids = []
    if file_ids:
        # Fetch files
        files_response = supabase.table("files").select("*").in_("id", file_ids).order("title", desc=False).execute()
        all_files = files_response.data or []
        all_google_file_ids = [file_name for gemini_file in all_files for file_name in gemini_file.get("file_names", [])]

        all_documents = supabase.table("documents").select("*").in_("file", file_ids).execute().data or []
        references = {idx + 1: doc.get("id") for idx, doc in enumerate(all_documents)}
        references_reverse = {doc.get("id"): idx + 1 for idx, doc in enumerate(all_documents)}

    
    content = []
    for idx, f in enumerate(all_files):
        file_docs = [doc for doc in all_documents if doc.get("file") == f.get("id")]
        content_type = f.get("content_type")
        if content_type == "lecture":
            file_content = f"LECTURE {f.get('file_number')}: {f.get('title')}\n"
            
            for doc in sorted(file_docs, key=lambda d: d.get("page", 0)):
                file_content += f"\SLIDE {doc.get('page')} (REFERENCE {references_reverse[doc.get('id')]})\nContent: {doc.get('text', '')}\nDescription: {doc.get('description', '')}\n"
            
            content.append(file_content)
        elif content_type == "textbook":
            file_content = f"TEXTBOOK {f.get('file_number')}: {f.get('title')}\n"

            # group by the chapter_number. TODO
            
            for doc in sorted(file_docs, key=lambda d: d.get("page", 0)):
                file_content += f"\nPAGE {doc.get('page')}\nContent: {doc.get('text', '')}\nDescription: {doc.get('description', '')}\n"
            
            content.append(file_content)
        elif content_type == "homework":
            file_content = f"HOMEWORK {f.get('file_number')}: {f.get('title')}\n"

            # group by the problem_number. TODO
            
            for doc in sorted(file_docs, key=lambda d: d.get("page", 0)):
                file_content += f"\nPAGE {doc.get('page')}\nContent: {doc.get('text', '')}\nDescription: {doc.get('description', '')}\n"
            
            content.append(file_content)
        else:
            file_content = f"FILE {f.get('file_number')}: {f.get('title')}\n"
            
            for doc in sorted(file_docs, key=lambda d: d.get("page", 0)):
                file_content += f"\nPAGE {doc.get('page')} (REFERENCE {references_reverse[doc.get('id')]})\nContent: {doc.get('text', '')}\nDescription: {doc.get('description', '')}\n"
            
            content.append(file_content)

    documents = Documents(references=references, class_id=class_id, message_id=message_id, chat_id=chat_id)
        
    return {
        "context": "\n\n".join(content),
        "documents": documents,
        "google_file_ids": all_google_file_ids
    }