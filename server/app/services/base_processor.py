# base_processor.py
from enum import Enum
import os
from typing import List, Union, Literal, Dict, TypeAlias, AsyncGenerator
import asyncio
from app.services.rate_limiter import rate_limiter
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dataclasses import dataclass

LiteralModel: TypeAlias = Literal["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
@dataclass
class Message:
    content: List[Dict[str, str]]

class CleanedResponse:
    def __init__(self, page: int, description: str, text: str):
        self.page = page
        self.description = description
        self.text = text

class ContentType(Enum):
    LECTURE = "lecture"
    TOPIC = "topic"

class BaseProcessor:
    def __init__(self):
        """
        Initialize the BaseProcessor and create all the models.
        """
        # Configure the Gemini API
        genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
        
        # Configure safety settings
        self.safety_settings = {
            HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
            HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
        }

    async def get_model_instance(self, model: LiteralModel, system_instruction: str | None = None) -> genai.GenerativeModel:
        if system_instruction:
            model_configs = {
                "gemini-2.0-flash": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-001",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-2.0-flash-lite": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-lite-preview-02-05",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-1.5-pro": genai.GenerativeModel(
                    model_name="gemini-1.5-pro",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-1.5-flash": genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
                "gemini-1.5-flash-8b": genai.GenerativeModel(
                    model_name="gemini-1.5-flash-8b",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                    system_instruction=system_instruction
                ),
            }
            return model_configs[model]
        else:
            model_configs = {
                "gemini-2.0-flash": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-001",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-2.0-flash-lite": genai.GenerativeModel(
                    model_name="gemini-2.0-flash-lite-preview-02-05",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-1.5-pro": genai.GenerativeModel(
                    model_name="gemini-1.5-pro",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-1.5-flash": genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
                "gemini-1.5-flash-8b": genai.GenerativeModel(
                    model_name="gemini-1.5-flash-8b",
                    generation_config={"temperature": 0},
                    safety_settings=self.safety_settings,
                ),
            }
            return model_configs[model]
    async def prepare_conversation_history(
        self,
        messages: List[Message],
        max_tokens: int = 1048576
    ) -> List[Message]:
        """
        Trim conversation history to stay within token limits.
        Estimates token count for both text and images.
        """
        CHARS_PER_TOKEN = 4
        IMAGE_TOKEN_ESTIMATE = 1024  # Conservative estimate for image tokens
        token_count = 0
        trimmed_messages: List[Message] = []

        for message in reversed(messages):
            message_tokens = 0
            
            # Calculate tokens for each content part
            for part in message.content:
                if part["type"] == "text":
                    message_tokens += len(part["text"]) // CHARS_PER_TOKEN
                elif part["type"] == "image_url":
                    message_tokens += IMAGE_TOKEN_ESTIMATE

            if token_count + message_tokens > max_tokens:
                break

            token_count += message_tokens
            trimmed_messages.insert(0, message)

        print(
            f"\nTrimmed conversation history to {len(trimmed_messages)} messages from {len(messages)} messages"
        )
        print(f"Estimated total tokens: {token_count}")

        return trimmed_messages
    

    async def get_rpm(self, model: str) -> int:
        if model == "gemini-2.0-flash":
            return 15
        elif model == "gemini-2.0-flash-lite":
            return 30
        elif model == "gemini-1.5-pro":
            return 2
        elif model == "gemini-1.5-flash":   
            return 15
        elif model == "gemini-1.5-flash-8b":
            return 15
        else:
            raise ValueError(f"Invalid model: {model}")
    
    

    async def robust_generate(
        self,
        system_instruction: str,
        message: Message,
        model: LiteralModel = "gemini-2.0-flash",
        retries: int = 3,
        initial_wait: int = 5
    ) -> str:
        try:
            # Acquire rate limiter permission
            await rate_limiter.acquire(model)
            
            try:
                model_instance = await self.get_model_instance(model, system_instruction)
                
                # Extract content parts from the message
                content_parts = []
                for part in message.content:
                    if part["type"] == "text":
                        content_parts.append(part["text"])
                    elif part["type"] == "image_url":
                        # Use the correct key structure for inline_data
                        content_parts.append({
                            "inline_data": {  # Changed from inlineData to inline_data
                                "mime_type": "image/png",  # Changed from mimeType to mime_type
                                "data": part["image_url"].split(",")[1]  # Remove the "data:image/png;base64," prefix
                            }
                        })
                
                # Generate response
                response = model_instance.generate_content(
                    content_parts,
                    stream=False
                )
                
                return response.text
                
            finally:
                # Always release the rate limiter
                rate_limiter.release(model)
                
        except Exception as error:
            if retries > 0:
                await asyncio.sleep(initial_wait)
                return await self.robust_generate(
                    message,
                    model,
                    retries - 1,
                    initial_wait * 1.5
                )
            raise error
        

    async def robust_generate_stream(
        self,
        system_instruction: str,
        message: Message,
        model: LiteralModel = "gemini-2.0-flash",
        retries: int = 3,
        initial_wait: int = 5
    ) -> AsyncGenerator[str, None]:
        """
        A streaming version of robust_generate that yields chunks of the response.
        """
        try:
            # Acquire rate limiter permission
            await rate_limiter.acquire(model)
            
            try:
                model_instance = await self.get_model_instance(model, system_instruction)
                
                # Extract content parts from the message
                content_parts = []
                for part in message.content:
                    if part["type"] == "text":
                        content_parts.append(part["text"])
                    elif part["type"] == "image_url":
                        content_parts.append({
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": part["image_url"].split(",")[1]
                            }
                        })
                
                # Generate response with streaming
                response = model_instance.generate_content(
                    content_parts,
                    stream=True
                )
                
                # Properly iterate over the chunks
                for chunk in response:
                    if chunk.text:
                        yield chunk.text
                
            finally:
                # Always release the rate limiter
                rate_limiter.release(model)
                
        except Exception as error:
            if retries > 0:
                await asyncio.sleep(initial_wait)
                async for chunk in self.robust_generate_stream(
                    system_instruction,
                    message,
                    model,
                    retries - 1,
                    initial_wait * 1.5
                ):
                    yield chunk
                return
            raise error