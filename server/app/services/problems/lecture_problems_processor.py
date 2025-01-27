from typing import List, Dict, Callable, Awaitable, Union
from app.services.base_processor import ContentType
from app.services.problems.base_problems_processor import (
    BaseProblemsProcessor,
    MCQQuestion,
    FRQQuestion,
    ProblemsContent,
    QuestionType
)

class LectureProblemsProcessor(BaseProblemsProcessor):
    def __init__(
        self,
        course_title: str,
        lecture_names: List[str],
        lectures: ProblemsContent,
        question_type: QuestionType,
        additional_instructions: str = ""
    ):
        super().__init__(course_title, ContentType.LECTURE, question_type, additional_instructions)
        self.lectures = lectures
        self.lecture_names = lecture_names

    async def process_problems(
        self,
        num_questions: int = 3,
        conceptual_ratio: float = 1,
        single_part_ratio: float = 1,
        all_lectures: List[Dict[str, Union[str, int]]] = [],
        batch_size: int = None,
        on_batch_complete: Callable[[List[List[Union[MCQQuestion, FRQQuestion]]]], Awaitable[None]] = None
    ) -> List[List[Union[MCQQuestion, FRQQuestion]]]:
        """Process problems for lectures"""
        if conceptual_ratio > 1 or single_part_ratio > 1:
            raise ValueError("Ratios cannot be greater than 1")

        lecture_name = ", ".join(self.lecture_names)
        print(f"Generating {num_questions} questions for {lecture_name}")

        # Split questions by type
        conceptual_questions = round(num_questions * conceptual_ratio)
        computational_questions = num_questions - conceptual_questions

        single_part_conceptual = round(conceptual_questions * single_part_ratio)
        multi_part_conceptual = conceptual_questions - single_part_conceptual

        single_part_computational = round(computational_questions * single_part_ratio)
        multi_part_computational = computational_questions - single_part_computational

        question_numbers = [
            single_part_conceptual,
            multi_part_conceptual,
            single_part_computational,
            multi_part_computational
        ]
        prompts = [
            self.single_part_conceptual_prompt,
            self.multi_part_conceptual_prompt,
            self.single_part_computational_prompt,
            self.multi_part_computational_prompt
        ]
        all_tags = [
            ["conceptual"],
            ["conceptual", "multi-part"],
            ["computational"],
            ["computational", "multi-part"]
        ]

        for j, num_q in enumerate(question_numbers):
            if num_q == 0:
                continue

            tags = all_tags[j]
            tag_description = f"{tags[0]} {tags[1]}" if len(tags) > 1 else tags[0]
            print(f"Generating {num_q} {tag_description} questions")

            if batch_size:
                # Process in batches
                for i in range(0, num_q, batch_size):
                    current_batch_size = min(batch_size, num_q - i)
                    result = await self.process_batch(
                        current_batch_size,
                        lecture_name,
                        self.lectures['content'],
                        prompts[j]
                    )
                    self.clean_result(result, lecture_name, tags, all_lectures)
                    
                    # Call on_batch_complete after each batch
                    await on_batch_complete(self.questions[lecture_name][i:i + current_batch_size])
            else:
                # Process all at once
                result = await self.process_batch(
                    num_q,
                    lecture_name,
                    self.lectures['content'],
                    prompts[j]
                )
                self.clean_result(result, lecture_name, tags, all_lectures)

        # If not batching, call on_batch_complete once at the end
        if not batch_size:
            await on_batch_complete(self.questions[lecture_name])

        return self.questions[lecture_name]