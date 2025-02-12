from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict
from app.services.base_processor import BaseProcessor, Message
import re

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
        self.chat_histories: Dict[str, List[str]] = {}  # Add chat history storage

    def initialize_prompt(self) -> str:
        return "You are a helpful assistant that can answer questions about the course. Using the provided context, answer the question."

    def format_conversation(self, messages: List[str]) -> str:
        """Format the conversation to help maintain context"""
        context_summary = ""
        
        # Add pairs of messages with context
        for i in range(0, len(messages)-1, 2):
            user_msg = messages[i]
            assistant_msg = messages[i+1] if i+1 < len(messages) else None
            
            if assistant_msg:
                context_summary += f"\nStudent asked: {user_msg}\nYou explained: {assistant_msg}\n"
        
        return f"""
        Previous conversation context:
        {context_summary}
        
        Based on this context, respond to the student's latest message.
        Remember to:
        1. Be consistent with previous explanations
        2. Build upon what the student has understood
        3. Address any misconceptions from earlier in the conversation
        """

    async def process_batch(
        self,
        message_id: str,
        content: str,
        question: str,
        all_lectures: List[Dict[str, Any]],
        all_textbooks: List[Dict[str, Any]],
        all_documents: List[Dict[str, Any]],
    ) -> str:
        """Process a chat message"""
        try:
            # Initialize chat history if not exists
            if message_id not in self.chat_histories:
                self.chat_histories[message_id] = []
            
            # Add question to chat history
            self.chat_histories[message_id].append(question)
            
            # Build conversation context
            conversation_context = ""
            if len(self.chat_histories[message_id]) > 1:
                conversation_context = self.format_conversation(self.chat_histories[message_id])

            message = Message(content=[
                {"type": "text", "text": self.initialize_prompt()},
                {"type": "text", "text": f"Context:\n{content}"},
                {"type": "text", "text": conversation_context},  # Add conversation context
                {"type": "text", "text": f"Question: {question}\n\nAnswer:"}
            ])
            
            response = await self.robust_generate(message, model="gemini-2.0-flash")
            print(f"Successfully generated response for {message_id}")

            # Add response to chat history
            self.chat_histories[message_id].append(response)

            message_obj = self.clean_result(message_id, question, response, all_lectures, all_textbooks, all_documents)
            
            if message_id not in self.messages:
                self.messages[message_id] = []
            
            self.messages[message_id].append(message_obj)
            
            return response
            
        except Exception as e:
            print(f"Error in process_batch: {str(e)}")
            raise

    async def process_messages(
        self,
        message_prompts: List[Dict[str, Any]],
        on_batch_complete: Optional[Callable[[List[ChatMessage]], Awaitable[None]]] = None,
        all_lectures: List[Dict[str, str]] = [],
        all_textbooks: List[Dict[str, str]] = [],
        all_documents: Dict[str, List[Any]] = {},
    ) -> Dict[str, List[ChatMessage]]:
        """Process chat messages"""
        
        print(f"Processing {len(message_prompts)} messages")

        system_prompt = """
        You are a helpful and patient Teaching Assistant at a university.
        
        Important guidelines for your responses:
        1. Maintain consistent knowledge throughout the conversation
        2. If a student says they don't understand something, help explain it again
        3. If a student makes a mistake, point out specifically what's wrong
        4. Keep track of what has been explained and what hasn't
        5. When a student says they understand something, build upon that in next responses
        6. If a student contradicts their earlier understanding, kindly point it out
        
        Remember the conversation context:
        - What concepts have been explained
        - What the student has understood
        - What the student is still struggling with
        
        Keep responses conversational but precise.
        DON'T SHOW THE ANSWER, just help guide the student to the correct answer.
        Once you've helped guide the student to the correct answer, end the conversation in a nice way and DONT ASK ANY MORE QUESTIONS.
        SAy something nice at the end like, glad I could help, or great job, or something like that.

        **Guidelines for Responses:**
        1. Keep explanations **concise and to the point**. Avoid large blocks of text.
        2. **Check for understanding** before moving forward by asking the student to summarize or apply the concept. Only do this when walking a student through a problem they want to solve.
        3. Instead of directly giving answers, **ask guiding questions** to help the student think through problems.
        4. Use simple, **real-world analogies** when appropriate to clarify concepts.
        5. If the student is struggling, **break down the explanation into smaller steps**.
        6. Validate student responses and encourage them to refine their thinking when needed.
        7. If the student asks for more detail, **expand gradually** instead of dumping too much information at once.
        8. **Only use knowledge from the provided course materials**. Do not make up or assume information.
        9. To provide the student with visualization for the concepts, use LaTeX formatting to display equations, diagrams, and graphs.
        10. When citing course content, use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags, where x is the lecture number and a, b, c are the slide numbers. Moreover, if you use the textbook, use <TEXTBOOK x><PAGE a><PAGE b><PAGE c></TEXTBOOK> tags, where x is the textbook number and a, b, c are the page numbers. Put this at the end of your response. 

        ---

        ### **Example Interaction:**

        **Student:** "I don't understand how recursion works."

        **You (AI):** "Recursion is when a function calls itself to solve a smaller piece of the problem. Have you worked with loops before?"
        <LECTURE 4><SLIDE 12><SLIDE 13><SLIDE 14></LECTURE>

        **Student:** "Yeah, I know loops."

        **You (AI):** "Great! Recursion is similar to a loop, but instead of repeating an action with a `for` or `while` statement, the function calls itself with a slightly smaller input. What do you think happens if a recursive function never stops calling itself?"
        <TEXTBOOK 1><PAGE 45></TEXTBOOK>

        **Student:** "It would go on forever?"

        **You (AI):** "Exactly! That's why recursion needs a **base case**—a condition where it stops. Would you like to see an example with factorial calculation?
        <LECTURE 4><SLIDE 12><SLIDE 13><SLIDE 14></LECTURE>
        <TEXTBOOK 1><PAGE 46></TEXTBOOK>

        ---

        ### **Now, continue the conversation using this style.**
        """

        for message_prompt in message_prompts:
            message_id = message_prompt.get('id')
            question = message_prompt.get('question')
            
            if not message_id or not question:
                print(f"Skipping message - missing id or question")
                continue

            context = f"{system_prompt}\n\nCourse Materials:\n{'\n'.join(self.items[message_id])}"
            
            result = await self.process_batch(
                message_id,
                context,
                question,
                all_lectures,
                all_textbooks,
                all_documents[message_id]
            )
            print(f"Result: {result}")

            if on_batch_complete and message_id in self.messages:
                await on_batch_complete(self.messages[message_id])

        return self.messages
    
    def clean_result(
        self,
        message_id: str,
        question: str,
        result: str,
        all_lectures: List[Dict[str, Any]],
        all_textbooks: List[Dict[str, Any]],
        all_documents: List[Dict[str, Any]],
    ) -> ChatMessage:
        """Clean chat results and extract document references from tags."""
        document_ids = []
        
        # Debug prints
        print("Parsing response:", result)
        print("Available lectures:", all_lectures)
        print("Available documents:", all_documents)
        
        lecture_matches = re.finditer(r'<LECTURE ([^>]+)>((?:<SLIDE \d+>)+)</LECTURE>', result)
        for lecture_match in lecture_matches:
            lecture_name = lecture_match.group(1)
            slide_nums = [int(num) for num in re.findall(r'<SLIDE (\d+)>', lecture_match.group(2))]

            lecture_id = next((lecture['id'] for lecture in all_lectures if lecture['name'] == lecture_name), None)
            
            # Debug prints
            print(f"Found lecture name: {lecture_name}")
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
        
        # Remove the tags from the result
        cleaned_result = re.sub(r'<(LECTURE|TEXTBOOK|SLIDE|PAGE)[^>]*>', '', result)
        cleaned_result = re.sub(r'</(LECTURE|TEXTBOOK)>', '', cleaned_result)
        
        return ChatMessage(
            id=message_id,
            question=question,
            response=cleaned_result.strip(),
            documents=list(set(document_ids))
        )

    def clear_chat_history(self, message_id: str) -> None:
        """Clear the chat history for a specific message ID"""
        if message_id in self.chat_histories:
            del self.chat_histories[message_id]