import json
import os
from lecture.base_processor import BaseProcessor
from langchain_core.messages import HumanMessage
import re
import uuid


class MCQProblemsProcessor(BaseProcessor):
    def __init__(self, *args, **kwargs):
        """
        Initialize the MCQProblemsProcessor class.
        
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
        
        base_question_prompt = f"""You are a professor for the class {self.course_code}. You will be given documents from lectures and be asked to generate multiple choice questions for the students to answer. You will have 5 answer choices available, 'A', 'B', 'C', 'D', and 'E'. There can only be one correct answer. Put the question in <QUESTION> and </QUESTION> tags. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question. For each question, use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations. When adding your textual response with math symbols, be sure to use LaTeX formatting. """
        
        default_question_prompt = f"""You will be tasked with generating single-part questions. Here is a full example output, generating 1 practice problem for the lecture Simplex Method. 

        YOUR OUTPUT: <OUTPUT><QUESTION>What is the first step in the simplex method?</QUESTION> <OPTION_A>Add slack variables to the constraints</OPTION_A> <OPTION_B>Form the initial tableau</OPTION_B> <OPTION_C>Solve the system of equations</OPTION_C> <OPTION_D>Identify the pivot column</OPTION_D> <OPTION_E>Identify the pivot row</OPTION_E> <CORRECT_B>Answer B is correct because it is the first step in the simplex method.</CORRECT_B> <INCORRECT_A>Answer A is incorrect because adding slack variables to the constraints is not the first step in the simplex method.</INCORRECT_A> <INCORRECT_C>Answer C is incorrect because solving the system of equations is not the first step in the simplex method.</INCORRECT_C> <INCORRECT_D>Answer D is incorrect because identifying the pivot column is not the first step in the simplex method.</INCORRECT_D> <INCORRECT_E>Answer E is incorrect because identifying the pivot row is not the first step in the simplex method.</INCORRECT_E><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></OUTPUT>"""
        
        multipart_question_prompt = f"""You will be tasked with generating multi-part questions, anywhere between 3 and 5 parts. You can use <QUESTION_X> and </QUESTION_X> tags to encapsulate each part of the question, where X is the part number. The part number must be 'A', 'B', 'C', 'D', or 'E'. Here is a full example output, generating 1 practice problem for the lecture Simplex Method. 

       YOUR OUTPUT: 
        <OUTPUT>
        <QUESTION_A>What is the primary goal of the simplex method in linear programming?</QUESTION_A> 
        <OPTION_A>To maximize or minimize a linear objective function</OPTION_A> 
        <OPTION_B>To graphically represent constraints</OPTION_B> 
        <OPTION_C>To eliminate redundant constraints</OPTION_C> 
        <OPTION_D>To compute the gradient of the objective function</OPTION_D> 
        <OPTION_E>To identify the pivot column</OPTION_E>
        <CORRECT_A>Answer A is correct because the simplex method is designed to optimize a linear objective function under given constraints.</CORRECT_A> 
        <INCORRECT_B>Answer B is incorrect because graphical representation is typically used for problems with two variables, not as part of the simplex method.</INCORRECT_B> 
        <INCORRECT_C>Answer C is incorrect because eliminating redundant constraints is not the primary focus of the simplex method.</INCORRECT_C> 
        <INCORRECT_D>Answer D is incorrect because computing the gradient is not relevant in the simplex method, which operates in a linear programming context.</INCORRECT_D>
        <INCORRECT_E>Answer E is incorrect because identifying the pivot column is not the primary focus of the simplex method.</INCORRECT_E><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5>
        
        <QUESTION_B>What is the purpose of adding slack variables to the constraints?</QUESTION_B> 
        <OPTION_A>To convert inequalities into equalities</OPTION_A> 
        <OPTION_B>To identify redundant constraints</OPTION_B> 
        <OPTION_C>To determine the pivot column</OPTION_C> 
        <OPTION_D>To check for feasibility</OPTION_D> 
        <OPTION_E>To identify the pivot row</OPTION_E>
        <CORRECT_A>Answer A is correct because slack variables are added to convert inequality constraints into equality constraints, allowing the simplex method to work effectively.</CORRECT_A> 
        <INCORRECT_B>Answer B is incorrect because identifying redundant constraints is not the purpose of slack variables.</INCORRECT_B> 
        <INCORRECT_C>Answer C is incorrect because determining the pivot column is a step in the simplex algorithm, not related to adding slack variables.</INCORRECT_C> 
        <INCORRECT_D>Answer D is incorrect because checking feasibility is achieved through other aspects of the simplex method.</INCORRECT_D>
        <INCORRECT_E>Answer E is incorrect because identifying the pivot row is not the purpose of slack variables.</INCORRECT_E><SLIDE 1><SLIDE 2><SLIDE 3>
        
        <QUESTION_C>What is the next step after forming the initial tableau in the simplex method?</QUESTION_C> 
        <OPTION_A>Identify the pivot column</OPTION_A> 
        <OPTION_B>Check for feasibility</OPTION_B> 
        <OPTION_C>Perform row operations</OPTION_C> 
        <OPTION_D>Add artificial variables</OPTION_D> 
        <OPTION_E>Identify the pivot row</OPTION_E>
        <CORRECT_A>Answer A is correct because identifying the pivot column is the next logical step after forming the initial tableau.</CORRECT_A> 
        <INCORRECT_B>Answer B is incorrect because feasibility is checked before forming the tableau.</INCORRECT_B> 
        <INCORRECT_C>Answer C is incorrect because row operations occur after the pivot column and pivot row are identified.</INCORRECT_C> 
        <INCORRECT_D>Answer D is incorrect because artificial variables are used in specific cases, such as in the two-phase method, not as the immediate next step.</INCORRECT_D>
        <INCORRECT_E>Answer E is incorrect because identifying the pivot row is not the next step after forming the initial tableau.</INCORRECT_E><SLIDE 7><SLIDE 9>
        </OUTPUT>
        """
        
        conceptual_question_prompt = f"""IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is not a single step, but a concept or idea."""
        
        computational_question_prompt = f"""IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process."""
        
        
        # single-part, conceptual
        self.single_part_conceptual_prompt = base_question_prompt + conceptual_question_prompt + default_question_prompt
        
        # single-part, computational
        self.single_part_computational_prompt = base_question_prompt + computational_question_prompt + default_question_prompt
        
        # multi-part, conceptual
        self.multi_part_conceptual_prompt = base_question_prompt + conceptual_question_prompt + multipart_question_prompt
        
        # multi-part, computational
        self.multi_part_computational_prompt = base_question_prompt + computational_question_prompt + multipart_question_prompt
        
        # check if questions.json exists
        if os.path.exists(self.json_output_file) and not self.regenerate:
            with open(self.json_output_file, "r") as file:
                self.questions = json.load(file)
        else:
            self.questions = {} 
        
        
    def process_batch(self, num_questions: int, lecture_name: str, content: str, prompt: str):
        # flat questions 
        flat_questions = []
        for key in self.questions.keys():
            for i in range(len(self.questions[key])):
                flat_questions.extend(self.questions[key][i])
        
        # Join all previously generated questions into a single string
        already_generated = "\n".join([
            question["question"] 
            for question in flat_questions
        ])
        
        message = HumanMessage(content=[
            {"type": "text", "text": prompt},
            {"type": "text", "text": "The following questions have already been generated. Do not repeat them: " + already_generated},
            {"type": "text", "text": f"You should generate {num_questions} new questions for the lecture: {lecture_name}. INPUT: " + content + "\n\nYOUR OUTPUT: "},
        ])
        return self.robust_generate(message)
    
    def clean_result(self, result: str, lecture_name: str, tags: list):
        """Clean up the result into the specified question format"""
        question_blocks = re.findall(r'<OUTPUT>(.*?)</OUTPUT>', result, re.DOTALL)
        for block in question_blocks:
            if not block.strip():
                continue
            
            try:
                question_objs = []
                if "multi-part" in tags:
                    multi_part_question_obj = []
                    
                    for letter in ['A', 'B', 'C', 'D', 'E']:
                        # Pattern to match everything from QUESTION_X to either the next QUESTION_ or the end
                        pattern = f'<QUESTION_{letter}>(.*?)</QUESTION_{letter}>(.*?)(?=<QUESTION_[A-E]>|$)'
                        part_match = re.search(pattern, block, re.DOTALL)
                        
                        if part_match:
                            # Group 1 is the question text, Group 2 is everything else
                            question_text = part_match.group(1).strip()
                            part_block = part_match.group(0)  # Full match including question tags
                            
                            # Extract slide numbers for this part
                            slide_matches = re.findall(r'<SLIDE\s+(\d+)>', part_block)
                            slides = [int(num) for num in slide_matches if num.isdigit()]
                            
                            # Process this part as a question
                            question_obj = self._process_question_block(question_text, part_block, slides, tags)
                            if question_obj:  # Only append if we got a valid question object
                                multi_part_question_obj.append(question_obj)
                    
                    if len(multi_part_question_obj) > 0:
                        question_objs.append(multi_part_question_obj)
                    else:
                        print(f"No questions generated for {lecture_name}. RESULT: {result}")
                else:
                    # Handle single-part questions
                    slide_matches = re.findall(r'<SLIDE\s+(\d+)>', block)
                    slides = [int(num) for num in slide_matches if num.isdigit()]
                    question_match = re.search(r'<QUESTION>(.*?)</QUESTION>', block)
                    if question_match:
                        question = question_match.group(1).strip()
                        question_obj = self._process_question_block(question, block, slides, tags)
                        if question_obj:  # Only append if we got a valid question object
                            question_objs.append([question_obj])
                
                if question_objs and lecture_name not in self.questions:
                    self.questions[lecture_name] = []
                if question_objs:
                    self.questions[lecture_name].extend(question_objs)
                    
            except Exception as e:
                print(f"Error processing question block: {str(e)}")
                print(f"Block content: {block[:200]}...")  # Print first 200 chars of problematic block
                continue

    def _process_question_block(self, question, block, slides, tags):
        """Helper method to process a single question block"""
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
        
        # Create question object
        question_obj = {
            "question": question,
            "options": options,
            "answers": answers,
            "explanations": explanations,
            "type": 'mcq',
            "tags": tags,
            "slides": slides
        }
        
        return question_obj
    
    def process_problems(self, num_docs = None, num_questions: int = 3, conceptual_computational_ratio = None, single_multi_part_ratio = None):
        """
        Process slides, extract content in batches, and generates problems.
        
        Args:
            num_docs: the number of documents to process. If None, process all documents.
            num_questions: the number of questions to ask.
            conceptual_computational_ratio: the ratio of conceptual questions to computational questions. If None, generate all questions.
            single_multi_part_ratio: the ratio of single-part questions to multi-part questions. If None, generate all questions.
        """
        
        if conceptual_computational_ratio is None:
            conceptual_computational_ratio = 1
        if single_multi_part_ratio is None:
            single_multi_part_ratio = 1
        
        if conceptual_computational_ratio > 1:
            raise ValueError("conceptual_computational_ratio cannot be greater than 1")
        
        if single_multi_part_ratio > 1:
            raise ValueError("single_multi_part_ratio cannot be greater than 1")
        
        # Process each category and aggregate results
        if num_docs is None:  
            num_docs = len(self.slides)
        else:
            num_docs = min(num_docs, len(self.slides))
        
        for i in range(0, num_docs):
            print(f"Processing {self.slide_names[i]}")
            remaining_questions = num_questions - len(self.questions.get(self.slide_names[i], []))
            # check if the lecture already has specified number of questions, and subtract from num_questions
            if remaining_questions <= 0:
                print(f"Skipping {self.slide_names[i]} - already has {len(self.questions.get(self.slide_names[i], []))} questions")
                continue
            try:
                print(f"Generating {remaining_questions} questions for {self.slide_names[i]}")
                
                # First split: conceptual vs computational
                conceptual_questions = round(remaining_questions * conceptual_computational_ratio)
                computational_questions = remaining_questions - conceptual_questions
                
                # Then split each category into single vs multi-part
                single_part_conceptual = round(conceptual_questions * single_multi_part_ratio)
                multi_part_conceptual = conceptual_questions - single_part_conceptual
                
                single_part_computational = round(computational_questions * single_multi_part_ratio)
                multi_part_computational = computational_questions - single_part_computational
                
                question_numbers = [single_part_conceptual, multi_part_conceptual, single_part_computational, multi_part_computational]
                prompts = [self.single_part_conceptual_prompt, self.multi_part_conceptual_prompt, self.single_part_computational_prompt, self.multi_part_computational_prompt]
                all_tags = [["conceptual"], ["conceptual", "multi-part"], ["computational"], ["computational", "multi-part"]]
                
                for num_questions, prompt, tags in zip(question_numbers, prompts, all_tags):
                    if num_questions == 0:
                        continue
                    # Only try to print tags[1] if it exists
                    tag_description = f"{tags[0]} {tags[1]}" if len(tags) > 1 else tags[0]
                    print(f"Generating {num_questions} {tag_description} questions")
                    result = self.process_batch(num_questions, self.slide_names[i], self.slides[i], prompt)
                    self.clean_result(result, self.slide_names[i], tags)

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
            lecture_dir = os.path.join(file_path, lecture_name)
            os.makedirs(lecture_dir, exist_ok=True)

            questions_path = os.path.join(lecture_dir, "questions.txt")
            with open(questions_path, "w") as questions_file:
                for q_idx, question_group in enumerate(self.questions[lecture_name], 1):
                    questions_file.write(f"QUESTION {q_idx}\n")
                    
                    if len(question_group) > 1:
                        # Handle multipart questions
                        for part_idx, part in enumerate(question_group):
                            part_letter = chr(65 + part_idx)  # Convert 0,1,2 to A,B,C
                            questions_file.write(f"Part {part_letter}:\n")
                            questions_file.write(f"{part['question']}\n")
                            
                            # Options with indentation
                            for opt in ['A', 'B', 'C', 'D', 'E']:
                                questions_file.write(f"{opt}. {part['options'][opt]}\n")
                            
                            # Answer and explanation with indentation
                            answer = [opt for opt, value in part['answers'].items() if value][0]
                            questions_file.write(f"\nANSWER: {answer}\n")
                            questions_file.write(f"\nEXPLANATION:\n")
                            for opt in part['explanations'].keys():
                                questions_file.write(f"{opt}. {part['explanations'][opt]}\n")
                            questions_file.write("\n")
                    else:
                        # Handle single questions
                        part = question_group[0]
                        questions_file.write(part['question'] + "\n")
                        
                        for opt in ['A', 'B', 'C', 'D', 'E']:
                            questions_file.write(f"{opt}. {part['options'][opt]}\n")
                        
                        answer = [opt for opt, value in part['answers'].items() if value][0]
                        questions_file.write(f"\nANSWER: {answer}\n")
                        questions_file.write(f"\nEXPLANATION:\n")
                        for opt in part['explanations'].keys():
                            questions_file.write(f"{opt}. {part['explanations'][opt]}\n")
                    
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
                if len(question) > 1:
                    # generate random uuid to connect multi-part questions
                    multipart_uuid = str(uuid.uuid4())
                    for multi_question in question:
                        self.supabase.table("questions").insert({
                            "question": multi_question["question"],
                            "option_a": multi_question["options"]["A"],
                            "option_b": multi_question["options"]["B"],
                            "option_c": multi_question["options"]["C"],
                            "option_d": multi_question["options"]["D"],
                            "option_e": multi_question["options"]["E"],
                            "solution": [opt for opt, value in multi_question["answers"].items() if value][0],
                            "explanation_a": multi_question["explanations"]["A"],
                            "explanation_b": multi_question["explanations"]["B"],
                            "explanation_c": multi_question["explanations"]["C"],
                            "explanation_d": multi_question["explanations"]["D"],
                            "explanation_e": multi_question["explanations"]["E"],
                            "lecture": lecture_mapping[lecture_name],
                            "multipart": multipart_uuid
                        }).execute()
                else:    
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