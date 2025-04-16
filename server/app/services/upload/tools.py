from typing import List, Tuple, Union, Dict, Any, Optional
from agents import function_tool

from app.services.upload.models import HomeworkProblemPart, Chapter

@function_tool
async def create_lecture(title: str, content: str) -> Tuple[bool, str]:
    """Create a lecture. Will return if it was able to successfully create the lecture and the file id of the generated lecture in python and the file name in string. If unsuccessful, the string will contain the error message.

    Args:
        title: The title of the lecture (e.g., "Lecture 1").
        content: The content of the lecture (e.g., "This is a lecture").
    """
    return "sunny"

@function_tool
async def create_homework(title: str, due_date: str) -> Tuple[bool, str]:
    """Create a homework file. Will return if it was able to successfully create the homework file and the file id of the generated homework file in python and the file name in string. If unsuccessful, the string will contain the error message.

    Args:
        title: The title of the homework (e.g., "Homework 10").
        due_date: The due date of the homework in format MM-DD-YYYY (e.g., "02-25-2025").
    """
    return "sunny"

@function_tool
async def create_homework_problem(
    problem_name: str, 
    problem_number: int,  # The number of the problem (e.g., "1")
    parts: List[HomeworkProblemPart], 
    info: Optional[str] = None
) -> List[str]:
    """Create a homework problem. Will return if it was able to successfully create the homework problem and the file id of the generated homework problem in python and the file name in string. If unsuccessful, the string will contain the error message.

    Args:
        problem_name: The name of the problem (e.g., "Problem 1").
        parts: A list of dictionaries, each representing a part of the problem with the following structure:
            {
                "part_name": Optional[str],  # The subtitle of the part (e.g., "(a)"), can be None if there's only one part
                "given": Optional[str],      # The given information for this part
                "textbook": Optional[Dict[str, Any]]  # Textbook reference with structure:
                    {
                        "textbook_number": str,  # The textbook number
                        "exercise": Optional[str],  # The exercise number/name
                        "page": Optional[str]  # The page number or range
                    }
            }
        info: Additional information or instructions for the problem.
    """

    # 1. Will loop through all of the problem parts, and return the documents ready to be inserted


    return "sunny"

@function_tool
async def create_textbook(title: str, chapters: List[Chapter]) -> List[str]:
    """Create a textbook. Will return if it was able to successfully create the textbook and the file id of the generated textbook in python and the file name in string. If unsuccessful, the string will contain the error message.

    Args:
        title: The title of the textbook (e.g., "Textbook 1").
        chapters: A list of chapters to generate a textbook for.
    """
    return "sunny"

@function_tool
async def create_table_of_contents(chapters: List[Chapter]) -> List[str]:
    """Create a table of contents. Will return if it was able to sucessfully generate the table of contents and the file id of the generated table of contents in python and the file name in string. If unsuccessful, the string will contain the error message.

    Args:
        chapters: A list of chapters to generate a table of contents for.
    """
    return "sunny"

async def create_exercise(exercise_name: str, chapter_number: int, exercise_number: int, start_page: int, end_page: int) -> List[str]:
    """Create an exercise. Will return if it was able to successfully create the exercise and the file id of the generated exercise in python and the file name in string. If unsuccessful, the string will contain the error message.

    Args:
        exercise_name: The name of the exercise (e.g., "Exercise 1").
        chapter_number: The number of the chapter (e.g., "1").
        exercise_number: The number of the exercise (e.g., "1").
        start_page: The start page of the exercise.
        end_page: The end page of the exercise.
    """
    return "sunny"