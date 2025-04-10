from dataclasses import dataclass
import os
from typing import Any
from pydantic import BaseModel
from typing_extensions import List, Tuple

from agents import Agent, Runner, OpenAIChatCompletionsModel, RunContextWrapper, function_tool
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

gemini_client = AsyncOpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=GOOGLE_API_KEY)

@dataclass
class OneDriveFile:
    id: str
    name: str

    def __str__(self):
        return f"\n - Name: {self.name}, Id: {self.id}"

@dataclass
class FileClassifierContext:
    class_title: str
    onedrive_files: List[OneDriveFile]

    def __str__(self):
        return f"Class: {self.class_title}\nFiles: {self.onedrive_files}"

def dynamic_instructions(
    context: RunContextWrapper[FileClassifierContext], agent: Agent[FileClassifierContext]
) -> str:
    return f"""
    Classify the files into lecture, textbook, homework, and other files. Place their ids in each of the respective lists. The lecture files are ones that contain things like Lectures, Lecture Notes, Lecture Slides, etc. The textbook files are ones that contain things like Textbooks, Readings, etc. The homework files are ones that contain things like Homeworks, Assignments, etc. The other files are ones that don't fit into the other categories. 
    {context.context}
    """

class FileClassifierResult(BaseModel):
    lecture_files: List[str]
    textbook_files: List[str]
    homework_files: List[str]
    other_files: List[str]

class FileClassifier:
    def __init__(self):
        pass

    async def classify_files(self, class_title: str, onedrive_files: List[Any]) -> Tuple[List[str], List[str], List[str], List[str]]:
        """
        Classify the files into lecture, textbook, homework, and other files. Will return a tuple of lists of file ids.
        """
        onedrive_files_list = []
        for onedrive_file in onedrive_files:
            onedrive_files_list.append(OneDriveFile(id=onedrive_file["id"], name=onedrive_file["name"]))

        context = FileClassifierContext(class_title=class_title, onedrive_files=onedrive_files_list)

        classify_agent = Agent[FileClassifierContext](
            name="File Classifier",
            instructions=dynamic_instructions,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.0-flash",
                openai_client=gemini_client,
            ),
            output_type=FileClassifierResult
        )

        result = await Runner.run(  
            starting_agent=classify_agent,
            input="Classify these files into lecture, textbook, homework, and other files.",
            context=context,
        )

        return result.final_output.lecture_files, result.final_output.textbook_files, result.final_output.homework_files, result.final_output.other_files
