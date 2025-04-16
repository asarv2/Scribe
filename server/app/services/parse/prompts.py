
def get_parse_prompt(course_title: str) -> str:
    """
    Get the base instructions for all file types.
    
    Args:
        course_title: Title of the course for context
    
    Returns:
        Base instructions string
    """
    # Get base components that are used across all prompts
    base_instructions = _get_base_instructions(course_title)
    additional_instructions = _get_additional_instructions()

    return f"{base_instructions}\n\n{additional_instructions}"


def get_file_type_prompt(file_type: str, document: dict = None) -> str:
    """
    Generate an appropriate prompt based on the file type.

    Args:
        file_type: Type of file ('pdf', 'audio', 'video', 'image', etc.)
        course_title: Title of the course for context
        document: Optional document metadata containing page numbers, timestamps, etc.
    
    Returns:
        A formatted prompt string tailored to the file type
    """
    # Default values if document is None
    document = document or {}
    
    # Format specific instructions based on file type
    if file_type == 'pdf':
        page_number = document.get('page', 1)
        specific_instructions = f"This is page {page_number} of a PDF document. Describe exactly what you see in the image."
    
    elif file_type == 'audio':
        start_time = int(document.get('start_time', 0) or 0)
        end_time = int(document.get('end_time', 0) or 0)
        start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
        end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
        specific_instructions = f"This is an audio segment from {start_time_fmt} to {end_time_fmt}. Describe exactly what you are able to pick up from the transcript."
    
    elif file_type == 'video':
        start_time = int(document.get('start_time', 0) or 0)
        end_time = int(document.get('end_time', 0) or 0)
        start_time_fmt = f"{int(start_time // 60):02d}:{int(start_time % 60):02d}"
        end_time_fmt = f"{int(end_time // 60):02d}:{int(end_time % 60):02d}"
        specific_instructions = f"This is a video segment from {start_time_fmt} to {end_time_fmt}. Describe exactly what you are able to pick up from the video."
    
    elif file_type == 'image':
        specific_instructions = "Describe exactly what you see in the image."
    
    else:
        specific_instructions = f"Describe exactly what you see in the {file_type} file."
    
    return specific_instructions


def _get_base_instructions(course_title: str) -> str:
    """
    Get the base instructions for all file types.
    
    Args:
        course_title: Title of the course for context
    
    Returns:
        Base instructions string
    """
    example_description = '''This document presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points. The proof is outlined, focusing on one direction of the implication. It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex. The underlining highlights the key steps and conclusions of the proof. The notation "pf" indicates "proof," and the double-headed arrow indicates the "if and only if" nature of the theorem. The term "conv. comb." is an abbreviation for "convex combination." The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''

    instructions = f'''Provide a detailed description of the content, in the context of the course: {course_title}.

    Describe what you see, including specific details that would not be known unless you were given the context of the slide. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX notation (enclosed in $ signs) to describe any mathematical content you see on the slide.

    Here is an example of a good description:

    {example_description}'''

    return instructions


def _get_additional_instructions() -> str:
    """
    Get additional instructions that apply to all file types.
    
    Returns:
        Additional instructions string
    """
    return """In addition, you should be concise and to the point, and not be too specific for the one page, since the document may continue.
    
    Here is an example to show how you should output your answer: 

    This document continues the proof of Theorem 10.1 from the previous page, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof."""