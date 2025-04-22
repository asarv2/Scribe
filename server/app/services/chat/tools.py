# creating the tools
from typing import List, Tuple, Union
from agents import function_tool, RunContextWrapper
from app.services.chat.models import MultipleChoiceQuestion, FreeResponseQuestion, Documents, clean_references
from app.extensions import get_supabase
import logging

logger = logging.getLogger(__name__)

@function_tool
async def update_chat_title(wrapper: RunContextWrapper[Documents], title: str) -> str:
    """Update the chat title. Will return a True as boolean if it was able to sucessfully update the chat title and the string will contain the id of the updated chat title. If unsuccessful, the boolean will be false adn the string will contain the error message.

    Args:
        title: The title of the chat.
    """
    try:
        supabase_client = get_supabase()
        # get the chat id
        chat_id = wrapper.context.chat_id
        
        # update the chat title
        chat_response = supabase_client.table('chats').update({"name": title}).eq("id", chat_id).execute()
        logger.info(f"Chat Response: {chat_response}")  # Fixed logging statement
        return chat_response.data[0]['name']
    except Exception as e:
        raise e


@function_tool
async def create_figure_matplotlib(wrapper: RunContextWrapper[Documents], title: str, python_code: str, references: List[int]) -> int:
    """Generates a figure object given the python code that will produce the figure. Make sure not to add the title to the plot, as this will be added seperately. This will return the number of the figure, which will then be replaced by the actual figure of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the figure number itself, as this is unknown to the user.

    The following imports are available:
    - import io
    - import matplotlib.pyplot as plt
    - import scipy
    - import networkx as nx (also available as 'x')
    - import numpy as np
    - import seaborn as sns
    - import pandas as pd
    - import matplotlib.colors as mcolors

    Args:
        title: The title of the figure.
        python_code: The python code that will produce the figure. Do not add the title to the plot, as this will be added seperately.
        references: List of number references that were used.

    Returns:
        The number of the figure.
    """
    # 0. Import and set up non-interactive backend *before* pyplot
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import io, os, subprocess, hashlib, tempfile, logging
    import scipy
    import networkx as nx
    import numpy as np
    import seaborn as sns
    import pandas as pd
    import matplotlib.colors as mcolors

    logger = logging.getLogger(__name__)
    
    try:
        # Supabase client and context
        supabase = get_supabase()
        class_id = wrapper.context.class_id
        message_id = wrapper.context.message_id

        # Resolve references
        refs = [wrapper.context.references.get(r) for r in references]
        refs = [r for r in refs if r]

        # Find pending figure record
        fig_rec = (
            supabase.table('figures')
            .select('id')
            .eq('generation_status', 'generating')
            .eq('message', message_id)
            .order('created_at', desc=True)
            .limit(1)
            .execute().data[0]
        )
        fig_id = fig_rec['id']
        fig_number = wrapper.context.figures.index(fig_id) + 1

        # Clear previous plots
        plt.close('all')

        # RC settings for LaTeX - Modified to handle font availability
        try:
            # First attempt with full LaTeX setup
            plt.rcParams.update({
                'text.usetex': True,
                'font.family': 'serif',
                'font.serif': ['Computer Modern Roman'],
                'pgf.preamble': r"\usepackage[T1]{fontenc} \usepackage{unicode-math}"
            })
            
            # Test if LaTeX works by creating a simple text
            plt.figure()
            plt.text(0.5, 0.5, r'$\alpha$')
            plt.close()
            
        except Exception as font_error:
            logger.warning(f"LaTeX setup failed: {font_error}. Falling back to standard fonts.")
            # Fallback to non-LaTeX rendering
            plt.rcParams.update({
                'text.usetex': False,
                'font.family': 'sans-serif',
            })

        # Create fresh figure
        fig = plt.figure(figsize=(5.5, 3.5))
        # Controlled exec namespace with essential builtins
        builtins_dict = {
            '__import__': __import__,
            'len': len,
            'range': range,
            'zip': zip,
            'list': list,
            'dict': dict,
            'tuple': tuple,
            'set': set,
            'int': int,
            'float': float,
            'str': str,
            'bool': bool,
            'min': min,
            'max': max,
            'sum': sum,
            'abs': abs,
            'round': round
        }
        
        namespace = {
            '__builtins__': builtins_dict,
            'plt': plt, 'np': np, 'scipy': scipy,
            'nx': nx, 'x': nx, 'sns': sns,
            'pd': pd, 'mcolors': mcolors,
            'figure': fig,
        }

        # Execute user code
        exec(python_code, namespace)
        current_fig = plt.gcf()
        plt.tight_layout()

        # Ensure there's plotted content
        has_content = any(
            ax.lines or ax.collections or ax.patches or ax.images or ax.texts
            for ax in current_fig.axes
        )
        if not has_content:
            plt.close('all')
            supabase.table('figures').update({
                'generation_status': 'error',
                'generation_error': 'Figure has no plotted content'
            }).eq('id', fig_id).execute()
            raise Exception('Figure has no plotted content')

        # --- Caching: skip regen if same code hash exists ---
        code_hash = hashlib.sha256(python_code.encode()).hexdigest()
        cache_folder = f"cache/figures/{class_id}"
        os.makedirs(cache_folder, exist_ok=True)
        png_path = os.path.join(cache_folder, f"{code_hash}.png")
        tex_path = os.path.join(cache_folder, f"{code_hash}.tex")
        if os.path.exists(png_path) and os.path.exists(tex_path):
            # Upload cached files
            supabase.storage.from_('figures').upload(f"{class_id}/{fig_id}.png", open(png_path,'rb').read(), {'content-type':'image/png'})
            supabase.storage.from_('figures').upload(f"{class_id}/{fig_id}.tex", open(tex_path,'rb').read(), {'content-type':'application/x-tex'})
        else:
            # 1) Save PNG
            buf = io.BytesIO()
            current_fig.savefig(buf, format='png', bbox_inches='tight', dpi=300)
            buf.seek(0)
            with open(png_path, 'wb') as f: f.write(buf.getvalue())
            supabase.storage.from_('figures').upload(f"{class_id}/{fig_id}.png", buf.getvalue(), {'content-type':'image/png'})

            # 2) Generate LaTeX
            tikz_content = None
            
            # 2a) Primary: network2tikz for any graph
            try:
                for v in namespace.values():
                    if isinstance(v, (nx.Graph, nx.DiGraph)):
                        from network2tikz import plot
                        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.tex')
                        plot(v, filename=tmp.name, edge_weights=True, edge_labels=True, pos=namespace.get('pos', None))
                        tikz_content = open(tmp.name).read()
                        os.unlink(tmp.name)
                        logger.info("Successfully generated graph using network2tikz")
                        break
                if not tikz_content:
                    raise Exception("No graph found in namespace")
            except Exception as e3:
                logger.warning(f"network2tikz attempt failed: {e3}")
                
                # 2b) Secondary: tikzplotlib
                try:
                    import tikzplotlib
                    kod = tikzplotlib.get_tikz_code(
                        figure=current_fig,
                        axis_width='\\linewidth',
                        strict=True,
                        externalize_tables=True
                    )
                    tikz_content = kod
                    logger.info("Successfully generated tikz using tikzplotlib")
                except Exception as e2:
                    logger.warning(f"tikzplotlib attempt failed: {e2}")
                    
                    # 2c) Tertiary: PGF backend
                    try:
                        pgf_buf = io.StringIO()
                        current_fig.savefig(pgf_buf, format='pgf')
                        tikz_content = pgf_buf.getvalue()
                        logger.info("Successfully generated pgf using matplotlib pgf backend")
                    except Exception as e:
                        logger.warning(f"PGF backend attempt failed: {e}")

            if tikz_content:
                with open(tex_path, 'w') as f: f.write(tikz_content)
                supabase.storage.from_('figures').upload(f"{class_id}/{fig_id}.tex", tikz_content.encode(), {'content-type':'application/x-tex'})

        # Clean up plotting state
        plt.close('all')

        # Update DB record
        update = {
            'message': message_id,
            'title': title,
            'code': python_code,
            'references': refs,
            'generation_status': 'complete'
        }
        supabase.table('figures').update(update).eq('id', fig_id).execute()
        return fig_number

    except Exception as e:
        plt.close('all')
        supabase.table('figures').update({'generation_status':'error','generation_error':str(e)}).eq('id', fig_id).execute()
        raise



