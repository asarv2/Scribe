import os
from typing import List, Tuple, Dict
from app.extensions import CHATS_DIR
from app.services.base_processor import BaseProcessor, Message

class TitleProcessor(BaseProcessor):
    def __init__(
        self,
        chat_id: str,
        human_message: str,
        ai_message: str,
    ):
        super().__init__()
        self.chat_id = chat_id
        self.human_message = human_message
        self.ai_message = ai_message

    def format_conversation(self) -> str:
        """Format the conversation history into context"""
        return (
            "Previous conversation context:\n"
            f"Student asked: {self.human_message}\nYou explained: {self.ai_message}\n"
        )

    async def process_message(self) -> List[str]:
        """
        Prompt the model to generate a title for the chat.
        """
        system_prompt = (
            "You are an expert at identifying the title of a chat."
            "Given the first couple of messages in a chat, "
            "you will identify the title of the chat. "
            "The title should be a single sentence that captures the essence of the chat. "
            "You should output a single <TITLE>x</TITLE> tag, where x is the title of the chat. "
            "Here is an example to show how you should output your answer:\n"
            "CONVERSATION:\n"
            "Student: Can you explain the simplex method?\n"
            "You: The simplex method is a method for solving linear programming problems."
            "OUTPUT:\n"
            "<TITLE>Simplex Method</TITLE>\n"
        )

        messages = self.format_conversation() + "\n" + "CONVERSATION:\n" + self.human_message

        prompt = (
            "Now it is your turn to generate a title for the chat. "
            f"{messages}\n"
            "OUTPUT:\n"
        )

        # save input prompt to .txt file in uploads folder
        with open(os.path.join(CHATS_DIR, f"{self.chat_id}.txt"), "w") as f:
            f.write("SYSTEM PROMPT: " + system_prompt + "\n\n" + "INPUT PROMPT: " + prompt)

        message = Message(content=[
            {"type": "text", "text": prompt},
        ])

        response = await self.robust_generate(system_prompt, message, "gemini-2.0-flash")

        return response
    
    def clean_result(self, response: str) -> str:
        """
        Clean the response from the model and extract topic information.
        
        Args:
            response: Raw response string containing <TITLE> tags
        
        Returns:
            title: The title of the chat
        """
        import re
        title_match = re.search(r'<TITLE>(.*?)</TITLE>', response)
        if title_match:
            return title_match.group(1).strip()
        else:
            return ""
