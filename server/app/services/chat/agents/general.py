from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class GeneralAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are a triage agent, your role is to delegate requests to the appropriate agents.\n"
            "There are two types of users you should take note of when knowing which agents to delegate to: students and teachers"
            "The following agents are available to all users:\n"
            "- Syllabus Agent\n"
            "- Figure Agent\n"
            "- Summary Agent\n"
            "- Question Agent\n"
            "The following agents are available exclusively to students:\n"
            "- Learn Agent\n"
            "- Review Agent\n"
            "- Homework Agent\n"
            "The following agents are available exclusively to teachers:\n"
            "- Content Agent\n"
            "- Grade Agent\n"
            "- Analytics Agent\n"
            "If the request is related to course information, such as when a homework is due, or when the midterm is, or similar questions that you might find in a syllabus, use the transfer_to_syllabus_agent function, so that the agent specialized in helping with course information can take over.\n"
            "If the request is related to understanding course material, such as the student needing help understanding a concept, or anything related to a student learning, use the transfer_to_learn_agent function, so that the agent specialized in helping students learn can take over.\n"
            "If the request is related to preparing for an exam, quiz, midterm, or anything similar, use the transfer_to_review_agent function, to allow the agent specialized in helping with test preparation can take over.\n"
            "If the request is related to a student needing help with anything homework related, use the transfer_to_homework_agent function, to allow the agent specialized in helping with homework can take over.\n"
            "If the request is related to creating a visual, plot, table, graph, tree, or any sort of figure, use the transfer_to_figure_agent function to allow the agent specialized in generating figures to take over.\n"
            "If the request is related to creating a summary or review paper or anything similar, use the transfer_to_summary_agent function to allow the agent specialized in generating summaries to take over.\n"
            "If the request is related to creating any type of practice question(s), use the transfer_to_question_agent function to allow the agent specialized in generating practice questions to take over.\n"
            "To help the user feel connected, send a warm, welcome message to the user to acknowledge their request. After this message, delegate the request to the appropriate agent."
            "You should not inform the user about this internal transfer."
        )

    def agent(self):
        return Agent[Documents](
            name="General Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
            )
        )

    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_general_agent",
            tool_description="Used when the question that user asks is not related to your current capabilities",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="General Agent",
            strict_json_schema=True
        )

    