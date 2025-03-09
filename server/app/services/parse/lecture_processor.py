from typing import List, Dict, Any, Optional, Callable
import base64
from app.services.base_processor import BaseProcessor, CleanedResponse, Message
from app.config import model_manager
from PIL import Image
import io

class LectureProcessor(BaseProcessor):
    def __init__(self, course_title: str):
        super().__init__()
        self.course_title = course_title
        self.notes: Dict[str, Dict[int, CleanedResponse]] = {}
        self.conversation_history: List[Message] = []

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
        text: str
    ) -> CleanedResponse:
        cleaned_response = CleanedResponse(
            page=page_number,
            description=response.strip(),
            text=text
        )

        if lecture_name not in self.notes:
            self.notes[lecture_name] = {}
        self.notes[lecture_name][page_number] = cleaned_response

        return cleaned_response

    async def process_with_phi4(self, image: bytes, prompt: str) -> Optional[str]:
        """Try to process with Phi-4 model first"""
        try:
            model, processor = model_manager.get_model()
            if not model or not processor:
                return None

            # Convert bytes to PIL Image
            pil_image = Image.open(io.BytesIO(image))
            
            # Use the prompt parameter in the formatted text
            formatted_prompt = f"<|user|><|image_1|>{prompt}<|end|><|assistant|>"
            
            # Process image and text with Phi-4 format
            inputs = processor(text=formatted_prompt, images=pil_image, return_tensors='pt')

            # Move all input tensors to the same device as the model's first layer
            device = model.device
            for key in inputs:
                if inputs[key] is not None:  # Only move tensors that exist
                    inputs[key] = inputs[key].to(device)

            # Generate response
            generate_ids = model.generate(
                **inputs,
                max_new_tokens=2000,
                num_beams=1,
                do_sample=False,
                pad_token_id=processor.tokenizer.pad_token_id,
                num_logits_to_keep=1
            )
            
            generate_ids = generate_ids[:, inputs['input_ids'].shape[1]:]
            response = processor.batch_decode(
                generate_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False
            )[0]
            return response
        except Exception as e:
            print(f"Phi-4 processing failed: {str(e)}")
            return None

    async def process_page(
        self,
        image: bytes,
        text: str,
        page_number: int,
        lecture_name: str,
        num_pages: int,
    ) -> CleanedResponse:
        try:
            # Get prompts
            base_prompt = self._get_base_prompt()
            additional_prompt = self._get_additional_prompt(page_number, num_pages)
            combined_prompt = base_prompt + "\n\n" + additional_prompt

            # Try Phi-4 first
            phi4_response = await self.process_with_phi4(image, combined_prompt)
            
            if phi4_response:
                print(f"Successfully processed page {page_number} with Phi-4")
                return self.clean_response(
                    phi4_response,
                    lecture_name,
                    page_number,
                    text
                )

            # Fallback to Gemini
            print(f"Falling back to Gemini for page {page_number}")
            base64_image = base64.b64encode(image).decode('utf-8')
            
            message = Message(content=[
                {
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{base64_image}"
                },
                {
                    "type": "text",
                    "text": combined_prompt
                },
                *([] if not text else [{"type": "text", "text": text}])
            ])

            self.conversation_history.append(message)
            
            response = await self.robust_generate(
                None,
                message,
                model="gemini-2.0-flash-lite"
            )
            
            if not response:
                raise Exception("Empty response from both models")
            
            print(f"Successfully processed page {page_number} with Gemini")
            
            self.conversation_history.append(Message(content=[{"type": "text", "text": response}]))

            return self.clean_response(
                response,
                lecture_name,
                page_number,
                text
            )

        except Exception as error:
            print(f"Error processing page {page_number}: {str(error)}")
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
                )
                results.append(result)
                await after_generate(result)
            return results
        except Exception as error:
            print("Error processing PDF:", error)
            raise error

    def _get_base_prompt(self) -> str:
        example_description = '''This slide presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points. The proof is outlined, focusing on one direction of the implication. It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex. The underlining highlights the key steps and conclusions of the proof. The notation "pf" indicates "proof," and the double-headed arrow indicates the "if and only if" nature of the theorem. The term "conv. comb." is an abbreviation for "convex combination." The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''

        instructions = f'''Provide a detailed description of the content from the lecture slides, in the context of the course: ${self.course_title}.

        Describe what you see, including specific details that would not be known unless you were given the context of the slide. Be very detailed and specific, but make sure to stay concise and to the point. Use LaTeX notation (enclosed in $ signs) to describe any mathematical content you see on the slide.

        Here is an example of a good description:

        {example_description}'''

        return instructions

    def _get_additional_prompt(self, page_number: int, num_pages: int) -> str:
        example_description = '''This slide continues the proof of Theorem 10.1 from the previous slide, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof.'''

        prompt = (
            f"Use the previous slide's description to help you understand the context of the current slide. "
            f"Here is an example of a good description:\n\n"
            f"{example_description}\n\n"
            f"Now it's your turn. Please describe SLIDE {page_number} of {num_pages}: "
        )

        return prompt