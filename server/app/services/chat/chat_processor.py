from typing import Dict, List, Any, Optional, Callable, Awaitable, TypedDict, AsyncGenerator, Tuple
import uuid
from app.services.base_processor import BaseProcessor, Message
import re
from datetime import datetime
import os
from app.extensions import MESSAGES_DIR, UPLOAD_FOLDER
from app.extensions import supabase
from app.services.chat.prompts import get_conceptual_prompt, get_homework_student_prompt, get_review_prompt, get_method_prompt, get_homework_teacher_prompt, get_generate_prompt, get_general_student_prompt, get_general_teacher_prompt, get_present_mode
from app.utils.chat import get_critical_instructions
from app.utils.get_content import process_special_tags
import google.generativeai as genai
from google.generativeai.types import File

class ChatProcessor(BaseProcessor):
    def __init__(
        self,
        prompt_type: str,
        course_title: str,
        message_id: str,
        question: str,
        past_messages: List[Tuple[str, str, str]],  # List of (id, question, response)
        google_file_ids: List[str] = []
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


        # get the files from gemini api
        self.additional_files = []
        print(f"Google file ids: {google_file_ids}")
        for file_id in google_file_ids:
            retrived_file = self.get_file_from_gemini(file_id)
            if retrived_file:
                self.additional_files.append(retrived_file)

    def get_file_from_gemini(self, file_name: str) -> File | None:
        # Get the file from Gemini
        try:
            response = genai.get_file(file_name)
            if response.state.name == "ACTIVE":
                return response
            else:
                error_info = ""
                if hasattr(response, "error") and response.error:
                    error_code = getattr(response.error, "code", "Unknown")
                    error_message = getattr(response.error, "message", "No details available")
                    
                    # Try to extract detailed error information
                    error_details = []
                    if hasattr(response.error, "details") and response.error.details:
                        for detail in response.error.details:
                            if hasattr(detail, "@type"):
                                error_details.append(f"Type: {detail['@type']}")
                            # Add any other relevant fields from the detail object
                            error_details_str = ", ".join(error_details) if error_details else "No details"
                            error_info = f" (Code: {error_code}, Message: {error_message}, Details: {error_details_str})"
                    else:
                        error_info = f" (Code: {error_code}, Message: {error_message})"
                
                # Get additional metadata if available
                metadata_info = ""
                if hasattr(response, "updateTime"):
                    metadata_info += f", Last updated: {response.updateTime}"
                if hasattr(response, "sizeBytes"):
                    metadata_info += f", Size: {response.sizeBytes} bytes"
                
                print(f"File {file_name} is not active. Status: {response.state.name}{error_info}{metadata_info}")
                
                # For error code 3 (INVALID_ARGUMENT), provide more specific guidance
                if error_code == 3:
                    print(f"This may indicate an issue with the file format or content. Please verify the file is valid and in a supported format.")
                
                return None
        except Exception as e:
            print(f"Error retrieving file {file_name}: {str(e)}")
            return None

    async def format_conversation(self) -> str:
        """Format the conversation history into context"""
        if not self.chat_history:
            return ""
            
        context_summary = ""
        for i in range(0, len(self.chat_history)-1, 2):
            user_msg = self.chat_history[i]
            assistant_msg = await process_special_tags(self.chat_history[i+1], supabase)
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
    
    def figure_prompt(self) -> str:
        """Get the prompt for the figure generation"""
        return (
             "Moreover, if the student asks for a generation of a figure or graph from content, either from lectures, chapters, homeworks, or the class as a whole, use <FIGURE></FIGURE> tags to for each of figures you would like to generate.\n"
            "1. Use <FIGURE>x</FIGURE> tags to specify the format for the figure, where x are the instructions for generating the figure. These instructions will be used (not by you) to create Python code that can display a chart with tools like matplotlib. Use this information to guide your prompt for the figure generation. For example, a figure could look like this: <FIGURE>Generate a figure of the following equations: y = 2x + 1 and y = x^2, with x and y axes.</FIGURE>.\n"
            "Be sure to not include a generated figure itself, but only provide the tags to specify the format of the figure. You do not need to create the figure yourself, just the formatting in tags for another AI to generate the figure."
            
        )
    
    def summary_prompt(self) -> str:
        """Get the prompt for the summary generation"""
        return (
            "Additionally, if the student asks for a summary of content, either from lectures, chapters, homeworks, or the class as a whole, use <SUMMARY></SUMMARY> tags to for each of summaries you would like to generate.\n"
            "1. Use <SUMMARY>x</SUMMARY> tags to specify the format for the summary, where x are the instructions for generating the summary. For example, a summary could look like this: <SUMMARY>Generate a summary of the lecture on the simplex method. Make sure to include all the details of the simplex method, including the initial tableau, the pivot operations, and the final solution.</SUMMARY>.\n"
            "Be sure to not include a generated summary itself, but only provide the tags to specify the format of the summary. You do not need to create the summary yourself, just the formatting in tags for another AI to generate the summary."
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

    async def process_message(
        self,
        complete_context: str,
        output_rules: str,
        stream_callback: Optional[Callable[[str], Awaitable[None]]] = None
    ) -> AsyncGenerator[str, None]:
        """Process a single message with streaming"""
        try:
            conversation_context = await self.format_conversation()
            
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
                case 'present':
                    system_prompt = get_present_mode()

            prompt = (
                "Now, continue the conversation using this style.\n"
                f"{conversation_context}\n\n"
                "Here is the current conversation context:\n\n"
                f"{complete_context}\n\n"
                "IMPORTANT: Make sure to respond only to the student's latest message, not the conversation history. Do not repeat yourself or answer your own messages. Only respond to the student's latest message."
                f"Student: {self.current_question}\n"
                "You (AI): "
            )

            # adding figure prompt to end of system prompt
            system_prompt += self.figure_prompt()

            # adding summary prompt to end of system prompt
            system_prompt += self.summary_prompt()

            # adding practice problem prompt to end of system prompt
            system_prompt += self.practice_problem_prompt()

            # adding critical instructions to end of system prompt
            system_prompt += get_critical_instructions(output_rules)

            # # adding critical instructions to beginning of input prompt
            # prompt = self.get_critical_instructions(output_rules) + "\n\n" + prompt

            # save input prompt to .txt file in uploads folder
            with open(os.path.join(MESSAGES_DIR, f"{self.message_id}.txt"), "w") as f:
                f.write("SYSTEM PROMPT: " + system_prompt + "\n\n" + "INPUT PROMPT: " + prompt)

            # add additional files to the message content
            message_content = []
            additional_files = []
            if self.additional_files:
                additional_files.extend(self.additional_files)
            message_content.append({"type": "text", "text": prompt})

            message = Message(content=message_content)

            response_text = ""
            async for chunk in self.robust_generate_stream(system_prompt, message, "gemini-2.0-flash", additional_files=additional_files):
                response_text += chunk
                if stream_callback:
                    yield await stream_callback(chunk)

            # Add response to chat history
            self.chat_history.extend([self.current_question, response_text])

            yield response_text
            
        except Exception as e:
            print(f"Error in process_message: {str(e)}")
            raise


    def clear_chat_history(self, message_id: str) -> None:
        """Clear the chat history for a specific message ID"""
        if message_id in self.chat_histories:
            del self.chat_histories[message_id]

    def extract_figure_prompts(self, result: str, response_url: str) -> Tuple[List[Dict[str, Any]], str]:
        """Parse figure tags from the response and convert them to figure prompts.
        
        Args:
            result: The response string containing figure tags
            response_url: The URL of the response to the message

        Returns:
            List of figure prompt dictionaries ready for the FigureProcessor
            String of the response with the figure prompts replaced with <FIGURE_GENERATION>x</FIGURE_GENERATION> tags, where x is the id of the created figure
        """
        figure_prompts = []

        # Find all figure tag blocks
        figure_matches = re.finditer(
            r'<FIGURE>(.*?)</FIGURE>',
            result,
            re.DOTALL
        )
        
        # Store matches and their spans for later replacement
        matches_data = []
        for match in figure_matches:
            figure_prompt = {
                "additional_info": match.group(1).strip()
            }
            figure_prompts.append(figure_prompt)

            # insert figure into supabase and get the id
            figure_response = supabase.table("figures").insert({
                "message": self.message_id,
                "prompt": figure_prompt["additional_info"],
                "response_url": response_url
            }).execute()
            figure_id = figure_response.data[0]["id"]

            # update the figure prompt with the id
            figure_prompt["id"] = figure_id
            
            # Store the full match and its position for replacement
            matches_data.append((match.group(0), match.span(), figure_id))
        
        # Replace matches from end to beginning to avoid position shifts
        matches_data.sort(key=lambda x: x[1][0], reverse=True)
        for full_match, (start, end), figure_id in matches_data:
            replacement = f"<FIGURE_GENERATION>{figure_id}</FIGURE_GENERATION>"
            result = result[:start] + replacement + result[end:]

        return figure_prompts, result

    def extract_summary_prompts(self, result: str, response_url: str) -> Tuple[List[Dict[str, Any]], str]:
        """Parse summary tags from the response and convert them to summary prompts.
        
        Args:
            result: The response string containing summary tags
            response_url: The URL of the response to the message

        Returns:
            List of summary prompt dictionaries ready for the SummaryProcessor
            String of the response with the summary prompts replaced with <SUMMARY_GENERATION>x</SUMMARY_GENERATION> tags, where x is the id of the created summary
        """
        summary_prompts = []

        # Find all summary tag blocks
        summary_matches = re.finditer(
            r'<SUMMARY>(.*?)</SUMMARY>',
            result,
            re.DOTALL
        )
        
        # Store matches and their spans for later replacement
        matches_data = []
        for match in summary_matches:
            summary_prompt = {
                "additional_info": match.group(1).strip()
            }
            summary_prompts.append(summary_prompt)

            # insert summary into supabase and get the id
            summary_response = supabase.table("summaries").insert({
                "message": self.message_id,
                "prompt": summary_prompt["additional_info"],
                "response_url": response_url
            }).execute()
            summary_id = summary_response.data[0]["id"]

            # update the summary prompt with the id
            summary_prompt["id"] = summary_id
            
            # Store the full match and its position for replacement
            matches_data.append((match.group(0), match.span(), summary_id))
        
        # Replace matches from end to beginning to avoid position shifts
        matches_data.sort(key=lambda x: x[1][0], reverse=True)
        for full_match, (start, end), summary_id in matches_data:
            replacement = f"<SUMMARY_GENERATION>{summary_id}</SUMMARY_GENERATION>"
            result = result[:start] + replacement + result[end:]

        return summary_prompts, result

    def extract_practice_problem_prompts(self, result: str, response_url: str) -> Tuple[List[Dict[str, Any]], str]:
        """Parse problem tags from the response and convert them to problem prompts.
        
        Args:
            result: The response string containing problem tags
            response_url: The URL of the response to the message
            
        Returns:
            List of problem prompt dictionaries ready for the ProblemsProcessor
            String of the response with the problem prompts replaced with <QUESTION_GENERATION>x</QUESTION_GENERATION> tags
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
        
        # Store matches and their spans for later replacement
        matches_data = []
        for match in problem_matches:
            parts = int(match.group(1)) if match.group(1) else 1
            problem_type = match.group(2) if match.group(2) else "CONCEPTUAL"
            format_type = match.group(3) if match.group(3) else "FRQ"
            info = match.group(4) if match.group(4) else ""
            
            problem_prompt = {
                "mcq": format_type == "MCQ",
                "multi_part": parts > 1,
                "computational": problem_type == "COMPUTATIONAL",
                "additional_info": info.strip()
            }
            # insert problem into supabase and get the id
            problem_response = supabase.table("questions").insert({
                "message": self.message_id,
                "frq": not problem_prompt["mcq"],
                "multi": uuid.uuid4() if problem_prompt["multi_part"] else None, # will need to use later to make multiple parts
                "computational": problem_prompt["computational"],
                "prompt": problem_prompt["additional_info"],
                "response_url": response_url
            }).execute()
            problem_id = problem_response.data[0]["id"]

            # update the problem prompt with the id
            problem_prompt["id"] = problem_id
            problem_prompts.append(problem_prompt)
            
            # Store the full match and its position for replacement
            matches_data.append((match.group(0), match.span(), problem_id))
        
        # Replace matches from end to beginning to avoid position shifts
        matches_data.sort(key=lambda x: x[1][0], reverse=True)
        for full_match, (start, end), problem_id in matches_data:
            replacement = f"<QUESTION_GENERATION>{problem_id}</QUESTION_GENERATION>"
            result = result[:start] + replacement + result[end:]

        return problem_prompts, result