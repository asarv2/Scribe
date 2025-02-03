from typing import List, Dict, Any, Optional, Callable, Union
from langchain_core.messages import AIMessage, HumanMessage
import base64
import re
from app.services.base_processor import BaseProcessor, CleanedResponse

class TextbookProcessor(BaseProcessor):
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
        textbook_name: str,
        page_number: int,
    ) -> CleanedResponse:
        cleaned_response = CleanedResponse(
            page=page_number,
            description=response.strip()  # Treat entire response as description
        )

        if textbook_name not in self.notes:
            self.notes[textbook_name] = {}
        self.notes[textbook_name][page_number] = cleaned_response

        return cleaned_response

    async def process_page(
        self,
        image: bytes,
        text: str,
        page_number: int,
        textbook_name: str,
        num_pages: int,
    ) -> CleanedResponse:
        try:
            # Convert image bytes to base64
            base64_image = base64.b64encode(image).decode('utf-8')
            
            # Prepare base prompt based on handwritten flag
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
            response = await self.robust_generate(message, model="gemini-1.5-flash-8b")
            print("Response:", response)

            if response:
                # Add AI response to conversation history
                self.conversation_history.append(AIMessage(content=response))

            return self.clean_response(
                response,
                textbook_name,
                page_number,
            )

        except Exception as error:
            print(f"Error processing page {page_number}:", error)
            raise error

    async def process_pages(
        self,
        textbook_name: str,
        num_pages: int,
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
                    textbook_name,
                    num_pages,
                    document['image_bboxes']
                )
                results.append(result)
                await after_generate(result)
            return results
        except Exception as error:
            print("Error processing PDF:", error)
            raise error

    def _get_base_prompt(self) -> str:
        example_description = '''This page presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points. The proof is outlined, focusing on one direction of the implication. It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous page, thus proving that $S$ is convex. The underlining highlights the key steps and conclusions of the proof. The notation "pf" indicates "proof," and the double-headed arrow indicates the "if and only if" nature of the theorem. The term "conv. comb." is an abbreviation for "convex combination." The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''

        instructions = f'''Provide a detailed description of the content from the {"handwritten notes" if self.handwritten else "textbook"}, in the context of the course: {self.course_title}.

        Describe what you see, including specific details that would not be known unless you were given the context of the page. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX notation (enclosed in $ signs) to describe any mathematical content you see on the page.

        Here is an example of a good description:

        {example_description}'''

        return instructions

    def _get_additional_prompt(self, page_number: int, num_pages: int) -> str:
        example_description = '''This textbook's page continues the proof of Theorem 10.1 from the previous page, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof.'''

        prompt = (
            f"Use the previous page's description to help you understand the context of the current page. "
            f"Here is an example of a good description:\n\n"
            f"{example_description}\n\n"
            f"Now it's your turn. Please describe PAGE {page_number} of {num_pages}: "
        )

        return prompt