import os
from typing import List, Tuple, Dict
from app.extensions import EVALUATIONS_DIR
from app.services.base_processor import BaseProcessor, Message

class TopicProcessor(BaseProcessor):
    def __init__(
        self,
        topics: List[str],
        message: str,
        message_id: str,
        past_messages: List[Tuple[str, str, str]],
    ):
        super().__init__()
        self.topics = topics
        self.current_message = message
        self.message_id = message_id
        self.chat_history = []
        # Format past messages into chat history
        for _, q, r in past_messages:
            if q and r:  # Only add complete message pairs
                self.chat_history.extend([q, r])

    def format_conversation(self) -> str:
        """Format the conversation history into context"""
        if not self.chat_history:
            return ""
            
        context_summary = ""
        for i in range(0, len(self.chat_history)-1, 2):
            user_msg = self.chat_history[i]
            assistant_msg = self.chat_history[i+1]
            context_summary += f"Student asked: {user_msg}\nYou explained: {assistant_msg}\n"
        
        return (
            "Previous conversation context:\n"
            f"{context_summary}\n"
        )

    async def process_message(self) -> List[str]:
        """
        Prompt the model to group the message into topics of questions being asked, depending on the topics provided.
        """
        system_prompt = (
            "You are an expert at identifying the topics of questions being asked in a chat. "
            "Given a series of messages in a conversation and a list of topics, "
            "you will identify the topic of the most recent question/message. "
            "Each of the topics can be an individual term itself, or a type of question being asked.\n"
            "If you see a new topic, ouput <NEW>x</NEW>, where x is the topic name. "
            "You can output multiple <NEW>x</NEW> tags if the message pertains to multiple topics.\n"
            "If the topic is already in the list, output <TOPIC>y</TOPIC>, where y is the topic number for that topic. "
            "You can output multiple <TOPIC>y</TOPIC> tags if the message pertains to multiple topics.\n"
            "Here is an example to show how you should output your answer:\n"
            "TOPICS:\n"
            "TOPIC 1: Simplex Method\n"
            "TOPIC 2: Network Flows Type Problems\n"
            "TOPIC 3: What is the difference between a simplex method and a dual simplex method?\n"
            "INCOMING MESSAGE:\n"
            "- Can you explain the simplex method?\n"
            "OUTPUT:\n"
            "<TOPIC>1</TOPIC>\n"
            "<NEW>Dual Simplex Method</NEW>\n"
        )

        messages = self.format_conversation() + "\n" + "INCOMING MESSAGE: " + self.current_message

        prompt = (
            "Now it is your turn to group the message into topics of questions being asked, depending on the topics provided. "
            "Remember to only use <NEW>x</NEW> or <TOPIC>y</TOPIC> tags.\n"
            "TOPICS:\n"
            f"{self.topics}\n"
            "MESSAGES:\n"
            f"{messages}\n"
            "OUTPUT:\n"
        )

        # save input prompt to .txt file in uploads folder
        with open(os.path.join(EVALUATIONS_DIR, f"{self.message_id}.txt"), "w") as f:
            f.write("SYSTEM PROMPT: " + system_prompt + "\n\n" + "INPUT PROMPT: " + prompt)

        message = Message(content=[
            {"type": "text", "text": prompt},
        ])

        response = await self.robust_generate(system_prompt, message, "gemini-2.0-flash")

        return response
    
    def clean_result(self, response: str, topics: Dict[int, Tuple[str, str]]) -> List[Tuple[str, str, int]]:
        """
        Clean the response from the model and extract topic information.
        
        Args:
            response: Raw response string containing <NEW> and <TOPIC> tags
            topics: Dictionary mapping topic numbers to (uuid, topic_name) tuples
        
        Returns:
            List of (topic_id, topic_name, count) tuples where:
            - For existing topics: topic_id is the UUID from the database
            - For new topics: topic_id is None
            - count is always 1 (to increment the topic count by 1)
        """
        import re
        result = []
        
        # Extract existing topics
        topic_matches = re.findall(r'<TOPIC>(\d+)</TOPIC>', response)
        for topic_num in topic_matches:
            topic_num = int(topic_num)
            if topic_num in topics:
                uuid, topic_name = topics[topic_num]
                result.append((uuid, topic_name, 1))
        
        # Extract new topics
        new_matches = re.findall(r'<NEW>(.*?)</NEW>', response)
        for new_topic in new_matches:
            # For new topics, we use None as the ID - they'll be inserted as new rows
            result.append((None, new_topic.strip(), 1))
        
        return result  