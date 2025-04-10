import os
import asyncio
from agents import Agent, Runner, OpenAIChatCompletionsModel
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

gemini_client = AsyncOpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=GOOGLE_API_KEY)

def main():
    gemini_agent = Agent(
        name="Gemini agent",
        instructions="You are a helpful assistant at McDonald's. Provide accurate and concise answers to customer inquiries.",
        model=OpenAIChatCompletionsModel( 
            model="gemini-2.0-flash",
            openai_client=gemini_client,
        )
    ) 

    result = Runner.run_sync(gemini_agent, input="What is the price of a Big Mac in New York?")
    print(result.final_output)

if __name__ == "__main__":
    main()