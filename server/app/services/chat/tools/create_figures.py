# tools/create_figure.py
from agents.tool import function_tool, FunctionTool
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models import Documents, Figure, CreateFigureResponse
import subprocess, shutil, os, tempfile, hashlib, logging, re

logger = logging.getLogger(__name__)

async def create_figures(wrapper: RunContextWrapper[Documents], figures: List[Figure]) -> List[CreateFigureResponse]:
    """Generates figure objects given the latex codes that will produce the figure. Make sure not to add the title to the plot, as this will be added seperately. This will return the ids of the figures, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created.

    Args:
        figures: The figures to create. Each figure has a title, latex code, and references.

    Returns:
        A list of CreateFigureResponse objects. Each object will have a success field, which will be true if the figure was created successfully, and false if there was an error. If there was an error, the error field will contain the error message describing the issue. If the figure was created successfully, the figure_id field will contain the id of the figure.
    

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

    # get the message id and class id
    message_id = wrapper.context.message_id
    class_id = wrapper.context.class_id
    logger.info(f"Message ID: {message_id}, Class ID: {class_id}")
    
    for figure in figures:
        try:
            # get the title, latex code, and references
            title = figure.title
            latex_code = figure.latex_code

            # Get references
            references = [wrapper.context.references.get(ref, None) for ref in figure.references]
            references = [ref for ref in references if ref is not None]

            logger.info(f"Starting figure generation for title: {title}")
            logger.info(f"LaTeX code: {latex_code}")
            supabase_client = get_supabase()

            # insert a figure in the database, with the generation status set to generating
            figure_response = supabase_client.table('figures').insert({
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
            cache_key = f"{latex_code}"
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
                try:
                    with open(svg_output_path, 'rb') as f:
                        supabase_client.storage.from_('figures').upload(
                            f"{class_id}/{figure_id}.svg", 
                            f.read(), 
                            {'content-type': 'image/svg+xml'}
                        )
                    logger.info(f"Uploaded cached SVG to {class_id}/{figure_id}.svg")
                except Exception as upload_error:
                    logger.error(f"Error uploading cached SVG: {str(upload_error)}")
                    # Try to delete if it exists and upload again
                    try:
                        supabase_client.storage.from_('figures').remove([f"{class_id}/{figure_id}.svg"])
                        with open(svg_output_path, 'rb') as f2:
                            supabase_client.storage.from_('figures').upload(
                                f"{class_id}/{figure_id}.svg", 
                                f2.read(), 
                                {'content-type': 'image/svg+xml'}
                            )
                        logger.info(f"Successfully re-uploaded cached SVG after deletion")
                    except Exception as retry_error:
                        logger.error(f"Failed to re-upload SVG after deletion: {str(retry_error)}")
                
                # Upload PNG file
                try:
                    with open(png_output_path, 'rb') as f:
                        supabase_client.storage.from_('figures').upload(
                            f"{class_id}/{figure_id}.png", 
                            f.read(), 
                            {'content-type': 'image/png'}
                        )
                    logger.info(f"Uploaded cached PNG to {class_id}/{figure_id}.png")
                except Exception as upload_error:
                    logger.error(f"Error uploading cached PNG: {str(upload_error)}")
                    # Try to delete if it exists and upload again
                    try:
                        supabase_client.storage.from_('figures').remove([f"{class_id}/{figure_id}.png"])
                        with open(png_output_path, 'rb') as f2:
                            supabase_client.storage.from_('figures').upload(
                                f"{class_id}/{figure_id}.png", 
                                f2.read(), 
                                {'content-type': 'image/png'}
                            )
                        logger.info(f"Successfully re-uploaded cached PNG after deletion")
                    except Exception as retry_error:
                        logger.error(f"Failed to re-upload PNG after deletion: {str(retry_error)}")
                
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
                    error=None
                ))
            
            # If not cached, generate the figure
            with tempfile.TemporaryDirectory() as tmpdir:
                logger.info(f"Created temporary directory: {tmpdir}")
                
                # Detect content type
                has_tikz = "\\begin{tikzpicture}" in latex_code
                has_pgfplots = "\\begin{axis}" in latex_code or "\\begin{semilogxaxis}" in latex_code or "\\begin{semilogyaxis}" in latex_code or "\\begin{loglogaxis}" in latex_code
                has_algorithm = "\\begin{algorithm}" in latex_code
                
                logger.info(f"LaTeX content detection: tikz={has_tikz}, pgfplots={has_pgfplots}, algorithm={has_algorithm}")
                
                # Clean the LaTeX code - extract tikzpicture content if needed
                cleaned_latex_code = latex_code
                
                # Extract tikzpicture content if document class is present
                if "\\documentclass" in cleaned_latex_code and has_tikz:
                    logger.info("Extracting tikzpicture content from document")
                    try:
                        # Find the tikzpicture environment
                        tikz_start = cleaned_latex_code.find("\\begin{tikzpicture}")
                        tikz_end = cleaned_latex_code.find("\\end{tikzpicture}") + len("\\end{tikzpicture}")
                        
                        if tikz_start != -1 and tikz_end != -1:
                            # Get just the tikzpicture content
                            tikz_content = cleaned_latex_code[tikz_start:tikz_end]
                            logger.info(f"Extracted tikzpicture content: {tikz_content[:100]}...")
                            cleaned_latex_code = tikz_content
                        else:
                            logger.warning("Could not find tikzpicture environment in the LaTeX code")
                            raise Exception("Could not find tikzpicture environment in your LaTeX code. Please ensure your code contains a complete \\begin{tikzpicture}...\\end{tikzpicture} environment.")
                    except Exception as extract_error:
                        logger.error(f"Error extracting tikzpicture content: {str(extract_error)}")
                        raise Exception(f"Error processing your LaTeX code: {str(extract_error)}. Please provide only the TikZ content without document class declarations.")
                
                # Create the LaTeX document
                tex_file = os.path.join(tmpdir, "figure.tex")
                with open(tex_file, 'w') as f:
                    f.write("\\documentclass[tikz,border=10pt]{standalone}\n")
                    
                    # Add required packages based on content
                    f.write("\\usepackage{tikz}\n")
                    f.write("\\usepackage{amsmath,amssymb}\n")
                    
                    if has_pgfplots:
                        f.write("\\usepackage{pgfplots}\n")
                        f.write("\\pgfplotsset{compat=1.18}\n")
                    
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
                logger.info("Attempting primary LaTeX compilation")
                pdf_file = os.path.join(tmpdir, "figure.pdf")
                latex_result = subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmpdir, tex_file],
                    capture_output=True,
                    text=True
                )
                
                # Save the LaTeX output for debugging
                with open(os.path.join(cache_folder, f"{code_hash}_latex_stdout.log"), 'w') as f:
                    f.write(latex_result.stdout)
                with open(os.path.join(cache_folder, f"{code_hash}_latex_stderr.log"), 'w') as f:
                    f.write(latex_result.stderr)
                
                # Check for LaTeX errors
                error_match = re.search(r'!(.*?)(?=\n\s*\n|\n\s*l\.)', latex_result.stdout, re.DOTALL)
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
                    alt_pdf_file = os.path.join(tmpdir, "alt_figure.pdf")
                    alt_latex_result = subprocess.run(
                        ["pdflatex", "-interaction=nonstopmode", "-output-directory", tmpdir, alt_tex_file],
                        capture_output=True,
                        text=True
                    )
                    
                    # Save the alternative LaTeX output for debugging
                    with open(os.path.join(cache_folder, f"{code_hash}_alt_latex_stdout.log"), 'w') as f:
                        f.write(alt_latex_result.stdout)
                    with open(os.path.join(cache_folder, f"{code_hash}_alt_latex_stderr.log"), 'w') as f:
                        f.write(alt_latex_result.stderr)
                    
                    # Check for alternative LaTeX errors
                    alt_error_match = re.search(r'!(.*?)(?=\n\s*\n|\n\s*l\.)', alt_latex_result.stdout, re.DOTALL)
                    if alt_error_match:
                        alt_latex_error = alt_error_match.group(1).strip()
                        logger.error(f"Alternative LaTeX error message: {alt_latex_error}")
                    
                    if alt_latex_result.returncode != 0 or not os.path.exists(alt_pdf_file):
                        logger.error(f"Alternative LaTeX compilation also failed with return code {alt_latex_result.returncode}")
                        
                        # Create a more helpful error message
                        error_details = latex_error if 'latex_error' in locals() else 'Unknown error'
                        alt_error_details = alt_latex_error if 'alt_latex_error' in locals() else 'Unknown error'
                        
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
                        supabase_client.table('figures').update({
                            "generation_status": "error",
                            "generation_error": error_msg
                        }).eq("id", figure_id).execute()
                        
                        # Add error response instead of raising the exception
                        responses.append(CreateFigureResponse(
                            success=False,
                            figure_id=figure_id,
                            error=error_msg
                        ))
                    
                    # If alternative compilation succeeded, use that PDF
                    pdf_file = alt_pdf_file
                
                # Convert PDF to SVG
                svg_file = os.path.join(tmpdir, "figure.svg")
                logger.info(f"Converting PDF to SVG: {pdf_file} -> {svg_file}")
                pdf2svg_result = subprocess.run(
                    ["pdf2svg", pdf_file, svg_file],
                    capture_output=True,
                    text=True
                )
                
                # Convert PDF to PNG with transparent background
                png_file = os.path.join(tmpdir, "figure.png")
                logger.info(f"Converting PDF to PNG: {pdf_file} -> {png_file}")
                pdf2png_result = subprocess.run(
                    ["convert", "-density", "300", "-background", "transparent", pdf_file, png_file],
                    capture_output=True,
                    text=True
                )
                
                # Check if PNG conversion failed, try alternative method
                if pdf2png_result.returncode != 0 or not os.path.exists(png_file):
                    logger.warning(f"Primary PNG conversion failed, trying alternative method")
                    pdf2png_alt_result = subprocess.run(
                        ["pdftoppm", "-png", "-r", "300", "-transp", pdf_file, os.path.join(tmpdir, "figure")],
                        capture_output=True,
                        text=True
                    )
                    # Find the generated PNG file (pdftoppm adds -1 suffix)
                    png_files = [f for f in os.listdir(tmpdir) if f.startswith("figure-") and f.endswith(".png")]
                    if png_files:
                        shutil.move(os.path.join(tmpdir, png_files[0]), png_file)
                    else:
                        logger.error("Alternative PNG conversion also failed")
                
                # Cache the files
                shutil.copy(tex_file, tex_path)
                if os.path.exists(svg_file):
                    shutil.copy(svg_file, svg_output_path)
                if os.path.exists(png_file):
                    shutil.copy(png_file, png_output_path)
                
                # Upload the SVG file
                if os.path.exists(svg_file):
                    logger.info(f"Uploading SVG to Supabase storage: {class_id}/{figure_id}.svg")
                    try:
                        with open(svg_file, "rb") as f:
                            svg_data = f.read()
                            supabase_client.storage.from_('figures').upload(
                                f"{class_id}/{figure_id}.svg", 
                                svg_data, 
                                {'content-type': 'image/svg+xml'}
                            )
                    except Exception as upload_error:
                        logger.error(f"Error uploading SVG: {str(upload_error)}")
                        # Try to delete if it exists and upload again
                        try:
                            supabase_client.storage.from_('figures').remove([f"{class_id}/{figure_id}.svg"])
                            with open(svg_file, "rb") as f:
                                svg_data = f.read()
                                supabase_client.storage.from_('figures').upload(
                                    f"{class_id}/{figure_id}.svg", 
                                    svg_data, 
                                    {'content-type': 'image/svg+xml'}
                                )
                            logger.info(f"Successfully re-uploaded SVG after deletion")
                        except Exception as retry_error:
                            logger.error(f"Failed to re-upload SVG after deletion: {str(retry_error)}")
                else:
                    logger.error(f"SVG file was not created: {svg_file}")
                
                # Upload the PNG file
                if os.path.exists(png_file):
                    logger.info(f"Uploading PNG to Supabase storage: {class_id}/{figure_id}.png")
                    try:
                        with open(png_file, "rb") as f:
                            png_data = f.read()
                            supabase_client.storage.from_('figures').upload(
                                f"{class_id}/{figure_id}.png", 
                                png_data, 
                                {'content-type': 'image/png'}
                            )
                    except Exception as upload_error:
                        logger.error(f"Error uploading PNG: {str(upload_error)}")
                        # Try to delete if it exists and upload again
                        try:
                            supabase_client.storage.from_('figures').remove([f"{class_id}/{figure_id}.png"])
                            with open(png_file, "rb") as f:
                                png_data = f.read()
                                supabase_client.storage.from_('figures').upload(
                                    f"{class_id}/{figure_id}.png", 
                                    png_data, 
                                    {'content-type': 'image/png'}
                                )
                            logger.info(f"Successfully re-uploaded PNG after deletion")
                        except Exception as retry_error:
                            logger.error(f"Failed to re-upload PNG after deletion: {str(retry_error)}")
                else:
                    logger.error(f"PNG file was not created: {png_file}")
                
                # Update DB record
                supabase_client.table('figures').update({
                    'generation_status': 'complete'
                }).eq('id', figure_id).execute()
                
                logger.info(f"Figure generation completed successfully")
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
                    supabase_client = get_supabase()
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
                error=str(e)
            ))
    return responses
