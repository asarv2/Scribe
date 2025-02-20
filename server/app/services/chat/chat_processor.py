from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict, AsyncGenerator, Tuple
from app.services.base_processor import BaseProcessor, Message
import re
from datetime import datetime
import os
from app.extensions import MESSAGES_DIR, UPLOAD_FOLDER
from app.extensions import supabase
class ChatMessage(TypedDict):
    id: str
    question: str
    response: str
    references: List[str]
    title: Optional[str]
    figures: List[str]

class ChatProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        message_id: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        answer_system_prompt: str,
    ):
        super().__init__()
        self.course_title = course_title
        self.message_id = message_id
        self.current_question = question
        self.chat_history = []
        self.answer_system_prompt = answer_system_prompt
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

            base_system_prompt = (
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
            )

            additional_system_prompt = (
                "Once you've helped guide the student to the correct answer, end the conversation in a nice way and DONT ASK ANY MORE QUESTIONS.\n"
                "Say something nice at the end like, glad I could help, or great job, or something like that.\n\n"
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
                "10. Use <CODE>x</CODE> tags to write code in Python that can display a chart in matplotlib. For example, if you wanted to show the 2D visualization of 2 equations (with x and y axes), you should write the following code: <CODE>import matplotlib.pyplot as plt\nimport numpy as np\nx = np.linspace(-5, 5, 100)\ny1 = 2*x + 1  # First equation: y = 2x + 1\ny2 = x**2    # Second equation: y = x^2\nplt.plot(x, y1, label='y = 2x + 1')\nplt.plot(x, y2, label='y = x^2')\nplt.grid(True)\nplt.legend()\nplt.xlabel('x')\nplt.ylabel('y')\nplt.show()</CODE>. You should only enclose the code in the code tag, not anywhere else in your response.\n\n"
                "11. Use <TITLE>x</TITLE> tags to start your response with the summary title of the content that is relevant to the student's question, where x is the title. Only include the title tag if it is the first response you are giving to the student. If you see previous responses, do not include the title tag. For example, if the student asks about the concept of recursion in Python code, you should use the following tag: <TITLE>Recursion in Python Code</TITLE>. You should only enclose the title in the title tag, not anywhere else in your response.\n\n"
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
                "When you would like to show a chart, use <CODE>x</CODE> tags to write code in Python that can display a chart in matplotlib. For example, if you wanted to show the 2D visualization of 2 equations (with x and y axes), you should write the following code: <CODE>import matplotlib.pyplot as plt\nimport numpy as np\nx = np.linspace(-5, 5, 100)\ny1 = 2*x + 1  # First equation: y = 2x + 1\ny2 = x**2    # Second equation: y = x^2\nplt.plot(x, y1, label='y = 2x + 1')\nplt.plot(x, y2, label='y = x^2')\nplt.grid(True)\nplt.legend()\nplt.xlabel('x')\nplt.ylabel('y')\nplt.show()</CODE>. You should only enclose the code in the code tag, not anywhere else in your response.\n\n"
                "When citing course content, use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags, where x is the lecture number and a, b, c are the slide numbers. "
                "Moreover, if you use the textbook, use <TEXTBOOK x><PAGE a><PAGE b><PAGE c></TEXTBOOK> tags, where x is the textbook number and a, b, c are the page numbers. "
                "Put this at the end of your response.\n\n"
                f"**Student:** {self.current_question}\n"
                "**You (AI):** "
            )


            # save input prompt to .txt file in uploads folder
            with open(os.path.join(MESSAGES_DIR, f"{self.message_id}.txt"), "w") as f:
                f.write("BASE PROMPT: " + base_system_prompt + "\n\n" + "ADDITIONAL PROMPT: " + additional_system_prompt + "\n\n" + "ANSWER SYSTEM PROMPT: " + self.answer_system_prompt + "\n\n" + "INPUT PROMPT: " + prompt)

            message = Message(content=[
                {"type": "text", "text": prompt},
            ])

            final_system_prompt = base_system_prompt + additional_system_prompt + self.answer_system_prompt
            
            response_text = ""
            async for chunk in self.robust_generate_stream(final_system_prompt, message, "gemini-2.0-flash"):
                response_text += chunk
                if stream_callback:
                    yield await stream_callback(chunk)

            # Add response to chat history
            self.chat_history.extend([self.current_question, response_text])

            yield response_text
            
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
        """Clean chat results and extract document references and code blocks from tags."""
        document_ids = []
        figure_ids = []
        
        # Extract title if present
        title = None
        title_match = re.search(r'<TITLE>([^<]+)</TITLE>', result)
        if title_match:
            title = title_match.group(1).strip()
            result = re.sub(r'<TITLE>[^<]+</TITLE>', '', result)

        # Extract and process code blocks
        code_matches = re.finditer(r'<CODE>(.*?)</CODE>', result, re.DOTALL)
        for code_match in code_matches:
            code_block = code_match.group(1).strip()
            try:
                # Create a synchronous version for now
                figure_id = self._execute_and_save_plot_sync(code_block)
                if figure_id:
                    figure_ids.append(figure_id)
                    # Replace code block with figure reference
                    result = result.replace(code_match.group(0), f'<FIGURE>{figure_id}</FIGURE>')
            except Exception as e:
                print(f"Error executing code block: {str(e)}")
                # Remove the code block if execution fails
                result = result.replace(code_match.group(0), '')

        # Process lectures and insert document tags
        lecture_matches = re.finditer(r'<LECTURE ([^>]+)>((?:<SLIDE \d+>)+)</LECTURE>', result)
        for lecture_match in lecture_matches:
            lecture_number = lecture_match.group(1)
            slide_nums = [int(num) for num in re.findall(r'<SLIDE (\d+)>', lecture_match.group(2))]
            lecture_id = next((lecture['id'] for lecture in all_lectures if lecture['note_number'] == int(lecture_number)), None)
            
            # Find matching documents
            matching_docs = [
                doc['id'] for doc in all_documents
                if doc.get('page') in slide_nums 
                and doc.get('lecture') == lecture_id
            ]
            document_ids.extend(matching_docs)
            
            # Replace the lecture tag with document tags
            document_tags = ''.join([f'<DOCUMENT>{doc_id}</DOCUMENT>' for doc_id in matching_docs])
            result = result.replace(lecture_match.group(0), document_tags)

        # Process textbooks and insert document tags
        textbook_matches = re.finditer(r'<TEXTBOOK ([^>]+)>((?:<PAGE \d+>)+)</TEXTBOOK>', result)
        for textbook_match in textbook_matches:
            textbook_number = textbook_match.group(1)
            page_nums = [int(num) for num in re.findall(r'<PAGE (\d+)>', textbook_match.group(2))]
            textbook_id = next((textbook['id'] for textbook in all_textbooks if textbook['textbook_number'] == int(textbook_number)), None)
            
            # Find matching documents
            matching_docs = [
                doc['id'] for doc in all_documents
                if doc.get('page') in page_nums 
                and doc.get('textbook') == textbook_id
            ]
            document_ids.extend(matching_docs)
            
            # Replace the textbook tag with document tags
            document_tags = ''.join([f'<DOCUMENT>{doc_id}</DOCUMENT>' for doc_id in matching_docs])
            result = result.replace(textbook_match.group(0), document_tags)
        
        # Remove any remaining lecture/textbook related tags
        cleaned_result = re.sub(r'<(LECTURE|TEXTBOOK|SLIDE|PAGE|TITLE)[^>]*>', '', result)
        cleaned_result = re.sub(r'</(LECTURE|TEXTBOOK|TITLE)>', '', cleaned_result)
        
        return ChatMessage(
            id=self.message_id,
            question=self.current_question,
            response=cleaned_result.strip(),
            references=list(set(document_ids)),
            title=title,
            figures=figure_ids
        )

    def _execute_and_save_plot_sync(self, code_block: str) -> Optional[str]:
        """Synchronous version of plot generation and saving."""
        import io
        import os
        import matplotlib.pyplot as plt
        import numpy as np
        
        try:
            # Clear any existing plots
            plt.close('all')
            
            # Create namespace with pre-imported modules and ensure plt.figure is called
            namespace = {
                'plt': plt,
                'np': np,
                'figure': plt.figure(),  # Create a new figure explicitly
            }
            
            # Set non-interactive backend before executing code
            plt.switch_backend('Agg')
            
            # Execute the code
            exec(code_block, namespace)
            
            # Get the current figure (the one we're working with)
            current_fig = plt.gcf()
            
            # Verify the figure has actual content
            if len(current_fig.axes) == 0 or not any(ax.lines or ax.collections or ax.patches or ax.images for ax in current_fig.axes):
                print("Figure exists but has no plotted content")
                return None
            
            # Save to buffer for Supabase
            buffer = io.BytesIO()
            current_fig.savefig(buffer, format='png', bbox_inches='tight', dpi=300)
            
            # Insert metadata and upload to Supabase
            figure_data = {
                'message': self.message_id,
                'code': code_block,
            }
            
            figure_id = supabase.table('figures').insert(figure_data).execute().data[0]['id']

            # Save to local file system for debugging
            local_path = os.path.join(UPLOAD_FOLDER, f"{figure_id}.png")
            current_fig.savefig(local_path, format='png', bbox_inches='tight', dpi=300)
            
            # Clean up
            plt.close('all')
            
            buffer.seek(0)
            supabase.storage.from_('figures').upload(
                f"{figure_id}.png",
                buffer.getvalue(),
                {'content-type': 'image/png'}
            )

            print(f"Figure saved locally at: {local_path}")
            return figure_id

        except Exception as e:
            print(f"Error in _execute_and_save_plot_sync: {str(e)}")
            plt.close('all')  # Ensure cleanup even on error
            return None

    def clear_chat_history(self, message_id: str) -> None:
        """Clear the chat history for a specific message ID"""
        if message_id in self.chat_histories:
            del self.chat_histories[message_id]