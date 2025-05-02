from agents import AgentHooks, RunContextWrapper, Agent, ToolsToFinalOutputResult, Tool
from typing import List, Optional, Tuple, Callable, TypeAlias
from app.extensions import get_supabase
from agents.tool import function_tool, FunctionToolResult
from app.services.chat.models.main import Documents, Figure, CreateFigureResponse
import subprocess, shutil, os, tempfile, hashlib, logging, re, time

logger = logging.getLogger(__name__)

class FigureHooks(AgentHooks):

    def __init__(self):
        # Run the check at module load time
        try:
            check_external_tools()
            logger.info("External tool check passed")
        except RuntimeError as e:
            logger.error(f"External tool check failed: {str(e)}")
            # We don't want to crash the entire application, but we'll log the error
            # and the function will fail when called
        self.create_figure_tool = function_tool(create_figure, name_override="create_figure")
        self.create_figures_tool = function_tool(create_figures, name_override="create_figures")
        self.create_figure_check = create_figure_check

    async def on_handoff(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        source: Agent[Documents],
    ) -> None:
        """Called when the agent is being handed off to. The `source` is the agent that is handing
        off to this agent."""
        message_id = wrapper.context.message_id
        # update the status text
        self.supabase_client.table("messages").update({
            "status_text": f"Getting ready to create figures..."
        }).eq("id", message_id).execute()



def upload_with_retry(bucket: str, path_on_bucket: str, local_file: str, mime: str):
    """Helper function to upload a file to Supabase storage with retry logic."""
    try:
        supabase_client = get_supabase()
        with open(local_file, "rb") as f:
            file_data = f.read()
            supabase_client.storage.from_(bucket).upload(
                path_on_bucket, file_data, {"content-type": mime}
            )
        logger.info(f"Uploaded file to {path_on_bucket}")
    except Exception as upload_error:
        logger.error(f"Error uploading file: {str(upload_error)}")
        # Try to delete if it exists and upload again
        try:
            supabase_client.storage.from_(bucket).remove([path_on_bucket])
            supabase_client.storage.from_(bucket).upload(
                path_on_bucket, file_data, {"content-type": mime}
            )
            logger.info(f"Successfully re-uploaded file after deletion")
        except Exception as retry_error:
            logger.error(f"Failed to re-upload file after deletion: {str(retry_error)}")
            raise retry_error

def run_cmd(cmd: List[str], cwd: Optional[str] = None, timeout: int = 60) -> subprocess.CompletedProcess:
    """Run a command with timeout and capture output.
    
    Args:
        cmd: Command and arguments to run
        cwd: Working directory
        timeout: Timeout in seconds
        
    Returns:
        CompletedProcess object
        
    Raises:
        subprocess.CalledProcessError: If command returns non-zero exit code
        subprocess.TimeoutExpired: If command times out
    """
    proc = subprocess.run(
        cmd, 
        capture_output=True, 
        text=True, 
        timeout=timeout, 
        cwd=cwd
    )
    return proc

def convert_pdf_to_images(pdf_file: str, output_dir: str, timeout: int = 30) -> Tuple[Optional[str], Optional[str]]:
    """Convert PDF to SVG and PNG formats with fallback mechanisms.
    
    Args:
        pdf_file: Path to the PDF file
        output_dir: Directory to save output files
        timeout: Timeout in seconds for conversion processes
        
    Returns:
        Tuple of (svg_file_path, png_file_path), either may be None if conversion failed
    """
    svg_file = os.path.join(output_dir, "figure.svg")
    png_file = os.path.join(output_dir, "figure.png")
    
    # Convert PDF to SVG
    logger.info(f"Converting PDF to SVG: {pdf_file} -> {svg_file}")
    try:
        pdf2svg_result = run_cmd(
            ["pdf2svg", pdf_file, svg_file],
            timeout=timeout
        )
        logger.info("PDF to SVG conversion successful")
    except Exception as e:
        logger.warning(f"PDF to SVG conversion failed: {str(e)}")
        svg_file = None
    
    # Convert PDF to PNG with transparent background
    logger.info(f"Converting PDF to PNG: {pdf_file} -> {png_file}")
    try:
        pdf2png_result = run_cmd(
            ["convert", "-density", "300", "-background", "transparent", pdf_file, png_file],
            timeout=timeout
        )
        logger.info("PDF to PNG conversion successful")
    except Exception as e:
        logger.warning(f"Primary PNG conversion failed: {str(e)}, trying alternative method")
        # Try alternative method
        try:
            pdf2png_alt_result = run_cmd(
                ["pdftoppm", "-png", "-r", "300", "-transp", pdf_file, os.path.join(output_dir, "figure")],
                timeout=timeout
            )
            
            # Find the generated PNG file (pdftoppm adds -1 suffix)
            png_files = [f for f in os.listdir(output_dir) if f.startswith("figure-") and f.endswith(".png")]
            if png_files:
                shutil.move(os.path.join(output_dir, png_files[0]), png_file)
                logger.info("Alternative PNG conversion successful")
            else:
                logger.error("Alternative PNG conversion failed to produce output files")
                png_file = None
        except Exception as alt_e:
            logger.error(f"Alternative PNG conversion also failed: {str(alt_e)}")
            png_file = None
    
    # Verify files exist
    if svg_file and not os.path.exists(svg_file):
        logger.error(f"SVG file not created: {svg_file}")
        svg_file = None
    
    if png_file and not os.path.exists(png_file):
        logger.error(f"PNG file not created: {png_file}")
        png_file = None
        
    return svg_file, png_file

