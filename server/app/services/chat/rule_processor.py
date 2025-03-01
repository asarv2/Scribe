import os
from typing import List, Tuple, Dict
from app.extensions import EVALUATIONS_DIR
from app.services.base_processor import BaseProcessor, Message

class RuleProcessor(BaseProcessor):
    def __init__(
        self,
        class_title: str,
        rules: List[str],
        message: str,
        message_id: str,
        past_messages: List[Tuple[str, str, str]],
    ):
        super().__init__()
        self.rules = rules
        self.class_title = class_title
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
            f"You are an expert at identifying the rules allowed in a chat, for the class {self.class_title}. "
            "Given a series of messages in a conversation and a list of rules, "
            "you will identify the rule of the most recent question/message. "
            "Each of the rules can be an individual term itself, or a type of question being asked.\n"
            "If you see a new rule, ouput <NEW>x</NEW>, where x is the rule name. "
            "You can output multiple <NEW>x</NEW> tags if the message pertains to multiple rules.\n"
            "If the rule is already in the list, output <RULE>y</RULE>, where y is the rule number for that rule. "
            "You can output multiple <RULE>y</RULE> tags if the message pertains to multiple rules.\n"
            "Make sure to make the rule as specific as possible. For example, if the rule is not to use tableau, "
            "do not just output <NEW>Tableau Method</NEW>, output <NEW>Do not use tableau method</NEW>.\n"
            "Here is an example to show how you should output your answer:\n"
            "RULES:\n"
            "RULE 1: Do not use tableu method, only use dictionary method\n"
            "RULE 2: Make sure to show all your work\n"
            "INCOMING MESSAGE:\n"
            "You should ensure that Homework 1, problem 1 is done using the dictionary method.\n"
            "OUTPUT:\n"
            "<RULE>1</RULE>\n"
            "<NEW>Homework 1, problem 1 is done using the dictionary method</NEW>\n"
        )

        messages = self.format_conversation() + "\n" + "INCOMING MESSAGE: " + self.current_message

        prompt = (
            "Now it is your turn to group the message into rules, depending on the rules provided. "
            "Remember to only use <NEW>x</NEW> or <RULE>y</RULE> tags.\n"
            "RULES:\n"
            f"{self.rules}\n"
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
    
    def clean_result(self, response: str, rules: Dict[int, Tuple[str, str]]) -> List[Tuple[str, str, int]]:
        """
        Clean the response from the model and extract rule information.
        
        Args:
            response: Raw response string containing <NEW> and <RULE> tags
            rules: Dictionary mapping rule numbers to (uuid, rule_name) tuples
        
        Returns:
            List of (rule_id, rule_name, count) tuples where:
            - For existing rules: rule_id is the UUID from the database
            - For new rules: rule_id is None
            - count is always 1 (to increment the rule count by 1)
        """
        import re
        result = []
        
        # Extract existing rules
        rule_matches = re.findall(r'<RULE>(\d+)</RULE>', response)
        for rule_num in rule_matches:
            rule_num = int(rule_num)
            if rule_num in rules:
                uuid, rule_name = rules[rule_num]
                result.append((uuid, rule_name, 1))
        
        # Extract new rules
        new_matches = re.findall(r'<NEW>(.*?)</NEW>', response)
        for new_rule in new_matches:
            # For new rules, we use None as the ID - they'll be inserted as new rows
            result.append((None, new_rule.strip(), 1))
        
        return result  