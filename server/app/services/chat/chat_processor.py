from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict, AsyncGenerator, Tuple
from app.services.base_processor import BaseProcessor, Message
import re
from datetime import datetime
import os
from app.extensions import MESSAGES_DIR, UPLOAD_FOLDER
from app.extensions import supabase
from app.services.chat.prompts import get_conceptual_prompt, get_homework_student_prompt, get_review_prompt, get_method_prompt, get_homework_teacher_prompt, get_generate_prompt, get_general_student_prompt, get_general_teacher_prompt
from app.services.chat.problems_processor import ProblemsProcessor


class ChatMessage(TypedDict):
    id: str
    question: str
    response: str
    lecture_references: List[str]
    chapter_references: List[str]
    chapter_exercise_references: List[str]
    homework_exercise_references: List[str]
    figures: List[str]


class ChatProcessor(BaseProcessor):
    def __init__(
        self,
        prompt_type: str,
        course_title: str,
        message_id: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
    ):
        super().__init__()
        self.prompt_type = prompt_type
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
    

    def practice_problem_prompt(self) -> str:
        """Get the prompt for the practice problem generation"""
        return (
        "Furthermore, if the student asks for the generation of practice questions, use <QUESTION></QUESTION> tags to specify the format for each of the questions.\n"
        "1. Use <PARTS>x</PARTS> tags to specify the number of parts in the question. For example, if the question has 3 parts, you should write <PARTS>3</PARTS>. In most cases, the number of parts is 1.\n"
        "2. Use <TYPE>y</TYPE> tags to specify the type of question. There are currently only 2 types of questions, 'CONCEPTUAL' and 'COMPUTATIONAL'. You should only use 'CONCEPTUAL' if the student asks for a conceptual question, and you should only use 'COMPUTATIONAL' if the student asks for a computational question.\n"
        "3. Use <FORMAT>z</FORMAT> tags to specify the format of the question. There are currently only 2 formats, 'MCQ' and 'FRQ'. You should only use 'MCQ' if the student asks for a multiple choice question, and you should only use 'FRQ' if the student asks for a free response question.\n"
        "Here is a full example of an example question tag: \n\n"
        "4. Use <INFO>x</INFO> tags to specify any additional information about the nature of the question to be generated. This will be extremely helpful for making a precise and accurate question."
        "Here is an example of a question tag with all the tags filled in: \n\n"
        "<QUESTION><PARTS>1</PARTS><TYPE>CONCEPTUAL</TYPE><FORMAT>MCQ</FORMAT><INFO>A problem highlighting the intricaies of the simplex method and the concept of degeneracy</INFO></QUESTION>.\n\n"
        "Be sure to not include a generated question itself, but only provide the tags to specify the format of the question. You do not need to create the question yourself, just the formatting in tags for another AI to generate the question."
        )
    
    def get_critical_instructions(self, output_rules: str) -> str:
        """Get the rules for the chat processor"""
        return (
            "CRITICAL INSTRUCTIONS:\n\n"
            f"{output_rules}\n\n"
            "FORMATTING:\n\n"
            "Only if you find it useful, or the student asks use <CODE>x</CODE> tags to write code in Python that can display a chart in matplotlib. For example, if you wanted to show the 2D visualization of 2 equations (with x and y axes), you should write the following code: <CODE>import matplotlib.pyplot as plt\nimport numpy as np\nx = np.linspace(-5, 5, 100)\ny1 = 2*x + 1  # First equation: y = 2x + 1\ny2 = x**2    # Second equation: y = x^2\nplt.plot(x, y1, label='y = 2x + 1')\nplt.plot(x, y2, label='y = x^2')\nplt.grid(True)\nplt.legend()\nplt.xlabel('x')\nplt.ylabel('y')\nplt.show()</CODE>. You should only enclose the code in the code tag, not anywhere else in your response.\n\n"
            "When citing course content, use <LECTURE x><SLIDE a><SLIDE b><SLIDE c></LECTURE> tags, where x is the lecture number and a, b, c are the slide numbers. "
            "Moreover, if you use the content from the chapter, use <CHAPTER x><PAGE a><PAGE b><PAGE c></CHAPTER> tags, where x is the chapter number and a, b, c are the page numbers. If you cite any exercises from the chapter, use <CHAPTER x><EXERCISE a><EXERCISE b><EXERCISE c></CHAPTER> tags, where x is the chapter number and a, b, c are the exercise numbers."
            "Lastly, if you use the homework, use <HOMEWORK x><PROBLEM a><PROBLEM b><PROBLEM c></HOMEWORK> tags, where x is the homework number and a, b, c are the problem numbers. "
            "Put this at the end of your response. Do not include periods after your citations, add it before the tags.\n\n"
            "An example of a lecture citation: <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3></LECTURE> This is a citation to the first 3 slides of lecture 1."
            "An example of a chapter citation: <CHAPTER 1><PAGE 1><PAGE 2><PAGE 3></CHAPTER> This is a citation to the first 3 pages of chapter 1."
            "An example of a chapter exercise citation: <CHAPTER 1><EXERCISE 1><EXERCISE 2><EXERCISE 3></CHAPTER> This is a citation to the first 3 exercises of chapter 1."
            "An example of a combined chapter and exercise citation: <CHAPTER 1><PAGE 1><EXERCISE 1><EXERCISE 2></CHAPTER> This is a citation to the first page and the first 2 exercises of chapter 1."
            "An example of a homework citation: <HOMEWORK 1><PROBLEM 1><PROBLEM 2><PROBLEM 3></HOMEWORK> This is a citation to the first 3 problems of homework 1."
        )

    async def process_message(
        self,
        complete_context: str,
        output_rules: str,
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None
    ) -> AsyncGenerator[str, None]:
        """Process a single message with streaming"""
        try:
            conversation_context = self.format_conversation()
            
            system_prompt = ""
            match self.prompt_type:
                case "concept":
                    system_prompt = get_conceptual_prompt()
                case "homework-student":
                    system_prompt = get_homework_student_prompt(solution=False)
                case "review":
                    system_prompt = get_review_prompt()
                case "method":
                    system_prompt = get_method_prompt()
                case "homework-professor":
                    system_prompt = get_homework_teacher_prompt()
                case "generate":
                    system_prompt = get_generate_prompt()
                case 'general-student':
                    system_prompt = get_general_student_prompt()
                case 'general-teacher':
                    system_prompt = get_general_teacher_prompt()

            prompt = (
                "Now, continue the conversation using this style.\n"
                f"{conversation_context}\n\n"
                "Here is the current conversation context:\n\n"
                f"{complete_context}\n\n"
                f"Student: {self.current_question}\n"
                "You (AI): "
            )

            # adding practice problem prompt to end of system prompt
            system_prompt += self.practice_problem_prompt()

            # adding critical instructions to end of system prompt
            system_prompt += self.get_critical_instructions(output_rules)

            # # adding critical instructions to beginning of input prompt
            # prompt = self.get_critical_instructions(output_rules) + "\n\n" + prompt

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
        all_chapters: List[Dict[str, Any]],
        all_homeworks: List[Dict[str, Any]],
        all_lecture_documents: List[Dict[str, Any]],
        all_chapter_documents: List[Dict[str, Any]],
        all_chapter_exercises: List[Dict[str, Any]],
        all_homework_exercises: List[Dict[str, Any]],
    ) -> ChatMessage:
        """Clean chat results and extract document references and code blocks from tags."""
        lecture_document_ids = []
        chapter_document_ids = []
        chapter_exercise_ids = []
        homework_exercise_ids = []
        figure_ids = []
        lecture_ids = []
        chapter_ids = []
        homework_ids = []

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

        # First, normalize incorrect closing tags like </CHAPTER 2> to </CHAPTER>
        result = re.sub(r'</LECTURE\s+\d+>', '</LECTURE>', result)
        result = re.sub(r'</CHAPTER\s+\d+>', '</CHAPTER>', result)
        result = re.sub(r'</HOMEWORK\s+\d+>', '</HOMEWORK>', result)
        
        # Also handle standalone chapter/lecture tags without proper closing
        standalone_tags = re.finditer(r'<(CHAPTER|LECTURE|HOMEWORK)\s+(\d+)>(?!\s*<(?:SLIDE|PAGE|EXERCISE|PROBLEM))', result)
        for tag in reversed(list(standalone_tags)):
            tag_type, number = tag.groups()
            # Replace with proper opening and closing tags
            start, end = tag.span()
            result = result[:start] + f'<{tag_type} {number}></{tag_type}>' + result[end:]

        # Process lectures and insert document tags
        lecture_matches = list(re.finditer(r'<LECTURE ([^>]+)>((?:<SLIDE \d+>)+)</LECTURE>', result))
        for lecture_match in reversed(lecture_matches):
            lecture_number = lecture_match.group(1)
            slide_nums = [int(num) for num in re.findall(r'<SLIDE (\d+)>', lecture_match.group(2))]
            lecture_id = next((lecture['id'] for lecture in all_lectures if lecture['note_number'] == int(lecture_number)), None)
            
            if lecture_id:
                lecture_ids.append(lecture_id)
                
                # Find matching documents
                matching_docs = [
                    doc['id'] for doc in all_lecture_documents
                    if doc.get('page') in slide_nums 
                    and doc.get('lecture') == lecture_id
                ]
                lecture_document_ids.extend(matching_docs)
                
                # Replace the lecture tag with document tags
                document_tags = ''.join([f'<DOCUMENT_LECTURE>{doc_id}</DOCUMENT_LECTURE>' for doc_id in matching_docs])
                
                # Replace only this specific match using string slicing
                start, end = lecture_match.span()
                result = result[:start] + document_tags + result[end:]

        # Process chapters and insert document tags
        chapter_matches = list(re.finditer(r'<CHAPTER ([^>]+)>((?:<PAGE \d+>|<EXERCISE \d+>)+)</CHAPTER>', result))
        for chapter_match in reversed(chapter_matches):
            chapter_number = chapter_match.group(1)
            page_nums = [int(num) for num in re.findall(r'<PAGE (\d+)>', chapter_match.group(2))]
            exercise_nums = [int(num) for num in re.findall(r'<EXERCISE (\d+)>', chapter_match.group(2))]
            chapter_id = next((chapter['id'] for chapter in all_chapters if chapter['chapter_number'] == int(chapter_number)), None)
            
            if chapter_id:
                chapter_ids.append(chapter_id)
                
                # Find matching documents for pages
                matching_docs = [
                    doc['id'] for doc in all_chapter_documents
                    if doc.get('page') in page_nums 
                    and doc.get('chapter') == chapter_id
                ]
                chapter_document_ids.extend(matching_docs)
                
                # Find matching exercises
                matching_exercises = [
                    exercise['id'] for exercise in all_chapter_exercises
                    if exercise.get('exercise_number') in exercise_nums
                    and exercise.get('chapter') == chapter_id
                ]
                chapter_exercise_ids.extend(matching_exercises)
                
                # Replace the chapter tag with document and exercise tags
                document_tags = ''.join([f'<DOCUMENT_CHAPTER>{doc_id}</DOCUMENT_CHAPTER>' for doc_id in matching_docs])
                exercise_tags = ''.join([f'<EXERCISE_CHAPTER>{exercise_id}</EXERCISE_CHAPTER>' for exercise_id in matching_exercises])
                
                # Replace only this specific match using string slicing
                start, end = chapter_match.span()
                result = result[:start] + document_tags + exercise_tags + result[end:]
        
        # Process homework and insert document tags
        homework_matches = list(re.finditer(r'<HOMEWORK ([^>]+)>((?:<PROBLEM \d+>)+)</HOMEWORK>', result))
        for i, homework_match in enumerate(reversed(homework_matches)):
            homework_number = homework_match.group(1)
            problem_nums = [int(num) for num in re.findall(r'<PROBLEM (\d+)>', homework_match.group(2))]
            homework_id = next((homework['id'] for homework in all_homeworks if homework['homework_number'] == int(homework_number)), None)
            
            if homework_id:
                homework_ids.append(homework_id)
                
                # Find matching documents
                matching_exercises = [
                    doc['id'] for doc in all_homework_exercises
                    if doc.get('problem_number') in problem_nums 
                    and doc.get('homework') == homework_id
                ]
                homework_exercise_ids.extend(matching_exercises)
                
                # Replace the specific homework tag with exercise tags
                exercise_tags = ''.join([f'<PROBLEM_HOMEWORK>{exercise_id}</PROBLEM_HOMEWORK>' for exercise_id in matching_exercises])
                
                # Replace only this specific match using string slicing
                start, end = homework_match.span()
                result = result[:start] + exercise_tags + result[end:]
        
        # Remove any remaining tags
        cleaned_result = re.sub(r'<(LECTURE|CHAPTER|HOMEWORK|SLIDE|PAGE|PROBLEM|EXERCISE)(\s[^>]*)?>', '', result)
        cleaned_result = re.sub(r'</(LECTURE|CHAPTER|HOMEWORK)(\s[^>]*)?>', '', cleaned_result)
        
        return ChatMessage(
            id=self.message_id,
            question=self.current_question,
            response=cleaned_result.strip(),
            lecture_references=list(set(lecture_ids)),
            chapter_references=list(set(chapter_ids)),
            chapter_exercise_references=list(set(chapter_exercise_ids)),
            homework_exercise_references=list(set(homework_exercise_ids)),
            figures=figure_ids
        )

    def _execute_and_save_plot_sync(self, code_block: str) -> Optional[str]:
        """Synchronous version of plot generation and saving."""
        import io
        import os
        import matplotlib.pyplot as plt
        import scipy
        import networkx as nx
        import numpy as np
        
        try:
            # Clear any existing plots
            plt.close('all')
            
            # Create namespace with pre-imported modules and ensure plt.figure is called
            namespace = {
                'plt': plt,
                'np': np,
                'scipy': scipy,
                'nx': nx,  # Add networkx to the namespace
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

    def extract_practice_problem_prompts(self, result: str) -> Tuple[List[Dict[str, Any]], str]:
        """Parse problem tags from the response and convert them to problem prompts.
        
        Args:
            result: The response string containing problem tags
            
        Returns:
            List of problem prompt dictionaries ready for the ProblemsProcessor
            The reference response with the practice problem prompts removed
        """
        problem_prompts = []
        
        # Find all problem tag blocks
        problem_matches = re.finditer(
            r'<QUESTION>'
            r'(?:<PARTS>(\d+)</PARTS>)?'
            r'(?:<TYPE>(CONCEPTUAL|COMPUTATIONAL)</TYPE>)?'
            r'(?:<FORMAT>(MCQ|FRQ)</FORMAT>)?'
            r'(?:<INFO>(.*?)</INFO>)?'
            r'</QUESTION>',
            result,
            re.DOTALL
        )
        
        for i, match in enumerate(problem_matches):
            parts = int(match.group(1)) if match.group(1) else 1
            problem_type = match.group(2) if match.group(2) else "CONCEPTUAL"
            format_type = match.group(3) if match.group(3) else "FRQ"
            info = match.group(4) if match.group(4) else ""
            
            problem_prompt = {
                "id": f"generated_{i}",
                "mcq": format_type == "MCQ",
                "multi_part": parts > 1,
                "computational": problem_type == "COMPUTATIONAL",
                "additional_info": info.strip()
            }
            
            problem_prompts.append(problem_prompt)

        reference_response = re.sub(r'<QUESTION>.*?</QUESTION>', '', result, flags=re.DOTALL)

        return problem_prompts, reference_response

    async def generate_practice_problems(
        self,
        problem_prompts: List[Dict[str, Any]],
        output_rules: str,
        all_content: List[Any], # all of the content merged together
        lectures: List[Dict[str, Any]],
        chapters: List[Dict[str, Any]],
        homeworks: List[Dict[str, Any]],
        lecture_documents: List[Dict[str, Any]],
        chapter_documents: List[Dict[str, Any]],
        chapter_exercises: List[Dict[str, Any]],
        homework_exercises: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Generate practice problems based on parsed tags.
        
        Args:
            problem_prompts: List of problem prompts
            lectures: List of lecture metadata
            chapters: List of chapter metadata
            homeworks: List of homework metadata
            lecture_documents: List of lecture documents
            chapter_documents: List of chapter documents
            chapter_exercises: List of chapter exercises
            homework_exercises: List of homework exercises
            
        Returns:
            List of generated problems
        """
        if not problem_prompts:
            return []
        
        # initialize the critical instructions
        critical_instructions = self.get_critical_instructions(output_rules)
            
        # Initialize the problems processor
        processor = ProblemsProcessor(self.course_title, critical_instructions, all_content, lectures, chapters, homeworks, lecture_documents, chapter_documents, chapter_exercises, homework_exercises)
        
        # Process the problems
        try:
            questions = await processor.process_problems(problem_prompts, self.clean_result)
            # Flatten the questions dictionary into a list of all generated problems
            all_problems = []
            for question_groups in questions.values():
                for group in question_groups:
                    all_problems.extend(group)
            return all_problems
            
        except Exception as e:
            print(f"Error generating practice problems: {str(e)}")
            return []