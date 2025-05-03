import asyncio
from agents import OpenAIChatCompletionsModel
from dotenv import load_dotenv
import os

load_dotenv()

from google import genai
from agents import Agent, Runner, OpenAIChatCompletionsModel, ModelSettings, RawResponsesStreamEvent, RunConfig
from openai import AsyncOpenAI
from openai.types.responses import ResponseTextDeltaEvent
from agents.extensions.models.litellm_model import LitellmModel

def list_models_and_capabilities():
    # Initialize the Gemini client
    client = genai.Client()
    
    # List available models
    models = client.models.list()
    
    print("Available models:")
    for model in models:
        print(f"\nModel: {model.name}")
        print(f"Display name: {model.display_name}")
        print(f"Description: {model.description}")
        
        # Check if the model supports content caching
        supports_caching = False
        if hasattr(model, 'supported_generation_methods'):
            print(f"Supported generation methods: {model.supported_generation_methods}")
            if 'createCachedContent' in model.supported_generation_methods:
                supports_caching = True
        
        print(f"Supports content caching: {supports_caching}")
        
        # Print input/output token limits if available
        if hasattr(model, 'input_token_limit'):
            print(f"Input token limit: {model.input_token_limit}")
        if hasattr(model, 'output_token_limit'):
            print(f"Output token limit: {model.output_token_limit}")

def create_cache():
    # 1) Initialize the Gemini client
    client = genai.Client()

    # Get the file object
    file_obj = client.files.get(name="files/sfbdbp4fsq3e")
    
    # Print file details
    print(f"File: {file_obj.name}")
    print(f"MIME type: {file_obj.mime_type}")
    
    try:
        # Try with dictionary config instead of CreateCachedContentConfig
        cache = client.caches.create(
            model="models/gemini-2.5-flash-preview-04-17-001",
            config={
                "display_name": "my_cached_file",
                "contents": [file_obj],
                "ttl": "3600s"
            }
        )
        print("Created cache:", cache.name)
    except Exception as e:
        print(f"Error creating cache: {str(e)}")
        print("This might be due to quota limitations or API access restrictions.")

async def delete_cache(cache_names):
    client = genai.Client()
    for cache_name in cache_names:
        try:
            client.caches.delete(name=cache_name)
            print(f"Deleted cache: {cache_name}")
        except Exception as e:
            print(f"Error deleting cache {cache_name}: {str(e)}")

async def run_agent(cache_name):
    gemini_client = AsyncOpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai", api_key=os.getenv("GOOGLE_API_KEY"))

    # 4) Instantiate a Gemini-backed chat model with the cached content
    model = OpenAIChatCompletionsModel(
        model="gemini-2.5-flash-preview-04-17",
        model_settings=ModelSettings(
            extra_body={"cachedContent": cache_name},
            include_usage=True,
            temperature=0.1
        )
    )

    # 5) Define an agent that summarizes the file when asked
    agent = Agent(
        name="FileSummarizerAgent",
        instructions="You are a helpful assistant. Summarize the content of the provided file when asked.",
        model=model,
        model_settings=ModelSettings(
            include_usage=True,
            temperature=0.1,
            extra_body={"stream": True},
        )
    )

    test_input = [{"role": "user", "content": [
        {
            "type": "input_image",
            "image_url": "https://generativelanguage.googleapis.com/v1beta/cachedContents/m82edmeq156i",
            "detail": "low"
        },
        {"type": "input_text", "text": "What is this file about?"}
    ]}]

    result = Runner.run_streamed(agent, "What is this file about?")

    async for event in result.stream_events():
        if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                print(chunk)
    
    # 7) Output the summary
    print("Summary:", result.final_output)
    for raw_response in result.raw_responses:
        print("Usage:", raw_response.usage)

