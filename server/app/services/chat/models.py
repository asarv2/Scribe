# creating the output types
import re
from typing import List, Dict, Any
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

async def fetch_file_resources(supabase, file_ids, class_id, chat_id, message_id, figures, summaries, questions, chat_references):
    """
    Fetch file resources and their documents.
    
    Returns a dictionary with files and their documents.
    """
    all_files = []
    all_documents = []
    all_google_file_ids = []
    references = {}  # Initialize references dictionary outside the if block
    references_reverse = {}  # Initialize references_reverse dictionary outside the if block
    
    if file_ids:
        # Fetch files
        files_response = supabase.table("files").select("*").in_("id", file_ids).order("title", desc=False).execute()
        all_files = files_response.data or []
        all_google_file_ids = [file_name for gemini_file in all_files for file_name in gemini_file.get("file_names", [])]

        file_documents = supabase.table("documents").select("*").in_("file", file_ids).execute().data or []

        # get the documents that are in the chat_references
        chat_documents = supabase.table("documents").select("*").in_("id", chat_references).execute().data or []

        # merge the file_documents and chat_documents
        all_documents = file_documents + chat_documents

        references = {idx + 1: doc.get("id") for idx, doc in enumerate(all_documents)}
        references_reverse = {doc.get("id"): idx + 1 for idx, doc in enumerate(all_documents)}

    
    content = []
    for idx, f in enumerate(all_files):
        file_docs = [doc for doc in all_documents if doc.get("file") == f.get("id")]
        content_type = f.get("content_type")
        if content_type == "lecture":
            file_content = f"LECTURE {f.get('file_number')}: {f.get('title')}\n"
            
            for doc in sorted(file_docs, key=lambda d: d.get("page", 0)):
                file_content += f"\\SLIDE {doc.get('page')} (REFERENCE {references_reverse[doc.get('id')]})\nContent: {doc.get('text', '')}\nDescription: {doc.get('description', '')}\n"
            
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

    documents = Documents(references=references, class_id=class_id, message_id=message_id, chat_id=chat_id, figures=figures, summaries=summaries, questions=questions)
        
    return {
        "context": "\n\n".join(content),
        "documents": documents,
        "google_file_ids": all_google_file_ids
    }


async def fetch_figure_resources(supabase_client, figure_id):
    """
    Fetch figure resources.

    Args:
        supabase_client: The Supabase client
        figure_id (str): The figure ID
    
    Returns:
        str: Formatted figure text
    """
    figure_text = "<FIGURE_GENERATION>\n"
    figure_response = supabase_client.table("figures").select("*").eq("id", figure_id).execute()
    if not figure_response.data:
        return {"error": "Figure not found"}
    
    figure = figure_response.data[0]
    figure_text += "Figure: " + figure.get("title", "") + "\n\nCode: " + figure.get("code", "")
    figure_text += "</FIGURE_GENERATION>"
    return figure_text

async def fetch_summary_text(supabase_client, summary_id):
    """
    Fetch summary text.
    
    Args:
        supabase_client: The Supabase client
        summary_id (str): The summary ID
    
    Returns:
        str: Formatted summary text
    """
    summary_text = "<SUMMARY_GENERATION>\n"
    summary_response = supabase_client.table("summaries").select("*").eq("id", summary_id).execute()
    if not summary_response.data:
        return {"error": "Summary not found"}
    
    summary = summary_response.data[0]
    summary_text += "Summary: " + summary.get("title", "") + "\n\n" + summary.get("preamble", "") + "\n\n" + summary.get("body", "") + "\n\n" + summary.get("conclusion", "")
    summary_text += "</SUMMARY_GENERATION>"
    return summary_text

async def fetch_question_text(supabase_client, question_id):
    """
    Fetch question text.

    Args:
        supabase_client: The Supabase client
        question_id (str): The question ID
    
    Returns:
        str: Formatted question text
    """
    question_response = supabase_client.table("questions").select("*").eq("id", question_id).execute()
    if not question_response.data:
        return {"error": "Question not found"}
    
    question = question_response.data[0]
    question_text = "<QUESTION_GENERATION>\n"
    question_text += f"Question: {question.get('problem', 'No problem statement')}\n\n"

    # Handle MCQ questions
    if not question.get('frq', False):
        options = question.get('options', [])
        answers = question.get('answers', [])
        explanations = question.get('explanations', [])
        
        if options:
            question_text += "Options:\n"
            for idx, option in enumerate(options):
                question_text += f"{idx + 1}. {option}\n"
            question_text += "\n"
        
        if answers:
            question_text += f"Correct Answer(s): {', '.join(answers)}\n\n"
        
        if explanations:
            question_text += "Explanations:\n"
            for idx, explanation in enumerate(explanations):
                question_text += f"{idx + 1}. {explanation}\n"
            question_text += "\n"
    
    # Handle FRQ questions
    else:
        if question.get('solution'):
            question_text += f"Solution:\n{question['solution']}\n\n"
    
    return question_text + "</QUESTION_GENERATION>"

