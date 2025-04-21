from dotenv import load_dotenv
load_dotenv()

import base64
import os
import asyncio
from openai import AsyncOpenAI, OpenAI
from agents import Agent, OpenAIChatCompletionsModel, Runner, ModelSettings, set_tracing_disabled
from openai.types.responses import ResponseTextDeltaEvent
import google.generativeai as genai

import requests
from PIL import Image
import io
from pydub import AudioSegment

# disable tracing
set_tracing_disabled(True)

client = OpenAI(
    api_key=os.getenv("GOOGLE_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

stream_client = AsyncOpenAI(
    api_key=os.getenv("GOOGLE_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

agent = Agent(
    name="Parse Agent",
    instructions="You are a helpful assistant.",
    model=OpenAIChatCompletionsModel( 
        model="gemini-2.0-flash",
        openai_client=stream_client,
    ),
    model_settings=ModelSettings(
        include_usage=True
    )
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
        },
        {
            "arguments": "{\"title\": \"A logo\", \"description\": \"The words spell out Google, in a blue and red color\"}",
            "call_id": "",
            "name": "image_analysis",
            "type": "function_call",
            "id": "123",
            "status": "completed"
        }, {
            "call_id": "",
            "output": "",
            "type": "function_call_output",
            "id": "123",
            "status": "completed"
        },
        {
            "role": "assistant",
            "content": "The image is a picture of Google's logo."
        },{
            "role": "user",
            "content": "Why do you think that?"
        }
    ])
    
    # process the stream
    async for event in result.stream_events():
        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            print(event.data.delta, end="", flush=True)


async def main_tokens():
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


    response = await stream_client.chat.completions.create(
        model="gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "What is in this image?",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                        }
                    },
                ],
            },
            # {
            #     "arguments": "{\"title\": \"A logo\", \"description\": \"The words spell out Google, in a blue and red color\"}",
            #     "call_id": "",
            #     "name": "image_analysis",
            #     "type": "function_call",
            #     "id": "123",
            #     "status": "completed"
            # }, {
            #     "call_id": "",
            #     "output": "",
            #     "type": "function_call_output",
            #     "id": "123",
            #     "status": "completed"
            # },
            {
                "role": "assistant",
                "content": "The image is a picture of Google's logo."
            },{
                "role": "user",
                "content": "Why do you think that?"
            }
        ],
        stream=True,
        # stream_options={"include_usage": True}
    )

    async for chunk in response:
        # Check if this chunk carries usage info
        if hasattr(chunk, "usage") and chunk.usage is not None:
            print("Usage:", dict(chunk.usage))
        else:
            print("Delta:", chunk.choices[0].delta.content)


async def main_agent_file():
    # # 1. Fetch & compress image
    # image_url = "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/files/547a83a8-ab2c-4f3c-9112-b1cb6414ff36/02361caa-63f3-4e13-a453-28883c126c32/aaf34b85-653d-421c-99c5-f4d834ea4bd5.png"
    # resp = requests.get(image_url)
    # img = Image.open(io.BytesIO(resp.content))
    # max_size = 800
    # if max(img.size) > max_size:
    #     ratio = max_size / max(img.size)
    #     img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    # buffer = io.BytesIO()
    # img.convert("RGB").save(buffer, format="JPEG", quality=90)

    # # 2. Upload to Gemini Files API (blocking → run in thread)
    # def _upload(buf: io.BytesIO):
    #     buf.seek(0)
    #     return genai.upload_file(
    #         path=buf,
    #         mime_type="image/jpeg",
    #         display_name="agent_upload.jpg"
    #     )
    # myfile = await asyncio.to_thread(_upload, buffer)

    # # 3. Poll until ACTIVE
    # while myfile.state.name != "ACTIVE":
    #     await asyncio.sleep(1)
    #     myfile = await asyncio.to_thread(genai.get_file, myfile.id)

    file_id = "lui9d206c1rp"

    # 4. Run agent with file reference
    result = Runner.run_streamed(
        agent,
        input=[
            {"role": "system", "content": "You are a helpful assistant."},
            {
                "role": "user",
                "content": [
                    {"type": "input_text",  "text": "What is in this image?"},
                    {
                        "type": "input_file",
                        "file_id": file_id,
                    },
                ],
            },
        ]
    )

    # 5. Stream and print
    async for event in result.stream_events():
        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            print(event.data.delta, end="", flush=True)

