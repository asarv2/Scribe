from agents import Agent, ModelSettings, OpenAIChatCompletionsModel, Runner
from app.services.parse.models import ParseDocuments, SyllabusResponse
from app.services.parse.prompts import get_syllabus_prompt
from supabase import Client
class FileParser:
    def __init__(self, supabase_client: Client, class_id: str, file_id: str):
        self.class_id = class_id
        self.file_id = file_id
        self.supabase_client = supabase_client

        self.parse_syllabus_system_prompt = get_syllabus_prompt(self.course_title)

        self.parse_syllabus_agent = Agent[ParseDocuments](
            name="Parse Syllabus Agent",
            instructions=self.parse_syllabus_system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                include_usage=True,
                temperature=0.0 # deterministic output
            ),
            output_type=SyllabusResponse
        )

    async def parse_syllabus(self, google_file_id: str, prev_class_name: str | None = None, prev_class_code: str | None = None, prev_class_description: str | None = None, prev_outcomes: list[str] | None = None):
        """
        Parses the syllabus and returns a SyllabusResponse
        """

        documents = ParseDocuments(class_id=self.class_id, file_id=self.file_id)

        # input messages
        input_message_parts = [
            {"type": "input_text", "content": "Please parse the syllabus for the following class, providing the class name, code, description, and outcomes. The syllabus is attached below."},
            {
                "type": "input_image",
                "image_url": f"https://generativelanguage.googleapis.com/v1beta/{google_file_id}",
                "detail": "high"
            }
        ]

        result = await Runner.run(self.parse_syllabus_agent, input=[{"role": "user", "content": input_message_parts}], context=documents)

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
        class_result = await self.supabase_client.table("classes").update(update_data).eq("id", self.class_id).execute()

        if class_result.error:
            raise Exception(f"Failed to update class: {class_result.error}")
        

        # making previous outcomes lowercase
        prev_outcomes = [outcome.lower() for outcome in prev_outcomes]

        # insert the outcomes
        insert_data = [{"class": self.class_id, "title": outcome} for outcome in outcomes if outcome.lower() not in prev_outcomes]
        outcomes_result = await self.supabase_client.table("outcomes").upsert(insert_data).execute()

        if outcomes_result.error:
            raise Exception(f"Failed to insert outcomes: {outcomes_result.error}")

        return class_name, class_code, class_description, outcomes