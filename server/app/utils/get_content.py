from app.extensions import supabase

async def fetch_lecture_content(supabase, lecture_ids):
    """Generate textual content from lecture documents."""
    if not lecture_ids:
        return ""
    
    resources = await fetch_lecture_resources(supabase, lecture_ids)
    lectures = resources["lectures"]
    documents = resources["documents"]
    
    content = []
    for lecture in lectures:
        lecture_docs = [doc for doc in documents if doc.get("lecture") == lecture.get("id")]
        lecture_content = f"LECTURE {lecture.get('note_number')}: {lecture.get('name')}\n"
        
        for doc in sorted(lecture_docs, key=lambda d: d.get("page", 0)):
            lecture_content += f"\nSLIDE {doc.get('page')}\nContent: {doc.get('text', '')}\nDescription: {doc.get('description', '')}\n"
        
        content.append(lecture_content)
    
    return "\n\n".join(content)

async def fetch_chapter_content(supabase, chapter_ids):
    """Generate textual content from chapter documents and exercises."""
    if not chapter_ids:
        return ""
    
    resources = await fetch_chapter_resources(supabase, chapter_ids)
    chapters = resources["chapters"]
    documents = resources["documents"]
    exercises = resources["exercises"]
    
    content = []
    for chapter in chapters:
        chapter_docs = [doc for doc in documents if doc.get("chapter") == chapter.get("id")]
        chapter_content = f"CHAPTER {chapter.get('chapter_number')}: {chapter.get('title')}\n"
        
        for doc in sorted(chapter_docs, key=lambda d: d.get("page", 0)):
            chapter_content += f"PAGE {doc.get('page')}: {doc.get('text', '')}\n"
            if doc.get('description'):
                chapter_content += f"Description: {doc.get('description')}\n"
        
        # Add exercises related to this chapter
        chapter_exercises = [ex for ex in exercises if ex.get("chapter") == chapter.get("id")]
        if chapter_exercises:
            chapter_content += f"\nCHAPTER {chapter.get('chapter_number')} EXERCISES:\n\n"
            for ex in chapter_exercises:
                chapter_content += f"CHAPTER {chapter.get('chapter_number')}, EXERCISE {ex.get('exercise_number')}: {ex.get('text', '')}\n"
        
        content.append(chapter_content)
    
    return "\n\n".join(content)

async def fetch_homework_content(supabase, homework_ids):
    """Generate textual content from homework documents and exercises."""
    if not homework_ids:
        return ""
    
    resources = await fetch_homework_resources(supabase, homework_ids)
    homeworks = resources["homeworks"]
    exercises = resources["exercises"]
    
    content = []
    for homework in homeworks:
        homework_content = f"HOMEWORK {homework.get('homework_number')}\n"
        
        if homework.get('additional_info'):
            homework_content += f"Additional Info: {homework.get('additional_info')}\n"
        
        
        # Add exercises related to this homework
        homework_exercises = [ex for ex in exercises if ex.get("homework") == homework.get("id")]
        sorted_homework_exercises = sorted(homework_exercises, key=lambda x: (x.get('problem_number', 0), x.get('problem_part_number', 0)))
        
        # Group exercises by problem_number to determine if we need to show part letters
        problem_groups = {}
        for ex in sorted_homework_exercises:
            problem_num = ex.get('problem_number', 0)
            if problem_num not in problem_groups:
                problem_groups[problem_num] = []
            problem_groups[problem_num].append(ex)
        
        if sorted_homework_exercises:
            for ex in sorted_homework_exercises:
                problem_num = ex.get('problem_number', 0)
                part_num = ex.get('problem_part_number', 0)
                
                # Format the problem number
                if len(problem_groups.get(problem_num, [])) > 1:
                    # Convert part_num to alphabetical (0->a, 1->b, etc.)
                    part_letter = chr(97 + part_num) if 0 <= part_num < 26 else str(part_num)
                    problem_label = f"{problem_num}{part_letter}"
                else:
                    problem_label = f"{problem_num}"
                
                homework_content += f"\nPROBLEM {problem_label}\n"
                
                if (ex.get('text') and ex.get('text') != ""):
                    homework_content += f"- {ex.get('text')}\n"
                elif (ex.get('given') and ex.get('given') != ""):
                    homework_content += f"- {ex.get('given')}\n"
                
                if (ex.get('info') and ex.get('info') != ""):
                    homework_content += f"Info: {ex.get('info')}\n"
        
        content.append(homework_content)
    
    return "\n\n".join(content)

async def fetch_lecture_resources(supabase, lecture_ids):
    """
    Fetch lecture resources and their documents.
    
    Returns a dictionary with lectures and their documents.
    """
    all_lectures = []
    all_documents = []
    
    if lecture_ids:
        # Fetch lectures
        lectures_response = supabase.table("lectures").select("*").in_("id", lecture_ids).order("note_number", desc=False).execute()
        all_lectures = lectures_response.data or []
        
        # Fetch lecture documents
        documents_response = supabase.table("documents").select("*").in_("lecture", lecture_ids).order("page", desc=False).execute()
        all_documents = documents_response.data or []
    
    return {
        "lectures": all_lectures,
        "documents": all_documents
    }

async def fetch_chapter_resources(supabase, chapter_ids):
    """
    Fetch chapter resources, their documents, and related exercises.
    
    Returns a dictionary with chapters, their documents, and exercises.
    """
    all_chapters = []
    all_documents = []
    all_exercises = []
    
    if chapter_ids:
        # Fetch chapters
        chapters_response = supabase.table("chapters").select("*").in_("id", chapter_ids).order("chapter_number", desc=False).execute()
        all_chapters = chapters_response.data or []
        
        # Fetch chapter documents
        documents_response = supabase.table("documents").select("*").in_("chapter", chapter_ids).order("page", desc=False).execute()
        all_documents = documents_response.data or []
        
        # Fetch exercises related to chapters
        exercises_response = supabase.table("exercises").select("*").in_("chapter", chapter_ids).execute()
        all_exercises = exercises_response.data or []
    
    return {
        "chapters": all_chapters,
        "documents": all_documents,
        "exercises": all_exercises
    }

async def fetch_homework_resources(supabase, homework_ids):
    """
    Fetch homework resources, their documents, and related exercises.
    
    Returns a dictionary with homeworks, their documents, and exercises.
    """
    all_homeworks = []
    all_exercises = []
    
    if homework_ids:
        # Fetch homeworks
        homeworks_response = supabase.table("homeworks").select("*").in_("id", homework_ids).order("homework_number", desc=False).execute()
        all_homeworks = homeworks_response.data or []
        
        # Fetch exercises related to homeworks
        exercises_response = supabase.table("exercises").select("*").in_("homework", homework_ids).execute()
        all_exercises = exercises_response.data or []
        

    # print("All homeworks: ", all_homeworks)
    # print("All exercises: ", all_exercises)
    
    return {
        "homeworks": all_homeworks,
        "exercises": all_exercises
    }

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