@function_tool
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
        # Import subprocess at the beginning of the function to ensure it's available in all scopes
        import subprocess, shutil, os, tempfile, hashlib, logging
        from pylatex import Document, Package, NoEscape
        
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
            
            # Upload the LaTeX source
            supabase_client.storage.from_('figures').upload(
                f"{class_id}/{figure_id}.tex", 
                open(tex_path, 'rb').read(), 
                {'content-type': 'application/x-tex'}
            )
        else:
            # We need to render the LaTeX code to an image
            with tempfile.TemporaryDirectory() as tmpdir:
                # Extract just the TikZ content if full LaTeX document is provided
                if '\\documentclass' in latex_code and '\\begin{document}' in latex_code:
                    # Extract just the tikzpicture environment
                    import re
                    tikz_match = re.search(r'\\begin{tikzpicture}(.*?)\\end{tikzpicture}', latex_code, re.DOTALL)
                    if tikz_match:
                        latex_code = tikz_match.group(0)
                        logger.info(f"Extracted TikZ content: {latex_code}")
                
                # Create a standalone document
                doc_options = ['tikz', 'border=10pt']
                doc_options.append('transparent')
                
                doc = Document(documentclass='standalone', document_options=doc_options)
                
                # Add necessary packages
                doc.packages.append(Package('tikz'))
                doc.packages.append(Package('amsmath'))
                doc.packages.append(Package('amssymb'))
                
                # Add any additional TikZ libraries that might be needed
                if '\\usetikzlibrary' not in latex_code:
                    # Add common TikZ libraries that might be needed
                    doc.preamble.append(NoEscape('\\usetikzlibrary{arrows.meta,positioning,shapes,calc,decorations.pathreplacing,decorations.markings}'))
                
                # Add the TikZ code to the document
                doc.append(NoEscape(latex_code))
                
                # Generate the PDF
                pdf_filename = os.path.join(tmpdir, "figure")
                try:
                    # Save the raw tex file for debugging
                    doc.generate_tex(pdf_filename)
                    
                    # Log the generated tex file content
                    with open(f"{pdf_filename}.tex", 'r') as f:
                        logger.info(f"Generated TeX file:\n{f.read()}")
                    
                    # Try to compile with pdflatex directly first
                    try:
                        subprocess.run(
                            ["pdflatex", "-interaction=nonstopmode", f"{pdf_filename}.tex"],
                            cwd=tmpdir,
                            check=True,
                            capture_output=True
                        )
                        logger.info("Successfully compiled with pdflatex")
                    except subprocess.CalledProcessError as e:
                        logger.warning(f"pdflatex failed: {e.stderr.decode('utf-8', errors='ignore')}")
                        # Fall back to PyLaTeX's method
                        doc.generate_pdf(pdf_filename, clean_tex=False)
                    
                    # Save the LaTeX code to cache
                    with open(tex_path, "w") as f:
                        f.write(latex_code)
                    
                    # Try to convert PDF to SVG using pdf2svg (system tool)
                    svg_file = os.path.join(tmpdir, "figure.svg")
                    try:
                        # First check if pdf2svg is installed
                        subprocess.run(["which", "pdf2svg"], check=True, capture_output=True)
                        
                        # Convert PDF to SVG
                        subprocess.run(
                            ["pdf2svg", f"{pdf_filename}.pdf", svg_file],
                            check=True,
                            capture_output=True
                        )
                        
                        # Save to cache and upload
                        shutil.copy(svg_file, output_path)
                        with open(svg_file, "rb") as f:
                            svg_data = f.read()
                            supabase_client.storage.from_('figures').upload(
                                f"{class_id}/{figure_id}.svg", 
                                svg_data, 
                                {'content-type': 'image/svg+xml'}
                            )
                        logger.info("Successfully converted PDF to SVG using pdf2svg")
                    except subprocess.CalledProcessError:
                        # If pdf2svg is not available, use a pure Python approach with matplotlib
                        logger.warning("pdf2svg not available, using matplotlib for conversion")
                        
                        # Use pdf2image to convert PDF to PNG
                        from pdf2image import convert_from_path
                        png_file = os.path.join(tmpdir, "figure.png")
                        images = convert_from_path(f"{pdf_filename}.pdf", dpi=300)
                        if images:
                            # Save PNG with transparency
                            images[0].save(png_file, "PNG")
                            
                            # Use matplotlib to convert PNG to SVG
                            import matplotlib.pyplot as plt
                            from matplotlib import image
                            
                            # Read the image
                            img = image.imread(png_file)
                            
                            # Create figure with transparent background
                            fig = plt.figure(figsize=(10, 10), frameon=False)
                            ax = plt.Axes(fig, [0., 0., 1., 1.])
                            ax.set_axis_off()
                            fig.add_axes(ax)
                            
                            # Display the image
                            ax.imshow(img)
                            
                            # Save as SVG
                            plt.savefig(svg_file, format='svg', transparent=True, bbox_inches='tight', pad_inches=0)
                            plt.close()
                            
                            # Save to cache and upload
                            shutil.copy(svg_file, output_path)
                            with open(svg_file, "rb") as f:
                                svg_data = f.read()
                                supabase_client.storage.from_('figures').upload(
                                    f"{class_id}/{figure_id}.svg", 
                                    svg_data, 
                                    {'content-type': 'image/svg+xml'}
                                )
                            logger.info("Successfully converted PDF to SVG using matplotlib")
                        else:
                            raise Exception("Failed to convert PDF to PNG")
                except Exception as e:
                    # Check if the .log file exists to get more detailed error information
                    log_file = f"{pdf_filename}.log"
                    if os.path.exists(log_file):
                        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                            log_content = f.read()
                            logger.error(f"LaTeX compilation log:\n{log_content}")
                    
                    # Try a simpler approach with direct file writing and compilation
                    try:
                        logger.info("Attempting alternative LaTeX compilation approach")
                        simple_tex_path = os.path.join(tmpdir, "simple_figure.tex")
                        
                        # Create a minimal standalone document
                        with open(simple_tex_path, 'w') as f:
                            f.write("\\documentclass[tikz,border=10pt,transparent]{standalone}\n")
                            f.write("\\usepackage{tikz}\n")
                            f.write("\\usepackage{amsmath,amssymb}\n")
                            f.write("\\usetikzlibrary{arrows.meta,positioning,shapes,calc}\n")
                            f.write("\\begin{document}\n")
                            f.write(latex_code)
                            f.write("\\end{document}\n")
                        
                        # Compile with pdflatex
                        result = subprocess.run(
                            ["pdflatex", "-interaction=nonstopmode", simple_tex_path],
                            cwd=tmpdir,
                            capture_output=True,
                            text=True
                        )
                        
                        if result.returncode == 0:
                            logger.info("Alternative compilation succeeded")
                            # Handle different output formats similar to above
                            # ... (similar conversion code as above)
                            
                            # Skip the original error
                            raise Exception("Used alternative compilation method")
                        else:
                            logger.error(f"Alternative compilation failed: {result.stderr}")
                    except Exception as alt_e:
                        if str(alt_e) == "Used alternative compilation method":
                            # This is our success signal
                            pass
                        else:
                            logger.error(f"Alternative approach failed: {alt_e}")
                            # Continue with the original error
                            raise Exception(f"Failed to compile LaTeX: {str(e)}")
                    
                    # If we get here with the original error, raise it
                    if str(e) != "Used alternative compilation method":
                        raise Exception(f"Failed to compile LaTeX: {str(e)}")

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
        logger.error(f"Error in create_figure_latex: {str(e)}")
        # update the figure status to error
        supabase_client.table('figures').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", figure_id).execute()

        raise e

