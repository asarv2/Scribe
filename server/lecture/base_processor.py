# base_processor.py
from datetime import datetime
import re
import os
from pylatex import Document, Section, Subsection, Command, Package
from pylatex.base_classes import Container
from pylatex.utils import NoEscape, bold
from pylatex.base_classes import Environment
from typing import Dict, List
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
import time
from supabase.client import Client, create_client

class BaseProcessor:
    def __init__(self, class_id: str, output_dir: str, regenerate: bool = False):
        '''
        Base class for all processors.
        
        Args:
            class_id: The uuid of the class in supabase, ex: 123e4567-e89b-12d3-a456-426614174000
            
            output_dir: The directory to save the output files.

            regenerate: Whether to regenerate the given files.
            
        Attributes:
            self.supabase: The supabase client.
            self.llm_gemini_pro: The gemini-1.5-pro llm for processing.
            self.llm_gemini_flash: The gemini-2.0-flash-exp llm for processing.
            self.llm_gemini_flash8b: The gemini-1.5-flash8b llm for processing.
            self.class_id: The uuid of the class in supabase, ex: 123e4567-e89b-12d3-a456-426614174000
            self.course_title: The title of the course.
            self.course_code: The code of the course.
            self.output_dir: The directory to save the output files.
            self.regenerate: Whether to regenerate the given files.
            self.course_link: A link to the course, if not a brightspace course, ex: https://www.math.purdue.edu/~yipn/421
            self.brightspace_course_id: The 7 digit id found on the link of the brightspace course URL, ex 1095465
            self.brightspace_course_descriptor: A descriptor for the course, found on the grid view, ex WL.202510.CS24200.LE1.
        '''
        load_dotenv()  # Load environment variables
        
        # creating supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_PRIVATE_KEY")
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.class_id = class_id
        
        # getting class info
        class_info = self.supabase.table("classes").select("*").eq("id", class_id).execute().data[0]
        self.course_title = class_info["title"]
        self.course_code = class_info["class_code"]
        self.course_link = class_info["course_link"]
        self.brightspace_course_id = class_info["brightspace_course_id"]
        self.brightspace_course_descriptor = class_info["brightspace_course_descriptor"]
        
        self.output_dir = output_dir
        os.makedirs(os.path.join(self.output_dir, self.course_code), exist_ok=True)
        self.regenerate = regenerate
        
        self.llm_gemini_pro = ChatGoogleGenerativeAI(
            model='gemini-1.5-pro',
            temperature=0, 
            max_tokens=None, 
            timeout=None, 
            max_retries=2
        )
        
        self.llm_gemini_flash = ChatGoogleGenerativeAI(
            model='gemini-2.0-flash-exp',
            temperature=0, 
            max_tokens=None, 
            timeout=None, 
            max_retries=2
        )
        
        self.llm_gemini_flash8b = ChatGoogleGenerativeAI(
            model='gemini-1.5-flash-8b',
            temperature=0, 
            max_tokens=None, 
            timeout=None, 
            max_retries=2
        )
        
        
        
    def robust_generate(self, message: HumanMessage, retries: int = 5, initial_wait: int = 5) -> str:
        """
        Robust method for generating text with exponential backoff.
        
        Args:
            message: The message to process
            retries: Number of retry attempts
            initial_wait: Initial wait time in seconds
        
        Returns:
            str: Generated text response
        """
        last_error = None
        
        for attempt in range(retries):
            try:
                response = self.llm_gemini_flash.generate([[message]])
                return response.generations[0][0].text
                
            except Exception as e:
                last_error = e
                
                # Check for different types of errors that need retrying
                should_retry = any([
                    "ResourceExhausted" in str(e),
                    "rate_limit" in str(e).lower(),
                    "too many requests" in str(e).lower(),
                    "quota exceeded" in str(e).lower()
                ])
                
                if should_retry and attempt < retries - 1:
                    # Calculate wait time with exponential backoff
                    wait_time = initial_wait * (1.5 ** attempt)
                    print(f"Attempt {attempt + 1}/{retries} failed. Retrying in {wait_time:.1f} seconds...")
                    print(f"Error: {str(e)}")
                    time.sleep(wait_time)
                    continue
                
                # If we're out of retries or it's not a retryable error
                break
        
        # If we get here, all retries failed
        raise RuntimeError(f"Failed after {retries} attempts. Last error: {last_error}")
    
    # Common utility methods
    def format_url_for_latex(self, url: str) -> str:
        """
        Format URL for LaTeX hyperref package.
        """
        # Replace problematic characters in URLs
        url = url.replace('%', '\\%')
        url = url.replace('#', '\\#')
        url = url.replace('&', '\\&')
        url = url.replace('_', '\\_')
            
        return url
    
    def process_math_term(self, term: str) -> str:
        """Enhanced math term processing with better handling of nested expressions"""
        if not term:
            return ""

        # Remove HTML tags and escaped sequences that cause issues
        cleanup_replacements = {
            'textasciicircum{}': '^',
            'textbackslash{}': '',
            '\\\\': '\\',
            '\\_SAT': '_SAT'
        }
        
        for old, new in cleanup_replacements.items():
            term = term.replace(old, new)

        # Detect if term is already in math mode
        # Count occurrences of single $; if odd, it's partially in math mode.
        is_math_mode = (term.count('$') % 2 == 1)

        # Store and protect existing math blocks
        math_blocks = []
        # Use a non-greedy regex to ensure minimal capturing between $...$
        term = re.sub(r'\$(.*?)\$',
                      lambda m: self._store_math(m.group(1), math_blocks),
                      term, flags=re.DOTALL)

        # Special cases, longer patterns first
        special_cases = {
            # Basic math operations
            'log(1 + e^(-z))': r'\log(1 + e^{-z})',
            '(0, 0)': r'$(0, 0)$',
            '^T': r'^T',

            # Greek letters
            'alpha': r'$\alpha$',
            'beta': r'$\beta$',
            'gamma': r'$\gamma$',
            'delta': r'$\delta$',
            'epsilon': r'$\epsilon$',
            'theta': r'$\theta$',
            'lambda': r'$\lambda$',
            'mu': r'$\mu$',
            'sigma': r'$\sigma$',
            'omega': r'$\omega$',

            # Function notation
            'sigma(x)': r'$\sigma(x)$',
            'sigma(z)': r'$\sigma(z)$',
            "sigma'(z)": r'$\sigma\'(z)$',
            'f(x)': r'$f(x)$',
            'g(x)': r'$g(x)$',

            # Subscripts and superscripts
            'x_0': r'$x_0$',
            '-x_0': r'$-x_0$',
            'x_i': r'$x_i$',
            'y_i': r'$y_i$',
            '_i': r'$_i$',
            '_j': r'$_j$',
            '_n': r'$_n$',
            '_p': r'$_p$',

            # Matrix notation
            'c^T': r'$c^T$',
            'b^T': r'$b^T$',
            'A^T': r'$A^T$',
            '^{-1}': r'^{-1}',
            '^{T}': r'^{T}',

            # Special functions and operators
            'mathbb{1}': r'$\mathbb{1}$',
            'frac{': r'$\frac{',
            'sum_{': r'$\sum_{',
            'prod_{': r'$\prod_{',
            'int_{': r'$\int_{',

            # Logical operators
            'implies': r'$\implies$',
            'iff': r'$\iff$',
            'forall': r'$\forall$',
            'exists': r'$\exists$',
            'ne': r'$\ne$',

            # Arrows and symbols
            'leftarrow': r'$\leftarrow$',
            'rightarrow': r'$\rightarrow$',
            'leftrightarrow': r'$\leftrightarrow$',
            'Leftarrow': r'$\Leftarrow$',
            'Rightarrow': r'$\Rightarrow$',
            'cdot': r'$\cdot$',

            # Norms and spaces
            'L^1': r'$L^1$',
            'L^2': r'$L^2$',
            'L^infty': r'$L^\infty$',
            'L^∞': r'$L^\infty$',
            '||': r'$\|$',

            # HTML-style tags
            '<sup>': r'^{',
            '</sup>': r'}',
            '<sub>': r'_{',
            '</sub>': r'}',

            # Special characters
            '\\{': r'\{',
            '\\}': r'\}',
            'textbackslash': r'\textbackslash',

            # Additional math expressions
            'max{0, -z}': r'$\max\{0, -z\}$',
            'max{0, 1-z}': r'$\max\{0, 1-z\}$',
            'y(w^Tx)': r'$y(w^{T}x)$',
            'w^T': r'$w^{T}$',
            'e^(-z)': r'$e^{-z}$',
            # Already included in a transformed version above, but ensure unique
            'e^{-z}': r'$e^{-z}$'
        }

        # Process special cases longest first
        for case in sorted(special_cases.keys(), key=len, reverse=True):
            if case in term:
                replacement = special_cases[case]
                # If we are inside math mode and the replacement is also wrapped in $...$, remove extra $
                if is_math_mode and replacement.startswith('$') and replacement.endswith('$'):
                    replacement = replacement[1:-1]
                term = term.replace(case, replacement)

        # Clean up duplicate or empty math mode markers
        term = re.sub(r'\${2,}', '$', term)  # collapse multiple $$ to single $
        term = re.sub(r'(\$)\s*(\$)', r'\1\2', term)  # Remove spaces between $ $
        # Remove isolated $ pairs with no content
        term = re.sub(r'\$\$', '$', term)

        try:
            # Instead of '\\+\\', use a quantifier to mean multiple backslashes.
            # '\\+\{' means one or more backslashes followed by '{'
            # '\\+\}' means one or more backslashes followed by '}'
            # '\\{2,}' means two or more backslashes
            term = re.sub(r'\\+\{', '{', term)
            term = re.sub(r'\\+\}', '}', term)
            term = re.sub(r'\\{2,}', r'\\', term)
        except re.error as e:
            print(f"Regex error while cleaning braces and backslashes: {e}")
            # If needed, handle the error by logging, raising a different exception, or returning the unmodified term.
            return term

        # If not in math mode and term contains math-y chars, wrap in $
        if not is_math_mode and any(c in term for c in '_^\\{}'):
            if not term.strip().startswith('$'):
                term = f'${term}$'

        # Restore protected math blocks
        term = self._restore_math(term, math_blocks)

        # Final normalization of math mode delimiters
        # Ensure balanced math mode (if not balanced, we could try to fix it)
        if term.count('$') % 2 != 0:
            # Add a trailing $ if odd count
            term += '$'

        return term

    def sanitize_latex(self, text: str) -> str:
        """Enhanced sanitization for LaTeX output"""
        if not text:
            return ""
        
        math_blocks = []
        # Protect existing math
        text = re.sub(r'\$(.*?)\$',
                      lambda m: self._store_math(m.group(1), math_blocks),
                      text, flags=re.DOTALL)

        # Unicode math replacements
        unicode_math = {
            '\u2212': r'-',
            '∧': r'\wedge',
            '\u2228': r'\vee',
            '↔': r'\leftrightarrow',
            '¬': r'\neg',
            '⊗': r'\otimes',
            '⊕': r'\oplus',
            '∈': r'\in',
            '∉': r'\notin',
            '∀': r'\forall',
            '∃': r'\exists',
            '≤': r'\leq',
            '≥': r'\geq',
            '≠': r'\neq',
            '≈': r'\approx',
            '∞': r'\infty'
        }
        for symbol, replacement in unicode_math.items():
            # Insert in math mode
            text = text.replace(symbol, f'${replacement}$')

        # General replacements (outside math mode)
        # Note: We must be careful with $ and other chars that we already handled
        replacements = {
            '%': r'\%',
            '&': r'\&',
            '#': r'\#',
            '~': r'\textasciitilde{}',
            '^': r'\textasciicircum{}',
            '<': r'\textless{}',
            # unicode arrow replacements done above
            '→': r'$\rightarrow$',
            '←': r'$\leftarrow$',
            '≠': r'$\neq$',
            '∑': r'$\sum$',
            '⇒': r'$\implies$',
            '·': r'$\cdot$',
            '…': r'\ldots',
            # Smart quotes handling
            '"': '``',
            '"': "''",
            '"': "''",
            '\u2019': "'",
            '\u2018': "`",
            '—': '---'
        }

        for char, replacement in replacements.items():
            text = text.replace(char, replacement)

        # Restore math blocks
        text = self._restore_math(text, math_blocks)

        # Ensure balanced math mode after restoration
        if text.count('$') % 2 != 0:
            # Attempt simple fix by adding a trailing $
            text += '$'

        return text

    def sanitize_section_title(self, title: str) -> str:
        """Sanitize section titles specifically"""
        # Handle special characters in section titles
        title = title.replace('&', r'\&')
        title = title.replace('\\', '')  # Remove backslashes
        title = title.replace('{', r'\{')
        title = title.replace('}', r'\}')
        title = title.replace('_', r'\_')
        title = title.replace('^', r'\textasciicircum{}')
        title = title.replace('~', r'\textasciitilde{}')
        title = title.replace('<', r'\textless{}')
        title = title.replace('>', r'\textgreater{}')
        # Replace {-} with simple hyphen
        title = title.replace('{-}', '-')
        return title
    
    def save_slide_latex(self, lecture_name: str, slides: dict, figures_dict: dict):
        """
        Save processed slides to a LaTeX PDF file using PyLaTeX. Want to create a page for each slides. Each will have 2 sections, one that says 'Content' and one that says 'Figures'. In the content section, we will have the latex for the slide and the description beow, and in the figures section, we will have the figures for the slide.
        
        Args:
            lecture_name (str): The name of the lecture.
            slides (dict): A dictionary for a given lecture as keys and slide numbers as values. Example: {
                "1": {
                    "latex": "\\underline{\text{Def 1}} \\quad \\text{Line Segment}",
                    "figures": [
                        {
                            "bbox": [10, 10, 60, 30],
                            "description": "A figure of a line segment between two points"
                        }
                    ],
                    "description": "A slide with a line segment between two points"
                }, 
                "2": {
                    "latex": "\\underline{\text{Def 1}} \\quad \\text{Triangle}",
                    "figures": [
                        {
                            "bbox": [10, 10, 60, 30],
                            "description": "A figure of a triangle"
                        }
                    ],
                    "description": "A slide with a triangle"
                } ...
            }
            figures_dict (dict): A dictionary for a given lecture as keys and slide numbers as values. Example: {
                "1": [
                    "figures/line_segment.png"
                ],
                "2": [
                    "figures/triangle.png"
                ]
            }
        """
        
        geometry_options = {
            "margin": "1in",
            "headheight": "14pt",
            "headsep": "25pt"
        }
        doc = Document(geometry_options=geometry_options)
        
        # Add packages
        for pkg in ['hyperref', 'enumitem', 'fancyhdr', 'xcolor', 'url', 'breakurl', 'amsmath', 'amssymb', 'mathtools', 'amsthm', 'thmtools']:
            doc.packages.append(Package(pkg))

        doc.preamble.append(NoEscape(r'''
            \hypersetup{
                colorlinks=true,
                linkcolor=blue,
                filecolor=magenta,
                urlcolor=blue,
                breaklinks=true,
                bookmarks=true,
                pdfborder={0 0 0}
            }
            \urlstyle{same}
            \Urlmuskip=0mu plus 1mu  % URL breaking in nicer spots
            
            % Math configuration
            \everymath{\displaystyle}
            \setlength{\jot}{10pt}  % Increase spacing between equations
            
            \pagestyle{fancy}
            \fancyhf{}
            \rhead{Generated on \today}
            \cfoot{\thepage}
            
            % Better Unicode support
            \usepackage[utf8]{inputenc}
            \usepackage{newunicodechar}
            \usepackage[breaklinks=true]{hyperref}
            \setlength{\itemsep}{1em} % Adds spacing between items
            
            % Configure itemize settings globally
            \setlist[itemize]{nosep}
            \setlist[itemize]{leftmargin=*}
            
            % Remove section numbering
            \renewcommand{\thesection}{}
            \renewcommand{\thesubsection}{}
        '''))
        doc.preamble.append(Command('lhead', f'Lecture: {lecture_name}'))
        
        doc.preamble.append(Command('title', f'{lecture_name}'))
        doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
        doc.preamble.append(Command('date', NoEscape(r'\today')))
        doc.append(NoEscape(r'\maketitle'))
        
        for slide_number, slide_data in slides.items():
            with doc.create(Section(f'Slide {slide_number}')):
                # add content
                doc.append(NoEscape(r'\subsection{Content}'))
                doc.append(NoEscape(slide_data['latex']))
                
                # add description 
                doc.append(NoEscape(r'\subsection{Description}'))
                doc.append(NoEscape(slide_data['description']))
                
                # add figures
                doc.append(NoEscape(r'\subsection{Figures}'))
                figures = figures_dict[str(slide_number)]
                doc.append(NoEscape(r'\begin{figure}[h]'))
                doc.append(NoEscape(r'\centering'))
                # Single row of first 3 figures
                doc.append(NoEscape(r'\begin{minipage}{\textwidth}'))
                doc.append(NoEscape(r'\centering'))
                for idx, figure in enumerate(slides[slide_number]["figures"][:3]):
                    figure_path = figures[idx]
                    doc.append(NoEscape(r'\begin{minipage}{0.15\textwidth}'))
                    doc.append(NoEscape(r'\centering'))
                    doc.append(NoEscape(r'\includegraphics[width=0.8\textwidth]{' + figure_path + '}'))
                    doc.append(NoEscape(r'\caption{' + figure['description'] + '}'))
                    doc.append(NoEscape(r'\end{minipage}'))
                    if idx < min(2, len(slides[slide_number]["figures"]) - 1):
                        doc.append(NoEscape(r'\hfill'))
                doc.append(NoEscape(r'\end{minipage}'))
                doc.append(NoEscape(r'\end{figure}'))
            doc.append(NoEscape(r'\newpage'))
                    
        base_filename = f"notes"
        filename = os.path.join(self.output_dir, self.course_code, "lectures", lecture_name, base_filename)
        
        log_dir = "_logs"
        # Generate PDF with logs in separate directory
        try:
            # Generate PDF with logs in separate directory
            doc.generate_pdf(
                filename,
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
                src_file = os.path.join(self.output_dir, self.course_code, "lectures", lecture_name, log_dir, f"{base_filename}{ext}")
                if os.path.exists(src_file):
                    # Display log content for debugging
                    if ext == '.log':
                        print(f"\nContents of log file:")
                        with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = f.readlines()
                            print("..." if len(lines) > 50 else "")
                            for line in lines[-50:]:
                                if "!" in line or "Error" in line or "Warning" in line:
                                    print(f"ERROR/WARNING: {line.strip()}")
                
            print(f"PDF generated successfully: {filename}.pdf")
            # Clean up the .tex file if successful
            if os.path.exists(f"{filename}.tex"):
                os.remove(f"{filename}.tex")
            return True

        except Exception as e:
            error_msg = str(e)
            print(f"Error during compilation: {error_msg}")
            
            # Error analysis and log display
            if "! LaTeX Error:" in error_msg:
                latex_error = re.search(r'! LaTeX Error:(.*?)\n', error_msg)
                if latex_error:
                    print(f"LaTeX Error: {latex_error.group(1).strip()}")
            elif "! Package" in error_msg:
                package_error = re.search(r'! Package (.*?) Error:(.*?)\n', error_msg)
                if package_error:
                    print(f"Package {package_error.group(1)} Error: {package_error.group(2).strip()}")
            elif "! Missing" in error_msg:
                missing_error = re.search(r'! Missing (.*?) inserted', error_msg)
                if missing_error:
                    print(f"Missing character error: {missing_error.group(1)}")
            
            # Check log files in the log directory
            for ext in ['.log', '.aux', '.out']:
                log_file = os.path.join(self.output_dir, self.course_code, "lectures", lecture_name, log_dir, f"{base_filename}{ext}")
                if os.path.exists(log_file):
                    print(f"\nContents of {log_file}:")
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            if any(marker in line for marker in ["!", "Error", "Warning"]):
                                print(line.strip())
            return False
    
    def save_questions_latex(self, lecture_name: str, questions: list[dict]):
        """
        Save processed questions to a LaTeX PDF file using PyLaTeX. We will have one section titled 'Questions' for questions, and one section titled 'Answers' for answers. The answers should be in the same format as the questions, but the options should have the answer explanation in red text instead of the answer stem.
        
        Args:
            questions (list[dict]): A list of dictionaries for a given lecture as keys and slide numbers as values. Example: [
                {
                    "question": "According to the Klee-Minty example, how many steps does the Largest Coefficient Rule require in the worst case?",
                    "options": {
                        "A": "n steps",
                        "B": "2n steps", 
                        "C": "2^n - 1 steps",
                        "D": "3m/2 steps",
                        "E": "3m steps"
                    },
                    "answers": {
                        "A": false,
                        "B": false,
                        "C": true,
                        "D": false,
                        "E": false
                    },
                    "explanations": {
                        "A": "Answer A is incorrect because the Smallest Coefficient Rule requires n steps, not the Largest Coefficient Rule.",
                        "B": "Answer B is incorrect because the Largest Coefficient Rule does not require 2n steps.",
                        "C": "Answer C is correct because the Klee-Minty example shows that the Largest Coefficient Rule requires 2^n - 1 steps in the worst case.",
                        "D": "Answer D is incorrect because 3m/2 steps is the average case for the simplex method, not the worst case for the Largest Coefficient Rule.",
                        "E": "Answer E is incorrect because 3m steps is the rare case for the simplex method, not the worst case for the Largest Coefficient Rule."
                    },
                    "type": "conceptual",
                    "slides": [
                        3
                    ]
                }
            ]
        }
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
            \setlist[enumerate]{label=\Alph*.}
            \setlist[enumerate]{itemsep=0.5em}
            
            % Define a command for red text
            \newcommand{\incorrect}[1]{\textcolor{red}{#1}}
        '''))
        doc.preamble.append(Command('lhead', f'Lecture: {lecture_name}'))
        
        # Title
        doc.preamble.append(Command('title', f'Practice Questions for {lecture_name}'))
        doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
        doc.preamble.append(Command('date', NoEscape(r'\today')))
        doc.append(NoEscape(r'\maketitle'))

        # Questions Section
        with doc.create(Section('Questions')):
            for i, q in enumerate(questions, 1):
                # Question stem
                doc.append(NoEscape(f'{i}. {q["question"]}'))
                doc.append(NoEscape(r'\begin{enumerate}[label=\Alph*.]'))
                
                # Options
                for opt in ['A', 'B', 'C', 'D', 'E']:
                    if opt in q['options']:
                        doc.append(NoEscape(f'\\item {q["options"][opt]}'))
                
                doc.append(NoEscape(r'\end{enumerate}'))
                doc.append(NoEscape(r'\vspace{1em}'))

        # Answers Section
        doc.append(NoEscape(r'\newpage'))
        with doc.create(Section('Answers')):
            for i, q in enumerate(questions, 1):
                # Question stem with answers
                doc.append(NoEscape(f'{i}. {q["question"]}'))
                doc.append(NoEscape(r'\begin{enumerate}[label=\Alph*.]'))
                        
                # Options with explanations
                for opt in ['A', 'B', 'C', 'D', 'E']:
                    if opt in q['options']:
                        explanation = q['explanations'].get(opt, '')
                        if q['answers'].get(opt, False):
                            doc.append(NoEscape(f'\\item {explanation}'))
                        else:
                            doc.append(NoEscape(f'\\item \\incorrect{{{explanation}}}'))
                
                doc.append(NoEscape(r'\end{enumerate}'))
                
                # Add slide references. Formatting is off, just leaving for now.
                # if q['slides']:
                #     slides_str = ', '.join(map(str, q['slides']))
                #     doc.append(NoEscape(f'\nReferenced Slides: {slides_str}'))
                
                doc.append(NoEscape(r'\vspace{1em}'))

        base_filename = f"questions"
        filename = os.path.join(self.output_dir, self.course_code, "lectures", lecture_name, base_filename)
        
        log_dir = "_logs"
        # Generate PDF with logs in separate directory
        try:
            # Generate PDF with logs in separate directory
            doc.generate_pdf(
                filename,
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
                src_file = os.path.join(self.output_dir, self.course_code, "lectures", lecture_name, log_dir, f"{base_filename}{ext}")
                if os.path.exists(src_file):
                    # Display log content for debugging
                    if ext == '.log':
                        print(f"\nContents of log file:")
                        with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = f.readlines()
                            print("..." if len(lines) > 50 else "")
                            for line in lines[-50:]:
                                if "!" in line or "Error" in line or "Warning" in line:
                                    print(f"ERROR/WARNING: {line.strip()}")
                
            print(f"PDF generated successfully: {filename}.pdf")
            # Clean up the .tex file if successful
            if os.path.exists(f"{filename}.tex"):
                os.remove(f"{filename}.tex")
            return True

        except Exception as e:
            error_msg = str(e)
            print(f"Error during compilation: {error_msg}")
            
            # Error analysis and log display
            if "! LaTeX Error:" in error_msg:
                latex_error = re.search(r'! LaTeX Error:(.*?)\n', error_msg)
                if latex_error:
                    print(f"LaTeX Error: {latex_error.group(1).strip()}")
            elif "! Package" in error_msg:
                package_error = re.search(r'! Package (.*?) Error:(.*?)\n', error_msg)
                if package_error:
                    print(f"Package {package_error.group(1)} Error: {package_error.group(2).strip()}")
            elif "! Missing" in error_msg:
                missing_error = re.search(r'! Missing (.*?) inserted', error_msg)
                if missing_error:
                    print(f"Missing character error: {missing_error.group(1)}")
            
            # Check log files in the log directory
            for ext in ['.log', '.aux', '.out']:
                log_file = os.path.join(self.output_dir, self.course_code, "lectures", lecture_name, log_dir, f"{base_filename}{ext}")
                if os.path.exists(log_file):
                    print(f"\nContents of {log_file}:")
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            if any(marker in line for marker in ["!", "Error", "Warning"]):
                                print(line.strip())
            return False
    
    def save_summary_latex(self, categorized_results: dict):
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
        for pkg in ['hyperref', 'enumitem', 'fancyhdr', 'xcolor', 'url', 'breakurl', 'amsmath', 'amssymb', 'mathtools', 'amsthm', 'thmtools']:
            doc.packages.append(Package(pkg))

        doc.preamble.append(NoEscape(r'''
            \hypersetup{
                colorlinks=true,
                linkcolor=blue,
                filecolor=magenta,
                urlcolor=blue,
                breaklinks=true,
                bookmarks=true,
                pdfborder={0 0 0}
            }
            \urlstyle{same}
            \Urlmuskip=0mu plus 1mu  % URL breaking in nicer spots
            
            % Math configuration
            \everymath{\displaystyle}
            \setlength{\jot}{10pt}  % Increase spacing between equations
            
            \pagestyle{fancy}
            \fancyhf{}
            \rhead{Generated on \today}
            \lhead{Course Summary}
            \cfoot{\thepage}
            
            % Better Unicode support
            \usepackage[utf8]{inputenc}
            \usepackage{newunicodechar}
            \usepackage[breaklinks=true]{hyperref}
            \setlength{\itemsep}{1em} % Adds spacing between items
            
            % Configure itemize settings globally
            \setlist[itemize]{nosep}
            \setlist[itemize]{leftmargin=*}
        '''))

        doc.preamble.append(Command('title', f'{self.course_title} Course Summary'))
        doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
        doc.preamble.append(Command('date', NoEscape(r'\today')))
        doc.append(NoEscape(r'\maketitle'))

        def has_valid_key_term(line):
            parts = line.split(':')
            return len(parts) == 2 and bool(parts[0].strip()) and bool(parts[1].strip())

        def extract_slide_fragment(line):
            matches = re.findall(r'<L\[([^\]]+)\] (\d+)>', line)
            if matches:
                lecture_name, page_number = matches[0]
                return f"{lecture_name}.pdf#page={page_number}"
            return None

        class CustomItemize(Environment):
            _latex_name = 'itemize'

            def __init__(self):
                super().__init__()
                self.options = NoEscape('leftmargin=*')

        def process_results(results, doc, depth=0):
            if not results:
                return False

            has_content = False
            
            for result in results:
                if isinstance(result, dict):
                    # Handle nested dictionary structure
                    for subcategory, subresults in result.items():
                        if not subresults:
                            continue
                        # If top-level
                        if depth == 0:
                            with doc.create(Subsection(self.sanitize_section_title(subcategory))):
                                if process_results(subresults, doc, depth + 1):
                                    has_content = True
                                else:
                                    doc.pop()
                        else:
                            if process_results(subresults, doc, depth + 1):
                                doc.append(NoEscape(r'\subsubsection{'
                                                    + self.sanitize_section_title(subcategory)
                                                    + '}'))
                                has_content = True
                else:
                    # Individual result line
                    result = result.strip().replace("*", "")
                    cleaned_result = self.filter_summary(result.strip())

                    if cleaned_result:
                        with doc.create(CustomItemize()):
                            for line in cleaned_result.splitlines():
                                line = line.strip()
                                if line and has_valid_key_term(line):
                                    slide_fragment = extract_slide_fragment(line)
                                    # Remove slide markers
                                    line = re.sub(r'<L\[[^>]+] [^>]+>', '', line)

                                    term, description = line.split(':', 1)
                                    term = term.strip()
                                    description = description.strip()

                                    # Decide how to process term
                                    # If it seems like a math term, process through process_math_term
                                    if any(x in term for x in ['^', 'infty', '∞', '<sup>', '</sup>', 'log(1 + e', '_']):
                                        term = self.process_math_term(term)
                                    else:
                                        term = self.sanitize_latex(term)

                                    description = self.sanitize_latex(description)

                                    # Add formatting
                                    if depth > 0:
                                        term = NoEscape(r'\textbf{' + term + '}')
                                    else:
                                        term = bold(term)

                                    if slide_fragment:
                                        if self.course_link:
                                            course_link = self.format_url_for_latex(self.course_link + "/")
                                        else:
                                            course, page = slide_fragment.split("#")
                                            course_link = self.format_url_for_latex(
                                                f"https://purdue.brightspace.com/d2l/common/assets/pdfjs-d2l-dist/"
                                                f"1.0.14-legacy/web/viewer.html?file=%2Fcontent%2Fenforced%2F"
                                                f"{self.brightspace_course_id}-{self.brightspace_course_descriptor}%2F"
                                                f"{course}%3Fou%3D{self.brightspace_course_id}"
                                                f"&lang=en-us&container=d2l-fileviewer-rendered-pdf"
                                                f"&fullscreen=d2l-fileviewer-rendered-pdf-dialog&height=667"
                                            )
                                            slide_fragment = f"#{page}"

                                        item_content = NoEscape(
                                            r'\item \href{'
                                            + course_link + slide_fragment
                                            + '}{' + term + '}: ' + description
                                        )
                                    else:
                                        item_content = NoEscape(r'\item ' + term + ': ' + description)

                                    doc.append(item_content)
                                    has_content = True

            return has_content

        # Generate sections
        for category, results in categorized_results.items():
            if results:  # Only process non-empty categories
                with doc.create(Section(self.sanitize_section_title(category))):
                    if not process_results(results, doc):
                        doc.pop()  # Remove empty section
        
        # Create directories if they don't exist
        os.makedirs(os.path.join(self.output_dir, self.course_code, self.summary_type), exist_ok=True)
        
        # Set base filename
        base_filename = f"summary"
        filename = os.path.join(self.output_dir, self.course_code, self.summary_type, base_filename)
        
        log_dir = "../_logs"

        try:
            # Generate PDF with logs in separate directory
            doc.generate_pdf(
                filename,
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
                src_file = os.path.join(self.output_dir, self.course_code, self.summary_type, f"{base_filename}{ext}")
                if os.path.exists(src_file):
                    # Display log content for debugging
                    if ext == '.log':
                        print(f"\nContents of log file:")
                        with open(src_file, 'r', encoding='utf-8', errors='ignore') as f:
                            lines = f.readlines()
                            print("..." if len(lines) > 50 else "")
                            for line in lines[-50:]:
                                if "!" in line or "Error" in line or "Warning" in line:
                                    print(f"ERROR/WARNING: {line.strip()}")
                
            print(f"PDF generated successfully: {filename}.pdf")
            # Clean up the .tex file if successful
            if os.path.exists(f"{filename}.tex"):
                os.remove(f"{filename}.tex")
            return True

        except Exception as e:
            error_msg = str(e)
            print(f"Error during compilation: {error_msg}")
            
            # Error analysis and log display
            if "! LaTeX Error:" in error_msg:
                latex_error = re.search(r'! LaTeX Error:(.*?)\n', error_msg)
                if latex_error:
                    print(f"LaTeX Error: {latex_error.group(1).strip()}")
            elif "! Package" in error_msg:
                package_error = re.search(r'! Package (.*?) Error:(.*?)\n', error_msg)
                if package_error:
                    print(f"Package {package_error.group(1)} Error: {package_error.group(2).strip()}")
            elif "! Missing" in error_msg:
                missing_error = re.search(r'! Missing (.*?) inserted', error_msg)
                if missing_error:
                    print(f"Missing character error: {missing_error.group(1)}")
            
            # Check log files in the log directory
            for ext in ['.log', '.aux', '.out']:
                log_file = os.path.join(log_dir, self.course_code, self.summary_type, f"{base_filename}{ext}")
                if os.path.exists(log_file):
                    print(f"\nContents of {log_file}:")
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            if any(marker in line for marker in ["!", "Error", "Warning"]):
                                print(line.strip())
            return False