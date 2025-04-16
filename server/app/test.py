import base64
import os
import asyncio
from openai import AsyncOpenAI
from agents import Agent, OpenAIChatCompletionsModel, Runner
from openai.types.responses import ResponseTextDeltaEvent

from dotenv import load_dotenv
import requests
from PIL import Image
import io

load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("GOOGLE_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
)


agent = Agent(
    name="Parse Agent",
    instructions="You are a helpful assistant.",
    model=OpenAIChatCompletionsModel( 
        model="gemini-2.0-flash",
        openai_client=client,
    ),
)

async def main():
    response = await client.chat.completions.create(
        model="gemini-2.0-flash",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello!"}
        ],
        stream=True
    )
    
    # Process the stream
    async for chunk in response:
        # Extract the content from each chunk
        if chunk.choices and len(chunk.choices) > 0:
            content = chunk.choices[0].delta.content
            if content:
                print(content, end="", flush=True)
    
    # Print a newline at the end
    print()

async def main_agent():
    image_url = "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/files/547a83a8-ab2c-4f3c-9112-b1cb6414ff36/02361caa-63f3-4e13-a453-28883c126c32/aaf34b85-653d-421c-99c5-f4d834ea4bd5.png"
    image = requests.get(image_url).content
    img = Image.open(io.BytesIO(image))
    max_size = 800
    if max(img.size) > max_size:
        ratio = max_size / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    
    # Save as compressed JPEG
    buffer = io.BytesIO()
    img.convert('RGB').save(buffer, format="JPEG", quality=90)
    compressed_image = buffer.getvalue()
    base64_image = base64.b64encode(compressed_image).decode("utf-8")

    result = Runner.run_streamed(agent, input=[
        {
            "role": "system",
            "content": "You are a helpful assistant."
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "What is in this image?",
                },
                {
                    "type": "input_image",
                    "image_url": f"data:image/jpeg;base64,{base64_image}",
                    "detail": "high"
                },
            ],
        }
    ])
    
    # process the stream
    async for event in result.stream_events():
        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            print(event.data.delta, end="", flush=True)

if __name__ == "__main__":
    # asyncio.run(main())
    asyncio.run(main_agent())
