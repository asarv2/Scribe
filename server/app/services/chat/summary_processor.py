import os
import re
from typing import Dict, List, TypedDict, Any, Callable, Awaitable
from app.extensions import SUMMARIES_DIR
from app.services.base_processor import BaseProcessor, Message, Summary

class SummaryPrompt(TypedDict):
    id: str
    additional_info: str

class SummaryProcessor(BaseProcessor):
    def __init__(
        self,
        course_title: str,
        critical_instructions: str,
        all_content: List[Any],
        lectures: List[Dict[str, Any]],
        chapters: List[Dict[str, Any]],
        homeworks: List[Dict[str, Any]],
        files: List[Dict[str, Any]],
        lecture_documents: List[Dict[str, Any]],
        chapter_documents: List[Dict[str, Any]],
        chapter_exercises: List[Dict[str, Any]],
        homework_exercises: List[Dict[str, Any]],
        file_documents: List[Dict[str, Any]],
    ):
        super().__init__()
        self.course_title = course_title
        self.critical_instructions = critical_instructions
        self.summaries: Dict[str, Summary] = {}
        self.lectures = lectures
        self.chapters = chapters
        self.homeworks = homeworks
        self.lecture_documents = lecture_documents
        self.chapter_documents = chapter_documents
        self.chapter_exercises = chapter_exercises
        self.homework_exercises = homework_exercises
        self.all_content = all_content
        self.files = files
        self.file_documents = file_documents

        # Base prompts
        base_question_prompt = (
            f"You are an expert summarization assistant tasked with creating a comprehensive and cohesive summary, "
            f"in the context of the class {self.course_title}. You will be given documents from lectures and be asked "
            f"to generate a complete summary. If your response contains math symbols, be sure to use LaTeX formatting."
        )

        quality_prompt = (
            f"To generate summaries of the highest quality, here are some guidelines you should follow.\n\n"
            f"CRITICAL REQUIREMENTS:\n"
            f"1. This course is a graduate level class, so you will need to generate complex, multi-step summaries.\n"
            f"2. Summaries should directly relate to the core content of the class.\n"
            f"3. Make each summary complete and self-contained.\n"
            f"4. Make sure the summaries cover a diverse set of concepts from the class.\n"
        )

        summary_requirements_prompt = (
            f"TASK: Generate a summary for the given class.\n\n"
            f"WHAT TO DO:\n"
            f"1. Use <PREAMBLE> and </PREAMBLE> tags to encapsulate the preamble.\n"
            f"2. Use <SUMMARY> and </SUMMARY> tags to encapsulate the summary.\n"
            f"3. Use <CONCLUSION> and </CONCLUSION> tags to encapsulate the conclusion.\n"
        )

        summary_formatting_prompt = (
            f"IMPORTANT: Follow these precise guidelines:\n\n"
            f"1. Synthesize Information:\n"
            f"- Generate a summary that captures the OVERALL essence of the lecture\n"
            f"- Exclude details specific to individual slides or instances\n"
            f"- Focus on broad, generalizable concepts and key insights\n\n"
            f"2. Formatting Requirements:\n"
            f"- Combine term and definition into a SINGLE, concise bullet point\n"
            f"- Ensure each bullet point is a complete, informative sentence\n"
            f"- Avoid breaking definitions across multiple bullet points\n"
            f"- Maintain a clear, flowing narrative that connects key points logically\n\n"
            f"3. Content Criteria:\n"
            f"- Prioritize the most significant and impactful information\n"
            f"- Eliminate redundant or overly specific details\n"
            f"- Present information in a way that provides a holistic understanding\n"
            f"- Use precise, academic language that conveys depth and nuance\n\n"
            f"4. Structure:\n"
            f"- Begin with a brief introductory statement defining the core concept in <PREAMBLE> and </PREAMBLE> tags.\n"
            f"- Organize bullet points to create a logical progression of ideas in <SUMMARY> and </SUMMARY> tags.\n"
            f"- Ensure each point adds unique value to the overall summary\n\n"
            f"5. Final Review:\n"
            f"- Check that the summary reads as a cohesive, integrated overview and add a <CONCLUSION> and </CONCLUSION> tag.\n"
            f"- Verify that no point feels isolated or disconnected from the whole\n"
            f"- Confirm that the summary provides a comprehensive yet concise understanding\n\n"
            f"Generate the summary strictly adhering to these guidelines."
        )

        example = (
            f"Here is a complete example of a summary for the content of the class.\n\n"
            f"<PREAMBLE>\n"
            f"This explores the simplex method and its variants for solving linear programming problems. The simplex method iteratively moves from one vertex of the feasible region to another, improving the objective function value at each step until the optimal solution is found.\n"
            f"</PREAMBLE>\n"
            f"<SUMMARY>\n"
            f"- **Basic Variables/Basic Feasible Solution**: Basic variables are those that define a vertex of the feasible region; setting non-basic variables to zero yields a basic feasible solution.\n"
            f"- **Non-Basic Variables**: Non-basic variables are set to zero in a basic feasible solution.\n"
            f"- **Entering/Leaving Arc**: In each iteration, a non-basic variable (entering variable) is selected to enter the basis, and a basic variable (leaving variable) is selected to leave the basis. The selection criteria can vary (e.g., largest-coefficient rule, largest-increase rule).\n"
            f"- **Variables and Coefficients**: $x_j$ represents a variable in the linear program, and $a_{{ij}}$ represents the coefficient of variable $x_j$ in the $i$-th constraint.\n"
            f"- **Slack Variable**: Slack variables are added to convert inequality constraints into equality constraints.\n"
            f"- **Feasible Region**: The feasible region is the set of all points satisfying all constraints of the linear program.\n"
            f"- **Optimal Dictionary**: The optimal dictionary represents the optimal solution of the linear program, expressing basic variables in terms of non-basic variables and providing the optimal objective function value.\n"
            f"- **Reduced Costs**: Reduced costs (Reduced Cost $z_{{ij}}$) represent the change in the objective function value per unit increase in a non-basic variable. Non-negativity of reduced costs is a necessary and sufficient condition for optimality.\n"
            f"- **Largest-Coefficient Rule/Largest-Increase Rule**: These are rules for selecting the entering variable in the simplex method. The largest-coefficient rule selects the variable with the largest coefficient in the objective function, while the largest-increase rule selects the variable that yields the largest increase in the objective function value.\n"
            f"- **Klee-Minty Cube**: This is a worst-case example demonstrating that the simplex method can take an exponential number of iterations under certain pivot rules.\n"
            f"- **Simplex Method in Matrix Form**: This is a compact matrix representation of the simplex method, facilitating efficient computation, especially for large problems.\n"
            f"- **Revised Simplex Method**: A variant of the simplex method that uses matrix operations to update the solution efficiently.\n"
            f"- **Parametric Analysis/Sensitivity Analysis**: These techniques analyze how changes in the objective function coefficients or the right-hand side values of the constraints affect the optimal solution.\n"
            f"- **Auxiliary Problem**: An auxiliary problem is introduced to find an initial feasible solution when the origin is not feasible in the original problem. This is often used in the two-phase simplex method.\n"
            f"- **Dictionary of Variables**: A representation of the linear program at a given iteration, expressing basic variables in terms of non-basic variables.\n"
            f"</SUMMARY>\n"
            f"<CONCLUSION>\n"
            f"This also covers the network simplex method (both primal and dual), which leverages the network structure of certain linear programs for efficient solution. The algorithm iteratively improves the solution by modifying the spanning tree and updating primal and dual flows. Different variants of the network simplex method are discussed, including two-phased approaches that combine primal and dual methods to handle infeasible starting points.\n"
            f"</CONCLUSION>\n"
            f"<LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>\n"
        )

        self.summary_prompt = (
            f"{base_question_prompt}\n"
            f"{quality_prompt}\n"
            f"{summary_requirements_prompt}\n"
            f"{summary_formatting_prompt}\n"
            f"{self.critical_instructions}\n"
            f"{example}\n"
        )

    
    async def process_batch(
        self,
        summary_id: str,
        content: str,
        prompt: str,
        additional_info: str
    ) -> str:
        """Process a batch of questions"""
        try:
            flat_summaries = []
            for summaries in self.summaries.values():
                # Check if summaries is a dictionary with the expected structure
                if isinstance(summaries, dict) and "content" in summaries:
                    flat_summaries.append(summaries["content"])
                # If it's a list (as in the original code)
                elif isinstance(summaries, list):
                    for group in summaries:
                        if isinstance(group, dict) and "summary" in group:
                            flat_summaries.append(group["summary"])
            
            flat_summaries_str = "\n".join(flat_summaries)

            # add additional instructions to the prompt
            additional_instructions_prompt = (
                f"VERY IMPORTANT: Follow these additonal instructions in the generation of the summary: {additional_info}"
            )
            system_message = prompt + "\n\n" + additional_instructions_prompt

            message = Message(content=[
                {
                    "type": "text",
                    "text": "The following summaries have already been generated. Do not repeat them: " + flat_summaries_str
                },
                {
                    "type": "text", 
                    "text": f"You should generate 1 new summary. INPUT: {content}\n\nYOUR OUTPUT: "
                }
            ])

            # save input prompt to .txt file in questions folder
            with open(os.path.join(SUMMARIES_DIR, f"{summary_id}.txt"), "w") as f:
                f.write("SYSTEM PROMPT: " + system_message + "\n\n" + "INPUT PROMPT: " + prompt)
            
            # Use a faster model with higher RPM
            response = await self.robust_generate(system_message, message, model="gemini-2.0-flash-lite")
            print(f"Successfully generated response for {summary_id}")
            return response
            
        except Exception as e:
            print(f"Error in process_batch: {str(e)}")
            raise
    
    def clean_result(
        self,
        summary_id: str,
        result: str,
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],
        file_references: List[str],
        figures: List[str]
    ) -> None:
        """Clean and process the generated summary result."""
        try:
            # Clean XML code blocks
            result = result.replace("```xml", "").replace("```", "")

            # Extract preamble, summary, and conclusion
            preamble_match = re.search(r"<PREAMBLE>(.*?)</PREAMBLE>", result, re.DOTALL)
            summary_match = re.search(r"<SUMMARY>(.*?)</SUMMARY>", result, re.DOTALL)
            conclusion_match = re.search(r"<CONCLUSION>(.*?)</CONCLUSION>", result, re.DOTALL)

            if not summary_match:
                raise ValueError("No summary content found")

            # Update or create summary entry
            if summary_id not in self.summaries:
                self.summaries[summary_id] = {
                    "id": summary_id,
                    "preamble": preamble_match.group(1).strip() if preamble_match else "",
                    "content": summary_match.group(1).strip(),
                    "conclusion": conclusion_match.group(1).strip() if conclusion_match else "",
                    "lecture_references": lecture_references,
                    "chapter_references": chapter_references,
                    "chapter_exercise_references": chapter_exercise_references,
                    "homework_exercise_references": homework_exercise_references,
                    "figures": figures,
                    "file_references": file_references
                }
            else:
                if preamble_match:
                    self.summaries[summary_id]["preamble"] = preamble_match.group(1).strip()
                self.summaries[summary_id]["content"] += "\n\n" + summary_match.group(1).strip()
                if conclusion_match:
                    self.summaries[summary_id]["conclusion"] = conclusion_match.group(1).strip()
                self.summaries[summary_id]["lecture_references"] = list(set(self.summaries[summary_id]["lecture_references"] + lecture_references))
                self.summaries[summary_id]["chapter_references"] = list(set(self.summaries[summary_id]["chapter_references"] + chapter_references))
                self.summaries[summary_id]["chapter_exercise_references"] = list(set(self.summaries[summary_id]["chapter_exercise_references"] + chapter_exercise_references))
                self.summaries[summary_id]["homework_exercise_references"] = list(set(self.summaries[summary_id]["homework_exercise_references"] + homework_exercise_references))
                self.summaries[summary_id]["figures"] = list(set(self.summaries[summary_id]["figures"] + figures))
                self.summaries[summary_id]["file_references"] = list(set(self.summaries[summary_id]["file_references"] + file_references))
        except Exception as e:
            print(f"Error processing summary block: {str(e)}")

    async def process_summaries(
        self,
        summary_prompts: List[SummaryPrompt],
        question: str,
        message_id: str,
        clean_figures_and_references: Callable[[Any], Any] = None,
        on_batch_complete: Callable[[Summary], Awaitable[None]] = None
    ) -> Dict[str, Summary]:
        """Process summaries for lectures"""
        
        print(f"Generating {len(summary_prompts)} summaries")

        for summary_prompt in summary_prompts:
            summary_id = summary_prompt.get('id')

            additional_info = summary_prompt.get('additional_info')

            result = await self.process_batch(
                    summary_id,
                    "\n".join(self.all_content),
                    self.summary_prompt,
                    additional_info
                )
            
            # clean the result, get the figures and references, of type ChatMessage
            figures_and_references = clean_figures_and_references(question, message_id, result, self.lectures, self.chapters, self.homeworks, self.files, self.lecture_documents, self.chapter_documents, self.chapter_exercises, self.homework_exercises, self.file_documents)

            print(f"Figures and references: {figures_and_references}")

            self.clean_result(
                summary_id, 
                figures_and_references['response'], 
                figures_and_references['lecture_references'], 
                figures_and_references['chapter_references'], 
                figures_and_references['chapter_exercise_references'], 
                figures_and_references['homework_exercise_references'], 
                figures_and_references['figures'],
                figures_and_references['file_references']
            )

            if on_batch_complete:
                await on_batch_complete(self.summaries[summary_id])

        return self.summaries  # Return all summaries, not just the last one
    


            
