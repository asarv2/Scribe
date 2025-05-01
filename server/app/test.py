from dotenv import load_dotenv
import os

load_dotenv()

from google import genai
from google.genai.types import CreateCachedContentConfig

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

def run_agent(cache_name):
    from agents import Agent, Runner, OpenAIChatCompletionsModel, ModelSettings

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
        model=model
    )

    response = Runner.run_streamed(agent, "What is this file about?")

    # 7) Output the summary
    print("Summary:", response.final_output)
    for raw_response in response.raw_responses:
        print("Usage:", raw_response.usage)

if __name__ == "__main__":
    # list_models_and_capabilities()
    create_cache()  # Commented out to first check model capabilities
    # run_agent("my_cached_file")