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

    def initialize_prompt(self) -> str:
        return "You are a helpful assistant that can answer questions about the course. Using the provided context, answer the question."

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
            message = Message(content=[
                {"type": "text", "text": self.initialize_prompt()},
                {"type": "text", "text": f"Context:\n{content}"},
                {"type": "text", "text": f"Question: {question}\n\nAnswer:"}
            ])
            
            response = await self.robust_generate(message, model="gemini-1.5-flash")
            print(f"Successfully generated response for {message_id}")

            message_obj = self.clean_result(message_id, question, response, all_lectures, all_textbooks, all_documents)
            
            # Store the message
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
        You are an AI assistant designed to act as a college office hours tutor. Your goal is to help students understand concepts by guiding them through discussions rather than overwhelming them with information.

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