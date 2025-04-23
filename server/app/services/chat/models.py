# creating the output types
import re
from typing import List, Dict, Any, Tuple
from agents import AgentHooks, RunContextWrapper, Agent, Tool
from agents.items import TResponseInputItem
from pydantic import BaseModel
import google.generativeai as genai
from google.generativeai.types import File
import json
import logging

logger = logging.getLogger(__name__)

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
    profile_id: str
    chat_id: str
    message_id: str
    references: Dict[int, str] # maps number found in text to the id in supabase
    figures: List[str] = []
    summaries: List[str] = []
    questions: List[str] = []
    grades: List[str] = []


def clean_references(text: str, references: Dict[int, str]) -> str:
    # Find all reference patterns like [1] or [1, 2, 3]
    ref_patterns = re.findall(r'\[([0-9\s,]+)\]', text)
    
    for pattern in ref_patterns:
        original = f"[{pattern}]"
        # Split by comma and strip whitespace for each number
        ref_nums = [int(num.strip()) for num in pattern.split(',')]
        
        # Replace with appropriate tags
        replacement = ""
        for num in ref_nums:
            if num in references:
                replacement += f"<DOCUMENT>{references[num]}</DOCUMENT>"
        
        text = text.replace(original, replacement)
    
    return text

async def fetch_chat_context(supabase, chat_id):
    # get all the messages in the chat
    messages = supabase.table("messages").select("*").eq("chat", chat_id).execute().data or []

    # get all of the figures for all the messages. Get figures where .message is in this messages list
    figures = supabase.table("figures").select("*").in_("message", [message.get("id") for message in messages]).execute().data or []

    # get all of the summaries for all the messages. Get summaries where .message is in this messages list
    summaries = supabase.table("summaries").select("*").in_("message", [message.get("id") for message in messages]).execute().data or []

    # get all of the questions for all the messages. Get questions where .message is in this messages list
    questions = supabase.table("questions").select("*").in_("message", [message.get("id") for message in messages]).execute().data or []

    # get all of the references from the figure.references, summary.references, and question.references
    references = {figure.get("id"): figure.get("references") for figure in figures}
    references.update({summary.get("id"): summary.get("references") for summary in summaries})
    references.update({question.get("id"): question.get("references") for question in questions})

    # return list of figures, summaries, questions, in sorted order by created_at. Want to return the ids of each of these.
    figures = sorted(figures, key=lambda x: x.get("created_at"))
    summaries = sorted(summaries, key=lambda x: x.get("created_at"))
    questions = sorted(questions, key=lambda x: x.get("created_at"))
    return {
        "figures": [figure.get("id") for figure in figures],
        "summaries": [summary.get("id") for summary in summaries],
        "questions": [question.get("id") for question in questions],
        "references": list(set(references))
    }

async def get_mapped_references(supabase, file_ids, document_ids, chat_references) -> Tuple[Dict[int, str], str]:
    """
    Fetch file resources and their documents.
    
    Returns a dictionary with files and their documents.

    Will create a text description of the references, with the name of the File and what reference number it is. If we have a document, we will first need to find the file it belongs to, and proceed with the following format:

    File 1
    Page 1 -> REFERENCE 1
    Page 2 -> REFERENCE 2

    File 2
    Page 1 -> REFERENCE 3
    Page 2 -> REFERENCE 4


    """
    all_documents = []
    references = {}  # Initialize references dictionary outside the if block
    references_reverse = {} # Initialize references_reverse dictionary outside the if block
    
    if file_ids:
        file_documents = supabase.table("documents").select("*").in_("file", file_ids).execute().data or []
    else:
        file_documents = []

    if document_ids:
        basic_documents = supabase.table("documents").select("*").in_("id", document_ids).execute().data or []
    else:
        basic_documents = []

    if chat_references:
        chat_documents = supabase.table("documents").select("*").in_("id", chat_references).execute().data or []
    else:
        chat_documents = []

    # merge the file_documents and chat_documents
    all_documents = file_documents + basic_documents + chat_documents

    references = {idx + 1: doc.get("id") for idx, doc in enumerate(all_documents)}
    references_reverse = {v: k for k, v in references.items()}

    # get the files for the file_ids
    files = supabase.table("files").select("*").in_("id", file_ids).execute().data or []

    # get the files for the document_ids
    # First, find the file IDs for the documents in all_documents
    document_file_ids = [doc.get("file") for doc in all_documents if doc.get("id") in document_ids]
    document_files = supabase.table("files").select("*").in_("id", document_file_ids).execute().data or []

    output = ""
    for file in files:
        output += f"{file.get('title')}\n"
        file_documents = sorted([document for document in all_documents if document.get("file") == file.get("id")], key=lambda x: x.get("page"))
        for document in file_documents:
            output += f"Page {document.get('page')} -> REFERENCE {references_reverse[document.get('id')]}\n"

    for document_file in document_files:
        output += f"{document_file.get('title')}\n"
        file_documents = sorted([document for document in all_documents if document.get("file") == document_file.get("id") and document.get("id") in document_ids], key=lambda x: x.get("page"))
        for document in file_documents:
            output += f"Page {document.get('page')} -> REFERENCE {references_reverse[document.get('id')]}\n"

    return references, output

