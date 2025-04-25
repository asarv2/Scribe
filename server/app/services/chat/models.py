# creating the output types
import re
from collections import defaultdict
from typing import Dict, List, Tuple, Set, Optional, Literal
from pydantic import BaseModel, Field
import google.generativeai as genai
from google.generativeai.types import File
import json
import logging

logger = logging.getLogger(__name__)

class Figure(BaseModel):
    title: str = Field(default="")
    latex_code: str = Field(default="")
    references: List[int] = Field(default=[])

class CreateFigureResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    figure_id: str = Field(default="")

class Question(BaseModel):
    title: str = Field(default="")
    question_type: Literal["mcq", "frq"] = "mcq"
    question: str = Field(default="")
    options: List[str] = Field(default_factory=list)
    answer: str = Field(default="")
    explanations: List[str] = Field(default_factory=list)
    references: List[int] = Field(default_factory=list)
    figures: List[Figure] = Field(default_factory=list)

class CreateQuestionResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    question_id: str = Field(default="")

class Summary(BaseModel):
    title: str = Field(default="")
    preamble: str = Field(default="")
    body: str = Field(default="")
    conclusion: str = Field(default="")
    references: List[int] = Field(default=[])
    figures: List[Figure] = Field(default=[])

class CreateSummaryResponse(BaseModel):
    success: bool = Field(default=False)
    error: Optional[str] = Field(default="")
    summary_id: str = Field(default="") 

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

from collections import defaultdict
from typing import Dict, List, Tuple, Set


async def get_mapped_references(
    supabase,
    file_ids: List[int] | None,
    document_ids: List[int] | None,
    chat_references: List[int] | None,
) -> Tuple[Dict[int, str], str, List[int], List[int]]:      # ➊ new return type
    """
    returns: (references_map, description_str,
              ordered_file_ids, ordered_document_ids)
    """
    logger.info(f"Fetching mapped references for file_ids: {file_ids}, document_ids: {document_ids}, chat_references: {chat_references}")
    # ---------- 1. normalise ----------
    orig_file_ids: List[int]      = file_ids or []          # keep originals
    orig_document_ids: List[int]  = document_ids or []

    file_ids: Set[int]            = set(orig_file_ids)      # same as before
    direct_doc_ids: Set[int]      = set(orig_document_ids)  #  ← rename for clarity
    chat_doc_ids: Set[int]        = set(chat_references or [])

    wanted_doc_ids = direct_doc_ids | chat_doc_ids

    # ---------- 2. pull docs ----------
    # We form a single OR clause so we hit the DB once.
    wanted_doc_ids = direct_doc_ids | chat_doc_ids
    or_parts = []
    if wanted_doc_ids:
        or_parts.append(f"id.in.({','.join(map(str, wanted_doc_ids))})")
    if file_ids:
        or_parts.append(f"file.in.({','.join(map(str, file_ids))})")

    docs_query = supabase.table("documents").select("*")
    if or_parts:  # safeguard in case *everything* is empty
        docs_query = docs_query.or_(",".join(or_parts))
    all_docs: List[dict] = docs_query.execute().data or []

    # Bucket by file for fast look-ups
    docs_by_file: Dict[int, List[dict]] = defaultdict(list)
    for d in all_docs:
        docs_by_file[d["file"]].append(d)

    # ---------- 3. Fetch every file we will mention ----------
    all_file_ids = set(docs_by_file) | file_ids
    all_file_ids = {fid for fid in all_file_ids if fid is not None}   # 🚑 strip NULLs

    if not (file_ids or direct_doc_ids or chat_doc_ids):
        return {}, "", [], []                                         # (empty result)

    file_rows = (
        supabase.table("files")
        .select("*")
        .in_("id", list(all_file_ids))
        .execute()
        .data
        or []
    )
    file_meta = {f["id"]: f for f in file_rows}

    # ---------- 4. build description + order trackers ----------
    description_lines: List[str] = []
    ref_map: Dict[int, str] = {}
    ref_lookup: Dict[str, int] = {}
    next_ref = 1

    ordered_file_ids: List[int]     = []   # ➋ collecting order
    ordered_document_ids: List[int] = []

    # ----- 4a. files supplied explicitly
    for fid in sorted(file_ids, key=lambda _id: file_meta[_id]["title"]):
        ordered_file_ids.append(fid)       # ➌ remember effective order
        description_lines.append(file_meta[fid]["title"])
        for doc in sorted(docs_by_file.get(fid, []), key=lambda d: d["page"]):
            if doc["id"] not in ref_lookup:
                ref_lookup[doc["id"]] = next_ref
                ref_map[next_ref] = doc["id"]
                next_ref += 1
                if doc["id"] in direct_doc_ids:          # 💡 only originals
                    ordered_document_ids.append(doc["id"])
            description_lines.append(
                f"Page {doc['page']} -> REFERENCE {ref_lookup[doc['id']]}"
            )
        description_lines.append("")  # blank line after each file block

    # ----- 4b. stray docs
    stray_docs = [
        d for d in all_docs if d["file"] not in file_ids
    ]
    stray_docs.sort(key=lambda d: (file_meta[d["file"]]["title"], d["page"]))

    for doc in stray_docs:
        if doc["id"] not in ref_lookup:
            ref_lookup[doc["id"]] = next_ref
            ref_map[next_ref] = doc["id"]
            next_ref += 1
            if doc["id"] in direct_doc_ids:          # 💡 only originals
                ordered_document_ids.append(doc["id"])
        title = file_meta[doc["file"]]["title"]
        description_lines.append(
            f"{title}, Page {doc['page']} -> REFERENCE {ref_lookup[doc['id']]}"
        )

    # ---------- 5. finalise ----------
    if description_lines and description_lines[-1] == "":
        description_lines.pop()
    description = "\n".join(description_lines)

    # ➏ new values included in the tuple
    return ref_map, description, ordered_file_ids, ordered_document_ids

