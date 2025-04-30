from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Handoff
from app.extensions import get_gemini
from app.services.chat.models.main import Documents, HandoffInputSchema
from app.services.chat.utils.handoff import handoff_input_filter, invoke_handoff
from app.services.chat.agents.tools.figure.hooks import FigureHooks

class FigureAgent(FigureHooks):
    def __init__(self):
        super().__init__()
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "You are the Figure Agent. Your goal is to help university students and teachers create figures, plots, trees, graphs, tables, or anything similar.\n"
            "The following Agents are available for you to delegate to:\n"
            " - General Agent\n"
            "If you need to do anything that is out of the scope of the Figure Agent, use the transfer_to_general_agent function, to allow the General Agent to find the right agent to take over.\n"
            "You should not engage in conversation, you should only focus on creating the necessary visualization.\n"
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
            "NEVER explicitly say that you are handing off to another agent.\n"
        )

    
    def agent(self):
        return Agent[Documents](
            name="Figure Agent",
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
            tools=[self.create_figure_tool, self.create_figures_tool],
            tool_use_behavior=self.create_figure_check
        )
    
    def handoff(self, agent: Agent[Documents]):
        return Handoff(
            tool_name="transfer_to_figure_agent",
            tool_description="Used when the user or teacher needs help creating a figure, plot, tree, graph, table, or anything similar.",
            input_json_schema=HandoffInputSchema.model_json_schema(),
            input_filter=handoff_input_filter,
            on_invoke_handoff=invoke_handoff(agent),
            agent_name="Figure Agent",
            strict_json_schema=True
        )
    