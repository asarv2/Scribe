from typing import List, Dict, Any, Optional, Callable
import base64
from app.services.base_processor import BaseProcessor, CleanedResponse, Message
from app.config import model_manager
from PIL import Image
import io
import torch
import asyncio
import time
from app.services.task_router import route_to_gpu_worker

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

            # Generate response with optimized parameters
            generate_ids = model.generate(
                **inputs,
                max_new_tokens=2000,
                num_beams=1,
                do_sample=False,
                pad_token_id=processor.tokenizer.pad_token_id,
                num_logits_to_keep=1,
                use_cache=True,  # Enable KV caching
                temperature=0.0  # Deterministic output, faster
            )
            
            generate_ids = generate_ids[:, inputs['input_ids'].shape[1]:]
            response = processor.batch_decode(
                generate_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False
            )[0]
            return response
        except Exception as e:
            print(f"Phi-4 processing failed: {str(e)}")
            return None

    async def process_with_phi4_batch(self, images: List[bytes], prompts: List[str], min_batch_size=4, max_batch_size=6) -> List[Optional[str]]:
        """Process multiple images in parallel with Phi-4 model using optimized batching"""
        try:
            # Route this GPU-intensive task to the GPU worker
            return await route_to_gpu_worker(self._process_with_phi4_batch, images, prompts, min_batch_size, max_batch_size)
        except Exception as e:
            print(f"Phi-4 batch processing failed: {str(e)}")
            return [None] * len(images)

    async def _process_with_phi4_batch(self, images: List[bytes], prompts: List[str], min_batch_size=4, max_batch_size=6) -> List[Optional[str]]:
        """Process multiple images in parallel with Phi-4 model using optimized batching"""
        try:
            model, processor = model_manager.get_model()
            if not model or not processor:
                return [None] * len(images)

            # Preload and preprocess all images
            print("Preloading and preprocessing all images...")
            preprocess_start = time.time()
            pil_images = []
            for img_bytes in images:
                img = Image.open(io.BytesIO(img_bytes))
                # Convert to RGB if image has alpha channel or is not RGB
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                # Use a smaller target size to reduce memory and processing time
                img = img.resize((384, 384), Image.LANCZOS)
                pil_images.append(img)
            preprocess_time = time.time() - preprocess_start
            print(f"Preprocessing completed in {preprocess_time:.2f} seconds")

            # Calculate optimal batch distribution
            total_images = len(images)
            batches = []
            
            # Determine optimal batch distribution to minimize forward passes
            remaining = total_images
            while remaining > 0:
                if remaining <= max_batch_size:
                    # Last batch with remaining images
                    batches.append(remaining)
                    break
                elif remaining <= max_batch_size * 2:
                    # Split remaining images into two balanced batches
                    batch1 = remaining // 2
                    batch2 = remaining - batch1
                    if batch1 < min_batch_size:
                        batch1 = min_batch_size
                        batch2 = remaining - batch1
                    batches.extend([batch1, batch2])
                    break
                else:
                    # Add a max-sized batch and continue
                    batches.append(max_batch_size)
                    remaining -= max_batch_size
            
            print(f"Optimized batch distribution: {batches} (total: {sum(batches)} images)")
            
            # Process images according to the calculated batch sizes
            all_responses = []
            image_index = 0
            
            for batch_num, batch_size in enumerate(batches):
                batch_images = pil_images[image_index:image_index+batch_size]
                batch_prompts = [f"<|user|><|image_1|>{prompts[i+image_index]}<|end|><|assistant|>" for i in range(batch_size)]
                
                print(f"\n--- PROCESSING BATCH {batch_num + 1}/{len(batches)} ({batch_size} images) ---")
                
                # Warm up KV cache for this specific batch
                if batch_num == 0 or batch_size > 1:
                    print("Warming up KV cache for this batch...")
                    with torch.no_grad():
                        # Use a simple prompt similar to what we'll process
                        warm_up_text = f"<|user|>Describe a lecture slide.<|end|><|assistant|>"
                        warm_up_inputs = processor(text=warm_up_text, return_tensors='pt').to(model.device)
                        _ = model(**warm_up_inputs)
                
                print("Processing batch inputs")
                # Time the input processing
                input_start = time.time()
                batch_inputs = processor(
                    text=batch_prompts, 
                    images=batch_images, 
                    return_tensors='pt', 
                    padding=True
                )
                
                # Move all input tensors to the same device as the model
                device = model.device
                for key in batch_inputs:
                    if batch_inputs[key] is not None:
                        batch_inputs[key] = batch_inputs[key].to(device)
                input_time = time.time() - input_start
                print(f"Input processing completed in {input_time:.2f} seconds")
                
                print("Generating responses for batch")
                # Generate responses with optimized parameters
                generation_start = time.time()
                with torch.no_grad():
                    generate_ids = model.generate(
                        **batch_inputs,
                        max_new_tokens=2000,
                        num_beams=1,
                        do_sample=False,
                        pad_token_id=processor.tokenizer.pad_token_id,
                        num_logits_to_keep=1,
                        use_cache=True,
                        temperature=0.0
                    )
                generation_time = time.time() - generation_start
                print(f"Generation completed in {generation_time:.2f} seconds")
                
                # Process each response in the batch
                batch_responses = []
                for j in range(batch_size):
                    # Extract the response for this specific image
                    response_ids = generate_ids[j, batch_inputs['input_ids'].shape[1]:]
                    response = processor.batch_decode(
                        [response_ids], skip_special_tokens=True, clean_up_tokenization_spaces=False
                    )[0]
                    batch_responses.append(response)
                    print(f'>>> Processed image {image_index+j+1}')
                
                all_responses.extend(batch_responses)
                image_index += batch_size
                
                # Clear CUDA cache between batches
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            
            return all_responses
            
        except Exception as e:
            print(f"Phi-4 batch processing failed: {str(e)}")
            return [None] * len(images)

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
            # Prepare all prompts and images
            images = []
            prompts = []
            page_numbers = []
            text_contents = []
            
            for document in documents:
                # Get prompts
                base_prompt = self._get_base_prompt()
                additional_prompt = self._get_additional_prompt(document['page'], num_slides)
                combined_prompt = base_prompt + "\n\n" + additional_prompt
                
                images.append(document['image'])
                prompts.append(combined_prompt)
                page_numbers.append(document['page'])
                text_contents.append(document['text'])
            
            # Process all images in optimized batches
            responses = await self.process_with_phi4_batch(images, prompts)
            
            # Process results
            results = []
            for i, response in enumerate(responses):
                if not response:
                    # Fallback to Gemini for this specific image
                    print(f"Falling back to Gemini for page {page_numbers[i]}")
                    base64_image = base64.b64encode(images[i]).decode('utf-8')
                    
                    message = Message(content=[
                        {
                            "type": "image_url",
                            "image_url": f"data:image/png;base64,{base64_image}"
                        },
                        {
                            "type": "text",
                            "text": prompts[i]
                        },
                        *([] if not text_contents[i] else [{"type": "text", "text": text_contents[i]}])
                    ])

                    self.conversation_history.append(message)
                    
                    response = await self.robust_generate(
                        None,
                        message,
                        model="gemini-2.0-flash-lite"
                    )
                    
                    if not response:
                        raise Exception(f"Empty response from both models for page {page_numbers[i]}")
                    
                    print(f"Successfully processed page {page_numbers[i]} with Gemini")
                    
                    self.conversation_history.append(Message(content=[{"type": "text", "text": response}]))
                else:
                    print(f"Successfully processed page {page_numbers[i]} with Phi-4")
                
                result = self.clean_response(
                    response,
                    lecture_name,
                    page_numbers[i],
                    text_contents[i]
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