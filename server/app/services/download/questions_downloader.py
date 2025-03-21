from typing import List, Union
from app.services.base_processor import MCQQuestion, FRQQuestion
from app.extensions import QUESTIONS_DIR
from pylatex import Document, Section, Command, Package
from pylatex.utils import NoEscape
import os
import re


class QuestionsDownloader:
    def __init__(self, questions: List[List[Union[MCQQuestion, FRQQuestion]]]):
        self.questions = questions

    def download_text(self):
        """Download questions as text file"""
        # Create a unique name for the questions file
        questions_id = self.questions[0][0]['id'].split('_')[0] if self.questions and self.questions[0] else "questions"
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.join(QUESTIONS_DIR, questions_id), exist_ok=True)
        
        filename = f"{questions_id}.txt"
        filepath = os.path.join(QUESTIONS_DIR, questions_id, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("PRACTICE QUESTIONS\n\n")
            f.write("QUESTIONS:\n\n")
            
            for i, question_group in enumerate(self.questions, 1):
                if len(question_group) > 1:
                    # Multipart question
                    f.write(f"{i}. Multi-part question:\n")
                    for j, part in enumerate(question_group, 1):
                        f.write(f"  {j}. {part['question']}\n")
                        for opt in ['A', 'B', 'C', 'D', 'E']:
                            if opt in part['options']:
                                f.write(f"     {opt}. {part['options'][opt]}\n")
                        f.write("\n")
                else:
                    # Single question
                    part = question_group[0]
                    f.write(f"{i}. {part['question']}\n")
                    for opt in ['A', 'B', 'C', 'D', 'E']:
                        if opt in part['options']:
                            f.write(f"   {opt}. {part['options'][opt]}\n")
                    f.write("\n")
            
            f.write("\nANSWERS:\n\n")
            
            for i, question_group in enumerate(self.questions, 1):
                if len(question_group) > 1:
                    # Multipart question answers
                    f.write(f"{i}. Multi-part question answers:\n")
                    for j, part in enumerate(question_group, 1):
                        f.write(f"  {j}. {part['question']}\n")
                        for opt in ['A', 'B', 'C', 'D', 'E']:
                            if opt in part['options']:
                                explanation = part['explanations'].get(opt, '')
                                correct = part['answers'].get(opt, False)
                                f.write(f"     {opt}. {'CORRECT: ' if correct else 'INCORRECT: '}{explanation}\n")
                        f.write("\n")
                else:
                    # Single question answers
                    part = question_group[0]
                    f.write(f"{i}. {part['question']}\n")
                    for opt in ['A', 'B', 'C', 'D', 'E']:
                        if opt in part['options']:
                            explanation = part['explanations'].get(opt, '')
                            correct = part['answers'].get(opt, False)
                            f.write(f"   {opt}. {'CORRECT: ' if correct else 'INCORRECT: '}{explanation}\n")
                    f.write("\n")
        
        return filepath

    def download_pdf(self):
        """Download questions as PDF file"""
        # Create a unique name for the questions file
        questions_id = self.questions[0][0]['id'].split('_')[0] if self.questions and self.questions[0] else "questions"
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.join(QUESTIONS_DIR, questions_id), exist_ok=True)
        
        base_filename = f"{questions_id}"
        success = self.save(questions_id, self.questions, base_filename, pdf=True)
        
        if success:
            return os.path.join(QUESTIONS_DIR, questions_id, f"{base_filename}.pdf")
        return None

    def download_latex(self):
        """Download questions as LaTeX file"""
        # Create a unique name for the questions file
        questions_id = self.questions[0][0]['id'].split('_')[0] if self.questions and self.questions[0] else "questions"
        
        base_filename = f"{questions_id}"
        success = self.save(questions_id, self.questions, base_filename, pdf=False)
        
        if success:
            return os.path.join(QUESTIONS_DIR, questions_id, f"{base_filename}.tex")
        return None

    def save(self, name: str, questions: list[list[dict]], base_filename: str, pdf: bool = True):
        """
        Save processed questions to a LaTeX PDF file using PyLaTeX. We will have one section titled 'Questions' for questions, and one section titled 'Answers' for answers. The answers should be in the same format as the questions, but the options should have the answer explanation in red text instead of the answer stem.
        
        Args:
            questions (list[list[dict]]): A list of lists of dictionaries for a given lecture as keys and slide numbers as values. Example: [[
                [
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
                }
            ]]
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
            \setlist[enumerate,1]{label=\arabic*.}
            \setlist[enumerate,2]{label=\alph*.}
            \setlist[enumerate,3]{label=\Alph*.}
            \setlist[enumerate]{itemsep=0.5em}
            
            % Define a command for red text
            \newcommand{\incorrect}[1]{\textcolor{red}{#1}}
        '''))
        doc.preamble.append(Command('lhead', f'{name}'))
        
        # Title
        doc.preamble.append(Command('title', f'Practice Questions for {name}'))
        doc.preamble.append(Command('author', 'Generated by Scribe.AI'))
        doc.preamble.append(Command('date', NoEscape(r'\today')))
        doc.append(NoEscape(r'\maketitle'))

        # Questions Section
        with doc.create(Section('Questions')):
            doc.append(NoEscape(r'\begin{enumerate}'))
            for question_group in questions:
                if len(question_group) > 1:
                    # Multipart question
                    doc.append(NoEscape(r'\item'))
                    doc.append(NoEscape(r'\begin{enumerate}'))
                    
                    for part in question_group:
                        doc.append(NoEscape(f'\\item {part["question"]}'))
                        doc.append(NoEscape(r'\begin{enumerate}'))
                        
                        for opt in ['A', 'B', 'C', 'D', 'E']:
                            if opt in part['options']:
                                doc.append(NoEscape(f'\\item {part["options"][opt]}'))
                        
                        doc.append(NoEscape(r'\end{enumerate}'))
                        doc.append(NoEscape(r'\vspace{0.5em}'))
                    
                    doc.append(NoEscape(r'\end{enumerate}'))
                else:
                    # Single question
                    doc.append(NoEscape(f'\\item {question_group[0]["question"]}'))
                    doc.append(NoEscape(r'\begin{enumerate}'))
                    
                    for opt in ['A', 'B', 'C', 'D', 'E']:
                        if opt in question_group[0]['options']:
                            doc.append(NoEscape(f'\\item {question_group[0]["options"][opt]}'))
                    
                    doc.append(NoEscape(r'\end{enumerate}'))
                    doc.append(NoEscape(r'\vspace{1em}'))
            
            doc.append(NoEscape(r'\end{enumerate}'))

        # Answers Section
        doc.append(NoEscape(r'\newpage'))
        with doc.create(Section('Answers')):
            doc.append(NoEscape(r'\begin{enumerate}'))
            for question_group in questions:
                if len(question_group) > 1:
                    # Multipart question answers
                    doc.append(NoEscape(r'\item'))
                    doc.append(NoEscape(r'\begin{enumerate}'))
                    
                    for part in question_group:
                        doc.append(NoEscape(f'\\item {part["question"]}'))
                        doc.append(NoEscape(r'\begin{enumerate}'))
                        
                        for opt in ['A', 'B', 'C', 'D', 'E']:
                            if opt in part['options']:
                                explanation = part['explanations'].get(opt, '')
                                if part['answers'].get(opt, False):
                                    doc.append(NoEscape(f'\\item {explanation}'))
                                else:
                                    doc.append(NoEscape(f'\\item \\incorrect{{{explanation}}}'))
                        
                        doc.append(NoEscape(r'\end{enumerate}'))
                        doc.append(NoEscape(r'\vspace{0.5em}'))
                    
                    doc.append(NoEscape(r'\end{enumerate}'))
                else:
                    # Single question answers
                    part = question_group[0]
                    doc.append(NoEscape(f'\\item {part["question"]}'))
                    doc.append(NoEscape(r'\begin{enumerate}'))
                    
                    for opt in ['A', 'B', 'C', 'D', 'E']:
                        if opt in part['options']:
                            explanation = part['explanations'].get(opt, '')
                            if part['answers'].get(opt, False):
                                doc.append(NoEscape(f'\\item {explanation}'))
                            else:
                                doc.append(NoEscape(f'\\item \\incorrect{{{explanation}}}'))
                    
                    doc.append(NoEscape(r'\end{enumerate}'))
                    doc.append(NoEscape(r'\vspace{1em}'))
            
            doc.append(NoEscape(r'\end{enumerate}'))

        filename = os.path.join(QUESTIONS_DIR, name, base_filename)
        
        if pdf:
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
                    src_file = os.path.join(QUESTIONS_DIR, name, log_dir, f"{base_filename}{ext}")
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
                    log_file = os.path.join(QUESTIONS_DIR, name, log_dir, f"{base_filename}{ext}")
                    if os.path.exists(log_file):
                        print(f"\nContents of {log_file}:")
                        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                            for line in f:
                                if any(marker in line for marker in ["!", "Error", "Warning"]):
                                    print(line.strip())
                return False
        else:
            # remove .tex from filename
            filename = filename.replace('.tex', '')
            doc.generate_tex(filename)
            return True