# Check for required external tools at module load time
def check_external_tools():
    """Check if all required external tools are available."""
    required_tools = ["latexmk", "pdf2svg", "convert", "pdftoppm"]
    missing_tools = []
    
    for tool in required_tools:
        if shutil.which(tool) is None:
            missing_tools.append(tool)
    
    if missing_tools:
        error_msg = f"Missing required external tools: {', '.join(missing_tools)}"
        logger.error(error_msg)
        raise RuntimeError(error_msg)

async def create_figure_check(
    wrapper: RunContextWrapper[Documents],
    results: list[FunctionToolResult]
) -> ToolsToFinalOutputResult:
    # 1⃣  Collect *all* CreateFigureResponse objects
    all_responses: list[CreateFigureResponse] = []
    for result in results:
        if result.tool.name == "create_figure":
            if isinstance(result.output, CreateFigureResponse):
                all_responses.append(result.output)
        elif result.tool.name == "create_figures":
            all_responses.extend(
                [r for r in result.output if isinstance(r, CreateFigureResponse)]
            )

    # 2⃣  Build a success map keyed by figure_id
    figure_success: dict[str, bool] = {}
    for resp in all_responses:
        fid = resp.figure_id or ""          # empty string if not provided
        # Initialise to False; upgrade to True if any success comes in
        figure_success[fid] = figure_success.get(fid, False) or resp.success

    # 3⃣  Every seen figure_id must have succeeded
    all_success = bool(figure_success) and all(figure_success.values())

    # 4⃣  Decide finality based on the *last* tool invoked
    final_tool       = results[-1].tool
    final_output_raw = results[-1].output

    if final_tool.name == "create_figure":
        # Single-figure call: final iff that single ID succeeded
        is_final = isinstance(final_output_raw, CreateFigureResponse) \
                   and final_output_raw.success
        return ToolsToFinalOutputResult(
            is_final_output=is_final,
            final_output=final_output_raw
        )

    elif final_tool.name == "create_figures":
        # Multi-figure call: final only if *all* unique IDs succeeded
        return ToolsToFinalOutputResult(
            is_final_output=all_success,
            final_output=final_output_raw
        )

    # Fallback: not a figure-creation tool
    return ToolsToFinalOutputResult(
        is_final_output=False,
        final_output=final_output_raw
    )