async def store_audio():
    audio_url = "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/files//test.wav"
    resp = requests.get(audio_url)
    audio_bytes = resp.content

    uploaded_file = genai.upload_file(
        path=io.BytesIO(audio_bytes),
        mime_type="audio/wav",
        display_name="test.wav"
    )

    print(uploaded_file)

    return uploaded_file

async def store_video():
    video_url = "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/files//scribe-secure.webm"
    resp = requests.get(video_url)
    video_bytes = resp.content

    uploaded_file = genai.upload_file(
        path=io.BytesIO(video_bytes),
        mime_type="video/webm",
        display_name="scribe-secure.webm"
    )

    print(uploaded_file)

    return uploaded_file

async def store_pdf():
    pdf_url = "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/files//29%20Weighted%20Graph.pdf"
    resp = requests.get(pdf_url)
    pdf_bytes = resp.content

    uploaded_file = genai.upload_file(
        path=io.BytesIO(pdf_bytes),
        mime_type="application/pdf",
        display_name="CS 253 Lecture 29.pdf"
    )

    print(uploaded_file)

    return uploaded_file


async def upload_large_video():
    # Use absolute path to the file
    import os
    current_dir = os.path.dirname(os.path.abspath(__file__))
    video_path = os.path.join(current_dir, "Lab1.mp4")
    
    uploaded_file = genai.upload_file(
        path=video_path,
        mime_type="video/mp4",
        display_name="Lab1.mp4"
    )
    print(uploaded_file)
    # poll until ACTIVE
    while uploaded_file.state.name != "ACTIVE":
        await asyncio.sleep(1)
        uploaded_file = await asyncio.to_thread(genai.get_file, uploaded_file.id)
    print(uploaded_file)

async def main_agent_audio():
    # 1. Download audio
    audio_url = "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/files//test.wav"
    resp = requests.get(audio_url)
    audio_bytes = resp.content
    
    # 3. Base64 encode
    base64_audio = base64.b64encode(audio_bytes).decode("utf-8")

    # 4. Prepare the Agent input with inline audio
    agent_input = [
        {"role": "system", "content": "You are a helpful assistant."},
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "What is said in this audio?"},
                {
                    "type": "input_image",
                    "image_url": "https://generativelanguage.googleapis.com/v1beta/files/jf6brc3uy0lj",
                    "detail": "high"
                }
            ]
        }
    ]
    # response = await stream_client.chat.completions.create(
    #     model="gemini-2.0-flash",
    #     messages=agent_input,
    #     stream=True,
    #     stream_options={"include_usage": True}
    # )
    
    # # Process the stream
    # async for chunk in response:
    #     # Extract the content from each chunk
    #     if chunk.choices and len(chunk.choices) > 0:
    #         content = chunk.choices[0].delta.content
    #         if content:
    #             print(content, end="", flush=True)
    #     if hasattr(chunk, "usage") and chunk.usage is not None:
    #         print("Usage:", dict(chunk.usage))

    # 3. Run the Agent with streaming
    result = Runner.run_streamed(agent, input=agent_input)

    # 4. Print the transcription as it's generated
    async for event in result.stream_events():
        if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
            print(event.data.delta, end="", flush=True)

    # print usage
    raw_responses = result.raw_responses
    for response in raw_responses:
        print(response.usage)

if __name__ == "__main__":
    # asyncio.run(main())
    # asyncio.run(main_agent())
    # asyncio.run(main_tokens())
    # asyncio.run(main_agent_file())
    asyncio.run(main_agent_audio())
    # asyncio.run(store_audio())
    # asyncio.run(store_video())
    # asyncio.run(store_pdf())
    # asyncio.run(upload_large_video())