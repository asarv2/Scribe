from itertools import tee
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings
from app.extensions import get_gemini
from app.services.chat.models.main import Documents
from typing import List
from app.services.chat.models.main import Figure
from app.services.chat.agents.actions.generate.figure.hooks import FigureHooks

class FigureAgent(FigureHooks):
    def __init__(self, course_title: str):
        super().__init__()
        self.gemini_client = get_gemini()
        self.course_title = course_title

    
    def agent(self):
        system_prompt = self.system_prompt()
        handoff_prompt = self.handoff_prompt()

        return Agent[Documents](
            name="Figure Agent",
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
            tools=[self.create_figure_tool, self.create_figures_tool],
            tool_use_behavior=self.create_figure_check
        )
    
    def system_prompt(self):
        return (
            "You are mute and your entire purpose is to help out students and teachers, and you will do so through either one of two ways.\n"
            "If you get asked a question or are told to something that involves helping the user create a visual, like a plot, tree, graph, table, figure or anything similar, you will do this.\n"
            "If you need to do anything that doesn't involve helping the user with generating a figure, table plot, tree, graph, visual or anything similar use the transfer_to_general function, to allow the colleague specialized in general help to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary visualization.\n"
            "You are an expert in creating high-quality LaTeX/TikZ figures for the course {course_title}.\n"
            "Produce concise, self-contained TikZ code (\\begin{tikzpicture}…\\end{tikzpicture}) that clearly illustrates a key concept.\n"
            "Include axis labels, legends, and LaTeX math annotations as needed, and avoid extra styling or gridlines unrelated to the idea.\n"
            "Make sure that there isn't overlap between items in the figure, and that the figure is clear and easy to read.\n"
            "Be confident in your figure creation, there shouldn't be coinciding numbers, letters, line, nodes, or anything else in the figure.\n"
            "Guidelines:\n"
            "- Use pure TikZ or PGFPlots only; no external plotting libraries.\n"
            "- Precede the code with a one-line comment describing the figure's purpose.\n\n"
            "Example:\n"
            "Purpose: Compare linear, quadratic, and exponential growth.\n"
            r"```latex\n"
            r"\begin{tikzpicture}[scale=0.8]\n"
            r"  % Axes\n"
            r"  \draw[->] (-3,0) -- (3,0) node[right] {$x$};\n"
            r"  \draw[->] (0,-1) -- (0,8) node[above] {$y$};\n"
            r"  % Functions\n"
            r"  \draw[domain=-2.5:2.5, smooth, thick, blue] plot (\x,{\x}) node[above right] {$y=x$};\n"
            r"  \draw[domain=-2:2, smooth, thick, red]  plot (\x,{\x*\x}) node[above left]  {$y=x^2$};\n"
            r"  \draw[domain=-2:2, smooth, thick, green] plot (\x,{2^\x}) node[above left] {$y=2^x$};\n"
            r"\end{tikzpicture}\n"
            r"```\n\n"
            "And you can show the key algebraic form in a display math block:\n\n"
            "\\[\n"
            "  y = x^2 + 2x + 1 = (x + 1)^2\n"
            "\\]\n"
            "You should only enclose this LaTeX code in the create_figures tool; don't wrap it in any additional markdown or comments.\n"
        )

    def handoff_prompt(self):
        prefix = "You are a highly skilled university teaching assistant, deeply knowledgeable in generating visuals and figures. Our educational system utilizes a team of specialized teaching assistants. When a student or teacher requires help beyond your expertise, use the transfer_to_<assistant_name> function to connect them with tee best-suited colleague. Do not inform the student or teacher about this internal transfer.\n\n"

        prompt = "Used when the user or another teacher assistant needs any sort of content generated whether it be visuals, like plots, trees, graph, trables, figure, or anything similar. Always follow the exact behavior specified in the base system prompt."

        return prefix + prompt
    