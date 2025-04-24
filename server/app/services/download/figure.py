from app.services.download.models import Figure
import os
from pylatex import Document, Section, Command, Package
from pylatex.utils import NoEscape
import re
from app.extensions import FIGURES_DIR
import logging
import zipfile
from io import BytesIO
import httpx

logger = logging.getLogger(__name__)

class FigureDownloader:
    def __init__(self, figures):
        # Now accepts a list of figures instead of a single figure
        self.figures = figures if isinstance(figures, list) else [figures]

    def download_latex(self, chat_title=None):
        """Download multiple figures as a single LaTeX file
        
        Uses chat title for naming if provided, otherwise uses figure titles
        """
        # Use the first figure's ID for the directory
        first_figure_id = self.figures[0]['id']
        figure_dir = os.path.join(FIGURES_DIR, first_figure_id)
        os.makedirs(figure_dir, exist_ok=True)
        
        # Create a base filename from chat title, first figure, or use "combined_figures"
        if chat_title:
            name = chat_title
        elif len(self.figures) == 1:
            name = self.figures[0]['title']
        else:
            name = f"Combined_Figures_{len(self.figures)}"
        
        # Create a safe filename
        safe_name = re.sub(r'[^\w\-_\. ]', '_', name)
        safe_name = safe_name.replace(' ', '_')
        base_filename = safe_name
        
        # Combine all figure codes
        combined_code = ""
        for i, figure in enumerate(self.figures):
            if i > 0:
                combined_code += "\n\\newpage\n"
            combined_code += f"\\subsection{{{figure['title']}}}\n"
            combined_code += figure['code']
        
        # Create the LaTeX document
        success = self.save_latex(figure_dir, combined_code, base_filename, title=name)
        
        if success:
            return os.path.join(figure_dir, f"{base_filename}.tex"), f"{base_filename}.tex"
        return None, None
    
    def download_pdf(self, chat_title=None):
        """Download multiple figures as a single PDF file
        
        Uses chat title for naming if provided, otherwise uses figure titles
        """
        # Use the first figure's ID for the directory
        first_figure_id = self.figures[0]['id']
        figure_dir = os.path.join(FIGURES_DIR, first_figure_id)
        os.makedirs(figure_dir, exist_ok=True)
        
        # Create a base filename from chat title, first figure, or use "combined_figures"
        if chat_title:
            name = chat_title
        elif len(self.figures) == 1:
            name = self.figures[0]['title']
        else:
            name = f"Combined_Figures_{len(self.figures)}"
        
        # Create a safe filename
        safe_name = re.sub(r'[^\w\-_\. ]', '_', name)
        safe_name = safe_name.replace(' ', '_')
        base_filename = safe_name
        
        # Combine all figure codes
        combined_code = ""
        for i, figure in enumerate(self.figures):
            if i > 0:
                combined_code += "\n\\newpage\n"
            combined_code += f"\\subsection{{{figure['title']}}}\n"
            combined_code += figure['code']
        
        # Create the LaTeX document and compile to PDF
        success = self.save_latex(figure_dir, combined_code, base_filename, title=name, pdf=True)
        
        if success:
            return os.path.join(figure_dir, f"{base_filename}.pdf"), f"{base_filename}.pdf"
        return None, None
    
    async def create_png_zip(self, class_id, chat_id=None, chat_title=None):
        """Create a zip file containing PNG images for all figures
        
        Uses chat title for naming if provided, otherwise uses figure titles
        """
        if not self.figures:
            return None
            
        # Create a BytesIO object to store the zip file
        zip_buffer = BytesIO()
        
        # Determine zip filename based on chat title or figures
        if chat_title:
            # Use chat title for the zip filename
            safe_chat_title = re.sub(r'[^\w\-_\. ]', '_', chat_title)
            safe_chat_title = safe_chat_title.replace(' ', '_')
            zip_filename = f"{safe_chat_title}_figures.zip"
        elif len(self.figures) == 1:
            # Use single figure title
            safe_name = re.sub(r'[^\w\-_\. ]', '_', self.figures[0]['title'])
            safe_name = safe_name.replace(' ', '_')
            zip_filename = f"{safe_name}.zip"
        else:
            # Default for multiple figures
            zip_filename = f"figures_{len(self.figures)}.zip"
        
        # Create a zip file
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            async with httpx.AsyncClient() as client:
                for figure in self.figures:
                    figure_id = figure['id']
                    title = figure['title']
                    
                    # Create a safe filename
                    safe_name = re.sub(r'[^\w\-_\. ]', '_', title)
                    safe_name = safe_name.replace(' ', '_')
                    filename = f"{safe_name}.png"
                    
                    # Construct the storage URL
                    storage_url = f"https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/figures/{class_id}/{figure_id}.png"
                    
                    try:
                        # Fetch the PNG from storage
                        response = await client.get(storage_url)
                        if response.status_code == 200:
                            # Add the PNG to the zip file
                            zip_file.writestr(filename, response.content)
                        else:
                            logger.error(f"Failed to fetch PNG for figure {figure_id}: {response.status_code}")
                    except Exception as e:
                        logger.error(f"Error fetching PNG for figure {figure_id}: {str(e)}")
        
        # Reset the buffer position to the beginning
        zip_buffer.seek(0)
        
        # Create a temporary file to store the zip
        first_figure_id = self.figures[0]['id']
        figure_dir = os.path.join(FIGURES_DIR, first_figure_id)
        os.makedirs(figure_dir, exist_ok=True)
        
        zip_path = os.path.join(figure_dir, zip_filename)
        
        # Write the zip file to disk
        with open(zip_path, 'wb') as f:
            f.write(zip_buffer.getvalue())
        
        return zip_path, zip_filename
    
    def save_latex(self, directory: str, code: str, base_filename: str, title: str, pdf=False):
        """
        Save figure code to a LaTeX file and optionally compile to PDF.
        """
        geometry_options = {
            "margin": "1in",
            "headheight": "14pt",
            "headsep": "25pt"
        }
        doc = Document(geometry_options=geometry_options)
        
        # Add packages
        for pkg in ['hyperref', 'fancyhdr', 'xcolor', 'graphicx', 'tikz', 'pgfplots']:
            doc.packages.append(Package(pkg))
        
        # Add any additional packages that might be needed for the figure
        doc.packages.append(Package('amsmath'))
        doc.packages.append(Package('amssymb'))
        
        doc.preamble.append(NoEscape(r'''
            \hypersetup{
                colorlinks=true,
                linkcolor=blue,
                filecolor=magenta,
                urlcolor=blue
            }
            \pagestyle{fancy}
            \fancyhf{}
            \rhead{Generated on \today}
            \cfoot{\thepage}
            
            % PGFPlots settings
            \pgfplotsset{compat=newest}
            \usetikzlibrary{patterns,arrows,decorations.pathreplacing}
        '''))
        doc.preamble.append(Command('lhead', f'{title}'))
        
        # Title
        doc.preamble.append(Command('title', f'{title}'))
        doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
        doc.preamble.append(Command('date', NoEscape(r'\today')))
        doc.append(NoEscape(r'\maketitle'))

        # Figure Section
        with doc.create(Section('Figures')):
            doc.append(NoEscape(code))

        # Create a valid filename by removing invalid characters
        safe_filename = re.sub(r'[^\w\-_\. ]', '_', base_filename)
        # Replace spaces with underscores
        safe_filename = safe_filename.replace(' ', '_')
        
        # Full path to the output file (without extension)
        filepath = os.path.join(directory, safe_filename)

        if pdf:
            log_dir = os.path.join(directory, "_logs")
            os.makedirs(log_dir, exist_ok=True)
            
            try:
                # Generate PDF with logs in separate directory
                doc.generate_pdf(
                    filepath,
                    clean_tex=False,
                    compiler='latexmk',
                    compiler_args=[
                        '-pdf',
                        '-interaction=nonstopmode',
                        '-file-line-error',
                        '-shell-escape',
                        '-8bit',
                        # Separate auxiliary files into logs directory
                        f'-aux-directory={log_dir}',
                        '-recorder',
                        '-verbose'
                    ]
                )
                
                # Handle log files
                log_extensions = ['.log', '.aux', '.out', '.fls']
                for ext in log_extensions:
                    src_file = os.path.join(log_dir, f"{safe_filename}{ext}")
                    if os.path.exists(src_file):
                        # Display log content for debugging
                        if ext == '.log':
                            logger.info(f"\nContents of log file:")
                            with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                                lines = f.readlines()
                                logger.info("..." if len(lines) > 50 else "")
                                for line in lines[-50:]:
                                    if "!" in line or "Error" in line or "Warning" in line:
                                        logger.error(f"ERROR/WARNING: {line.strip()}")
                
                logger.info(f"PDF generated successfully: {filepath}.pdf")
                return True

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Error during compilation: {error_msg}")
                
                # Error analysis and log display
                if "! LaTeX Error:" in error_msg:
                    latex_error = re.search(r'! LaTeX Error:(.*?)\n', error_msg)
                    if latex_error:
                        logger.error(f"LaTeX Error: {latex_error.group(1).strip()}")
                elif "! Package" in error_msg:
                    package_error = re.search(r'! Package (.*?) Error:(.*?)\n', error_msg)
                    if package_error:
                        logger.error(f"Package {package_error.group(1)} Error: {package_error.group(2).strip()}")
                elif "! Missing" in error_msg:
                    missing_error = re.search(r'! Missing (.*?) inserted', error_msg)
                    if missing_error:
                        logger.error(f"Missing character error: {missing_error.group(1)}")
                
                # Check log files in the log directory
                for ext in ['.log', '.aux', '.out']:
                    log_file = os.path.join(log_dir, f"{safe_filename}{ext}")
                    if os.path.exists(log_file):
                        logger.error(f"\nContents of {log_file}:")
                        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                            for line in f:
                                if any(marker in line for marker in ["!", "Error", "Warning"]):
                                    logger.error(line.strip())
                return False
        else:
            try:
                # Generate LaTeX file
                doc.generate_tex(filepath)
                logger.info(f"LaTeX file generated successfully: {filepath}.tex")
                return True
            except Exception as e:
                logger.error(f"Error generating LaTeX file: {str(e)}")
                return False

