import os
import asyncio
from typing_extensions import TypedDict, Any
from pydantic import BaseModel
from agents import Agent, Runner, OpenAIChatCompletionsModel, FunctionTool, function_tool
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

gemini_client = AsyncOpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=GOOGLE_API_KEY)

class MCQ(BaseModel):
    question: str
    options: list[str]
    answer: str

async def main():

    practice_agent = Agent(
        name="Practice Agent",
        instructions="Generate a multiple choice question according to the user's instructions.",
        model=OpenAIChatCompletionsModel( 
            model="gemini-2.0-flash",
            openai_client=gemini_client,
        ),
        output_type=MCQ
    ) 

    chat_agent = Agent(
        name="Chat Agent",
        instructions="You are a teaching assistant in the context of Linear Programming. If they ask for practice problems, handoff to the practice agent. Do not clarify this first with the user, just handoff.",
        model=OpenAIChatCompletionsModel( 
            model="gemini-2.0-flash",
            openai_client=gemini_client,
        ),
        handoffs=[practice_agent]
    )

    result = await Runner.run(chat_agent, input="Can you generate me a MCQ problem for simplex method?")
    print(result.final_output)

if __name__ == "__main__":
    asyncio.run(main())