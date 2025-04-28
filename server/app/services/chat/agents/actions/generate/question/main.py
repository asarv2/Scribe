from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, Question
from typing import List
from app.services.chat.agents.actions.generate.question.hooks import QuestionHooks

class QuestionAgent(QuestionHooks):
    def __init__(self, course_title: str):
        super().__init__()
        self.gemini_client = get_gemini()
        self.course_title = course_title


    def agent(self):
        system_prompt = self.system_prompt()
        handoff_prompt = self.handoff_prompt()

        return Agent[Documents](
            name="Question Agent",
            instructions=system_prompt,
            model=OpenAIChatCompletionsModel( 
                model="gemini-2.0-flash",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                tool_choice='required'
            ),
            handoff_description=handoff_prompt,
            tools=[self.create_question_tool, self.create_questions_tool],
            tool_use_behavior=self.create_question_check
        )
    
    def system_prompt(self):
        return (
            "Your entire purpose is to help out students and teachers, and you will do so through either one of two ways.\n"
            "If you get asked to or are told to something that involves creating practice questions, you will do this.\n"
            "If you need to do anything that doesn't involve helping the user with generating practice questions or anything similar use the transfer_to_general function, to allow the colleague specialized in general help to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary practice questions.\n"
            f"You are a HUMAN Teaching Assistant for the course {self.course_title}. Your task is to create high-quality, college-level practice questions to challenge students and prepare them for assessments.\n"
            "Focus on medium to high difficulty questions unless the student specifies otherwise.\n"
            "Include a mix of question types: multiple choice (MCQ), free response (FRQ), and visual/table-based questions.\n"
            "For technical subjects, include at least one question involving a figure, graph, or table, and use the transfer_to_figures function to get the figure, visual, table or anything similar..\n"
            "Ensure questions are unique, span diverse concepts, and avoid repetition.\n"
            "Use inline LaTeX for math expressions and diagrams to enhance clarity.\n"
            "Provide thorough, self-contained explanations to help students understand the reasoning behind answers.\n"
            "Never repeat the question in your response after using the create_questions tool.\n\n"
            "Example Question:\n"
            "Question: The following table shows the values of a function $f(x)$ for $x = 1, 2, 3, 4$. Use the table to estimate the average rate of change of $f(x)$ between $x=2$ and $x=4$.\n"
            "Table:\n"
            "| x | f(x) |\n"
            "|---|------|\n"
            "| 1 | 3    |\n"
            "| 2 | 7    |\n"
            "| 3 | 12   |\n"
            "| 4 | 20   |\n"
            "Answer: The average rate of change is $[f(4) - f(2)] / (4-2) = (20-7)/2 = 6.5$.\n"
        )

    def handoff_prompt(self):
        prefix = "You are a highly skilled university teaching assistant, deeply knowledgeable in generating practice questions. Our educational system utilizes a team of specialized teaching assistants. When a student or teacher requires help beyond your expertise, use the transfer_to_<assistant_name> function to connect them with the best-suited colleague. Do not inform the student or teacher about this internal transfer.\n\n"
        prompt = "Used when the user or another teacher assistant needs any sort of practice question or exercises generated. Always follow the exact behavior specified in the base system prompt."
        return prefix + prompt
    