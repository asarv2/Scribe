from app.services.download.models import Summary
import os
from pylatex import Document, Section, Command, Package
from pylatex.utils import NoEscape
import re
from app.extensions import SUMMARIES_DIR
import logging

logger = logging.getLogger(__name__)

class SummaryDownloader:
    def __init__(self, summaries):
        # Can accept either a single summary or a list of summaries
        if isinstance(summaries, list):
            self.summaries = summaries
        else:
            self.summaries = [summaries]
        
        # Create a directory based on the first summary's ID
        self.base_dir = os.path.join(SUMMARIES_DIR, self.summaries[0]['id'])
        os.makedirs(self.base_dir, exist_ok=True)

    def download_text(self, combined_title=None):
        """Download summaries as text file"""
        if not combined_title:
            combined_title = self._get_combined_title()
        
        # Combine all summaries into one text file
        content = ""
        for i, summary in enumerate(self.summaries):
            if i > 0:
                content += "\n\n" + "-" * 50 + "\n\n"
            
            content += f"# {summary['title']}\n\n"
            content += summary['preamble'] + "\n\n" 
            content += self._clean_content(summary['content']) + "\n\n" 
            content += summary['conclusion']
        
        # Create a safe filename
        safe_name = re.sub(r'[^\w\-_\. ]', '_', combined_title)
        safe_name = safe_name.replace(' ', '_')
        filename = f"{safe_name}.txt"
        filepath = os.path.join(self.base_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
        return filepath

    def download_pdf(self, combined_title=None):
        """Download summaries as PDF file"""
        if not combined_title:
            combined_title = self._get_combined_title()
        
        # Create a safe filename
        safe_name = re.sub(r'[^\w\-_\. ]', '_', combined_title)
        safe_name = safe_name.replace(' ', '_')
        
        # Prepare content for each summary
        success = self.save(self.base_dir, self.summaries, safe_name, combined_title, pdf=True)
        
        if success:
            filepath = os.path.join(self.base_dir, f"{safe_name}.pdf")
            # Verify the file exists before returning
            if os.path.exists(filepath):
                return filepath
        return None

    def download_latex(self, combined_title=None):
        """Download summaries as LaTeX file"""
        if not combined_title:
            combined_title = self._get_combined_title()
        
        # Create a safe filename
        safe_name = re.sub(r'[^\w\-_\. ]', '_', combined_title)
        safe_name = safe_name.replace(' ', '_')
        
        success = self.save(self.base_dir, self.summaries, safe_name, combined_title, pdf=False)
        
        if success:
            return os.path.join(self.base_dir, f"{safe_name}.tex")
        return None
    
    def _get_combined_title(self):
        """Generate a combined title from multiple summaries"""
        titles = [summary['title'] for summary in self.summaries]
        
        if len(titles) == 1:
            return titles[0]
        elif len(titles) == 2:
            return f"{titles[0]} and {titles[1]}"
        else:
            return f"{titles[0]}, {titles[1]} and more"
    
    def _clean_content(self, content):
        """Remove document tags from content"""

        # filter out any <DOCUMENT></DOCUMENT> tags, and remove spaces around the tags
        content = re.sub(r"\s*<DOCUMENT>.*?</DOCUMENT>\s*", "", content)

        # filter out any <FIGURE></FIGURE> tags, and remove spaces around the tags
        content = re.sub(r"\s*<FIGURE>.*?</FIGURE>\s*", "", content)

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

    def save(self, directory: str, summaries, base_filename: str, title: str, pdf: bool = True):
        """
        Save processed summaries to a LaTeX PDF file using PyLaTeX.
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

        # Add each summary as a separate section
        for summary in summaries:
            with doc.create(Section(summary['title'])):
                content = summary['preamble'] + "\n\n" + self._clean_content(summary['content']) + "\n\n" + summary['conclusion']
                doc.append(NoEscape(content))

        # Create a valid filename
        safe_filename = re.sub(r'[^\w\-_\. ]', '_', base_filename)
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
