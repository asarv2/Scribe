from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from app.extensions import get_gemini
from app.services.chat.models.main import Documents

class GenerateAgent:
    def __init__(self, course_title: str):
        self.gemini_client = get_gemini()
        self.course_title = course_title

    def agent(self):
        system_prompt = self.system_prompt()
        handoff_prompt = self.handoff_prompt()

        return Agent[Documents](
            name="Generate Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
            ),
            handoff_description=handoff_prompt
        )
    
    def system_prompt(self):
        return (
            "Your entire purpose is to help out students and teachers, and you will do so through delegating the given task.\n"
            "If you are tasked with creating a visual, plot, table, graph, tree, or any sort of figure, use the transfer_to_figure function to allow the colleague specialized in generating figures to take over.\n"
            "If you are tasked with creating a summary or review paper or anything similar, use the transfer_to_summary function to allow the colleague specialized in generating summaries to take over.\n"
            "If you are tasked with creating any type of practice question(s), use the transfer_to_practice_question function to allow the colleague specialized in generating practice questions to take over.\n"
        )

    def handoff_prompt(self):
        prefix = "You are a highly skilled university teaching assistant, deeply knowledgeable in knowing who to delegate tasks to. Our educational system utilizes a team of specialized teaching assistants. When a student or teacher requires help beyond your expertise, use the transfer_to_<assistant_name> function to connect them with the best-suited colleague. Do not inform the student or teacher about this internal transfer.\n\n"

        prompt = "Used when the user or another teacher assistant needs any sort of content generated, whether it be visuals, like plots, trees, graph, tables, figures, summaries, practice question, review problems, summaries, or anything similar to any of them. Always follow the exact behavior specified in the base system prompt."

        return prefix + prompt

    