from typing import List, Dict, Any, Optional, Callable, Union
from langchain_core.messages import AIMessage, HumanMessage
import base64
from app.services.base_processor import BaseProcessor, Figure, CleanedResponse

class LectureProcessor(BaseProcessor):
    def __init__(self, course_title: str, handwritten: bool = False):
        super().__init__()
        self.course_title = course_title
        self.handwritten = handwritten
        self.notes: Dict[str, Dict[int, CleanedResponse]] = {}
        self.conversation_history: List[Union[HumanMessage, AIMessage]] = []

    def parse_bbox(self, bbox: str) -> List[int]:
        bbox = bbox.strip().replace('[', '').replace(']', '')
        try:
            ymin, xmin, ymax, xmax = map(
                lambda x: int(x.strip()),
                bbox.split(',')
            )
            return [ymin, xmin, ymax, xmax]
        except:
            print(f"Warning: Could not parse bbox {bbox}, using default values")
            return [0, 0, 1000, 1000]

    def clean_response(
        self,
        response: str,
        lecture_name: str,
        page_number: int,
        image_bboxes: List[Figure]
    ) -> CleanedResponse:
        import re
        latex_match = re.search(r'<LATEX>(.*?)</LATEX>', response, re.DOTALL)
        latex = latex_match.group(1).strip() if latex_match else ""

        figures: List[Figure] = []
        if self.handwritten:
            figure_matches = re.finditer(
                r'<FIGURE (.*?)>(.*?)</FIGURE>',
                response,
                re.DOTALL
            )
            figures = [
                Figure(
                    bbox=self.parse_bbox(match.group(1)),
                    description=match.group(2).strip()
                )
                for match in figure_matches
            ]
        else:
            figures = image_bboxes

        description_match = re.search(
            r'<DESCRIPTION>(.*?)</DESCRIPTION>',
            response,
            re.DOTALL
        )
        description = description_match.group(1).strip() if description_match else ""

        cleaned_response = CleanedResponse(
            page=page_number,
            latex=latex,
            figures=figures,
            description=description
        )

        if lecture_name not in self.notes:
            self.notes[lecture_name] = {}
        self.notes[lecture_name][page_number] = cleaned_response

        return cleaned_response

    async def process_page(
        self,
        image: bytes,
        text: str,
        page_number: int,
        lecture_name: str,
        num_pages: int,
        image_bboxes: List[Figure]
    ) -> CleanedResponse:
        try:
            # Convert image bytes to base64
            base64_image = base64.b64encode(image).decode('utf-8')
            
            # Get prompts
            base_prompt = self._get_base_prompt()
            additional_prompt = self._get_additional_prompt(page_number, num_pages)

            message = HumanMessage(content=[
                {
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                },
                {
                    "type": "text",
                    "text": base_prompt + "\n\n" + additional_prompt
                },
                *([] if not text else [{"type": "text", "text": text}])
            ])

            # Add message to conversation history
            self.conversation_history.append(message)

            # Generate response using AI
            response = await self.robust_generate(message)
            print("Response:", response)

            if response:
                # Add AI response to conversation history
                self.conversation_history.append(AIMessage(content=response))

            return self.clean_response(
                response,
                lecture_name,
                page_number,
                image_bboxes
            )

        except Exception as error:
            print(f"Error processing page {page_number}:", error)
            raise error

    async def process_slides(
        self,
        lecture_name: str,
        num_slides: int,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedResponse], None]
    ) -> List[CleanedResponse]:
        try:
            results = []
            for document in documents:
                result = await self.process_page(
                    document['image'],
                    document['text'],
                    document['page'],
                    lecture_name,
                    num_slides,
                    document['image_bboxes']
                )
                results.append(result)
                await after_generate(result)
            return results
        except Exception as error:
            print("Error processing PDF:", error)
            raise error

    def _get_base_prompt(self) -> str:
        # Common example LaTeX content
        example_latex = '''
        <LATEX>
        \\textbf{Thm 10.1} \\quad $S$ is convex if and only if
        it contains all conv. comb. of points in $S$
        $pf$ $\\iff$

        Suppose $S$ contains all conv. comb. of pts in $S$.
        Then clearly, for any $z_1, z_2 \\in S$
        \\underline{tz_1 + (1-t)z_2 \\in S}
        Conv. comb. of $z_1, z_2$
        \\implies \\underline{S \\text{ is convex}}
        </LATEX>'''

        # Common example figure
        example_figure = '''
        <FIGURE [200, 90, 745, 527]>A description of the figure.</FIGURE>'''

        # Common example description
        example_description = '''
        <DESCRIPTION>This slide presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points.  The proof is outlined, focusing on one direction of the implication.  It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex.  The underlining highlights the key steps and conclusions of the proof.  The notation "pf" indicates "proof," and the double-headed arrow indicates the "if and only if" nature of the theorem.  The term "conv. comb." is an abbreviation for "convex combination."  The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.</DESCRIPTION>'''

        if self.handwritten:
            instructions = f'''Follow the 3 instructions carefully to extract the content from the handwritten notes, in the context of the course: ${self.course_title}.
            1. Re-create the content exactly as it is written on the slide in LaTeX format, preserving the formatting. Use <LATEX> and </LATEX> tags to enclose the LaTeX content, do not use ```latex or ```.
            Take note of direction of arrows, placement of labels, and other notations. Assume that major math libraries are available, so you can use them to re-create the content. Here is an example:

            {example_latex}
            
            2. Find any important figures on the slides and provide the 4 bounding box coordinates: [ymin, xmin, ymax, xmax]. Use <FIGURE> and </FIGURE> tags to enclose the figure coordinates. If there are no figures present, simply do not write any <FIGURE> tags. Example:
            {example_figure}

            3. Provide a text based description of what you see, including specific details that would not be known unless you were given the context of the slide. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX to describe any mathematical content you see on the slide. Use <DESCRIPTION> and </DESCRIPTION> tags to enclose the description. Example:
            {example_description}'''
        else:
            instructions = f'''Follow the 2 instructions carefully to extract the content from the lecture slides, in the context of the course: ${self.course_title}.
            1. Re-create the content exactly as it is written on the slide in LaTeX format, preserving the formatting. Use <LATEX> and </LATEX> tags to enclose the LaTeX content, do not use ```latex or ```.
            Take note of direction of arrows, placement of labels, and other notations. Assume that major math libraries are available, so you can use them to re-create the content. Here is an example:

            {example_latex}

            2. Provide a text based description of what you see, including specific details that would not be known unless you were given the context of the slide. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX to describe any mathematical content you see on the slide. Use <DESCRIPTION> and </DESCRIPTION> tags to enclose the description. Example:
            {example_description}'''

        return instructions

    def _get_additional_prompt(self, page_number: int, num_pages: int) -> str:
        # Common example LaTeX content
        example_latex = '''
        <LATEX>
        \\textbf{Thm 10.1} \\quad S \\text{ is convex } \\iff \\\\
        \\text{it contains all conv. comb. of points in } S \\\\
        pf \\quad \\iff \\\\
        \\underline{\\text{Suppose } S \\text{ is convex}} \\\\
        n=2: \\quad z_1, z_2 \\in S \\implies t_1 z_1 + t_2 z_2 \\in S, \\quad t_1, t_2 \\ge 0 \\\\
        \\quad t_1 + t_2 = 1 \\\\
        n=3: \\quad z_1, z_2, z_3 \\in S \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 = \\left( t_1 + t_2 \\right) \\left( \\frac{t_1}{t_1 + t_2} z_1 + \\frac{t_2}{t_1 + t_2} z_2 \\right) + t_3 z_3 \\\\
        t_1 + t_2 + t_3 = 1 \\\\
        t_1 + t_2 \\ge 0, \\quad t_3 \\ge 0 \\\\
        \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 \\in S
        </LATEX>'''

        # Common example figures (only for handwritten)
        example_figures = '''
        <FIGURE [200, 90, 745, 527]>Theorem 10.1 statement.</FIGURE>
        <FIGURE [400, 490, 800, 700]>Conclusion of the proof for n=3.</FIGURE>'''

        # Common example description
        example_description = '''
        <DESCRIPTION>This slide continues the proof of Theorem 10.1 from the previous slide, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof. The underlining highlights key assumptions and conclusions. The notation "pf" stands for "proof," and "conv. comb." is short for "convex combination." The context of linear programming is crucial because this theorem is fundamental to understanding the properties of feasible regions in linear programming problems, which are often convex sets.</DESCRIPTION>'''

        # Base instruction varies based on handwritten flag
        if self.handwritten:
            base_instruction = '''Use the previous slide's generation to help you understand the context of the current slide. Remember, you should enclose everything in <LATEX> and </LATEX>, <FIGURE> and </FIGURE>, and <DESCRIPTION> and </DESCRIPTION> tags. Do not include any other formats like ```latex or ```.\n'''
        else:
            base_instruction = '''Use the previous slide's generation to help you understand the context of the current slide. Remember, you should enclose everything in <LATEX> and </LATEX> and <DESCRIPTION> and </DESCRIPTION> tags. Do not include any other formats like ```latex or ```.\n'''

        # Example header
        example_header = f'Here is a complete example of what you should output.\n\nINPUT: SLIDE 3 of 15.\nOUTPUT:\n'

        # Combine all parts
        prompt = (
            f"{base_instruction}"
            f"{example_header}"
            f"{example_latex}\n"
        )

        # Add figures section only for handwritten notes
        if self.handwritten:
            prompt += f"{example_figures}\n"

        # Add description and final instruction
        prompt += (
            f"{example_description}\n"
            f"Now its your turn. INPUT: SLIDE {page_number} of {num_pages}. OUTPUT: "
        )

        return prompt