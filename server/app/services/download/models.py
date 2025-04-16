from typing import List, Literal, TypedDict


class Summary(TypedDict):
    id: str
    preamble: str
    content: str
    conclusion: str
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class MCQQuestion(TypedDict):
    id: str
    question: str
    question_type: Literal["mcq"]
    options: List[str]
    answers: List[str]
    explanations: List[str]
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]

class FRQQuestion(TypedDict):
    id: str
    question: str
    question_type: Literal["frq"]
    solution: str
    tags: List[str]
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]



async def fetch_figure_resources(supabase, figure_id):
    """
    Fetch figure resources.
    
    Returns a dictionary with figure resources.
    """
    figure_response = supabase.table("figures").select("*").eq("id", figure_id).execute()

    if not figure_response.data:
        return {"error": "Figure not found"}
    
    figure = figure_response.data[0]

    return "PROMPT: " + figure.get("prompt") + "\n\nCODE: " + figure.get("code")


async def fetch_summary_text(supabase, summary_id):
    """
    Fetch summary text.
    
    Returns a dictionary with summaries, their documents, and exercises.
    """
    summaries_response = supabase.table("summaries").select("*").eq("id", summary_id).execute()
    if not summaries_response.data:
        return {"error": "Summary not found"}
    
    summary = summaries_response.data[0]
    
    return "Summary: " + summary.get("title", "") + "\n\n" + summary.get("preamble", "") + "\n\n" + summary.get("body", "") + "\n\n" + summary.get("conclusion", "")

async def fetch_question_text(supabase, question_id):
    """
    Fetch question text.
    
    Returns a dictionary with question text.
    """
    question_response = supabase.table("questions").select("*").eq("id", question_id).execute()
    if not question_response.data:
        return {"error": "Question not found"}
    
    question = question_response.data[0]

    question_text = f"Question: {question.get('problem', 'No problem statement')}\n\n"

    # Handle MCQ questions
    if not question.get('frq', False):
        options = question.get('options', [])
        answers = question.get('answers', [])
        explanations = question.get('explanations', [])
        
        if options:
            question_text += "Options:\n"
            for idx, option in enumerate(options):
                option_letter = chr(65 + idx)  # A, B, C, D, E...
                question_text += f"{option_letter}. {option}\n"
            question_text += "\n"
        
        if answers:
            correct_letters = [chr(65 + int(ans)) for ans in answers]
            question_text += f"Correct Answer(s): {', '.join(correct_letters)}\n\n"
        
        if explanations:
            question_text += "Explanations:\n"
            for idx, explanation in enumerate(explanations):
                option_letter = chr(65 + idx)
                is_correct = str(idx) in answers
                question_text += f"{option_letter}. {'(CORRECT) ' if is_correct else ''}{explanation}\n"
            question_text += "\n"
    
    # Handle FRQ questions
    else:
        if question.get('solution'):
            question_text += f"Solution:\n{question['solution']}\n\n"
    
    return question_text

async def process_special_tags(message, supabase_client):
    """
    Process special tags in a message and replace them with the corresponding content.
    
    Supported tags:
    - <QUESTION_GENERATION>question_id</QUESTION_GENERATION>
    - <SUMMARY_GENERATION>summary_id</SUMMARY_GENERATION>
    - <FIGURE_GENERATION>figure_id</FIGURE_GENERATION>
    
    Args:
        message (str): The message containing special tags
        supabase_client: The Supabase client to use for fetching data
        
    Returns:
        str: The message with special tags replaced with their content
    """
    import re
    
    # Process question tags
    question_pattern = r'<QUESTION_GENERATION>(.*?)</QUESTION_GENERATION>'
    question_matches = re.findall(question_pattern, message)
    
    for question_id in question_matches:
        question_text = await fetch_question_text(supabase_client, question_id)
        if isinstance(question_text, dict) and "error" in question_text:
            replacement = f"[Error fetching question {question_id}: {question_text['error']}]"
        else:
            replacement = question_text
        message = message.replace(f"<QUESTION_GENERATION>{question_id}</QUESTION_GENERATION>", replacement)
    
    # Process summary tags
    summary_pattern = r'<SUMMARY_GENERATION>(.*?)</SUMMARY_GENERATION>'
    summary_matches = re.findall(summary_pattern, message)
    
    for summary_id in summary_matches:
        summary_text = await fetch_summary_text(supabase_client, summary_id)
        if isinstance(summary_text, dict) and "error" in summary_text:
            replacement = f"[Error fetching summary {summary_id}: {summary_text['error']}]"
        else:
            replacement = summary_text
        message = message.replace(f"<SUMMARY_GENERATION>{summary_id}</SUMMARY_GENERATION>", replacement)
    
    # Process figure tags
    figure_pattern = r'<FIGURE_GENERATION>(.*?)</FIGURE_GENERATION>'
    figure_matches = re.findall(figure_pattern, message)
    
    for figure_id in figure_matches:
        figure_text = await fetch_figure_resources(supabase_client, figure_id)
        if isinstance(figure_text, dict) and "error" in figure_text:
            replacement = f"[Error fetching figure {figure_id}: {figure_text['error']}]"
        else:
            replacement = figure_text
        message = message.replace(f"<FIGURE_GENERATION>{figure_id}</FIGURE_GENERATION>", replacement)
    
    return message