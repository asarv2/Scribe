# topic_problems_processor.py
from typing import List, Dict, Callable, Awaitable, Union
from app.services.base_processor import ContentType
from app.services.problems.base_problems_processor import (
    BaseProblemsProcessor,
    MCQQuestion,
    FRQQuestion,
    ProblemsContent,
    QuestionType,
    QuestionPrompt
)

class TopicProblemsProcessor(BaseProblemsProcessor):
    def __init__(
        self,
        course_title: str,
        topic_names: List[str],
        topics: ProblemsContent,
        question_type: QuestionType,
        additional_instructions: str = ""
    ):
        super().__init__(course_title, ContentType.TOPIC, question_type, additional_instructions)
        self.topics = topics
        self.topic_names = topic_names

    async def process_problems(
        self,
        question_prompts: List[QuestionPrompt],
        all_lectures: List[Dict[str, Union[str, int]]] = [],
        on_batch_complete: Callable[[List[List[Union[MCQQuestion, FRQQuestion]]]], Awaitable[None]] = None
    ) -> List[List[Union[MCQQuestion, FRQQuestion]]]:
        """Process problems for topics"""

        topic_name = ", ".join(self.topic_names)
        print(f"Generating 1 question for {topic_name}")

        for question_prompt in question_prompts:
            question_id = question_prompt.get('id')
            
            tags = []
            prompt = None
            if question_prompt.get('computational') and question_prompt.get('multi_part'):
                tags.append('computational')
                tags.append('multi-part')
                prompt = self.multi_part_computational_prompt
            elif question_prompt.get('computational'):
                tags.append('computational')
                prompt = self.single_part_computational_prompt
            elif question_prompt.get('conceptual') and question_prompt.get('multi_part'):
                tags.append('conceptual')
                tags.append('multi-part')
                prompt = self.multi_part_conceptual_prompt
            elif question_prompt.get('conceptual'):
                tags.append('conceptual')
                prompt = self.single_part_conceptual_prompt


            tag_description = f"{tags[0]} {tags[1]}" if len(tags) > 1 else tags[0]
            print(f"Generating 1 {tag_description} question")

            result = await self.process_batch(
                    topic_name,
                    self.lectures['content'],
                    prompt
                )
            self.clean_result(question_id, result, topic_name, tags, all_lectures)

            if on_batch_complete:
                await on_batch_complete(self.questions[topic_name])

        return self.questions[topic_name]
