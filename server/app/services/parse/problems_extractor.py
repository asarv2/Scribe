
from typing import Dict, List, Any


class ProblemsExtractor:
    def __init__(self, pdf_path: str, api_key: str):
        self.pdf_path = pdf_path
        self.api_key = api_key

    def extract_exercises_from_text(self, chapter_title: str, text: str) -> Dict[str, List[Dict[str, Any]]]:
        """Extract exercises from text using Gemini."""
        prompt = """
        You are an expert at extracting individual exercises from a textbook. The title of the chapter is "{chapter_title}".

        Please analyze the following text and extract the individual exercises in this exact format:
        1. Enclose your response in <CHAPTER> </CHAPTER> tags.
        2. Use <EXERCISE> and </EXERCISE> tags to start and end the exercises.
        3. Use <TITLE>x</TITLE> tags to enclose the title of each exercise, where x is the title.
        4. Use <PAGE>y</PAGE> or <PAGE>y-z</PAGE> tags to enclose the starting page number of each exercise, where y is the page number where the exercise starts and z is the page number where the exercise ends.

        The input text contains multiple pages marked with <PAGE x> and </PAGE x> tags. Use these markers to determine the correct page numbers for each exercise. If an exercise spans multiple pages, use the page range format (e.g., <PAGE>2-3</PAGE>).

        Here is an example of how exercises could look like:

        <CHAPTER>
        <EXERCISE>
            <TITLE>1.1</TITLE>
            <PAGE>30</PAGE>
        </EXERCISE>
        <EXERCISE>
            <TITLE>1.2</TITLE>
            <PAGE>31-32</PAGE>
        </EXERCISE>
        </CHAPTER>

        Now, it is your turn to analyze the following text and extract the exercises in the exact format specified above. Only output the exercises for the given chapter, nothing else. Do not use any other tags than the ones specified above. 

        If you see any leading exercises, ignore them, as they are probably a part of the subchapter exercises, not the chapter exercises. Look for a title like "Exercises" (the most main title) to start the exercises, do not include things like Projects or Explorations. Remember that each <EXERCISE> tag should only contain one exercise.
        INPUT: 
        {text}

        OUTPUT:

        """
        pass