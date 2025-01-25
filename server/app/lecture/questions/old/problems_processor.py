import json
import os
from lecture.base_processor import BaseProcessor
from langchain_core.messages import HumanMessage
import re


class ProblemsProcessor(BaseProcessor):
    def __init__(self, *args, **kwargs):
        """
        Initialize the ProblemsProcessor class.
        
        will be questions for each lecture, similar to the notes. As we generate problems, we will add them to the dictionary. Have 3 types for each question, 'conceptual', 'computational', and 'multi-part'. For now, just MCQ. Have 4 sections, 'question', 'options', 'answer', and 'explanation'.
        
        Steps:
        1. Use problem_types and algorithm_solutions if given, otherwise, ask to generate from scratch. One prompt is one question. We will need a way to avoid duplicates. 
        2. Ask it to generate the question plus options. Try the explations with it, in one shot. If it fails, then seperate the tasks.
        
        """
        super().__init__(*args, **kwargs)
        
        # reading in the slides
        lectures_folder = os.path.join(self.output_dir, self.course_code, "lectures")
        self.slides = []
        self.slide_names = []
        for lecture_dir in sorted(os.listdir(lectures_folder)):
            notes_path = os.path.join(lectures_folder, lecture_dir, "notes.txt")
            if os.path.isfile(notes_path):
                with open(notes_path, 'r') as file:
                    self.slides.append(file.read())
                    self.slide_names.append(lecture_dir)
        
        
        os.makedirs(os.path.join(self.output_dir, self.course_code), exist_ok=True)
        self.json_output_file = os.path.join(self.output_dir, self.course_code, "questions.json")
        
        # Create lectures directory if it doesn't exist
        os.makedirs(os.path.join(self.output_dir, self.course_code, "lectures"), exist_ok=True)
        self.lectures_output_dir = os.path.join(self.output_dir, self.course_code, "lectures")
        
        self.question_prompt = f"""You are a professor for the class {self.course_code}. You will be given documents from lectures and be asked to generate multiple choice questions for the students to answer. You will have 5 answer choices available, 'A', 'B', 'C', 'D', and 'E'. There can only be one correct answer. Put the question in <QUESTION> and </QUESTION> tags. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. For each question, use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations. When adding your textual response with math symbols, be sure to use LaTeX formatting.Here is a full example output, generating 1 practice problem for the lecture Simplex Method. 
        
        
        YOUR OUTPUT: <OUTPUT><QUESTION>What is the first step in the simplex method?</QUESTION> <OPTION_A>Add slack variables to the constraints</OPTION_A> <OPTION_B>Form the initial tableau</OPTION_B> <OPTION_C>Solve the system of equations</OPTION_C> <OPTION_D>Identify the pivot column</OPTION_D> <OPTION_E>Identify the pivot row</OPTION_E> <CORRECT_B>Answer B is correct because it is the first step in the simplex method.</CORRECT_B> <INCORRECT_A>Answer A is incorrect because adding slack variables to the constraints is not the first step in the simplex method.</INCORRECT_A> <INCORRECT_C>Answer C is incorrect because solving the system of equations is not the first step in the simplex method.</INCORRECT_C> <INCORRECT_D>Answer D is incorrect because identifying the pivot column is not the first step in the simplex method.</INCORRECT_D> <INCORRECT_E>Answer E is incorrect because identifying the pivot row is not the first step in the simplex method.</INCORRECT_E><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></OUTPUT>
        """

        # check if questions.json exists
        if os.path.exists(self.json_output_file) and not self.regenerate:
            with open(self.json_output_file, "r") as file:
                self.questions = json.load(file)
        else:
            self.questions = {} 
        
        
    def process_batch(self, num_questions: int, lecture_name: str, content: str, i: int):
        # Join all previously generated questions into a single string
        already_generated = "\n".join([
            self.questions[key][i]["question"] 
            for key in self.questions.keys()
            for i in range(len(self.questions[key]))
        ])
        message = HumanMessage(content=[
            {"type": "text", "text": self.question_prompt},
            {"type": "text", "text": "The following questions have already been generated. Do not repeat them: " + already_generated},
            {"type": "text", "text": f"You should generate {num_questions} new questions for the lecture: {lecture_name}. INPUT: " + content + "\n\nYOUR OUTPUT: "},
        ])
        return self.robust_generate(message)
    
    def clean_result(self, result: str, lecture_name: str):
        """Clean up the result into the specified question format"""
        # Split the results into individual questions using OUTPUT tags
        question_blocks = re.findall(r'<OUTPUT>(.*?)</OUTPUT>', result, re.DOTALL)
        for block in question_blocks:
            if not block.strip():
                continue
            
            try:
                # Extract question
                question_match = re.search(r'<QUESTION>(.*?)</QUESTION>', block)
                if not question_match:
                    continue
                question = question_match.group(1).strip()
                
                # Extract options
                options = {}
                for opt in ['A', 'B', 'C', 'D', 'E']:
                    opt_match = re.search(f'<OPTION_{opt}>(.*?)</OPTION_{opt}>', block)
                    if opt_match:
                        options[opt] = opt_match.group(1).strip()
                
                # Extract answers and explanations
                answers = {opt: False for opt in ['A', 'B', 'C', 'D', 'E']}
                explanations = {}
                
                # Check for correct answer
                for opt in ['A', 'B', 'C', 'D', 'E']:
                    correct_match = re.search(f'<CORRECT_{opt}>(.*?)</CORRECT_{opt}>', block)
                    incorrect_match = re.search(f'<INCORRECT_{opt}>(.*?)</INCORRECT_{opt}>', block)
                    
                    if correct_match:
                        answers[opt] = True
                        explanations[opt] = correct_match.group(1).strip()
                    elif incorrect_match:
                        explanations[opt] = incorrect_match.group(1).strip()
                
                # Extract slide numbers
                slide_matches = re.findall(r'<SLIDE\s+(\d+)>', block)
                slides = [int(num) for num in slide_matches if num.isdigit()]
                
                # Create question object
                question_obj = {
                    "question": question,
                    "options": options,
                    "answers": answers,
                    "explanations": explanations,
                    "type": "conceptual",  # You might want to determine this dynamically
                    "slides": slides
                }
                
                if lecture_name not in self.questions:
                    self.questions[lecture_name] = []
                self.questions[lecture_name].append(question_obj)
                
            except Exception as e:
                print(f"Error processing question block: {str(e)}")
                continue
    
    def process_problems(self, num_docs = None, num_questions: int = 3):
        """
        Process slides, extract content in batches, and generates problems.
        
        Args:
            num_docs: the number of documents to process. If None, process all documents.
            num_questions: the number of questions to ask.
        """
        
        # Process each category and aggregate results
        if num_docs is None:  
            num_docs = len(self.slides)
        else:
            num_docs = min(num_docs, len(self.slides))
        
        for i in range(0, num_docs):
            remaining_questions = num_questions
            print(f"Processing {self.slide_names[i]}")
            # check if the lecture already has specified number of questions, and subtract from num_questions
            if len(self.questions.get(self.slide_names[i], [])) >= remaining_questions:
                remaining_questions -= len(self.questions.get(self.slide_names[i], []))
                print(f"Skipping {self.slide_names[i]} - already has {len(self.questions.get(self.slide_names[i], []))} questions")
                continue
            try:
                print(f"Generating {remaining_questions} questions for {self.slide_names[i]}")
                result = self.process_batch(remaining_questions, self.slide_names[i], self.slides[i], i)
                self.clean_result(result, self.slide_names[i])

            except Exception as e:
                print(f"Error processing batch {i + 1}: {e}")
                
            # save outputs
            self.save_questions_json(self.json_output_file)
            self.save_questions_text(self.lectures_output_dir)
            self.save_questions_pdf(self.lectures_output_dir)
            
            
    def save_questions_json(self, file_path: str):
        with open(file_path, "w") as file:
            json.dump(self.questions, file, indent=4)

    def save_questions_pdf(self, file_path: str):
        """Save the questions as a PDF file.

        Args:
            file_path (str): The path to the output directory.
        """
        for lecture_name in self.questions.keys():
            os.makedirs(os.path.join(file_path, lecture_name), exist_ok=True)
            self.save_questions_latex(lecture_name, self.questions[lecture_name]) 
            
    def save_questions_text(self, file_path: str):
        """Save all questions for each lecture concatenated into a single questions.txt file.
        Each question is separated by a newline and labeled with 'QUESTION X' at the top.
        
        Args:
            file_path (str): The path to the output directory.
        """
        for lecture_name in self.questions.keys():
            # Create lecture directory
            lecture_dir = os.path.join(file_path, lecture_name)
            os.makedirs(lecture_dir, exist_ok=True)

            # Write all slides to single notes.txt file
            questions_path = os.path.join(lecture_dir, "questions.txt")
            with open(questions_path, "w") as questions_file:
                for i, question in enumerate(self.questions[lecture_name]):
                    questions_file.write(f"QUESTION {i + 1}\n")
                    questions_file.write(question["question"])
                    for opt in ['A', 'B', 'C', 'D', 'E']:
                        questions_file.write(f"\n{opt}. {question['options'][opt]}")
                    questions_file.write(f"\n\nANSWER: {[opt for opt, value in question["answers"].items() if value][0]}")
                    questions_file.write(f"\n\nEXPLANATION: \n{"\n".join([f"{opt}. {question['explanations'][opt]}" for opt in question["explanations"].keys()])}")
                    questions_file.write("\n\n")
             
    def save_questions_supabase(self):
        """
        Save the questions to supabase. Will insert into the 'questions' table, with the following fields:
        question, solution, slide
        
        question: the question, with the options added onto it
        solution: the solution to the question, with the explanations added onto it
        slide: the slide number that the question is from
        """
        
        lecture_mapping = self.supabase.table("lectures").select("id, name").eq("class", self.class_id).execute().data
        lecture_mapping = {row["name"]: row["id"] for row in lecture_mapping}

        questions_added = 0
        for lecture_name in self.questions.keys():
            for question in self.questions[lecture_name]:
                self.supabase.table("questions").insert({
                    "question": question["question"],
                    "option_a": question["options"]["A"],
                    "option_b": question["options"]["B"],
                    "option_c": question["options"]["C"],
                    "option_d": question["options"]["D"],
                    "option_e": question["options"]["E"],
                    "solution": [opt for opt, value in question["answers"].items() if value][0],
                    "explanation_a": question["explanations"]["A"],
                    "explanation_b": question["explanations"]["B"],
                    "explanation_c": question["explanations"]["C"],
                    "explanation_d": question["explanations"]["D"],
                    "explanation_e": question["explanations"]["E"],
                    "lecture": lecture_mapping[lecture_name]
                }).execute()
                questions_added += 1
        print(f"Saved {questions_added} questions to supabase.")
        
    def save_questions_storage_supabase(self):
        """
        Save the questions to supabase storage.
        """
        for lecture_name in self.questions.keys():
            # check if questions.pdf exists
            if not os.path.exists(os.path.join(self.output_dir, self.course_code, "lectures", f"{lecture_name}", "questions.pdf")):
                print(f"Skipping {lecture_name} - questions.pdf does not exist")
                continue
            response = self.supabase.storage.from_("slides").upload(
                file=os.path.join(self.output_dir, self.course_code, "lectures", f"{lecture_name}", "questions.pdf"),
                path=f"{self.course_code}/lectures/{lecture_name}/questions.pdf",
                file_options={"cache-control": "3600", "upsert": "true"},
            )
            print(f"Saved {lecture_name} to supabase storage. Response: {response}")