@function_tool
async def create_summary(wrapper: RunContextWrapper[Documents], title: str, preamble: str, body: str, conclusion: str, references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a summary object given the preamble, body, and conclusion. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool.

    To include document references in the summary, you should use [x], where x is the reference number. This helps to leave the user with a reference to the document that they can click on to view the document.

    You should aim to output in inline LaTeX, as this will be easier for the user to read. Moreover, you can use markdown bullet points to make the summary more readable.

    This function will return the id of the summary, which will then be replaced by the actual summary of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the summary id itself, as this is unknown to the user. 

    Args:
        title: The title of the summary.
        preamble: The preamble of the summary.
        body: The body of the summary.
        conclusion: The conclusion of the summary.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given summary.

    Example Summary:
    Title: Simplex Method Summary
    Preamble: This summary explores the simplex method and its variants for solving linear programming problems, emphasizing both the algorithmic process and the underlying mathematical structure.
    Body:
        - The simplex method iteratively moves from one vertex of the feasible region to another, improving the objective function value at each step until the optimal solution is found.\n"
        - **Basic Variables/Basic Feasible Solution**: Basic variables define a vertex of the feasible region; setting non-basic variables to zero yields a basic feasible solution.\n"
        - **Slack Variable**: Slack variables convert inequality constraints into equality constraints, enabling the use of matrix methods.\n"
        - **Feasible Region**: The feasible region is the set of all points satisfying all constraints of the linear program; it is typically a convex polytope.\n"
        - **Optimal Dictionary**: The optimal dictionary expresses basic variables in terms of non-basic variables and provides the optimal objective function value.\n"
        - **Reduced Costs**: Reduced costs represent the change in the objective function value per unit increase in a non-basic variable; non-negativity is necessary and sufficient for optimality.\n"
        - **Visualization**: See Figure 1 for a geometric illustration of the simplex method traversing the vertices of a feasible region.\n"
    Conclusion: The simplex method and its variants, including the network simplex method, provide efficient algorithms for solving large-scale linear programs by leveraging the structure of the feasible region and the properties of basic feasible solutions.\n"
    Figures: [create_figure: A 2D plot showing the feasible region of a linear program as a polygon, with arrows indicating the path taken by the simplex method from vertex to vertex toward the optimal solution.]\n"

    Returns:
        The id of the summary.

    Remember, do not repeat the summary in a message after this tool is run, as this will be confusing to the user.
    """
    try:
        supabase_client = get_supabase()
        
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first summary that is generating
        summary_response = supabase_client.table('summaries').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        summary_id = summary_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]
        
        # Apply replacements to all text sections
        preamble = clean_references(preamble, wrapper.context.references)
        body = clean_references(body, wrapper.context.references)
        conclusion = clean_references(conclusion, wrapper.context.references)
        
        # Update the summary into the database
        summary_update_response = supabase_client.table('summaries').update({
            "title": title,
            "preamble": preamble,
            "body": body,
            "conclusion": conclusion,
            "references": references,
            "figures": figure_ids,
            "generation_status": "complete"
        }).eq("id", summary_id).execute()
        
        # Extract the summary ID from the response
        if not (summary_update_response.data and len(summary_update_response.data) > 0):
            raise Exception("Failed to update summary: No ID returned from database")
        
        return summary_id
            
    except Exception as e:
        # update the summary into the database
        summary_update_response = supabase_client.table('summaries').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", summary_id).execute()

        raise e

@function_tool
async def create_mcq_question(wrapper: RunContextWrapper[Documents], title: str = "", question: str = "", options: List[str] = [], explanations: List[str] = [], answer: str = "", references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a question object given the MCQ question. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool. 
    
    This function will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Remember, do not repeat the question in a message after this tool is run, as this will be confusing to the user.

    Args:
        title: The title of the question.
        question: The question.
        options: List of options for the question.
        explanations: List of explanations for the options.
        answer: The answer to the question.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given question.

    Returns:
        The id of the question.
    """
    try:
        supabase_client = get_supabase()

        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first question that is generating
        question_response = supabase_client.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]
        
        question_data = {
            "title": title,
            "problem": question,
            "options": options,
            "explanations": explanations,
            "answers": [answer],
            "frq": False,
            "figures": figure_ids,
            "references": references,
            "generation_status": "complete"
        }
        
        # Insert the question into the database
        question_update_response = supabase_client.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:

        # update the question into the database
        question_update_response = supabase_client.table('questions').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", question_id).execute()   

        raise e

