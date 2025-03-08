from typing import List, Dict, Any, Optional, Callable
import base64
from app.services.base_processor import BaseProcessor, Message, CleanedHomeworkResponse

class HomeworkProcessor(BaseProcessor):
    def __init__(self, course_title: str):
        super().__init__()
        self.course_title = course_title
        self.notes: Dict[str, Dict[str, CleanedHomeworkResponse]] = {}
        self.conversation_history: List[Message] = []

    def clean_response(
        self,
        response: str,
        homework_name: str,
        problem: str,
        text: str,
        exercise_id: str
    ) -> CleanedHomeworkResponse:
        cleaned_response = CleanedHomeworkResponse(
            exercise_id=exercise_id,
            problem=problem,
            description=response.strip(),
            text=text
        )

        if homework_name not in self.notes:
            self.notes[homework_name] = {}
        self.notes[homework_name][problem] = cleaned_response

        return cleaned_response

    async def process_problem(
        self,
        image: bytes,
        text: str,
        problem: str,
        homework_name: str,
        exercise_id: str
    ) -> CleanedHomeworkResponse:
        try:
            # Convert image bytes to base64
            base64_image = base64.b64encode(image).decode('utf-8')
            
            # Get prompts
            base_prompt = self._get_base_prompt()
            additional_prompt = self._get_additional_prompt(problem)

            message = Message(content=[
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

            # Generate response using AI with increased retries and wait time
            response = await self.robust_generate(
                None,
                message,
                model="gemini-2.0-flash-lite"
            )
            
            if not response:
                raise Exception("Empty response from AI model")
            
            print(f"Successfully processed problem {problem}")

            # Add AI response to conversation history
            self.conversation_history.append(Message(content=[{"type": "text", "text": response}]))

            return self.clean_response(
                response,
                homework_name,
                problem,
                text,
                exercise_id
            )

        except Exception as error:
            print(f"Error processing problem {problem}: {str(error)}")
            raise error

    async def process_homework_problems(
        self,
        homework_name: str,
        documents: List[Dict[str, Any]],
        after_generate: Callable[[CleanedHomeworkResponse], None]
    ) -> List[CleanedHomeworkResponse]:
        try:
            results = []
            for document in documents:
                result = await self.process_problem(
                    document['image'],
                    document['text'],
                    document['problem'],
                    homework_name,
                    document['exercise_id']
                )
                results.append(result)
                await after_generate(result)
            return results
        except Exception as error:
            print("Error processing homework:", error)
            raise error

    def _get_base_prompt(self) -> str:
        example_description = '''This homework problem asks to prove that if a set $S$ is convex, then for any collection of points $x_1, x_2, ..., x_k$ in $S$ and any collection of non-negative weights $\\lambda_1, \\lambda_2, ..., \\lambda_k$ that sum to 1, the weighted sum $\\sum_{i=1}^{k} \\lambda_i x_i$ is also in $S$. The problem includes a hint to use induction on $k$, starting with the base case $k=2$ which follows directly from the definition of convexity. The problem is worth 10 points and is part of the section on convex optimization.'''

        instructions = f'''Provide a detailed description of the content from the homework, in the context of the course: ${self.course_title}.

        Describe what you see, including specific details about the homework problems, their requirements, and any hints or instructions provided. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX notation (enclosed in $ signs) to describe any mathematical content you see on the page.

        Here is an example of a good description:

        {example_description}'''

        return instructions

    def _get_additional_prompt(self, problem: str) -> str:
        example_description = '''This is the second part of the homework assignment. It contains Problem 3 (15 points) which asks to implement the simplex algorithm for a given linear program. The problem provides a specific linear program in standard form: maximize $3x_1 + 2x_2$ subject to $x_1 + x_2 \\leq 4$, $2x_1 + x_2 \\leq 5$, and $x_1, x_2 \\geq 0$. Students are required to show all steps of the simplex algorithm, including the initial tableau, pivot operations, and the final solution. The problem also asks to interpret the economic meaning of the dual variables in this context.'''

        prompt = (
            f"Use the previous page's description to help you understand the context of the current page. "
            f"Here is an example of a good description:\n\n"
            f"{example_description}\n\n"
            f"Now it's your turn. Please describe the problem: {problem}"
        )

        return prompt