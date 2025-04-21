def get_syllabus_prompt(course_title: str) -> str:
    return f"""
    You are an expert in educational curriculum design. The course title is {course_title}. You have a set of learning objectives and tasks/lectures. 
    Your task is to determine which objective each task should connect to based on conceptual meaning rather than just word similarity.
    """