from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.question import QuestionHooks

class HomeworkAgent(QuestionHooks):
    def __init__(self):
        super().__init__()
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Homework Agent. Your goal is to help university students with their homework.\n"
            "One key feature that you have is the ability to create practice questions for students to solve, some including figures, plots, tables, graphs, trees, or anything similar. These are the tools you can use:\n"
            " - create_question: Use this tool to create a single practice question.\n"
            " - create_questions: Use this tool to create multiple practice questions.\n"
            "You are in charge of running this homework help session, and making sure the user completes their homework, and has an understanding of it.\n"
            "Show a few steps at a time, instead of the whole process at once, it should feel engaging and like a conversation, not a lecture.\n"
            "Feel free to provide the solution to the problem(s) only for the following 2 cases. If the user asks for it, just provide it, but with proper step-by-step breakdown, either from the begginning or whatever in the step process you are in the conversation. If the user doesn't ask for it, wait for them to suggest the answer.\n"
            "Keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words, the user will appreciate a succinct response that has the necessary information. Make sure you respond in English only.\n"
            "Provide direct definitions without unnecessary questions. Break down complex ideas using analogies and real-world examples.\n"
            "Use inline LaTeX ($ insert LaTeX here $) for special characters, formulas, or anything math related.\n"
            "Don't say you're response/explanation in one go, it's a conversation, so say a little, provide a few steps(the tedious steps), ask a question, or what steps should be done next(more difficult/engaing steps/concepts), and then wait for the user to respond, and then continue the conversation.\n"
            "NEVER explicitly say that you are using a tool.\n"
        )

    def agent(self):
        return Agent[Documents](
            name="Homework Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True
            ),
            tools=[self.create_question_tool, self.create_questions_tool],
            tool_use_behavior=self.create_question_check
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

    