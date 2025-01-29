from typing import List, Dict, Callable, Awaitable
from app.services.base_processor import ContentType
from app.services.summary.base_summary_processor import BaseSummaryProcessor, Summary, SummaryContent

class TopicSummaryProcessor(BaseSummaryProcessor):
    def __init__(
        self,
        course_title: str,
        topic_names: List[str],
        topics: SummaryContent,
        additional_instructions: str
    ):
        super().__init__(course_title, ContentType.TOPIC, additional_instructions)
        self.topics = topics
        self.topic_names = topic_names
    async def process_summary(
        self,
        all_lectures: List[Dict[str, str]],
        num_batches: int,
        on_batch_complete: Callable[[int, Summary], Awaitable[None]]
    ) -> Summary:
        """
        Process the topic content in batches and generate summaries.
        
        Args:
            all_lectures: List of lecture dictionaries with note_number and id
            num_batches: Number of batches to split the content into
            on_batch_complete: Callback function to execute after each batch
        """
        print(f"Generating summary for {self.topic_names}")
        
        names = ", ".join(self.topic_names)
        batches = self.split_content_into_batches(self.topics['content'], num_batches)
        
        for i, batch in enumerate(batches):
            print(f"Processing batch {i + 1} of {len(batches)}")
            result = await self.process_batch(names, batch)
            print(f"Batch {i + 1} result:", result)
            self.clean_result(result, names, all_lectures)
            
            # Call the batch completion callback
            await on_batch_complete(i + 1, self.summary[names])

        return self.summary[names] 