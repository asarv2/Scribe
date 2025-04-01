import os
import re
from typing import Dict, List, TypedDict, Any, Callable, Awaitable, Optional
from app.extensions import FIGURES_DIR, supabase
from app.services.base_processor import BaseProcessor, Message, Figure

class FigurePrompt(TypedDict):
    id: str
    additional_info: str

class FigureProcessor(BaseProcessor):
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
        self.figures: Dict[str, Figure] = {}
        self.lectures = lectures
        self.chapters = chapters
        self.homeworks = homeworks
        self.files = files
        self.lecture_documents = lecture_documents
        self.chapter_documents = chapter_documents
        self.chapter_exercises = chapter_exercises
        self.homework_exercises = homework_exercises
        self.file_documents = file_documents
        self.all_content = all_content

        # Base prompts
        base_figure_prompt = (
            f"You are an expert figure generation assistant tasked with creating a comprehensive and cohesive figure, "
            f"in the context of the class {self.course_title}. You will be given documents from lectures and be asked "
            f"to generate a complete figure, using Python code."
        )

        quality_prompt = (
            f"To generate figures of the highest quality, here are some guidelines you should follow.\n\n"
            f"CRITICAL REQUIREMENTS:\n"
            f"1. You should enclose the code to generate the figure in <CODE>x</CODE> tags, where x is the code to generate the figure.\n"
            f"2. You can use libraries like matplotlib, scipy, networkx, numpy to generate the figure.\n"
            f"3. Make sure that the syntax of the code is correct.\n"
        )

        example_prompt = (
            f"Example: If you wanted to show the 2D visualization of 2 equations (with x and y axes), you should write the following code: <CODE>import matplotlib.pyplot as plt\nimport numpy as np\nx = np.linspace(-5, 5, 100)\ny1 = 2*x + 1  # First equation: y = 2x + 1\ny2 = x**2    # Second equation: y = x^2\nplt.plot(x, y1, label='y = 2x + 1')\nplt.plot(x, y2, label='y = x^2')\nplt.grid(True)\nplt.legend()\nplt.xlabel('x')\nplt.ylabel('y')\nplt.show()</CODE>. You should only enclose the code in the code tag, not anywhere else in your response.\n\n"
        )

        self.figure_prompt = base_figure_prompt + "\n\n" + quality_prompt + "\n\n" + example_prompt
    
    async def process_batch(
        self,
        figure_id: str,
        content: str,
        prompt: str,
        additional_info: str
    ) -> str:
        """Process a batch of figures"""
        try:
            flat_figures = [
                f["code"]
                for figures in self.figures.values()
                for group in figures
                for f in group
            ]
            flat_figures_str = "\n".join(flat_figures)

            # add additional instructions to the prompt
            additional_instructions_prompt = (
                f"VERY IMPORTANT: Follow these additonal instructions in the generation of the figure: {additional_info}"
            )
            system_message = prompt + "\n\n" + additional_instructions_prompt

            message = Message(content=[
                {
                    "type": "text",
                    "text": "The following figures have already been generated. Do not repeat them: " + flat_figures_str
                },
                {
                    "type": "text", 
                    "text": f"You should generate 1 new figure. INPUT: {content}\n\nYOUR OUTPUT: "
                }
            ])

            # save input prompt to .txt file in questions folder
            with open(os.path.join(FIGURES_DIR, f"{figure_id}.txt"), "w") as f:
                f.write("SYSTEM PROMPT: " + system_message + "\n\n" + "INPUT PROMPT: " + prompt)
            
            # Use a faster model with higher RPM
            response = await self.robust_generate(system_message, message, model="gemini-2.0-flash-lite")
            print(f"Successfully generated response for {figure_id}")
            return response
            
        except Exception as e:
            print(f"Error in process_batch: {str(e)}")
            raise
    
    def clean_result(
        self,
        figure_id: str,
        result: str,
        lecture_references: List[str],
        chapter_references: List[str],
        chapter_exercise_references: List[str],
        homework_exercise_references: List[str],    
        file_references: List[str],
    ) -> None:
        """Clean and process the generated figure result."""
        try:
            # Convert markdown-style code blocks (both with and without python tag) to CODE tags
            result = re.sub(
                r'```(?:python)?\n(.*?)```',
                lambda m: f'<CODE>{m.group(1).strip()}</CODE>',
                result,
                flags=re.DOTALL
            )

            # Find first CODE tag match
            code_match = re.search(r'<CODE>(.*?)</CODE>', result, re.DOTALL)
            if code_match:
                code_block = code_match.group(1).strip()
                try:
                    # Execute and save the plot
                    generated_figure_id = self._execute_and_save_plot_sync(code_block, figure_id)
                    if not generated_figure_id:
                        raise Exception("Failed to generate figure")
                        
                    self.figures[figure_id] = Figure(
                        id=figure_id,
                        code=code_block,
                        lecture_references=lecture_references,
                        chapter_references=chapter_references,
                        chapter_exercise_references=chapter_exercise_references,
                        homework_exercise_references=homework_exercise_references,
                        file_references=file_references
                    )
                        
                except Exception as e:
                    print(f"Error executing code block: {str(e)}")
                    # Remove the code block if execution fails
                    result = result.replace(code_match.group(0), '')
                    
        except Exception as e:
            print(f"Error processing figure block: {str(e)}")

    def _execute_and_save_plot_sync(self, code_block: str, figure_id: str) -> Optional[str]:
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

            # Save to local file system for debugging
            local_path = os.path.join(FIGURES_DIR, f"{figure_id}.png")
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

    async def process_figures(
        self,
        figure_prompts: List[FigurePrompt],
        question: str,
        message_id: str,
        clean_figures_and_references: Callable[[Any], Any] = None,
        on_batch_complete: Callable[[Figure], Awaitable[None]] = None
    ) -> Dict[str, Figure]:
        """Process figures for lectures"""
        
        print(f"Generating {len(figure_prompts)} figures")

        for figure_prompt in figure_prompts:
            figure_id = figure_prompt.get('id')

            additional_info = figure_prompt.get('additional_info')

            result = await self.process_batch(
                    figure_id,
                    "\n".join(self.all_content),
                    self.figure_prompt,
                    additional_info
                )
            
            # clean the result, get the figures and references, of type ChatMessage
            figures_and_references = clean_figures_and_references(question, message_id,result, self.lectures, self.chapters, self.homeworks, self.files, self.lecture_documents, self.chapter_documents, self.chapter_exercises, self.homework_exercises, self.file_documents)

            # there should no figure ids in the response

            print(f"Figures and references: {figures_and_references}")

            self.clean_result(
                figure_id, 
                figures_and_references['response'], 
                figures_and_references['lecture_references'], 
                figures_and_references['chapter_references'], 
                figures_and_references['chapter_exercise_references'], 
                figures_and_references['homework_exercise_references'], 
                figures_and_references['file_references']
            )

            if on_batch_complete:
                await on_batch_complete(self.figures[figure_id])

        return self.figures  # Return all figures, not just the last one
    


            