@function_tool
async def create_frq_question(wrapper: RunContextWrapper[Documents], title: str = "", question: str = "", answer: str = "", references: List[int] = [], figures: List[int] = []) -> str:
    """Generates a question object given the FRQ question. If you need any figures generated via matplotlib beforehand, use the create_figure tool. This will return the number of the figure, which you can pass to this tool. 
    
    This function will return the id of the question, which will then be replaced by the actual question of the object. You should provide a reassuring message after this tool is run, to clarify what was just created. Do not include any references to the question id itself, as this is unknown to the user.

    Args:
        title: The title of the question.
        question: The question.
        answer: The answer to the question.
        references: List of number references that were used.
        figures: List of figure numbers that were generated beforehand, that should be included for the given question.

    Returns:
        The id of the question.
    """
    try:
        supabase_client = get_supabase()
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        # find the first question that is generating
        question_response = supabase_client.table('questions').select('id').eq('generation_status', 'generating').eq('message', message_id).order('created_at', desc=True).execute()
        question_id = question_response.data[0]['id']

        # convert figure numbers to ids
        figure_ids = [wrapper.context.figures[figure_number - 1] for figure_number in figures]

        question_data = {
                "title": title,
                "problem": question,
                "solution": answer,
                "frq": True,
                "figures": figure_ids,
                "references": references,
                "generation_status": "complete"
        }
        
        # Insert the question into the database
        question_update_response = supabase_client.table('questions').update(question_data).eq("id", question_id).execute()

        if not (question_update_response.data and len(question_update_response.data) > 0):
            raise Exception("Failed to update question: No ID returned from database")
        
        return question_id
            
    except Exception as e:

        # update the question into the database
        question_update_response = supabase_client.table('questions').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", question_id).execute()   

        raise e

