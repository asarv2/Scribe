from agents import Agent, ModelSettings, OpenAIChatCompletionsModel, Runner
from app.services.parse.parse_models import ParseDocuments, SyllabusResponse
from supabase import Client
from typing import List, Any, Optional, cast
from agents.items import TResponseInputItem
from app.extensions import get_gemini


class FileParser:
    def __init__(
        self,
        supabase_client: Client,
        class_id: str,
        file_id: str,
        course_title: str = "",
    ):
        self.class_id = class_id
        self.file_id = file_id
        self.supabase_client = supabase_client
        self.course_title = course_title
        self.gemini_client = get_gemini()

        self.parse_syllabus_system_prompt = """
        You are an expert in educational curriculum design. You will be given a syllabus for a class, and your goal is to extract the necessary information. You will try to find the class name, class code, class description, and learning outcomes. For the learning outcomes, do not try to make these up on your own, be sure to only include them if the professor has explicitly stated them.
        """

        if not self.gemini_client:
            raise Exception("Gemini client not found")

        self.parse_syllabus_agent = Agent[ParseDocuments](
            name="Parse Syllabus Agent",
            instructions=self.parse_syllabus_system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                include_usage=True,
                temperature=0.0,  # deterministic output
            ),
            output_type=SyllabusResponse,
        )

    async def parse_syllabus(
        self,
        google_file_id: str,
        prev_class_name: Optional[str] = None,
        prev_class_code: Optional[str] = None,
        prev_class_description: Optional[str] = None,
        prev_outcomes: Optional[List[str]] = None,
    ):
        """
        Parses the syllabus and returns a SyllabusResponse
        """

        documents = ParseDocuments(class_id=self.class_id, file_id=self.file_id)

        # input messages
        input_message_parts = [
            {
                "type": "input_text",
                "content": "Please parse the syllabus for the following class, providing the class name, code, description, and outcomes. The syllabus is attached below.",
            },
            {
                "type": "input_image",
                "image_url": f"https://generativelanguage.googleapis.com/v1beta/{google_file_id}",
                "detail": "high",
            },
        ]

        # Cast the message to the correct type
        input_message = cast(
            List[TResponseInputItem], [{"role": "user", "content": input_message_parts}]
        )

        result = await Runner.run(
            self.parse_syllabus_agent,
            input=input_message,
            context=documents,
        )

        class_name = result.final_output.class_name
        class_code = result.final_output.class_code
        class_description = result.final_output.class_description
        outcomes = result.final_output.outcomes

        update_data = {}
        if not prev_class_name:
            update_data["title"] = class_name
        if not prev_class_code:
            update_data["class_code"] = class_code
        if not prev_class_description:
            update_data["course_description"] = class_description

        # update the supabase database
        class_result = await cast(
            Any,
            self.supabase_client.table("classes")
            .update(update_data)
            .eq("id", self.class_id)
            .execute(),
        )

        if class_result.error:
            raise Exception(f"Failed to update class: {class_result.error}")

        # making previous outcomes lowercase
        prev_outcomes_list = (
            []
            if prev_outcomes is None
            else [outcome.lower() for outcome in prev_outcomes]
        )

        # insert the outcomes
        insert_data = [
            {"class": self.class_id, "title": outcome}
            for outcome in outcomes
            if outcome.lower() not in prev_outcomes_list
        ]

        # Fix awaitable issue
        outcomes_result = await cast(
            Any, self.supabase_client.table("outcomes").upsert(insert_data).execute()
        )

        if outcomes_result.error:
            raise Exception(f"Failed to insert outcomes: {outcomes_result.error}")

        return class_name, class_code, class_description, outcomes
