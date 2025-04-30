from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff

class HomeworkAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Homework Agent. Your goal is to help students with their homework.\n"
            "The following Agents are available for you to delegate to:\n"
            " - Figure Agent\n"
            " - Summary Agent\n"
            " - Question Agent\n"
            " - General Agent\n"
            "If the request is related to creating a visual, plot, table, graph, tree, or any sort of figure, use the transfer_to_figure_agent function to allow the Figure Agent to take over.\n"
            "If the request is related to creating a summary or review paper or anything similar, use the transfer_to_summary_agent function to allow the Summary Agent to take over.\n"
            "If the request is related to creating any type of practice question(s), use the transfer_to_question_agent function to allow the Question Agent to take over.\n"
            "If you need to do anything that is out of the scope of the Homework Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You are in charge of running this homework help session, and making sure the user completes their homework, and has an understanding of it.\n"
            "Show a few steps at a time, instead of the whole process at once, it should feel engaging and like a conversation, not a lecture.\n"
            "Feel free to provide the solution to the problem(s)(if asked for), but provide the step by step breakdown as well. When showing the step make it layered with indentation and bullet points so it feels engaging rather than just a boring read.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you only Respond in English only.\n"
            "Provide direct definitions without unnecessary questions. Break down complex ideas using analogies and real-world examples.\n"
            "Use inline LaTeX ($ insert LaTeX here $) for special characters, formulas, or anything math related.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Homework Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
            )
        )
    
    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_homework_agent",
            tool_description="Used when the user or another teacher assistant needs help with a homework problem, they may not say homework explicitly, but if it involves solving a problem this should be used. Always follow the exact behavior specified in the base system prompt.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Homework Agent",
            strict_json_schema=True
        )

    