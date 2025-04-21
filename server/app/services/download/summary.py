from app.services.download.models import Summary
import os
from pylatex import Document, Section, Command, Package
from pylatex.utils import NoEscape
import re
from app.extensions import SUMMARIES_DIR
import logging

logger = logging.getLogger(__name__)

class SummaryDownloader:
    def __init__(self, summary: Summary):
        self.summary = summary

    def download_text(self):
        """Download summary as text file"""
        name = self.summary['title']
        content = self.summary['preamble'] + "\n\n" + self._clean_content(self.summary['content']) + "\n\n" + self.summary['conclusion']
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.join(SUMMARIES_DIR, self.summary['id']), exist_ok=True)
        
        filename = f"{name}.txt"
        filepath = os.path.join(SUMMARIES_DIR, self.summary['id'], filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
        return filepath

    def download_pdf(self):
        """Download summary as PDF file"""
        name = self.summary['title']
        content = self.summary['preamble'] + "\n\n" + self._clean_content(self.summary['content']) + "\n\n" + self.summary['conclusion']
        
        # Create directory if it doesn't exist
        summary_dir = os.path.join(SUMMARIES_DIR, self.summary['id'])
        os.makedirs(summary_dir, exist_ok=True)
        
        # Create a safe filename for the base filename
        safe_name = re.sub(r'[^\w\-_\. ]', '_', name)
        safe_name = safe_name.replace(' ', '_')
        base_filename = safe_name
        
        success = self.save(summary_dir, content, base_filename, title=self.summary['title'], pdf=True)
        
        if success:
            filepath = os.path.join(summary_dir, f"{base_filename}.pdf")
            # Verify the file exists before returning
            if os.path.exists(filepath):
                return filepath
        return None

    def download_latex(self):
        """Download summary as LaTeX file"""
        name = self.summary['title']
        content = self.summary['preamble'] + "\n\n" + self._clean_content(self.summary['content']) + "\n\n" + self.summary['conclusion']
        
        summary_dir = os.path.join(SUMMARIES_DIR, self.summary['id'])
        os.makedirs(summary_dir, exist_ok=True)
        
        base_filename = name  # Use title as the base filename
        success = self.save(summary_dir, content, base_filename, title=self.summary['title'], pdf=False)
        
        if success:
            return os.path.join(summary_dir, f"{base_filename}.tex")
        return None
    
    def _clean_content(self, content):
        """Remove document tags from content"""

        # filter out any <DOCUMENT></DOCUMENT> tags, and remove spaces around the tags
        content = re.sub(r"\s*<DOCUMENT>.*?</DOCUMENT>\s*", "", content)

        # 1) Convert **bold** to \textbf{...}
        cleaned_content = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", content)

        # 2) Convert bullet lines (* something or - something) into \item lines,
        #    wrapped by itemize environments. We'll do a simple pass:
        lines = cleaned_content.split("\n")
        new_lines = []
        inside_itemize = False

        for line in lines:
            # Does the line start with an asterisk or hyphen and some spacing?
            bullet_match = re.match(r"^\s*[\*\-]\s+(.*)$", line)
            if bullet_match:
                # If we are not already inside an itemize, start one
                if not inside_itemize:
                    new_lines.append(r"\begin{itemize}")
                    inside_itemize = True
                # Convert "* text" or "- text" -> "\item text"
                bullet_text = bullet_match.group(1)
                new_lines.append(r"\item " + bullet_text)
            else:
                # If we were inside an itemize block and we see a non-bullet line,
                # close out the itemize before continuing
                if inside_itemize:
                    new_lines.append(r"\end{itemize}")
                    inside_itemize = False
                new_lines.append(line)

        # If the text ended while we were still inside an itemize, close it
        if inside_itemize:
            new_lines.append(r"\end{itemize}")

        return "\n".join(new_lines)

    def save(self, directory: str, summary: str, base_filename: str, title: str, pdf: bool = True):
        """
        Save processed summary to a LaTeX PDF file using PyLaTeX.
        """
        geometry_options = {
            "margin": "1in",
            "headheight": "14pt",
            "headsep": "25pt"
        }
        doc = Document(geometry_options=geometry_options)
        
        # Add packages
        for pkg in ['hyperref', 'enumitem', 'fancyhdr', 'xcolor', 'url', 'breakurl']:
            doc.packages.append(Package(pkg))

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
            
            % Configure enumeration settings
            \setlist[enumerate,1]{label=\arabic*.}
            \setlist[enumerate,2]{label=\alph*.}
            \setlist[enumerate,3]{label=\Alph*.}
            \setlist[enumerate]{itemsep=0.5em}
            
            % Define a command for red text
            \newcommand{\incorrect}[1]{\textcolor{red}{#1}}
        '''))
        doc.preamble.append(Command('lhead', f'{title}'))
        
        # Title
        doc.preamble.append(Command('title', f'{title}'))
        doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
        doc.preamble.append(Command('date', NoEscape(r'\today')))
        doc.append(NoEscape(r'\maketitle'))

        # Questions Section
        with doc.create(Section('Summary')):
            doc.append(NoEscape(summary))

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
                # Clean up the .tex file if successful
                if os.path.exists(f"{filepath}.tex"):
                    os.remove(f"{filepath}.tex")
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
            doc.generate_tex(filepath)
            return True
