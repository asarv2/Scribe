from lecture.base_processor import BaseProcessor, ContentType
from langchain_core.messages import HumanMessage
import re
import json
import os
import uuid
from enum import Enum

class QuestionType(Enum):
    MCQ = "mcq"
    FRQ = "frq"

class BaseProblemsProcessor(BaseProcessor):
    def __init__(self, content_type: ContentType, question_type: QuestionType, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.content_type = content_type
        self.question_type = question_type
        
        # Customizable paths
        self.questions_dir = os.path.join(self.output_dir, self.course_code)
        self.content_dir = os.path.join(self.questions_dir, "content")  # Override in child classes
        self.json_filename = f"{self.content_type.value}_questions.json"
        self.json_output_file = os.path.join(self.questions_dir, self.json_filename)
        
        # Create necessary directories
        os.makedirs(self.questions_dir, exist_ok=True)
        os.makedirs(self.content_dir, exist_ok=True)
        
        # Initialize prompts and questions
        self._initialize_prompts()
        self.questions = self._load_existing_questions()
        
        
    def _initialize_prompts(self):
        """Initialize prompts based on question type"""
        if self.question_type == QuestionType.MCQ:
            self._initialize_mcq_prompts()
        elif self.question_type == QuestionType.FRQ:
            self._initialize_frq_prompts()
    
    def _initialize_mcq_prompts(self):
        """Initialize prompts for MCQ questions"""
        base_question_prompt = f"""You are a professor for the class {self.course_title}. You will be given documents from lectures and be asked to generate multiple choice questions for the students to answer. You will have 5 answer choices available, 'A', 'B', 'C', 'D', and 'E'. There can only be one correct answer. Put the question in <QUESTION> and </QUESTION> tags. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question. For each question, use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations. When adding your textual response with math symbols, be sure to use LaTeX formatting. """
        
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
        
    
    def _initialize_frq_prompts(self):
        """Initialize prompts for FRQ questions"""
                # single-part, conceptual
        self.single_part_conceptual_prompt = "To be implmented..."
        
        # single-part, computational
        self.single_part_computational_prompt = "To be implmented..."
        
        # multi-part, conceptual
        self.multi_part_conceptual_prompt = "To be implmented..."
        
        # multi-part, computational
        self.multi_part_computational_prompt = "To be implmented..."
    
    def _load_existing_questions(self):
        """Load existing questions from JSON file if it exists"""
        if os.path.exists(self.json_output_file) and not self.regenerate:
            with open(self.json_output_file, "r") as file:
                return json.load(file)
        return {}

    def process_batch(self, num_questions: int, name: str, content: str, prompt: str):
        """Process a batch of questions"""
        flat_questions = []
        for key in self.questions.keys():
            for i in range(len(self.questions[key])):
                flat_questions.extend(self.questions[key][i])
        
        already_generated = "\n".join([
            question["question"] 
            for question in flat_questions
        ])
        
        message = HumanMessage(content=[
            {"type": "text", "text": prompt},
            {"type": "text", "text": "The following questions have already been generated. Do not repeat them: " + already_generated},
            {"type": "text", "text": f"You should generate {num_questions} new questions for: {name}. INPUT: " + content + "\n\nYOUR OUTPUT: "},
        ])
        return self.robust_generate(message)
    
    def clean_result(self, result: str, name: str, tags: list):
        """Clean the result based on the question type"""
        if self.question_type == QuestionType.MCQ:
            return self._clean_mcq_result(result, name, tags)
        elif self.question_type == QuestionType.FRQ:
            return self._clean_frq_result(result, name, tags)

    def _clean_mcq_result(self, result: str, lecture_name: str, tags: list):
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
                            question_obj = self._process_mcq_block(question_text, part_block, slides, tags)
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
                        question_obj = self._process_mcq_block(question, block, slides, tags)
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

    def _process_mcq_block(self, question, block, slides, tags):
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

    def _clean_frq_result(self, result: str, name: str, tags: list):
        """Clean FRQ-specific results"""
        pass  # To be implemented

    def _process_frq_block(self, question, block, slides, tags):
        """Process FRQ-specific blocks"""
        pass  # To be implemented

    def save_questions_json(self):
        """Save questions to JSON"""
        with open(self.json_output_file, "w") as file:
            json.dump(self.questions, file, indent=4)

    def save_questions_text(self):
        """Save questions to text files"""
        for name in self.questions.keys():
            content_path = os.path.join(self.content_dir, name)
            os.makedirs(content_path, exist_ok=True)
            
            questions_path = os.path.join(content_path, f"{self.content_type.value}_questions.txt")
            with open(questions_path, "w") as questions_file:
                for q_idx, question_group in enumerate(self.questions[name], 1):
                    questions_file.write(f"QUESTION {q_idx}\n")
                    
                    if len(question_group) > 1:
                        self._write_multipart_question(questions_file, question_group)
                    else:
                        self._write_single_question(questions_file, question_group[0])
                    
                    questions_file.write("\n\n")

    def _write_multipart_question(self, file, question_group):
        """Helper method to write multipart questions"""
        for part_idx, part in enumerate(question_group):
            part_letter = chr(65 + part_idx)
            file.write(f"Part {part_letter}:\n")
            file.write(f"{part['question']}\n")
            
            if part["type"] == "mcq":
                self._write_mcq_options(file, part)
            
            file.write(f"\nANSWER: {self._get_answer(part)}\n")
            file.write(f"\nEXPLANATION:\n")
            self._write_explanations(file, part)
            file.write("\n")

    def _write_single_question(self, file, question):
        """Helper method to write single questions"""
        file.write(question['question'] + "\n")
        
        if question["type"] == "mcq":
            self._write_mcq_options(file, question)
        
        file.write(f"\nANSWER: {self._get_answer(question)}\n")
        file.write(f"\nEXPLANATION:\n")
        self._write_explanations(file, question)

    def _write_mcq_options(self, file, question):
        """Helper method to write MCQ options"""
        if 'options' not in question:
            print(f"Warning: Question missing options: {question.get('question', 'Unknown question')}")
            return
        
        for opt in ['A', 'B', 'C', 'D', 'E']:
            if opt not in question['options']:
                print(f"Warning: Question missing option {opt}: {question.get('question', 'Unknown question')}")
                return
            file.write(f"{opt}. {question['options'][opt]}\n")

    def _get_answer(self, question):
        """Helper method to get the correct answer"""
        if question["type"] == "mcq":
            try:
                return next(opt for opt, value in question['answers'].items() if value)
            except StopIteration:
                print(f"Warning: No correct answer found for MCQ question: {question.get('question', '')}")
                return "NO CORRECT ANSWER MARKED"
        return question.get('answer', '')

    def _write_explanations(self, file, question):
        """Helper method to write explanations"""
        if question["type"] == "mcq":
            for opt in question['explanations'].keys():
                file.write(f"{opt}. {question['explanations'][opt]}\n")
        else:
            file.write(question.get('solution', '') + "\n")

    def save_questions_pdf(self):
        """Save questions to PDF"""
        for name in self.questions.keys():
            content_path = os.path.join(self.content_dir, name)
            os.makedirs(content_path, exist_ok=True)
            self.save_questions_latex(name, self.questions[name], f"{self.content_type.value}_questions")

    def save_questions_supabase(self):
        """Save questions to Supabase"""
        lecture_mapping = self.supabase.table("lectures").select("id, name").execute().data
        topic_mapping = self.supabase.table("topics").select("id, title").execute().data
        
        questions_added = 0
        for name in self.questions.keys():
            if self.content_type == ContentType.LECTURE:
                reference_id = [lecture["id"] for lecture in lecture_mapping if lecture["name"] == name]
                if len(reference_id) == 0:
                    print(f"Skipping {name} - no lecture found")
                    continue
                reference_id = reference_id[0]
            elif self.content_type == ContentType.TOPIC:
                reference_id = [topic["id"] for topic in topic_mapping if topic["title"] == name]
                if len(reference_id) == 0:
                    print(f"Skipping {name} - no topic found")
                    continue
                reference_id = reference_id[0]
            for question in self.questions[name]:
                if len(question) > 1:
                    multipart_uuid = str(uuid.uuid4())
                    for multi_question in question:
                        self._save_question_to_supabase(multi_question, reference_id, multipart_uuid)
                else:
                    self._save_question_to_supabase(question[0], reference_id)
                questions_added += 1
        print(f"Saved {questions_added} questions to supabase.")

    def _save_question_to_supabase(self, question, reference_id, multipart_uuid=None):
        """Helper method to save a single question to Supabase"""
        try:
            question_data = {
                "question": question["question"],
                "mcq": True if question["type"] == "mcq" else False,
                "conceptual": True if "conceptual" in question["tags"] else False,
            }
            
            if question["type"] == "mcq":
                # Validate that there is at least one correct answer
                correct_answer = None
                try:
                    correct_answer = next(opt for opt, value in question["answers"].items() if value)
                except StopIteration:
                    print(f"Warning: No correct answer found for question: {question['question'][:100]}...")
                    return  # Skip this question
                
                question_data.update({
                    "option_a": question["options"]["A"],
                    "option_b": question["options"]["B"],
                    "option_c": question["options"]["C"],
                    "option_d": question["options"]["D"],
                    "option_e": question["options"]["E"],
                    "solution": correct_answer,
                    "explanation_a": question["explanations"]["A"],
                    "explanation_b": question["explanations"]["B"],
                    "explanation_c": question["explanations"]["C"],
                    "explanation_d": question["explanations"]["D"],
                    "explanation_e": question["explanations"]["E"],
                })
            else:
                question_data.update({
                    "solution": question["solution"],
                })
            
            if multipart_uuid:
                question_data["multipart"] = multipart_uuid
                
            if self.content_type == ContentType.LECTURE:
                question_data["lecture"] = reference_id
            elif self.content_type == ContentType.TOPIC:
                question_data["topic"] = reference_id
                
            self.supabase.table("questions").insert(question_data).execute()
            
        except KeyError as e:
            print(f"Error: Missing required field {e} in question: {question.get('question', 'Unknown')[:100]}...")
        except Exception as e:
            print(f"Error saving question to Supabase: {str(e)}")
            
    def save_questions_storage_supabase(self):
        """Save questions to Supabase storage"""
        for name in self.questions.keys():
            if not os.path.exists(os.path.join(self.output_dir, self.course_code, self.content_type.value, f"{name}", "questions.pdf")):
                print(f"Skipping {name} - questions.pdf does not exist")
                return
            response = self.supabase.storage.from_("slides").upload(
                file=os.path.join(self.output_dir, self.course_code, self.content_type.value, f"{name}", "questions.pdf"),
                path=f"{self.course_code}/{self.content_type.value}/{name}/questions.pdf",
                file_options={"cache-control": "3600", "upsert": "true"},
            )
            print(f"Saved {name} to supabase storage. Response: {response}")
            