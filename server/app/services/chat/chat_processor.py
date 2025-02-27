from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict, AsyncGenerator, Tuple
from app.services.base_processor import BaseProcessor, Message
import re
from datetime import datetime
import os
from app.extensions import MESSAGES_DIR, UPLOAD_FOLDER
from app.extensions import supabase
from app.services.chat.prompts import get_homework_prompt, get_summary_prompt, get_conceptual_prompt, get_general_prompt, get_review_prompt, get_specific_approach_prompt, get_faq_prompt, get_misconceptions_prompt


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
        prompt_type: str,
        course_title: str,
        message_id: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        answerable_problems_string: str | None,
    ):
        super().__init__()
        self.prompt_type = prompt_type
        self.course_title = course_title
        self.message_id = message_id
        self.current_question = question
        self.chat_history = []
        self.answerable_problems_string = answerable_problems_string
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
            
            system_prompt = ""
            match self.prompt_type:
                case "homework":
                    if self.answerable_problems_string is None:
                        system_prompt = get_homework_prompt(solution=False)
                    else:
                        system_prompt = get_homework_prompt(solution=True) + self.answerable_problems_string
                case "summary":
                    system_prompt = get_summary_prompt()
                case "conceptual":
                    system_prompt = get_conceptual_prompt()
                case "general-student":
                    system_prompt = get_general_prompt()
                case "review":
                    system_prompt = get_review_prompt()
                case "approach":
                    system_prompt = get_specific_approach_prompt()
                case "faq":
                    system_prompt = get_faq_prompt()
                case "misconception":
                    system_prompt = get_misconceptions_prompt()
                case 'general-teacher':
                    system_prompt = get_general_prompt()

            prompt = (
                "### **Now, continue the conversation using this style.**\n\n"
                f"{conversation_context}\n\n"
                "Here is the current conversation context:\n"
                f"{complete_context}\n\n"
                "CRITICAL INSTRUCTIONS:\n\n"
                "Only if you find it useful, or the student asks use <CODE>x</CODE> tags to write code in Python that can display a chart in matplotlib. For example, if you wanted to show the 2D visualization of 2 equations (with x and y axes), you should write the following code: <CODE>import matplotlib.pyplot as plt\nimport numpy as np\nx = np.linspace(-5, 5, 100)\ny1 = 2*x + 1  # First equation: y = 2x + 1\ny2 = x**2    # Second equation: y = x^2\nplt.plot(x, y1, label='y = 2x + 1')\nplt.plot(x, y2, label='y = x^2')\nplt.grid(True)\nplt.legend()\nplt.xlabel('x')\nplt.ylabel('y')\nplt.show()</CODE>. You should only enclose the code in the code tag, not anywhere else in your response.\n\n"
                "When citing course content, use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags, where x is the lecture number and a, b, c are the slide numbers. "
                "Moreover, if you use the textbook, use <TEXTBOOK x><PAGE a><PAGE b><PAGE c></TEXTBOOK> tags, where x is the textbook number and a, b, c are the page numbers. "
                "Put this at the end of your response. Do not include periods after your citations, add it before the tags.\n\n"
                f"**Student:** {self.current_question}\n"
                "**You (AI):** "
            )

            # save input prompt to .txt file in uploads folder
            with open(os.path.join(MESSAGES_DIR, f"{self.message_id}.txt"), "w") as f:
                f.write("SYSTEM PROMPT: " + system_prompt + "\n\n" + "INPUT PROMPT: " + prompt)

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

        # Convert markdown-style code blocks (both with and without python tag) to CODE tags
        result = re.sub(
            r'```(?:python)?\n(.*?)```',
            lambda m: f'<CODE>{m.group(1).strip()}</CODE>',
            result,
            flags=re.DOTALL
        )

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