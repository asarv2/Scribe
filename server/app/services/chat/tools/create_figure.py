# tools/create_figure.py
from agents.tool import function_tool
from agents.run_context import RunContextWrapper
from typing import List
from app.extensions import get_supabase
from app.services.chat.models import Documents
import subprocess, shutil, os, tempfile, hashlib, logging, re

logger = logging.getLogger(__name__)

@function_tool(name_override="create_figure", description_override="Generates a figure object given the latex code that will produce the figure. Make sure not to add the title to the plot, as this will be added seperately. This will return the number of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure number itself, as this is unknown to the user.")
async def create_figure(wrapper: RunContextWrapper[Documents], title: str, latex_code: str, references: List[int] = []) -> str:
    """Generates a figure object given the latex code that will produce the figure. Make sure not to add the title to the plot, as this will be added seperately. This will return the number of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure number itself, as this is unknown to the user.

    Args:
        title: The title of the figure.
        latex_code: The latex code that will produce the figure. Do not add the title to the plot, as this will be added seperately.
        references: List of number references that were used.

    Returns:
        The number of the figure.
    """
    try:
        logger = logging.getLogger(__name__)
        supabase_client = get_supabase()
        
        # get the message id and class id
        message_id = wrapper.context.message_id
        class_id = wrapper.context.class_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first figure that is generating
        figure_response = supabase_client.table('figures').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        figure_id = figure_response.data[0]['id']
        fig_number = wrapper.context.figures.index(figure_id) + 1

        # Create a hash of the latex code and settings for caching
        cache_key = f"{latex_code}"
        code_hash = hashlib.sha256(cache_key.encode()).hexdigest()
        cache_folder = f"cache/figures/{class_id}"
        os.makedirs(cache_folder, exist_ok=True)
        
        # Define paths for different formats
        output_path = os.path.join(cache_folder, f"{code_hash}.svg")
        tex_path = os.path.join(cache_folder, f"{code_hash}.tex")
        
        # Check if we already have this figure cached
        if os.path.exists(output_path) and os.path.exists(tex_path):
            # Upload cached files
            content_type = "image/svg+xml"
            
            # Upload the image file
            with open(output_path, 'rb') as f:
                supabase_client.storage.from_('figures').upload(
                    f"{class_id}/{figure_id}.svg", 
                    f.read(), 
                    {'content-type': content_type}
                )
            
            # Update DB record
            supabase_client.table('figures').update({
                'message': message_id,
                'title': title,
                'code': latex_code,
                'references': references,
                'generation_status': 'complete'
            }).eq('id', figure_id).execute()
            
            return fig_number
        
        # Create a temporary directory for the compilation
        with tempfile.TemporaryDirectory() as tmpdir:
            # Detect what kind of LaTeX code we're dealing with
            has_tikz = "\\begin{tikzpicture}" in latex_code or "\\tikz" in latex_code
            has_pgfplots = "\\begin{axis}" in latex_code
            has_algorithm = "\\begin{algorithm}" in latex_code or "\\begin{algorithmic}" in latex_code
            
            # Create the LaTeX document
            tex_file = os.path.join(tmpdir, "figure.tex")
            with open(tex_file, 'w') as f:
                f.write("\\documentclass[tikz,border=10pt]{standalone}\n")
                
                # Add required packages based on content
                f.write("\\usepackage{tikz}\n")
                f.write("\\usepackage{amsmath,amssymb}\n")
                
                if has_pgfplots:
                    f.write("\\usepackage{pgfplots}\n")
                    f.write("\\pgfplotsset{compat=newest}\n")
                
                # Add TikZ libraries
                f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,calc,decorations.pathreplacing,decorations.markings}\n")
                
                # Add algorithm packages if needed
                if has_algorithm:
                    f.write("\\usepackage{algorithm2e}\n")
                    f.write("\\usepackage{algpseudocode}\n")
                    f.write("\\usepackage{algorithmicx}\n")
                
                f.write("\\begin{document}\n")
                
                # Replace literal \n with actual newlines
                cleaned_latex_code = latex_code.replace('\\n', '\n').replace('\n\n', '\n')
                f.write(cleaned_latex_code)
                
                f.write("\n\\end{document}\n")
            
            try:
                # Compile with pdflatex
                result = subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", tex_file],
                    cwd=tmpdir,
                    capture_output=True,
                    text=True
                )
                
                if result.returncode != 0:
                    logger.error(f"LaTeX compilation failed: {result.stderr}")
                    
                    # Try alternative compilation with more packages
                    logger.info("Attempting alternative LaTeX compilation approach")
                    alt_tex_file = os.path.join(tmpdir, "alt_figure.tex")
                    
                    with open(alt_tex_file, 'w') as f:
                        f.write("\\documentclass{article}\n")
                        f.write("\\usepackage{tikz}\n")
                        f.write("\\usepackage{pgfplots}\n")
                        f.write("\\usepackage{amsmath,amssymb}\n")
                        f.write("\\usepackage{algorithm2e}\n")
                        f.write("\\usepackage{algpseudocode}\n")
                        f.write("\\usepackage{algorithmicx}\n")
                        f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,calc,decorations.pathreplacing,decorations.markings}\n")
                        f.write("\\pgfplotsset{compat=newest}\n")
                        f.write("\\begin{document}\n")
                        f.write(cleaned_latex_code)
                        f.write("\n\\end{document}\n")
                    
                    alt_result = subprocess.run(
                        ["pdflatex", "-interaction=nonstopmode", alt_tex_file],
                        cwd=tmpdir,
                        capture_output=True,
                        text=True
                    )
                    
                    if alt_result.returncode != 0:
                        # If both approaches fail, create a fallback error image
                        raise Exception(f"Failed to compile LaTeX: {alt_result.stderr}")
                    
                    # If alternative compilation succeeded, use that PDF
                    pdf_file = os.path.join(tmpdir, "alt_figure.pdf")
                else:
                    # Use the original PDF if it compiled successfully
                    pdf_file = os.path.join(tmpdir, "figure.pdf")
                
                # Convert PDF to SVG
                svg_file = os.path.join(tmpdir, "figure.svg")
                subprocess.run(
                    ["pdf2svg", pdf_file, svg_file],
                    check=True,
                    capture_output=True
                )
                
                # Copy the files to cache
                shutil.copy(svg_file, output_path)
                shutil.copy(tex_file, tex_path)
                
                # Upload the SVG
                with open(svg_file, "rb") as f:
                    svg_data = f.read()
                    supabase_client.storage.from_('figures').upload(
                        f"{class_id}/{figure_id}.svg", 
                        svg_data, 
                        {'content-type': 'image/svg+xml'}
                    )
                
                # Update DB record
                supabase_client.table('figures').update({
                    'message': message_id,
                    'title': title,
                    'code': latex_code,
                    'references': references,
                    'generation_status': 'complete'
                }).eq('id', figure_id).execute()
                
                return fig_number
                
            except Exception as e:
                logger.error(f"Error in figure generation: {str(e)}")
                
                # Create a fallback error image
                fallback_tex_path = os.path.join(tmpdir, "fallback.tex")
                with open(fallback_tex_path, 'w') as f:
                    f.write("\\documentclass{article}\n")
                    f.write("\\usepackage{tikz}\n")
                    f.write("\\usepackage{amsmath}\n")
                    f.write("\\begin{document}\n")
                    f.write("\\begin{tikzpicture}\n")
                    f.write("\\node[draw, fill=red!10, rounded corners, text width=10cm, align=center, font=\\bfseries] {")
                    f.write(f"Error creating figure: {title}\\\\[0.5cm]")
                    f.write("Please check your LaTeX code and try again.\\\\[0.3cm]")
                    f.write("Common issues:\\\\")
                    f.write("- Missing packages or libraries\\\\")
                    f.write("- Syntax errors in the code\\\\")
                    f.write("- Using unsupported commands")
                    f.write("};\n")
                    f.write("\\end{tikzpicture}\n")
                    f.write("\\end{document}\n")
                
                try:
                    # Try to compile the fallback figure
                    subprocess.run(
                        ["pdflatex", "-interaction=nonstopmode", fallback_tex_path],
                        cwd=tmpdir,
                        check=True,
                        capture_output=True
                    )
                    
                    # Convert to SVG and upload
                    svg_file = os.path.join(tmpdir, "fallback.svg")
                    subprocess.run(
                        ["pdf2svg", f"{tmpdir}/fallback.pdf", svg_file],
                        check=True,
                        capture_output=True
                    )
                    
                    # Upload the fallback image
                    with open(svg_file, "rb") as f:
                        svg_data = f.read()
                        supabase_client.storage.from_('figures').upload(
                            f"{class_id}/{figure_id}.svg", 
                            svg_data, 
                            {'content-type': 'image/svg+xml'}
                        )
                    
                    # Update DB with error status but still mark as complete
                    supabase_client.table('figures').update({
                        'message': message_id,
                        'title': f"{title} (Error)",
                        'code': latex_code,
                        'references': references,
                        'generation_status': 'complete',
                        'generation_error': str(e)
                    }).eq('id', figure_id).execute()
                    
                    return fig_number
                    
                except Exception as fallback_error:
                    # If even the fallback fails, just update the DB with error status
                    logger.error(f"Fallback figure creation failed: {fallback_error}")
                    supabase_client.table('figures').update({
                        "generation_status": "error",
                        "generation_error": str(e)
                    }).eq("id", figure_id).execute()
                    
                    raise e

    except Exception as e:
        logger.error(f"Error in create_figure: {str(e)}")
        # update the figure status to error
        supabase_client.table('figures').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", figure_id).execute()
        
        raise e