# Helper functions for TikZ validation and enhancement
def quick_validate(code: str) -> tuple[bool, str]:
    """Perform quick pre-flight checks on LaTeX code without running LaTeX.
    
    Args:
        code: The LaTeX code to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not code.strip():
        return False, "No LaTeX code provided."
    if '\\write18' in code:
        return False, "Shell-escape commands are not allowed for security reasons."
    if '\\input' in code and ('`' in code or "'" in code or '"' in code):
        return False, "External file inputs are not allowed for security reasons."
    if '\\include' in code:
        return False, "External file includes are not allowed for security reasons."
    return True, ""

# Map of regex patterns to required TikZ libraries
NEEDED_LIBS = {
    r'\bof\s+\w+\b': 'positioning',
    r'\bto\s*\[\s*bend': 'bending',
    r'\bnode\s*\[.*?regular polygon': 'shapes.geometric',
    r'rectangle split': 'shapes.multipart',
    r'circle split': 'shapes.multipart',
    r'ellipse split': 'shapes.multipart',
    r'\\matrix': 'matrix',
    r'\\graph': 'graphs',
    r'mindmap': 'mindmap',
    r'spy': 'spy',
    r'overlay': 'overlay-beamer-styles',
    r'\\draw.*?plot': 'plothandlers',
    r'\\shade': 'shadings',
    r'\\fill': 'patterns',
}

def infer_tikz_libs(code: str) -> set:
    """Infer required TikZ libraries based on code content.
    
    Args:
        code: The LaTeX code to analyze
        
    Returns:
        Set of library names that should be included
    """
    libs = set()
    for pattern, lib in NEEDED_LIBS.items():
        if re.search(pattern, code):
            libs.add(lib)
    return libs

# Common LaTeX error patterns with user-friendly explanations
ERROR_HINTS = {
    r'No shape named': "You referenced a node that hasn't been defined. Make sure to define all nodes before referencing them.",
    r'Undefined control sequence': "You used a command that LaTeX doesn't recognize. Check for typos or missing packages.",
    r'Missing \$': "Math mode error. Ensure all math expressions are properly enclosed in $ symbols.",
    r'Missing \\begin': "Environment error. Check that all \\begin{...} have matching \\end{...} tags.",
    r'Missing \\end': "Environment error. Check that all \\begin{...} have matching \\end{...} tags.",
    r'File .* not found': "Your code references files that don't exist. Remove external file references.",
    r'Package .* Error': "Package error. Check the specific package documentation for correct usage.",
    r'Runaway argument': "Unclosed group or missing closing brace. Check for matching { and }.",
    r'Paragraph ended': "LaTeX encountered unexpected content. Check for missing closing braces or commands.",
    r'Emergency stop': "Critical error in your LaTeX code. Check syntax carefully.",
}

def pretty_latex_error(log: str) -> str:
    """Extract user-friendly error message from LaTeX log.
    
    Args:
        log: The LaTeX compilation log
        
    Returns:
        User-friendly error message
    """
    for pattern, hint in ERROR_HINTS.items():
        if re.search(pattern, log):
            return hint
    return "Check your TikZ syntax for errors."

async def create_figures(wrapper: RunContextWrapper[Documents], figures: List[Figure]) -> List[CreateFigureResponse]:
    """Generates a figure object given the latex code that will produce the figure. This tool is ONLY for LaTeX/TikZ code, NOT for Python/matplotlib code.
    
    Make sure not to add the title to the plot, as this will be added separately. This will return the number of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure number itself, as this is unknown to the user.

    You can provide either a standalone TikZ picture OR a complete LaTeX document. If you provide a complete document, the tool will extract the TikZ/PGFPlots content automatically.

    Make sure if you have a legend it's not covering any words, or that any words aren't covering other features. The plot should be clean, and organized.

    Args:
        figures: List[Figure]
            title: The title of the figure.
            latex_code: The LaTeX code that will produce the figure.
            references: List of number references that were used.
            message: The message to the user after the figure is created.

    Returns:
        List[CreateFigureResponse]
            success: Whether the figure was created successfully.
            figure_id: The id of the figure.
            error: The error message if the figure was not created successfully.
            message: The message to the user after the figure is created.

    Returns:
        A list of CreateFigureResponse objects. Each object will have a success field, which will be true if the figure was created successfully, and false if there was an error. If there was an error, the error field will contain the error message describing the issue. If the figure was created successfully, the figure_id field will contain the id of the figure.

    Example TikZ code:
    ```latex
    \\begin{tikzpicture}[scale=0.8]
      % Axes
      \\draw[->] (-3,0) -- (3,0) node[right] {$x$};
      \\draw[->] (0,-1) -- (0,8) node[above] {$y$};
      % Functions
      \\draw[domain=-2.5:2.5, smooth, thick, blue] plot (\\x,{\\x}) node[above right] {$y=x$};
    \\end{tikzpicture}
    ```
    
    Example PGFPlots code:
    ```latex
    \\begin{tikzpicture}
      \\begin{axis}[
        xlabel={$x$},
        ylabel={$y$},
        axis lines=middle
      ]
        \\addplot[domain=-2:2, samples=100, smooth, blue] {x^2};
      \\end{axis}
    \\end{tikzpicture}
    ```
    
    Example 1: Sample weighted graph
    ```
    \\begin{tikzpicture}[scale=0.8]
      % Vertices
      \\node[circle, draw, fill=green!30] (A) at (0,4)  {A};
      \\node[circle, draw, fill=green!30] (B) at (2,6)  {B};
      \\node[circle, draw, fill=green!30] (C) at (2,2)  {C};
      \\node[circle, draw, fill=green!30] (D) at (5,5)  {D};
      \\node[circle, draw, fill=green!30] (E) at (5,1)  {E};
      \\node[circle, draw, fill=green!30] (F) at (7,5)  {F};

      % Edges with weights
      \\draw (A) -- node[above left] {5}  (B);
      \\draw (A) -- node[below left] {2}  (C);
      \\draw (B) -- node[above left] {12} (C);
      \\draw (B) -- node[above]      {7}  (D);
      \\draw (C) -- node[above right]{6}  (D);
      \\draw (C) -- node[above right]{10} (E);
      \\draw (D) -- node[right]      {8}  (E);
      \\draw (D) to[bend left =20]   node[above] {4} (F);
      \\draw (D) to[bend right=20]   node[below] {1} (F);
      \\draw (F) to[loop right]      node[right] {5} (F);
    \\end{tikzpicture}
    ```

    Example 2: Power-law relationship
    ```
    \\begin{tikzpicture}
      \\begin{loglogaxis}[
          xlabel={$x$},
          ylabel={$y$},
          legend pos=south east,
          grid=both,
      ]
        % Data points
        \\addplot[only marks] table[row sep=\\\\]{
          x   y \\\\
          1   2 \\\\
          2   4 \\\\
          4   7.9 \\\\
          8   16.2 \\\\
          16  31.5 \\\\
        };
        \\addlegendentry{Experimental}

        % Best-fit y = 2·x^{1.05}
        \\addplot+[domain=1:16,samples=100]{2*pow(x,1.05)};
        \\addlegendentry{Model $y = 2x^{1.05}$}
      \\end{loglogaxis}
    \\end{tikzpicture}
    ```

    Example 3: Dijkstra pseudo-algorithm
    ```
    \\begin{algorithm}[H]
    \\caption{Dijkstra's shortest-path}
    \\begin{algorithmic}[1]
    \\Require weighted graph $G=(V,E)$, source $s$
    \\Ensure $\\text{dist}[v]$ is the shortest distance from $s$ to every $v\\in V$
    \\State initialize all $\\text{dist}[v] \\gets \\infty$, $\\text{prev}[v] \\gets \\text{null}$
    \\State $\\text{dist}[s] \\gets 0$
    \\State $Q \\gets V$ \\Comment{min-priority queue keyed by $\\text{dist}$}
    \\While{$Q \\neq \\emptyset$}
      \\State $u \\gets$ vertex in $Q$ with smallest $\\text{dist}[u]$
      \\State remove $u$ from $Q$
      \\For{\\textbf{each} neighbor $v$ of $u$}
        \\If{$\\text{dist}[u] + w(u,v) < \\text{dist}[v]$}
          \\State $\\text{dist}[v] \\gets \\text{dist}[u] + w(u,v)$
          \\State $\\text{prev}[v] \\gets u$
          \\State update key of $v$ in $Q$
        \\EndIf
      \\EndFor
    \\EndWhile
    \\end{algorithmic}
    \\end{algorithm}
    ```
    """
    responses = []
    start_time = time.perf_counter()
    supabase_client = get_supabase()

    # get the message id and class id
    message_id = wrapper.context.message_id
    class_id = wrapper.context.class_id
    logger.info(f"Message ID: {message_id}, Class ID: {class_id}")
    
    # Version tag for cache invalidation when build flags change
    cache_version = "v1"
    
    for figure in figures:
        figure_id: str | None = None
        figure_start_time = time.perf_counter()
        try:
            # get the title, latex code, and references
            title = figure.title
            latex_code = figure.latex_code

            # Get references
            references = [wrapper.context.references.get(ref, None) for ref in figure.references]
            references = [ref.get("id") for ref in references if ref is not None and ref.get("file") is False]

            logger.info(f"Starting figure generation for title: {title}")
            
            # Perform quick validation before proceeding
            is_valid, error_msg = quick_validate(latex_code)
            if not is_valid:
                logger.warning(f"Pre-flight validation failed: {error_msg}")
                
                # Insert a figure record with error status
                figure_response = supabase_client.table('figures').insert({
                    'generation_status': 'error',
                    'message': message_id,
                    'title': title,
                    'code': latex_code,
                    'references': references,
                    'generation_error': error_msg,
                    'class': class_id
                }).execute()
                
                figure_id = figure_response.data[0]['id']
                
                responses.append(CreateFigureResponse(
                    success=False,
                    figure_id=figure_id,
                    error=error_msg,
                    message=figure.message
                ))
                continue  # Skip to the next figure
            
            logger.info(f"LaTeX code passed pre-flight validation")
            logger.info(f"LaTeX code: {latex_code}")

            # insert a figure in the database, with the generation status set to generating
            figure_response = supabase_client.table('figures').insert({
                'generation_status': 'generating',
                'message': message_id,
                'title': title,
                'code': latex_code,
                'references': references,
                'class': class_id
            }).execute()

            # get the figure id
            figure_id = figure_response.data[0]['id']
            logger.info(f"Created figure ID: {figure_id}")

            # Create a hash of the latex code and settings for caching
            cache_key = f"{cache_version}:{latex_code}"
            code_hash = hashlib.sha256(cache_key.encode()).hexdigest()
            cache_folder = f"cache/figures/{class_id}"
            os.makedirs(cache_folder, exist_ok=True)
            logger.info(f"Cache folder: {cache_folder}, Hash: {code_hash}")
            
            # Define paths for different formats
            svg_output_path = os.path.join(cache_folder, f"{code_hash}.svg")
            png_output_path = os.path.join(cache_folder, f"{code_hash}.png")
            tex_path = os.path.join(cache_folder, f"{code_hash}.tex")
            
            # Check if we already have this figure cached
            if os.path.exists(svg_output_path) and os.path.exists(png_output_path) and os.path.exists(tex_path):
                logger.info(f"Using cached figure from {svg_output_path} and {png_output_path}")
                # Upload cached files
                
                # Upload SVG file
                upload_with_retry(
                    'figures', 
                    f"{class_id}/{figure_id}.svg", 
                    svg_output_path, 
                    'image/svg+xml'
                )
                
                # Upload PNG file
                upload_with_retry(
                    'figures', 
                    f"{class_id}/{figure_id}.png", 
                    png_output_path, 
                    'image/png'
                )
                
                # Update DB record
                try:
                    supabase_client.table('figures').update({
                        'generation_status': 'complete'
                    }).eq('id', figure_id).execute()
                    logger.info(f"Updated figure record with cached data")
                except Exception as update_error:
                    logger.error(f"Failed to update figure record: {str(update_error)}")
                    raise update_error
                
                responses.append(CreateFigureResponse(
                    success=True,
                    figure_id=figure_id,
                    error=None,
                    message=figure.message
                ))
                continue  # Skip to the next figure
            
            # If not cached, generate the figure
            with tempfile.TemporaryDirectory() as tmpdir:
                logger.info(f"Created temporary directory: {tmpdir}")
                
                # Detect content type
                has_tikz = "\\begin{tikzpicture}" in latex_code
                has_pgfplots = "\\begin{axis}" in latex_code or "\\begin{semilogxaxis}" in latex_code or "\\begin{semilogyaxis}" in latex_code or "\\begin{loglogaxis}" in latex_code
                has_algorithm = "\\begin{algorithm}" in latex_code
                has_forest = "\\begin{forest}" in latex_code
                
                logger.info(f"LaTeX content detection: tikz={has_tikz}, pgfplots={has_pgfplots}, algorithm={has_algorithm}, forest={has_forest}")
                
                # Clean the LaTeX code - extract tikzpicture content if needed
                cleaned_latex_code = latex_code
                
                # Extract tikzpicture content if document class is present
                if "\\documentclass" in cleaned_latex_code and has_tikz:
                    logger.info("Extracting tikzpicture content from document")
                    try:
                        # Find the tikzpicture environment
                        tikz_start = cleaned_latex_code.find("\\begin{tikzpicture}")
                        tikz_end = cleaned_latex_code.find("\\end{tikzpicture}") + len("\\end{tikzpicture}")
                        
                        if tikz_start >= 0 and tikz_end > tikz_start:
                            cleaned_latex_code = cleaned_latex_code[tikz_start:tikz_end]
                            logger.info(f"Extracted tikzpicture content: {cleaned_latex_code[:50]}...")
                        else:
                            logger.warning("Could not extract tikzpicture content, using full code")
                    except Exception as extract_error:
                        logger.error(f"Error extracting tikzpicture content: {str(extract_error)}")
                
                # Infer required TikZ libraries
                auto_libs = infer_tikz_libs(cleaned_latex_code)
                if auto_libs:
                    logger.info(f"Auto-detected required TikZ libraries: {', '.join(auto_libs)}")
                
                # Create the LaTeX file
                tex_file = os.path.join(tmpdir, "figure.tex")
                logger.info(f"Creating LaTeX file: {tex_file}")
                
                with open(tex_file, 'w') as f:
                    f.write("\\documentclass[tikz,border=10pt]{standalone}\n")
                    
                    # Add required packages based on content
                    f.write("\\usepackage{tikz}\n")
                    f.write("\\usepackage{amsmath,amssymb}\n")
                    
                    if has_pgfplots:
                        f.write("\\usepackage{pgfplots}\n")
                        f.write("\\pgfplotsset{compat=1.18}\n")

                    if has_forest:
                        f.write("\\usepackage{forest}\n")
                        f.write("\\forestset{l sep=0.5cm,s sep=0.3cm}\n")
                    
                    if has_algorithm:
                        f.write("\\usepackage{algorithm}\n")
                        f.write("\\usepackage{algpseudocode}\n")
                        f.write("\\usepackage{algorithmicx}\n")
                    
                    # Add base TikZ libraries
                    f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,fit,calc,decorations.pathreplacing,decorations.markings,patterns,angles,quotes")
                    
                    # Add auto-detected libraries
                    if auto_libs:
                        f.write("," + ",".join(auto_libs))
                    
                    f.write("}\n")
                    
                    f.write("\\begin{document}\n")
                    f.write(cleaned_latex_code)
                    f.write("\n\\end{document}")
                
                # Save a debug copy of the LaTeX file
                debug_tex_path = os.path.join(cache_folder, f"{code_hash}_debug.tex")
                shutil.copy(tex_file, debug_tex_path)
                logger.info(f"Saved debug copy of LaTeX file to {debug_tex_path}")
                
                # Compile the LaTeX file to PDF
                compile_start_time = time.perf_counter()
                logger.info("Attempting primary LaTeX compilation")
                latex_result = run_cmd(
                    ["latexmk", "-pdf", "-no-shell-escape", "-interaction=nonstopmode", "figure.tex"],
                    cwd=tmpdir, timeout=60
                )
                compile_time = time.perf_counter() - compile_start_time
                logger.info(f"LaTeX compilation took {compile_time:.2f} seconds")
                
                pdf_file = os.path.join(tmpdir, "figure.pdf")
                log = latex_result.stdout + latex_result.stderr
                error_match = re.search(r'! (.*?)\n', log, re.DOTALL)
                
                # Save the LaTeX output for debugging
                with open(os.path.join(cache_folder, f"{code_hash}_latex_stdout.log"), 'w') as f:
                    f.write(latex_result.stdout)
                with open(os.path.join(cache_folder, f"{code_hash}_latex_stderr.log"), 'w') as f:
                    f.write(latex_result.stderr)
                
                # Check for LaTeX errors
                latex_error = None
                if error_match:
                    latex_error = error_match.group(1).strip()
                    logger.error(f"LaTeX error message: {latex_error}")
                
                if latex_result.returncode != 0 or not os.path.exists(pdf_file):
                    logger.error(f"LaTeX compilation failed with return code {latex_result.returncode}")
                    
                    # Try alternative approach with article class
                    logger.info("Attempting alternative LaTeX compilation approach")
                    alt_tex_file = os.path.join(tmpdir, "alt_figure.tex")
                    with open(alt_tex_file, 'w') as f:
                        f.write("\\documentclass{article}\n")
                        f.write("\\usepackage{tikz}\n")
                        f.write("\\usepackage{amsmath,amssymb}\n")
                        
                        if has_pgfplots:
                            f.write("\\usepackage{pgfplots}\n")
                            f.write("\\pgfplotsset{compat=1.18}\n")

                        if has_forest:
                            f.write("\\usepackage{forest}\n")
                            f.write("\\forestset{l sep=0.5cm,s sep=0.3cm}\n")
                        
                        if has_algorithm:
                            f.write("\\usepackage{algorithm}\n")
                            f.write("\\usepackage{algpseudocode}\n")
                            f.write("\\usepackage{algorithmicx}\n")
                        
                        # Add base TikZ libraries
                        f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,fit,calc,decorations.pathreplacing,decorations.markings,patterns,angles,quotes")
                        
                        # Add auto-detected libraries
                        if auto_libs:
                            f.write("," + ",".join(auto_libs))
                        
                        f.write("}\n")
                        
                        f.write("\\pagestyle{empty}\n")
                        f.write("\\begin{document}\n")
                        f.write("\\thispagestyle{empty}\n")
                        f.write(cleaned_latex_code)
                        f.write("\n\\end{document}")
                    
                    # Save a debug copy of the alternative LaTeX file
                    alt_debug_tex_path = os.path.join(cache_folder, f"{code_hash}_alt_debug.tex")
                    shutil.copy(alt_tex_file, alt_debug_tex_path)
                    logger.info(f"Saved debug copy of alternative LaTeX file to {alt_debug_tex_path}")
                    
                    # Compile the alternative LaTeX file
                    alt_compile_start_time = time.perf_counter()
                    try:
                        alt_latex_result = run_cmd(
                            ["latexmk", "-pdf", "-no-shell-escape", "-interaction=nonstopmode", "alt_figure.tex"],
                            cwd=tmpdir, timeout=60
                        )
                        alt_compile_time = time.perf_counter() - alt_compile_start_time
                        logger.info(f"Alternative LaTeX compilation took {alt_compile_time:.2f} seconds")
                        
                        alt_pdf_file = os.path.join(tmpdir, "alt_figure.pdf")
                        alt_log = alt_latex_result.stdout + alt_latex_result.stderr
                        alt_error_match = re.search(r'! (.*?)\n', alt_log, re.DOTALL)
                        
                        # Save the alternative LaTeX output for debugging
                        with open(os.path.join(cache_folder, f"{code_hash}_alt_latex_stdout.log"), 'w') as f:
                            f.write(alt_latex_result.stdout)
                        with open(os.path.join(cache_folder, f"{code_hash}_alt_latex_stderr.log"), 'w') as f:
                            f.write(alt_latex_result.stderr)
                        
                        # Check for alternative LaTeX errors
                        alt_latex_error = None
                        if alt_error_match:
                            alt_latex_error = alt_error_match.group(1).strip()
                            logger.error(f"Alternative LaTeX error message: {alt_latex_error}")
                        
                        if alt_latex_result.returncode != 0 or not os.path.exists(alt_pdf_file):
                            raise subprocess.CalledProcessError(alt_latex_result.returncode, "latexmk")
                        
                        # If alternative compilation succeeded, use that PDF
                        pdf_file = alt_pdf_file
                        
                    except Exception as alt_compile_error:
                        logger.error(f"Alternative LaTeX compilation also failed: {str(alt_compile_error)}")
                        
                        # Create a more helpful error message using our error parser
                        combined_log = log + alt_log if 'alt_log' in locals() else log
                        friendly_error = pretty_latex_error(combined_log)
                        
                        error_details = latex_error if latex_error else 'Unknown error'
                        error_msg = f"Failed to compile LaTeX: {error_details}. {friendly_error}"
                        logger.error(f"Error in figure generation: {error_msg}")
                        
                        # Update DB with error status
                        supabase_client.table('figures').update({
                            "generation_status": "error",
                            "generation_error": error_msg
                        }).eq("id", figure_id).execute()
                        
                        # Add error response instead of raising the exception
                        responses.append(CreateFigureResponse(
                            success=False,
                            figure_id=figure_id,
                            error=error_msg,
                            message=figure.message
                        ))
                        continue  # Skip to the next figure since compilation failed
                
                # Convert PDF to images
                convert_start_time = time.perf_counter()
                svg_file, png_file = convert_pdf_to_images(pdf_file, tmpdir)
                convert_time = time.perf_counter() - convert_start_time
                logger.info(f"PDF conversion took {convert_time:.2f} seconds")
                
                # Check if conversion failed
                if svg_file is None and png_file is None:
                    error_msg = "Failed to convert PDF to images"
                    logger.error(error_msg)
                    
                    # Update DB with error status
                    supabase_client.table('figures').update({
                        "generation_status": "error",
                        "generation_error": error_msg
                    }).eq("id", figure_id).execute()
                    
                    # Add error response
                    responses.append(CreateFigureResponse(
                        success=False,
                        figure_id=figure_id,
                        error=error_msg,
                        message=figure.message
                    ))
                    continue  # Skip to the next figure
                
                # Cache the files
                shutil.copy(tex_file, tex_path)
                if svg_file:
                    shutil.copy(svg_file, svg_output_path)
                if png_file:
                    shutil.copy(png_file, png_output_path)
                
                # Upload the SVG file
                if svg_file:
                    logger.info(f"Uploading SVG to Supabase storage: {class_id}/{figure_id}.svg")
                    upload_with_retry(
                        'figures',
                        f"{class_id}/{figure_id}.svg",
                        svg_file,
                        'image/svg+xml'
                    )
                else:
                    logger.warning("No SVG file to upload")
                
                # Upload the PNG file
                if png_file:
                    logger.info(f"Uploading PNG to Supabase storage: {class_id}/{figure_id}.png")
                    upload_with_retry(
                        'figures',
                        f"{class_id}/{figure_id}.png",
                        png_file,
                        'image/png'
                    )
                else:
                    logger.warning("No PNG file to upload")
                
                # Update DB record
                supabase_client.table('figures').update({
                    'generation_status': 'complete'
                }).eq('id', figure_id).execute()
                
                figure_time = time.perf_counter() - figure_start_time
                logger.info(f"Figure generation completed successfully in {figure_time:.2f} seconds")
                responses.append(CreateFigureResponse(
                    success=True,
                    figure_id=figure_id,
                    error=None,
                    message=figure.message
                ))
        except Exception as e:
            logger.error(f"Error in create_figures: {str(e)}")
            # update the figure status to error
            if figure_id:
                try:
                    supabase_client.table('figures').update({
                        "generation_status": "error",
                        "generation_error": str(e)
                    }).eq("id", figure_id).execute()
                    logger.info(f"Updated figure {figure_id} with error status")
                except Exception as update_error:
                    logger.error(f"Failed to update figure error status: {str(update_error)}")
            else:
                logger.error("Could not update figure status because figure_id is None")
            
            # Add error response instead of raising the exception
            responses.append(CreateFigureResponse(
                success=False,
                figure_id=figure_id,
                error=str(e),
                message=figure.message
            ))
    
    total_time = time.perf_counter() - start_time
    logger.info(f"Processed {len(figures)} figures in {total_time:.2f} seconds")
    return responses

async def create_figure(wrapper: RunContextWrapper[Documents], figure: Figure) -> CreateFigureResponse:
    """Generates a figure object given the latex code that will produce the figure. This tool is ONLY for LaTeX/TikZ code, NOT for Python/matplotlib code.
    
    Make sure not to add the title to the plot, as this will be added separately. This will return the number of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure number itself, as this is unknown to the user.

    You can provide either a standalone TikZ picture OR a complete LaTeX document. If you provide a complete document, the tool will extract the TikZ/PGFPlots content automatically.

    Make sure if you have a legend it's not covering any words, or that any words aren't covering other features. The plot should be clean, and organized.

    Args:
        figure: Figure
            title: The title of the figure.
            latex_code: The LaTeX code that will produce the figure.
            references: List of number references that were used.
            message: The message to the user after the figure is created.

    Returns:
        CreateFigureResponse
            success: Whether the figure was created successfully.
            figure_id: The id of the figure.
            error: The error message if the figure was not created successfully.
            message: The message to the user after the figure is created.

    Example TikZ code:
    ```latex
    \\begin{tikzpicture}[scale=0.8]
      % Axes
      \\draw[->] (-3,0) -- (3,0) node[right] {$x$};
      \\draw[->] (0,-1) -- (0,8) node[above] {$y$};
      % Functions
      \\draw[domain=-2.5:2.5, smooth, thick, blue] plot (\\x,{\\x}) node[above right] {$y=x$};
    \\end{tikzpicture}
    ```
    
    Example PGFPlots code:
    ```latex
    \\begin{tikzpicture}
      \\begin{axis}[
        xlabel={$x$},
        ylabel={$y$},
        axis lines=middle
      ]
        \\addplot[domain=-2:2, samples=100, smooth, blue] {x^2};
      \\end{axis}
    \\end{tikzpicture}
    ```
    
    Example 1: Sample weighted graph
    ```
    \\begin{tikzpicture}[scale=0.8]
      % Vertices
      \\node[circle, draw, fill=green!30] (A) at (0,4)  {A};
      \\node[circle, draw, fill=green!30] (B) at (2,6)  {B};
      \\node[circle, draw, fill=green!30] (C) at (2,2)  {C};
      \\node[circle, draw, fill=green!30] (D) at (5,5)  {D};
      \\node[circle, draw, fill=green!30] (E) at (5,1)  {E};
      \\node[circle, draw, fill=green!30] (F) at (7,5)  {F};

      % Edges with weights
      \\draw (A) -- node[above left] {5}  (B);
      \\draw (A) -- node[below left] {2}  (C);
      \\draw (B) -- node[above left] {12} (C);
      \\draw (B) -- node[above]      {7}  (D);
      \\draw (C) -- node[above right]{6}  (D);
      \\draw (C) -- node[above right]{10} (E);
      \\draw (D) -- node[right]      {8}  (E);
      \\draw (D) to[bend left =20]   node[above] {4} (F);
      \\draw (D) to[bend right=20]   node[below] {1} (F);
      \\draw (F) to[loop right]      node[right] {5} (F);
    \\end{tikzpicture}
    ```

    Example 2: Power-law relationship
    ```
    \\begin{tikzpicture}
      \\begin{loglogaxis}[
          xlabel={$x$},
          ylabel={$y$},
          legend pos=south east,
          grid=both,
      ]
        % Data points
        \\addplot[only marks] table[row sep=\\\\]{
          x   y \\\\
          1   2 \\\\
          2   4 \\\\
          4   7.9 \\\\
          8   16.2 \\\\
          16  31.5 \\\\
        };
        \\addlegendentry{Experimental}

        % Best-fit y = 2·x^{1.05}
        \\addplot+[domain=1:16,samples=100]{2*pow(x,1.05)};
        \\addlegendentry{Model $y = 2x^{1.05}$}
      \\end{loglogaxis}
    \\end{tikzpicture}
    ```

    Example 3: Dijkstra pseudo-algorithm
    ```
    \\begin{algorithm}[H]
    \\caption{Dijkstra's shortest-path}
    \\begin{algorithmic}[1]
    \\Require weighted graph $G=(V,E)$, source $s$
    \\Ensure $\\text{dist}[v]$ is the shortest distance from $s$ to every $v\\in V$
    \\State initialize all $\\text{dist}[v] \\gets \\infty$, $\\text{prev}[v] \\gets \\text{null}$
    \\State $\\text{dist}[s] \\gets 0$
    \\State $Q \\gets V$ \\Comment{min-priority queue keyed by $\\text{dist}$}
    \\While{$Q \\neq \\emptyset$}
      \\State $u \\gets$ vertex in $Q$ with smallest $\\text{dist}[u]$
      \\State remove $u$ from $Q$
      \\For{\\textbf{each} neighbor $v$ of $u$}
        \\If{$\\text{dist}[u] + w(u,v) < \\text{dist}[v]$}
          \\State $\\text{dist}[v] \\gets \\text{dist}[u] + w(u,v)$
          \\State $\\text{prev}[v] \\gets u$
          \\State update key of $v$ in $Q$
        \\EndIf
      \\EndFor
    \\EndWhile
    \\end{algorithmic}
    \\end{algorithm}
    ```
    """
    result = await create_figures(wrapper, [figure])
    return result[0]