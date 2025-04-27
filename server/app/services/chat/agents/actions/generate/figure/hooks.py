from agents import AgentHooks, RunContextWrapper, Agent
from typing import List, Optional, Tuple
from app.extensions import get_supabase
from app.services.chat.models.main import Documents, Figure, CreateFigureResponse
import subprocess, shutil, os, tempfile, hashlib, logging, re, time

logger = logging.getLogger(__name__)

class FigureHooks(AgentHooks):

    def __init__(self):
        # Run the check at module load time
        try:
            self.check_external_tools()
            logger.info("External tool check passed")
        except RuntimeError as e:
            logger.error(f"External tool check failed: {str(e)}")
            # We don't want to crash the entire application, but we'll log the error
            # and the function will fail when called

        self.supabase_client = get_supabase()

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

    

    async def on_end(
        self,
        wrapper: RunContextWrapper[Documents],
        agent: Agent[Documents],
        figures: List[Figure],
    ) -> List[CreateFigureResponse]:
        """Generates the figures in supabase and returns the responses to the user."""
        responses = []
        start_time = time.perf_counter()

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
                references = [ref for ref in references if ref is not None]

                logger.info(f"Starting figure generation for title: {title}")
                logger.info(f"LaTeX code: {latex_code}")

                # insert a figure in the database, with the generation status set to generating
                figure_response = self.supabase_client.table('figures').insert({
                    'generation_status': 'generating',
                    'message': message_id,
                    'title': title,
                    'code': latex_code,
                    'references': references
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
                    self.upload_with_retry(
                        'figures', 
                        f"{class_id}/{figure_id}.svg", 
                        svg_output_path, 
                        'image/svg+xml'
                    )
                    
                    # Upload PNG file
                    self.upload_with_retry(
                        'figures', 
                        f"{class_id}/{figure_id}.png", 
                        png_output_path, 
                        'image/png'
                    )
                    
                    # Update DB record
                    try:
                        self.supabase_client.table('figures').update({
                            'generation_status': 'complete'
                        }).eq('id', figure_id).execute()
                        logger.info(f"Updated figure record with cached data")
                    except Exception as update_error:
                        logger.error(f"Failed to update figure record: {str(update_error)}")
                        raise update_error
                    
                    responses.append(CreateFigureResponse(
                        success=True,
                        figure_id=figure_id,
                        error=None
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
                        
                        # Add any additional TikZ libraries that might be needed
                        f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,fit,calc,decorations.pathreplacing,decorations.markings,patterns,angles,quotes}\n")
                        
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
                    latex_result = self.run_cmd(
                        ["latexmk", "-pdf", "-shell-escape", "-interaction=nonstopmode", "figure.tex"],
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
                            
                            f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,fit,calc,decorations.pathreplacing,decorations.markings,patterns,angles,quotes}\n")
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
                            alt_latex_result = self.run_cmd(
                                ["latexmk", "-pdf", "-shell-escape", "-interaction=nonstopmode", "alt_figure.tex"],
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
                            
                            # Create a more helpful error message
                            error_details = latex_error if latex_error else 'Unknown error'
                            alt_error_details = alt_latex_error if alt_latex_error else 'Unknown error'
                            
                            # Extract the most useful part of the error message
                            if 'Undefined control sequence' in error_details or 'Undefined control sequence' in alt_error_details:
                                helpful_msg = "Your LaTeX code contains undefined commands. Check for typos or missing packages."
                            elif 'Missing $' in error_details or 'Missing $' in alt_error_details:
                                helpful_msg = "Your LaTeX code has math mode errors. Ensure all math expressions are properly enclosed in $ symbols."
                            elif 'Missing \\begin' in error_details or 'Missing \\begin' in alt_error_details:
                                helpful_msg = "Your LaTeX code has environment errors. Check that all \\begin{...} have matching \\end{...} tags."
                            elif 'File not found' in error_details or 'File not found' in alt_error_details:
                                helpful_msg = "Your LaTeX code references files that don't exist. Remove external file references."
                            else:
                                helpful_msg = "Check your LaTeX syntax for errors. Provide only the TikZ/PGFPlots content without document class declarations."
                            
                            error_msg = f"Failed to compile LaTeX: {error_details}. {helpful_msg}"
                            logger.error(f"Error in figure generation: {error_msg}")
                            
                            # Update DB with error status
                            self.supabase_client.table('figures').update({
                                "generation_status": "error",
                                "generation_error": error_msg
                            }).eq("id", figure_id).execute()
                            
                            # Add error response instead of raising the exception
                            responses.append(CreateFigureResponse(
                                success=False,
                                figure_id=figure_id,
                                error=error_msg
                            ))
                            continue  # Skip to the next figure since compilation failed
                    
                    # Convert PDF to images
                    convert_start_time = time.perf_counter()
                    svg_file, png_file = self.convert_pdf_to_images(pdf_file, tmpdir)
                    convert_time = time.perf_counter() - convert_start_time
                    logger.info(f"PDF conversion took {convert_time:.2f} seconds")
                    
                    # Check if conversion failed
                    if svg_file is None and png_file is None:
                        error_msg = "Failed to convert PDF to images"
                        logger.error(error_msg)
                        
                        # Update DB with error status
                        self.supabase_client.table('figures').update({
                            "generation_status": "error",
                            "generation_error": error_msg
                        }).eq("id", figure_id).execute()
                        
                        # Add error response
                        responses.append(CreateFigureResponse(
                            success=False,
                            figure_id=figure_id,
                            error=error_msg
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
                        self.upload_with_retry(
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
                        self.upload_with_retry(
                            'figures',
                            f"{class_id}/{figure_id}.png",
                            png_file,
                            'image/png'
                        )
                    else:
                        logger.warning("No PNG file to upload")
                    
                    # Update DB record
                    self.supabase_client.table('figures').update({
                        'generation_status': 'complete'
                    }).eq('id', figure_id).execute()
                    
                    figure_time = time.perf_counter() - figure_start_time
                    logger.info(f"Figure generation completed successfully in {figure_time:.2f} seconds")
                    responses.append(CreateFigureResponse(
                        success=True,
                        figure_id=figure_id,
                        error=None
                    ))
            except Exception as e:
                logger.error(f"Error in create_figures: {str(e)}")
                # update the figure status to error
                if figure_id:
                    try:
                        self.supabase_client = get_supabase()
                        self.supabase_client.table('figures').update({
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
                    error=str(e)
                ))
        
        total_time = time.perf_counter() - start_time
        logger.info(f"Processed {len(figures)} figures in {total_time:.2f} seconds")
        return responses


    def upload_with_retry(self, bucket: str, path_on_bucket: str, local_file: str, mime: str):
        """Helper function to upload a file to Supabase storage with retry logic."""
        try:
            with open(local_file, "rb") as f:
                file_data = f.read()
                self.supabase_client.storage.from_(bucket).upload(
                    path_on_bucket, file_data, {"content-type": mime}
                )
            logger.info(f"Uploaded file to {path_on_bucket}")
        except Exception as upload_error:
            logger.error(f"Error uploading file: {str(upload_error)}")
            # Try to delete if it exists and upload again
            try:
                self.supabase_client.storage.from_(bucket).remove([path_on_bucket])
                self.supabase_client.storage.from_(bucket).upload(
                    path_on_bucket, file_data, {"content-type": mime}
                )
                logger.info(f"Successfully re-uploaded file after deletion")
            except Exception as retry_error:
                logger.error(f"Failed to re-upload file after deletion: {str(retry_error)}")
                raise retry_error

    def run_cmd(self, cmd: List[str], cwd: Optional[str] = None, timeout: int = 60) -> subprocess.CompletedProcess:
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

    def convert_pdf_to_images(self, pdf_file: str, output_dir: str, timeout: int = 30) -> Tuple[Optional[str], Optional[str]]:
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
            pdf2svg_result = self.run_cmd(
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
            pdf2png_result = self.run_cmd(
                ["convert", "-density", "300", "-background", "transparent", pdf_file, png_file],
                timeout=timeout
            )
            logger.info("PDF to PNG conversion successful")
        except Exception as e:
            logger.warning(f"Primary PNG conversion failed: {str(e)}, trying alternative method")
            # Try alternative method
            try:
                pdf2png_alt_result = self.run_cmd(
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
    def check_external_tools(self):
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