async def process_special_tags(message, supabase_client, documents: Documents):
    """
    Process special tags in a message and replace them with the corresponding content.
    
    Supported tags:
    - <FIGURE_GENERATING> - Replace with create_figures tool call
    - <QUESTION_GENERATING> - Replace with create_questions tool call
    - <SUMMARY_GENERATING> - Replace with create_summaries tool call
    - <DOCUMENT>document_id</DOCUMENT> - Replace with the document reference
    
    Args:
        message (str): The message containing special tags
        supabase_client: The Supabase client to use for fetching data
        documents: The documents to map the document ids to the reference number
    Returns:
        list: Will return a conversation history object that can be used directly in the chat history
    """
    import re

    references_reverse = {v: k for k, v in documents.references.items()}
    content_parts = []

    # get the chat from supabase
    chat = supabase_client.table("chats").select("*").eq("id", documents.chat_id).execute().data[0]

    # get all the messages in the chat
    messages = supabase_client.table("messages").select("*").eq("chat", documents.chat_id).execute().data or []
    message_ids = [message.get("id") for message in messages]

    # get all the questions, summaries, and figures for the messages
    questions = supabase_client.table("questions").select("*").in_("message", message_ids).execute().data or []
    summaries = supabase_client.table("summaries").select("*").in_("message", message_ids).execute().data or []
    figures = supabase_client.table("figures").select("*").in_("message", message_ids).execute().data or []
    
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
    
    # Find figure generating tags
    figure_pattern = r'<FIGURE_GENERATING>'
    for match in re.finditer(figure_pattern, message):
        tag_positions.append({
            'start': match.start(),
            'end': match.end(),
            'type': 'figure'
        })
    
    # Find question generating tags
    question_pattern = r'<QUESTION_GENERATING>'
    for match in re.finditer(question_pattern, message):
        tag_positions.append({
            'start': match.start(),
            'end': match.end(),
            'type': 'question'
        })
    
    # Find summary generating tags
    summary_pattern = r'<SUMMARY_GENERATING>'
    for match in re.finditer(summary_pattern, message):
        tag_positions.append({
            'start': match.start(),
            'end': match.end(),
            'type': 'summary'
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
        if pos['type'] == 'figure':
            # Convert database figures to Figure model objects
            figure_objects = []
            for fig in figures:
                # Map references to reference numbers
                fig_references = []
                if "references" in fig and fig["references"]:
                    fig_references = [
                        references_reverse[ref] for ref in fig["references"] 
                        if ref in references_reverse
                    ]
                
                figure_objects.append({
                    "title": fig.get("title", ""),
                    "latex_code": fig.get("code", ""),
                    "references": fig_references
                })
            
            # Create a function call for create_figures
            call_id = f"figures_{documents.message_id}"
            function_call = {
                "arguments": json.dumps({
                    "figures": figure_objects
                }),
                "call_id": call_id,
                "name": "create_figures",
                "type": "function_call",
                "id": call_id,
                "status": "completed"
            }
            
            content_parts.append(function_call)
            
            # Format the output as requested
            figure_responses = []
            for fig in figures:
                figure_responses.append(f"CreateFigureResponse(success=True, error=None, figure_id='{fig.get('id', '')}')")
            
            # Format as a list string
            output_str = f"[{', '.join(figure_responses)}]"
            
            function_output = {
                "call_id": call_id,
                "output": output_str,
                "type": "function_call_output",
                "id": call_id,
                "status": "completed"
            }
            
            content_parts.append(function_output)
            
        elif pos['type'] == 'question':
            # Convert database questions to Question model objects
            question_objects = []
            for q in questions:
                # Map references to reference numbers
                q_references = []
                if "references" in q and q["references"]:
                    q_references = [
                        references_reverse[ref] for ref in q["references"] 
                        if ref in references_reverse
                    ]
                
                # Process figures if any
                q_figures = []
                if "figures" in q and q["figures"]:
                    for fig_id in q["figures"]:
                        # Find the figure in our figures list
                        for fig in figures:
                            if fig.get("id") == fig_id:
                                fig_references = []
                                if "references" in fig and fig["references"]:
                                    fig_references = [
                                        references_reverse[ref] for ref in fig["references"] 
                                        if ref in references_reverse
                                    ]
                                
                                q_figures.append({
                                    "title": fig.get("title", ""),
                                    "latex_code": fig.get("code", ""),
                                    "references": fig_references
                                })
                                break
                
                question_objects.append({
                    "title": q.get("title", ""),
                    "question_type": "frq" if q.get("frq", False) else "mcq",
                    "question": q.get("question", ""),
                    "options": q.get("options", []),
                    "answer": q.get("answers", [""])[0] if q.get("answers") else "",
                    "explanations": q.get("explanations", []),
                    "references": q_references,
                    "figures": q_figures
                })
            
            # Create a function call for create_questions
            call_id = f"questions_{documents.message_id}"
            function_call = {
                "arguments": json.dumps({
                    "questions": question_objects
                }),
                "call_id": call_id,
                "name": "create_questions",
                "type": "function_call",
                "id": call_id,
                "status": "completed"
            }
            
            content_parts.append(function_call)
            
            # Format the output as requested
            question_responses = []
            for q in questions:
                question_responses.append(f"CreateQuestionResponse(success=True, error=None, question_id='{q.get('id', '')}')")
            
            # Format as a list string
            output_str = f"[{', '.join(question_responses)}]"
            
            function_output = {
                "call_id": call_id,
                "output": output_str,
                "type": "function_call_output",
                "id": call_id,
                "status": "completed"
            }
            
            content_parts.append(function_output)
            
        elif pos['type'] == 'summary':
            # Convert database summaries to Summary model objects
            summary_objects = []
            for s in summaries:
                # Process document tags in summary content
                preamble = process_document_tags(s.get("preamble", ""))
                body = process_document_tags(s.get("body", ""))
                conclusion = process_document_tags(s.get("conclusion", ""))
                
                # Map references to reference numbers
                s_references = []
                if "references" in s and s["references"]:
                    s_references = [
                        references_reverse[ref] for ref in s["references"] 
                        if ref in references_reverse
                    ]
                
                # Process figures if any
                s_figures = []
                if "figures" in s and s["figures"]:
                    for fig_id in s["figures"]:
                        # Find the figure in our figures list
                        for fig in figures:
                            if fig.get("id") == fig_id:
                                fig_references = []
                                if "references" in fig and fig["references"]:
                                    fig_references = [
                                        references_reverse[ref] for ref in fig["references"] 
                                        if ref in references_reverse
                                    ]
                                
                                s_figures.append({
                                    "title": fig.get("title", ""),
                                    "latex_code": fig.get("code", ""),
                                    "references": fig_references
                                })
                                break
                
                summary_objects.append({
                    "title": s.get("title", ""),
                    "preamble": preamble,
                    "body": body,
                    "conclusion": conclusion,
                    "references": s_references,
                    "figures": s_figures
                })
            
            # Create a function call for create_summaries
            call_id = f"summaries_{documents.message_id}"
            function_call = {
                "arguments": json.dumps({
                    "summaries": summary_objects
                }),
                "call_id": call_id,
                "name": "create_summaries",
                "type": "function_call",
                "id": call_id,
                "status": "completed"
            }
            
            content_parts.append(function_call)
            
            # Format the output as requested
            summary_responses = []
            for s in summaries:
                summary_responses.append(f"CreateSummaryResponse(success=True, error=None, summary_id='{s.get('id', '')}')")
            
            # Format as a list string
            output_str = f"[{', '.join(summary_responses)}]"
            
            function_output = {
                "call_id": call_id,
                "output": output_str,
                "type": "function_call_output",
                "id": call_id,
                "status": "completed"
            }
            
            content_parts.append(function_output)
        
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