async def process_special_tags(message, supabase_client, documents: Documents):
    """
    Process special tags in a message and replace them with the corresponding content.
    
    Supported tags:
    Replace these with function calls and corresponding outputs
    - <QUESTION>question_id</QUESTION>
    - <SUMMARY>summary_id</SUMMARY>
    - <FIGURE>figure_id</FIGURE>

    - <DOCUMENT>document_id</DOCUMENT> replaces with the document reference
    
    Args:
        message (str): The message containing special tags
        supabase_client: The Supabase client to use for fetching data
        documents: The documents to map the document ids to the reference number
    Returns:
        list: Will return a conversation history object that can be used directly in the chat history
    """
    import re

    references_reverse = {v: k for k, v in documents.references.items()}
    figures_reverse = {v: k + 1 for k, v in enumerate(documents.figures)}
    
    # Track all figure IDs that need to be included
    all_figure_ids = []
    content_parts = []
    
    # Helper function to process document tags in a text
    def process_document_tags(text):
        if not documents.references:
            return text
        
        document_pattern = r'<DOCUMENT>(.*?)</DOCUMENT>'
        document_matches = re.findall(document_pattern, text)
        
        for document_id in document_matches:
            if document_id in references_reverse:
                reference_number = references_reverse[document_id]
                text = text.replace(f"<DOCUMENT>{document_id}</DOCUMENT>", f"[{reference_number}]")
            else:
                text = text.replace(f"<DOCUMENT>{document_id}</DOCUMENT>", f"[unknown reference]")
        
        return text
    
    # Process document tags in the main message
    message = process_document_tags(message)
    
    # Find all special tags and their positions
    tag_positions = []
    
    # Find question tags
    question_pattern = r'<QUESTION>(.*?)</QUESTION>'
    for match in re.finditer(question_pattern, message):
        question_id = match.group(1)
        tag_positions.append({
            'start': match.start(),
            'end': match.end(),
            'id': question_id,
            'type': 'question'
        })
    
    # Find summary tags
    summary_pattern = r'<SUMMARY>(.*?)</SUMMARY>'
    for match in re.finditer(summary_pattern, message):
        summary_id = match.group(1)
        tag_positions.append({
            'start': match.start(),
            'end': match.end(),
            'id': summary_id,
            'type': 'summary'
        })
    
    # Find figure tags
    figure_pattern = r'<FIGURE>(.*?)</FIGURE>'
    for match in re.finditer(figure_pattern, message):
        figure_id = match.group(1)
        tag_positions.append({
            'start': match.start(),
            'end': match.end(),
            'id': figure_id,
            'type': 'figure'
        })
    
    # Sort positions by start index
    tag_positions.sort(key=lambda x: x['start'])
    
    # Break the message into parts and insert function calls
    last_end = 0
    for pos in tag_positions:
        # Add text before this tag
        if pos['start'] > last_end:
            text_before = message[last_end:pos['start']]
            if text_before.strip():
                content_parts.append({
                    "role": "assistant",
                    "content": text_before
                })
        
        # Process the tag based on its type
        if pos['type'] == 'question':
            question_id = pos['id']
            question_response = supabase_client.table("questions").select("*").eq("id", question_id).execute()
            
            if not question_response.data:
                # Add error message
                content_parts.append({
                    "role": "assistant",
                    "content": f"[Error fetching question {question_id}: Question not found]"
                })
                last_end = pos['end']
                continue
                
            question = question_response.data[0]
            
            # Add function call part
            tool_name = "create_frq_question" if question.get("frq", False) else "create_mcq_question"

            # map question.references to the reference number, in references_reverse
            question_references = [references_reverse[ref] for ref in question.get("references", [])]
            question_figures = [figures_reverse[fig] for fig in question.get("figures", [])]
            
            if question.get("frq", False):
                function_call = {
                    "arguments": json.dumps({
                        "title": question.get("title", ""),
                        "question": question.get("problem", ""),
                        "answer": question.get("solution", ""),
                        "references": question_references,
                        "figures": question_figures
                    }),
                    "call_id": question_id,
                    "name": tool_name,
                    "type": "function_call",
                    "id": question_id,
                    "status": "completed"
                }
            else:
                function_call = {
                    "arguments": json.dumps({
                        "title": question.get("title", ""),
                        "question": question.get("problem", ""),
                        "options": question.get("options", []),
                        "explanations": question.get("explanations", []),
                        "answer": question.get("answers", [""])[0] if question.get("answers") else "",
                        "references": question_references,
                        "figures": question_figures
                    }),
                    "call_id": question_id,
                    "name": tool_name,
                    "type": "function_call",
                    "id": question_id,
                    "status": "completed"
                }
            
            content_parts.append(function_call)
            
            # Add function output part
            function_output = {
                "call_id": question_id,
                "output": question_id,
                "type": "function_call_output",
                "id": question_id,
                "status": "completed"
            }
            
            content_parts.append(function_output)
            
            # Add any figures associated with this question
            if "figures" in question and question["figures"]:
                all_figure_ids.extend(question["figures"])
                
        elif pos['type'] == 'summary':
            summary_id = pos['id']
            summary_response = supabase_client.table("summaries").select("*").eq("id", summary_id).execute()
            
            if not summary_response.data:
                # Add error message
                content_parts.append({
                    "role": "assistant",
                    "content": f"[Error fetching summary {summary_id}: Summary not found]"
                })
                last_end = pos['end']
                continue
                
            summary = summary_response.data[0]
            
            # Process document tags in summary content
            preamble = process_document_tags(summary.get("preamble", ""))
            body = process_document_tags(summary.get("body", ""))
            conclusion = process_document_tags(summary.get("conclusion", ""))

            # map summary.references to the reference number, in references_reverse
            summary_references = [references_reverse[ref] for ref in summary.get("references", [])]
            summary_figures = [figures_reverse[fig] for fig in summary.get("figures", [])]
            
            # Add function call part
            function_call = {
                "arguments": json.dumps({
                    "title": summary.get("title", ""),
                    "preamble": preamble,
                    "body": body,
                    "conclusion": conclusion,
                    "references": summary_references,
                    "figures": summary_figures
                }),
                "call_id": summary_id,
                "name": "create_summary",
                "type": "function_call",
                "id": summary_id,
                "status": "completed"
            }
            
            content_parts.append(function_call)
            
            # Add function output part
            function_output = {
                "call_id": summary_id,
                "output": summary_id,
                "type": "function_call_output",
                "id": summary_id,
                "status": "completed"
            }
            
            content_parts.append(function_output)
            
            # Add any figures associated with this summary
            if "figures" in summary and summary["figures"]:
                all_figure_ids.extend(summary["figures"])
                
        elif pos['type'] == 'figure':
            figure_id = pos['id']
            figure_response = supabase_client.table("figures").select("*").eq("id", figure_id).execute()
            
            if not figure_response.data:
                # Add error message
                content_parts.append({
                    "role": "assistant",
                    "content": f"[Error fetching figure {figure_id}: Figure not found]"
                })
                last_end = pos['end']
                continue
                
            figure = figure_response.data[0]

            # map figure.references to the reference number, in references_reverse
            figure_references = [references_reverse[ref] for ref in figure.get("references", [])]
            
            # Add function call part
            function_call = {
                "arguments": json.dumps({
                    "title": figure.get("title", ""),
                    "python_code": figure.get("code", ""),
                    "references": figure_references
                }),
                "call_id": figure_id,
                "name": "create_figure",
                "type": "function_call",
                "id": figure_id,
                "status": "completed"
            }
            
            content_parts.append(function_call)
            
            # Add function output part
            figure_number = str(figures_reverse[figure_id])
            function_output = {
                "call_id": figure_id,
                "output": figure_number,
                "type": "function_call_output",
                "id": figure_id,
                "status": "completed"
            }
            
            content_parts.append(function_output)
            
            # Add this figure ID to our list
            if figure_id not in all_figure_ids:
                all_figure_ids.append(figure_id)
        
        last_end = pos['end']
    
    # Add any remaining text after the last tag
    if last_end < len(message):
        remaining_text = message[last_end:]
        if remaining_text.strip():
            content_parts.append({
                "role": "assistant",
                "content": remaining_text
            })
    
    # Return the complete message with function calls and content parts
    return content_parts