async def run_agent_new(cache_name):
    class CachedGeminiModel(OpenAIChatCompletionsModel):
        def __init__(self, *, cache_name: str, **kwargs):
            super().__init__(**kwargs)
            self.cache_name = cache_name

        def _create_chat_completion(self, **kwargs):
            # Inject the cached_content parameter
            kwargs.setdefault("cached_content", self.cache_name)
            return super()._create_chat_completion(**kwargs)

    # Instantiate
    client = AsyncOpenAI(
        api_key=os.getenv("GOOGLE_API_KEY"),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    gemini_llm = CachedGeminiModel(
        openai_client=client,
        model="gemini-1.5-flash-002",
        cache_name=cache_name,  # from step 2
    )

    agent = Agent(
        name="FileSummarizerAgent",
        instructions="You are a helpful assistant. Summarize the content of the provided file when asked.",
        model=gemini_llm,
    )

    result = Runner.run_streamed(agent, "What is this file about?")

    async for event in result.stream_events():
        if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                print(chunk)
    
    print("Summary:", result.final_output)
    for raw_response in result.raw_responses:
        print("Usage:", raw_response.usage)

async def run_agent_litellm(cache_name):

    litellm_client = LitellmModel(
        model="gemini/gemini-1.5-flash-002",
        api_key=os.getenv("GOOGLE_API_KEY")
    )

    agent = Agent(
        name="Cached Gemini Agent",
        model=litellm_client,
        model_settings=ModelSettings(
            extra_body={"cached_content": cache_name}
        )
    )

    # ✦ Must await the coroutine to start the stream
    result = Runner.run_streamed(agent, "What is this file about?")

    async for event in result.stream_events():
        # process streaming chunks
        if event.type == "raw_response_event" and isinstance(event, RawResponsesStreamEvent):
            if isinstance(event.data, ResponseTextDeltaEvent):
                print(event.data.delta)
    print("Final summary:", result.final_output)
    for resp in result.raw_responses:
        print("Usage:", resp.usage)


def google_test():
    import os
    import pathlib
    import requests
    import time

    # uploaded at: https://generativelanguage.googleapis.com/v1beta/files/3zsp92b5none

    from google import genai
    from google.genai import types

    client = genai.Client()

    # # Download video file
    # url = 'https://storage.googleapis.com/generativeai-downloads/data/SherlockJr._10min.mp4'
    # path_to_video_file = pathlib.Path('SherlockJr._10min.mp4')
    # if not path_to_video_file.exists():
    #     with path_to_video_file.open('wb') as wf:
    #         response = requests.get(url, stream=True)
    #         for chunk in response.iter_content(chunk_size=32768):
    #             wf.write(chunk)

    # # Upload the video using the Files API
    # video_file = client.files.upload(file=path_to_video_file)

    # # Wait for the file to finish processing
    # while video_file.state.name == 'PROCESSING':
    #     print('Waiting for video to be processed.')
    #     time.sleep(2)
    #     video_file = client.files.get(name=video_file.name)

    # print(f'Video processing complete: {video_file.uri}')

    video_file = client.files.get(name="files/3zsp92b5none")

    # You must use an explicit version suffix: "-flash-001", not just "-flash".
    model='models/gemini-1.5-flash-002'

    # Create a cache with a 5 minute TTL
    cache = client.caches.create(
        model="models/gemini-1.5-flash-002",
        config=types.CreateCachedContentConfig(
        system_instruction="You are a helpful assistant. Summarize the content of the provided file when asked.",
        contents=[video_file],
        ttl="300s"
        )
    )

    cache_name = cache.name
    print("Cache name:", cache_name)
    print("Cache usage:", cache.usage_metadata)

    # cache_name = "cachedContents/jdjn8nxcwgvj"

    # Construct a GenerativeModel which uses the created cache.
    # response = client.models.generate_content(
    # model = model,
    # contents= (
    #     'Please summarize the video.'
    #     ),
    # config=types.GenerateContentConfig(cached_content=cache_name)
    # )

    # print(response.usage_metadata)

    # The output should look something like this:
    #
    # prompt_token_count: 696219
    # cached_content_token_count: 696190
    # candidates_token_count: 214
    # total_token_count: 696433

    # print(response.text)




if __name__ == "__main__":
    # list_models_and_capabilities()
    # create_cache()  # Commented out to first check model capabilities
    # asyncio.run(run_agent("cachedContents/4eaq4q3m90db"))
    # asyncio.run(run_agent_new("cachedContents/kfiy51m5q2zc"))
    # asyncio.run(run_agent_litellm("cachedContents/34jopukfx5di"))
    # google_test()
    caches = [
        "cachedContents/mh2v95ub1v6t",
        "cachedContents/byv86z83vg9e",
        "cachedContents/wdp8wil9fb44",
        "cachedContents/9b6nd9qfuebw",
        "cachedContents/lqw5dohjykfe",
        "cachedContents/lh4ifj4bnxme",
        "cachedContents/x87wqd4zywsw",
        "cachedContents/ju8qhcs1sjff",
        "cachedContents/a0y5a8x6m6eo",
        "cachedContents/33ltx8kqyn6r",
        "cachedContents/5nhob4gtk9e1",
        "cachedContents/3ld9bzc19l8g"
    ]
    asyncio.run(delete_cache(caches))