@function_tool
async def classify_grade_files(wrapper: RunContextWrapper[Documents], prompts: List[Tuple[int, int | None]]) -> List[int]:
    """Used to classify the files into the correct grade category.

    Args:
        prompts: A list of tuples for each grading entry, where the first element is the ID of the assingment to be graded, and the second element is the ID of the rubric to be used for grading, if any. The reference number should be used to find the correct files that are classified as a assingment to be graded or as a rubric.
    Returns:
        The list of the grading entry numbers that were just created.
    """
    try:
        supabase_client = get_supabase()
        # get the message id
        message_id = wrapper.context.message_id
        
        # Get references
        references = [wrapper.context.references.get(ref, None) for ref in references]
        references = [ref for ref in references if ref is not None]

        grades = []
        # create grade entries
        for index, prompt in enumerate(prompts):
            assignment_id, rubric_id = prompt

            file_id = references[assignment_id]
            rubric_id = rubric_id if rubric_id is not None else None

            updates = {
                "file": file_id,
                "message": message_id,
            }
            if rubric_id is not None:
                updates["rubric"] = rubric_id

            grade_response = supabase_client.table('grades').insert(updates).execute()
            grade_id = grade_response.data[0]['id']
            # add the grade id to the context
            wrapper.context.grades.append(grade_id)
            grades.append(index)
        return grades
    except Exception as e:  
        raise e

