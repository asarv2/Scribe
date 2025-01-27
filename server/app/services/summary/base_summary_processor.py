import re
from typing import Dict, List, TypedDict

from app.services.base_processor import BaseProcessor, ContentType
from langchain_core.messages import HumanMessage


class Figure(TypedDict):
    bbox: List[int]
    description: str

class SummaryContent(TypedDict):
    figures: Dict[int, List[Figure]]
    content: str

class Summary(TypedDict):
    preamble: str
    content: str
    conclusion: str
    slides: Dict[str, List[int]]

class BaseSummaryProcessor(BaseProcessor):
    def __init__(self, course_title: str, content_type: ContentType):
        super().__init__()
        self.course_title = course_title
        self.content_type = content_type
        self.summary: Dict[str, Summary] = {}
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
            f"2. Summaries should directly relate to the core content of the {self.content_type.value}.\n"
            f"3. Make each summary complete and self-contained.\n"
            f"4. Make sure the summaries cover a diverse set of concepts from the {self.content_type.value}."
        )

        summary_requirements_prompt = (
            f"TASK: Generate a summary for the given {self.content_type.value}(s).\n\n"
            f"WHAT TO DO:\n"
            f"1. Use <PREAMBLE> and </PREAMBLE> tags to encapsulate the preamble.\n"
            f"2. Use <SUMMARY> and </SUMMARY> tags to encapsulate the summary.\n"
            f"3. Use <CONCLUSION> and </CONCLUSION> tags to encapsulate the conclusion.\n"
            f"4. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the "
            f"<SLIDE x> tags at the end of each question. You should encapsulate all of the slide tags for a given lecture "
            f"in <LECTURE y> and </LECTURE> tags, where y is the lecture number.\n"
            f"5. Use <OUTPUT> and </OUTPUT> tags to encapsulate the summary."
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
            f"Here is a complete example of a summary for the "
            f"{'lecture 2024-08-27-ExSimplex' if self.content_type == ContentType.LECTURE else 'topic Simplex Method'}.\n\n"
            f"<OUTPUT>\n"
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
            f"</OUTPUT>"
        )

        self.summary_prompt = (
            f"{base_question_prompt}\n"
            f"{quality_prompt}\n"
            f"{summary_requirements_prompt}\n"
            f"{summary_formatting_prompt}\n"
            f"{example}"
        )

    async def process_batch(self, name: str, content: str) -> str:
        """Process a batch of content and return the generated summary."""
        existing_summaries = "\n".join(summary.get('content', '') for summary in self.summary.values())
        
        message = HumanMessage(content=[
            {"type": "text", "text": self.summary_prompt},
            {
                "type": "text",
                "text": "The following summaries have already been generated. Modify the preamble and conclusion "
                        "accordingly to encompass the new information. Do not repeat the summaries: " + existing_summaries
            },
            {
                "type": "text",
                "text": f"You should generate a summary for: {name}. INPUT: {content}\n\nYOUR OUTPUT: "
            }
        ])

        trimmed_messages = await self.prepare_conversation_history([message])
        return await self.robust_generate(trimmed_messages[0])

    def clean_result(self, result: str, name: str, lectures: List[Dict[str, str]]) -> None:
        """Clean and process the generated summary result."""
        try:
            # Clean XML code blocks
            result = result.replace("```xml", "").replace("```", "")

            # Extract content between <OUTPUT> tags
            output_match = re.search(r"<OUTPUT>(.*?)</OUTPUT>", result, re.DOTALL)
            if not output_match:
                raise ValueError("No output content found")
            result = output_match.group(1).strip()

            # Extract lecture and slides information
            lecture_slides: Dict[str, List[int]] = {}
            lecture_matches = re.finditer(r"<LECTURE\s+(\d+)>(.*?)</LECTURE>", result, re.DOTALL)

            for match in lecture_matches:
                lecture_number = int(match.group(1).strip())
                lecture_content = match.group(2)

                # Find the lecture by note_number
                lecture = next((l for l in lectures if int(l.get('note_number', 0)) == lecture_number), None)
                if not lecture:
                    continue

                # Extract slide numbers
                slide_numbers = [
                    int(num) for num in re.findall(r"<SLIDE\s+(\d+)>", lecture_content)
                    if num.isdigit()
                ]

                if slide_numbers:
                    lecture_slides[lecture['id']] = slide_numbers

            # Extract preamble, summary, and conclusion
            preamble_match = re.search(r"<PREAMBLE>(.*?)</PREAMBLE>", result, re.DOTALL)
            summary_match = re.search(r"<SUMMARY>(.*?)</SUMMARY>", result, re.DOTALL)
            conclusion_match = re.search(r"<CONCLUSION>(.*?)</CONCLUSION>", result, re.DOTALL)

            if not summary_match:
                raise ValueError("No summary content found")

            # Update or create summary entry
            if name not in self.summary:
                self.summary[name] = {
                    "preamble": preamble_match.group(1).strip() if preamble_match else "",
                    "content": summary_match.group(1).strip(),
                    "conclusion": conclusion_match.group(1).strip() if conclusion_match else "",
                    "slides": lecture_slides
                }
            else:
                if preamble_match:
                    self.summary[name]["preamble"] = preamble_match.group(1).strip()
                self.summary[name]["content"] += "\n\n" + summary_match.group(1).strip()
                if conclusion_match:
                    self.summary[name]["conclusion"] = conclusion_match.group(1).strip()
                self.summary[name]["slides"].update(lecture_slides)

        except Exception as e:
            print(f"Error processing summary block: {str(e)}")

    def split_content_into_batches(self, content: str, num_batches: int) -> List[str]:
        """Split content into specified number of batches."""
        sections = content.split('\n\n')
        batch_size = (len(sections) + num_batches - 1) // num_batches
        
        batches = []
        for i in range(0, len(sections), batch_size):
            batch = '\n\n'.join(sections[i:i + batch_size])
            batches.append(batch)
        
        return batches
        