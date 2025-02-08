from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict
from app.services.base_processor import BaseProcessor, Message

class ChatMessage(TypedDict):
    id: str
    question: str
    response: str
    documents: List[str]

class ChatProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        items: Dict[str, List[str]],
    ):
        super().__init__()
        self.course_title = course_title
        self.messages: Dict[str, List[ChatMessage]] = {}
        self.items = items

    def initialize_prompt(self) -> str:
        return "You are a helpful assistant that can answer questions about the course. Using the provided context, answer the question."

    async def process_batch(
        self,
        message_id: str,
        content: str,
        question: str,
    ) -> str:
        """Process a chat message"""
        try:
            message = Message(content=[
                {"type": "text", "text": self.initialize_prompt()},
                {"type": "text", "text": f"Context:\n{content}"},
                {"type": "text", "text": f"Question: {question}\n\nAnswer:"}
            ])
            
            response = await self.robust_generate(message, model="gemini-1.5-flash")
            print(f"Successfully generated response for {message_id}")
            
            # Store the message
            if message_id not in self.messages:
                self.messages[message_id] = []
            
            self.messages[message_id].append({
                "id": message_id,
                "question": question,
                "response": response
            })
            
            return response
            
        except Exception as e:
            print(f"Error in process_batch: {str(e)}")
            raise

    async def process_messages(
        self,
        message_prompts: List[Dict[str, Any]],
        on_batch_complete: Optional[Callable[[List[ChatMessage]], Awaitable[None]]] = None
    ) -> Dict[str, List[ChatMessage]]:
        """Process chat messages"""
        
        print(f"Processing {len(message_prompts)} messages")

        for message_prompt in message_prompts:
            message_id = message_prompt.get('id')
            question = message_prompt.get('question')
            
            if not message_id or not question:
                print(f"Skipping message - missing id or question")
                continue

            result = await self.process_batch(
                message_id,
                "\n".join(self.items[message_id]),
                question
            )

            if on_batch_complete and message_id in self.messages:
                await on_batch_complete(self.messages[message_id])

        return self.messages