async def get_image_content(supabase_client, figure_id, class_id):
    """
    Get image content for a figure.
    
    Args:
        supabase_client: The Supabase client
        figure_id (str): The figure ID
        class_id (str): The class ID
        
    Returns:
        dict or None: Image content part or None if error
    """
    import io
    import base64
    from PIL import Image
    
    try:
        # Download image from Supabase storage
        image_path = f"{class_id}/{figure_id}.png"
        response = supabase_client.storage.from_("figures").download(image_path)
        
        if not response:
            return None
        
        # Convert bytes to PIL Image
        img = Image.open(io.BytesIO(response))
        
        # Resize image if it's too large
        max_size = 800
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        
        # Save as compressed JPEG
        buffer = io.BytesIO()
        img.convert('RGB').save(buffer, format="JPEG", quality=90)
        compressed_image = buffer.getvalue()
        
        # Base64 encode the compressed image
        base64_image = base64.b64encode(compressed_image).decode('utf-8')
        
        return {
            "type": "input_image", 
            "image_url": f"data:image/jpeg;base64,{base64_image}", 
            "detail": "low"
        }
            
    except Exception as e:
        print(f"Error loading figure {figure_id}: {str(e)}")
        return None

async def process_special_tags(message, supabase_client, class_id, references_mapping: Dict[int, str]):
    """
    Process special tags in a message and replace them with the corresponding content.
    
    Supported tags:
    - <QUESTION>question_id</QUESTION>
    - <SUMMARY>summary_id</SUMMARY>
    - <FIGURE>figure_id</FIGURE>
    - <DOCUMENT>document_id</DOCUMENT> replaces with the document reference
    
    Args:
        message (str): The message containing special tags
        supabase_client: The Supabase client to use for fetching data
        references_mapping: The references to map the document ids to the reference number
    Returns:
        list[Dict[str, Any]]: Will return a conversation history object that can be used directly in the chat history

        Example for question tags:
        {"role": "assistant", "content": "Question: What is the capital of France? \nSolution: The capital of France is Paris."}
        {"role": "user", "content": "Question: What is the capital of France? \nOptions: Paris, London, Berlin, Madrid \nAnswer: Paris\nExplanations: \nParis is the capital of France. \nLondon is the capital of England. \nBerlin is the capital of Germany. \nMadrid is the capital of Spain."}

        Example for summary tags (which includes document tags):
        {"role": "assistant", "content": "Summary: What is Simplex Method? Preamble: The simplex method is a method for solving linear programming problems.[1] \nBody: The simplex method is a method for solving linear programming problems.[2, 3] \nConclusion: The simplex method is a method for solving linear programming problems.[4]"}

        Example for figure tags:
        {"role": "assistant", "content": [
        {"type": "input_image", "image_url": f"data:image/jpeg;base64,{image_data}", "detail": "low"},
        {"type": "input_text", "text": "Figure: A plot of time complexity of sorting algorithms"},
        ]

        Example for question with figures:
        {"role": "assistant", "content": [
        {"type": "input_image", "image_url": f"data:image/jpeg;base64,{image_data}", "detail": "low"},
        {"type": "input_text", "text": "Question: What is the capital of France? \nOptions: Paris, London, Berlin, Madrid \nAnswer: Paris\nExplanations: \nParis is the capital of France. \nLondon is the capital of England. \nBerlin is the capital of Germany. \nMadrid is the capital of Spain."},
        ]

        Example for summary with figures:
        {"role": "assistant", "content": [
        {"type": "input_image", "image_url": f"data:image/jpeg;base64,{image_data1}", "detail": "low"},
        {"type": "input_image", "image_url": f"data:image/jpeg;base64,{image_data2}", "detail": "low"},
        {"type": "input_text", "text": "Summary: What is Simplex Method? Preamble: The simplex method is a method for solving linear programming problems.\nBody: The simplex method is a method for solving linear programming problems.{1, 2} \nConclusion: The simplex method is a method for solving linear programming problems."},
        ]
    }
    """
    import re
    
    # Track all figure IDs that need to be included
    all_figure_ids = []
    
    # Process question tags
    question_pattern = r'<QUESTION>(.*?)</QUESTION>'
    question_matches = re.findall(question_pattern, message)
    
    for question_id in question_matches:
        # Fetch question data to get both text and associated figures
        question_response = supabase_client.table("questions").select("*").eq("id", question_id).execute()
        
        if not question_response.data:
            replacement = f"[Error fetching question {question_id}: Question not found]"
            message = message.replace(f"<QUESTION>{question_id}</QUESTION>", replacement)
            continue
            
        question = question_response.data[0]
        
        # Get question text
        question_text = await fetch_question_text(supabase_client, question_id)
        if isinstance(question_text, dict) and "error" in question_text:
            replacement = f"[Error fetching question {question_id}: {question_text['error']}]"
        else:
            replacement = question_text
        
        message = message.replace(f"<QUESTION>{question_id}</QUESTION>", replacement)
        
        # Add any figures associated with this question
        if "figures" in question and question["figures"]:
            all_figure_ids.extend(question["figures"])
    
    # Process summary tags
    summary_pattern = r'<SUMMARY>(.*?)</SUMMARY>'
    summary_matches = re.findall(summary_pattern, message)
    
    for summary_id in summary_matches:
        # Fetch summary data to get both text and associated figures
        summary_response = supabase_client.table("summaries").select("*").eq("id", summary_id).execute()
        
        if not summary_response.data:
            replacement = f"[Error fetching summary {summary_id}: Summary not found]"
            message = message.replace(f"<SUMMARY>{summary_id}</SUMMARY>", replacement)
            continue
            
        summary = summary_response.data[0]
        
        # Get summary text
        summary_text = await fetch_summary_text(supabase_client, summary_id)
        if isinstance(summary_text, dict) and "error" in summary_text:
            replacement = f"[Error fetching summary {summary_id}: {summary_text['error']}]"
        else:
            replacement = summary_text
        
        message = message.replace(f"<SUMMARY>{summary_id}</SUMMARY>", replacement)
        
        # Add any figures associated with this summary
        if "figures" in summary and summary["figures"]:
            all_figure_ids.extend(summary["figures"])
    
    # Process standalone figure tags
    figure_pattern = r'<FIGURE>(.*?)</FIGURE>'
    figure_matches = re.findall(figure_pattern, message)
    
    for figure_id in figure_matches:
        figure_text = await fetch_figure_resources(supabase_client, figure_id)
        if isinstance(figure_text, dict) and "error" in figure_text:
            replacement = f"[Error fetching figure {figure_id}: {figure_text['error']}]"
        else:
            replacement = figure_text
        
        message = message.replace(f"<FIGURE>{figure_id}</FIGURE>", replacement)
        
        # Add this figure ID to our list if it's not already there
        if figure_id not in all_figure_ids:
            all_figure_ids.append(figure_id)
    
    # Process document tags if references_mapping is provided
    if references_mapping:
        # we need to reverse the references_mapping to get the reference number to the document id
        references_reverse = {v: k for k, v in references_mapping.items()}
        document_pattern = r'<DOCUMENT>(.*?)</DOCUMENT>'
        document_matches = re.findall(document_pattern, message)
        
        for document_id in document_matches:
            if document_id in references_reverse:
                reference_number = references_reverse[document_id]
                message = message.replace(f"<DOCUMENT>{document_id}</DOCUMENT>", f"[{reference_number}]")
            else:
                message = message.replace(f"<DOCUMENT>{document_id}</DOCUMENT>", f"[unknown reference]")
    
    # If there are no figures, return a simple text message
    if not all_figure_ids:
        return {"role": "assistant", "content": message}
    
    # If there are figures, create a multipart message
    content_parts = []
    
    # First, collect all figure images
    for figure_id in all_figure_ids:
        image_part = await get_image_content(supabase_client, figure_id, class_id)
        if image_part:
            content_parts.append(image_part)
    
    # Add the text content as the final part
    content_parts.append({
        "type": "input_text",
        "text": message
    })
    
    return {"role": "assistant", "content": content_parts if content_parts else message}