from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.question.hooks import QuestionHooks

class QuestionAgent(QuestionHooks):
    def __init__(self):
        super().__init__()
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Question Agent. Your goal is to help students and teachers create practice questions for assessments.\n"
            "The following Agents are available for you to delegate to:\n"
            " - General Agent\n"
            "If you need to do anything that is out of the scope of the Question Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary questions.\n"
            "To do this, you can use the following tools:\n"
            " - create_question: Use this tool to create a single practice question.\n"
            " - create_questions: Use this tool to create multiple practice questions.\n"
            "Focus on medium to high difficulty questions unless the student specifies otherwise.\n"
            "If not specified, include a mix of question types: multiple choice (MCQ), free response (FRQ), and visual/table-based questions.\n"
            "For technical subjects, include at least one question involving a figure, graph, or table.\n"
            "Ensure questions are unique, span diverse concepts, and avoid repetition.\n"
            "Think step by step before using the tools to create the questions.\n"
            "Provide thorough, self-contained explanations to help students understand the reasoning behind answers.\n"
        )


    def agent(self):
        return Agent[Documents](
            name="Question Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                tool_choice='required'
            ),
            tools=[self.create_question_tool, self.create_questions_tool],
            tool_use_behavior=self.create_question_check
        )
    
    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_question_agent",
            tool_description="Used when the user or teacher needs help creating a practice question.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Question Agent",
            strict_json_schema=True
        )