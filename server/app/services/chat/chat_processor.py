from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict, AsyncGenerator, Tuple
from app.services.base_processor import BaseProcessor, Message
import re
from datetime import datetime
import os
from app.config import MESSAGES_DIR

class ChatMessage(TypedDict):
    id: str
    question: str
    response: str
    references: List[str]
    title: Optional[str]

class ChatProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        message_id: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
    ):
        super().__init__()
        self.course_title = course_title
        self.message_id = message_id
        self.current_question = question
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
            "Based on this context, respond to the student's latest message.\n"
            "Remember to:\n"
            "1. Be consistent with previous explanations\n"
            "2. Build upon what the student has understood\n"
            "3. Address any misconceptions from earlier in the conversation"
        )

    async def process_message(
        self,
        complete_context: str,
        all_lectures: List[Dict[str, Any]],
        all_textbooks: List[Dict[str, Any]],
        all_documents: List[Dict[str, Any]],
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None
    ) -> AsyncGenerator[str, None]:
        """Process a single message with streaming"""
        try:
            conversation_context = self.format_conversation()

            system_prompt = (
                "You are a helpful and patient Teaching Assistant at a university.\n\n"
                "Important guidelines for your responses:\n"
                "1. Maintain consistent knowledge throughout the conversation\n"
                "2. If a student says they don't understand something, help explain it again\n"
                "3. If a student makes a mistake, point out specifically what's wrong\n"
                "4. Keep track of what has been explained and what hasn't\n"
                "5. When a student says they understand something, build upon that in next responses\n"
                "6. If a student contradicts their earlier understanding, kindly point it out\n\n"
                "Remember the conversation context:\n"
                "- What concepts have been explained\n"
                "- What the student has understood\n"
                "- What the student is still struggling with\n\n"
                "Keep responses conversational but precise.\n"
                "DON'T SHOW THE ANSWER, just help guide the student to the correct answer.\n"
                "Once you've helped guide the student to the correct answer, end the conversation in a nice way and DONT ASK ANY MORE QUESTIONS.\n"
                "SAy something nice at the end like, glad I could help, or great job, or something like that.\n\n"
                "**Guidelines for Responses:**\n"
                "1. Keep explanations **concise and to the point**. Avoid large blocks of text.\n"
                "2. **Check for understanding** before moving forward by asking the student to summarize or apply the concept. Only do this when walking a student through a problem they want to solve.\n"
                "3. Instead of directly giving answers, **ask guiding questions** to help the student think through problems.\n"
                "4. Use simple, **real-world analogies** when appropriate to clarify concepts.\n"
                "5. If the student is struggling, **break down the explanation into smaller steps**.\n"
                "6. Validate student responses and encourage them to refine their thinking when needed.\n"
                "7. If the student asks for more detail, **expand gradually** instead of dumping too much information at once.\n"
                "8. **Only use knowledge from the provided course materials**. Do not make up or assume information.\n"
                "9. To provide the student with visualization for the concepts, use LaTeX formatting to display equations, diagrams, and graphs.\n"
                "10. Use <TITLE>x</TITLE> tags to start your response with the summary title of the content that is relevant to the student's question, where x is the title. Only include the title tag if it is the first response you are giving to the student. If you see previous responses, do not include the title tag. For example, if the student asks about the concept of recursion in Python code, you should use the following tag: <TITLE>Recursion in Python Code</TITLE>. You should only enclose the title in the title tag, not anywhere else in your response.\n\n"
                "CRITICAL INSTRUCTIONS:\n\n"
                "When citing course content, use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags, where x is the lecture number and a, b, c are the slide numbers. Moreover, if you use the textbook, use <TEXTBOOK x><PAGE a><PAGE b><PAGE c></TEXTBOOK> tags, where x is the textbook number and a, b, c are the page numbers. Put this at the end of your response.\n\n"
                "For example, if you use the lecture 4, slides 12, 13, and 14, you should use the following tags:\n"
                "<LECTURE 4><SLIDE 12><SLIDE 13><SLIDE 14></LECTURE>\n\n"
                "If you use the textbook 1, pages 45, 46, and 47, you should use the following tags:\n"
                "<TEXTBOOK 1><PAGE 45><PAGE 46><PAGE 47></TEXTBOOK>\n\n"
                "REFRAIN FROM USING ANY OTHER TAGS.\n\n"
                "---\n\n"
                "### **Example Interaction:**\n\n"
                "**Student:** \"I don't understand how recursion works.\"\n\n"
                "**You (AI):** <TITLE>Recursion in Python Code</TITLE> \"Recursion is when a function calls itself to solve a smaller piece of the problem. Have you worked with loops before?\"\n"
                "<LECTURE 4><SLIDE 12><SLIDE 13><SLIDE 14></LECTURE>\n\n"
                "**Student:** \"Yeah, I know loops.\"\n\n"
                "**You (AI):** \"Great! Recursion is similar to a loop, but instead of repeating an action with a `for` or `while` statement, the function calls itself with a slightly smaller input. What do you think happens if a recursive function never stops calling itself?\"\n"
                "<TEXTBOOK 1><PAGE 45></TEXTBOOK>\n\n"
                "**Student:** \"It would go on forever?\"\n\n"
                "**You (AI):** \"Exactly! That's why recursion needs a **base case**—a condition where it stops. Would you like to see an example with factorial calculation?\n"
                "<LECTURE 4><SLIDE 12><SLIDE 13><SLIDE 14></LECTURE>\n"
                "<TEXTBOOK 1><PAGE 46></TEXTBOOK>\n\n"
                "---\n"
            )

            prompt = (
                "### **Now, continue the conversation using this style.**\n\n"
                f"{conversation_context}\n\n"
                "Here is the current conversation context:\n"
                f"{complete_context}\n\n"
                "CRITICAL INSTRUCTIONS:\n\n"
                "When citing course content, use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags, where x is the lecture number and a, b, c are the slide numbers. "
                "Moreover, if you use the textbook, use <TEXTBOOK x><PAGE a><PAGE b><PAGE c></TEXTBOOK> tags, where x is the textbook number and a, b, c are the page numbers. "
                "Put this at the end of your response.\n\n"
                f"**Student:** {self.current_question}\n"
                "**You (AI):** "
            )

            # save input prompt to .txt file in uploads folder
            with open(os.path.join(MESSAGES_DIR, f"{self.message_id}.txt"), "w") as f:
                f.write("BASE PROMPT: " + system_prompt + "\n\n" + "INPUT PROMPT: " + prompt)

            message = Message(content=[
                {"type": "text", "text": prompt},
            ])
            
            response_text = ""
            async for chunk in self.robust_generate_stream(system_prompt, message, "gemini-2.0-flash"):
                response_text += chunk
                if stream_callback:
                    yield await stream_callback(chunk)

            # Add response to chat history
            self.chat_history.extend([self.current_question, response_text])

            cleaned_result = self.clean_result(
                response_text, 
                all_lectures, 
                all_textbooks, 
                all_documents
            )

            yield cleaned_result
            
        except Exception as e:
            print(f"Error in process_message: {str(e)}")
            raise

    def clean_result(
        self,
        result: str,
        all_lectures: List[Dict[str, Any]],
        all_textbooks: List[Dict[str, Any]],
        all_documents: List[Dict[str, Any]],
    ) -> ChatMessage:
        """Clean chat results and extract document references from tags."""
        document_ids = []
        
        # Extract title if present
        title = None
        title_match = re.search(r'<TITLE>([^<]+)</TITLE>', result)
        if title_match:
            title = title_match.group(1).strip()
            # Remove the entire title section (tags and content)
            result = re.sub(r'<TITLE>[^<]+</TITLE>', '', result)

        lecture_matches = re.finditer(r'<LECTURE ([^>]+)>((?:<SLIDE \d+>)+)</LECTURE>', result)
        for lecture_match in lecture_matches:
            lecture_number = lecture_match.group(1)
            slide_nums = [int(num) for num in re.findall(r'<SLIDE (\d+)>', lecture_match.group(2))]

            lecture_id = next((lecture['id'] for lecture in all_lectures if lecture['note_number'] == int(lecture_number)), None)
            
            # Debug prints
            print(f"Found lecture number: {lecture_number}")
            print(f"Found slide numbers: {slide_nums}")
            print(f"Found lecture ID: {lecture_id}")
            # Find matching documents
            matching_docs = [
                doc['id'] for doc in all_documents
                if doc.get('page') in slide_nums 
                and doc.get('lecture') == lecture_id
            ]
            print(f"Matching documents found: {matching_docs}")
            document_ids.extend(matching_docs)

        textbook_matches = re.finditer(r'<TEXTBOOK ([^>]+)>((?:<PAGE \d+>)+)</TEXTBOOK>', result)
        for textbook_match in textbook_matches:
            textbook_number = textbook_match.group(1)
            page_nums = [int(num) for num in re.findall(r'<PAGE (\d+)>', textbook_match.group(2))]

            textbook_id = next((textbook['id'] for textbook in all_textbooks if textbook['textbook_number'] == int(textbook_number)), None)

            # Debug prints
            print(f"Found textbook number: {textbook_number}")
            print(f"Found page numbers: {page_nums}")
            print(f"Found textbook ID: {textbook_id}")
            # Find matching documents
            matching_docs = [
                doc['id'] for doc in all_documents
                if doc.get('page') in page_nums 
                and doc.get('textbook') == textbook_id
            ]
            print(f"Matching documents found: {matching_docs}")
            document_ids.extend(matching_docs)
        
        # Remove all tags from the result (including TITLE tags)
        cleaned_result = re.sub(r'<(LECTURE|TEXTBOOK|SLIDE|PAGE|TITLE)[^>]*>', '', result)
        cleaned_result = re.sub(r'</(LECTURE|TEXTBOOK|TITLE)>', '', cleaned_result)
        
        return ChatMessage(
            id=self.message_id,
            question=self.current_question,
            response=cleaned_result.strip(),
            references=list(set(document_ids)),
            title=title  # Add the title to the response
        )

    def clear_chat_history(self, message_id: str) -> None:
        """Clear the chat history for a specific message ID"""
        if message_id in self.chat_histories:
            del self.chat_histories[message_id]