@function_tool
async def grade_results(wrapper: RunContextWrapper[Documents], grade_entry: int, results: List[Tuple[str, str]]) -> str:
    """Used to display the graded results of a given set of problems, with the results and feedback for each problem. You should aim to make the results have the format of the rubric if specified, otherwise just display the results in a nice format. The feedback should be detailed and specific to the problem, with actionable feedback for the user. 

    Args:
        grade_id: The id of the grading entry to be updated.
        results: A list of tuples for each grading entry, where the first element is the result of the user's work, and the second element is the feedback of the user's work. The length of this array is the number of problems on the assingment, not the number of grading entries.
    Returns:
        The id of the grading entry that was just updated.
    """
    try:
        supabase_client = get_supabase()
        
        # Find the grade id by index
        grade_id = wrapper.context.grades[grade_entry]

        # unpack the results and feedback
        results = [result for result, _ in results]
        feedback = [feedback for _, feedback in results]  

        grade_update_response = supabase_client.table('grades').update({
            "results": results,
            "feedback": feedback,
            "generation_status": "complete"
        }).eq("id", grade_id).execute()

        if not (grade_update_response.data and len(grade_update_response.data) > 0):
            raise Exception("Failed to update grade: No ID returned from database")

        return grade_id
            
    except Exception as e:

        # update the question into the database
        grade_update_response = supabase_client.table('grades').update({
            "generation_status": "error",
            "generation_error": str(e)
        }).eq("id", grade_id).execute()   

        raise e