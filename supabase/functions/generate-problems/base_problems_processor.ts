import { BaseProcessor, ContentType } from "../_shared/base_processor.ts";
import { HumanMessage } from "npm:@langchain/core/messages";

export enum QuestionType {
    MCQ = "mcq",
    FRQ = "frq",
}

interface QuestionOption {
    text: string;
    isCorrect: boolean;
    explanation: string;
}

export interface Question {
    question: string;
    options: { [key: string]: string };
    answers: { [key: string]: boolean };
    explanations: { [key: string]: string };
    type: string;
    tags: string[];
    slides: number[];
}

export interface ProblemsContent {
    figures: { [key: number]: string[] };
    content: string;
}

export class BaseProblemsProcessor extends BaseProcessor {
    protected contentType: ContentType;
    protected questionType: QuestionType;
    protected courseTitle: string;
    protected questions: { [key: string]: Question[][] } = {};

    // Prompts
    protected singlePartConceptualPrompt: string = "";
    protected singlePartComputationalPrompt: string = "";
    protected multiPartConceptualPrompt: string = "";
    protected multiPartComputationalPrompt: string = "";

    constructor(
        apiKey: string,
        courseTitle: string,
        contentType: ContentType,
        questionType: QuestionType = QuestionType.MCQ,
    ) {
        super(apiKey);
        this.courseTitle = courseTitle;
        this.contentType = contentType;
        this.questionType = questionType;
        this.initializePrompts();
    }

    protected initializePrompts(): void {
        if (this.questionType === QuestionType.MCQ) {
            this.initializeMCQPrompts();
        } else {
            this.initializeFRQPrompts();
        }
    }

    protected initializeMCQPrompts(): void {
        const baseQuestionPrompt =
            `You are a professor for the class ${this.courseTitle}. You will be given documents from lectures and be asked to generate multiple choice questions for the students to answer. You will have 5 answer choices available, 'A', 'B', 'C', 'D', and 'E'. For each question generated, there can only be one correct answer. If your response contains math symbols, be sure to use LaTeX formatting.`;
        const qualityPrompt =
            `To generate questions of the highest quality, here are some guidelines you should follow.
            
            CRITICAL REQUIREMENTS:
            1. Questions should directly relate to the core content of the ${this.contentType.valueOf()}.
            2. Make each explanation complete and self-contained.
            3. Each question should be difficult to answer correctly, if the student is not familiar with the content.
            4. Questions should involve multi-step reasoning.
            5. Make sure the questions cover a diverse set of concepts from the ${this.contentType.valueOf()}.`;

        const conceptualPrompt = `IMPORTANT: In addition, you should aim to generate conceptual questions, where the answer is not a single step, but a concept or idea.`;
        const computationalPrompt = `IMPORTANT: In addition, you should aim to generate computational questions, where the answer is a single step or a series of steps that are part of the computational process.`;

        const singlePartPrompt = `TASK: You will be generating single-part questions to test comprehension of the ${this.contentType.valueOf()}. 
        
        WHAT TO DO:
        1. Put the question in <QUESTION> and </QUESTION> tags.
        2. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center.
        3. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. 
        4. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags.
        5. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question.
        6. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations.
        
        Here is a full example output, generating 1 practice problem for the ${this.contentType.valueOf()} Simplex Method. 

        YOUR OUTPUT: <OUTPUT><QUESTION>What is the first step in the simplex method?</QUESTION> <OPTION_A>Add slack variables to the constraints</OPTION_A> <OPTION_B>Form the initial tableau</OPTION_B> <OPTION_C>Solve the system of equations</OPTION_C> <OPTION_D>Identify the pivot column</OPTION_D> <OPTION_E>Identify the pivot row</OPTION_E> <CORRECT_B>Answer B is correct because it is the first step in the simplex method.</CORRECT_B> <INCORRECT_A>Answer A is incorrect because adding slack variables to the constraints is not the first step in the simplex method.</INCORRECT_A> <INCORRECT_C>Answer C is incorrect because solving the system of equations is not the first step in the simplex method.</INCORRECT_C> <INCORRECT_D>Answer D is incorrect because identifying the pivot column is not the first step in the simplex method.</INCORRECT_D> <INCORRECT_E>Answer E is incorrect because identifying the pivot row is not the first step in the simplex method.</INCORRECT_E><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></OUTPUT>`;
        const multiPartPrompt = `TASK: You will be generating multi-part questions to test comprehension of the ${this.contentType.valueOf()}. 
        
        WHAT TO DO: 
        1. You must generate at least 3 parts, and at most 5 parts.
        2. Put the question in <QUESTION_X> and </QUESTION_X> tags, where X is the part number. For example, if you have 3 parts, you must use <QUESTION_A>, <QUESTION_B>, and <QUESTION_C> tags. The part number must be 'A', 'B', 'C', 'D', or 'E'. 
        3. Put the options in tags corresponding to the answer choice, e.g. <OPTION_A> and </OPTION_A>, with the text describing the option in the center.
        4. Put the answer in a tag if it is correct and incorrect ones with an explanation in a tag. For example, if answer A is correct, place the explanation in <CORRECT_A> and </CORRECT_A> tags. 
        5. If the answer is incorrect, place the explanation in <INCORRECT_B> and </INCORRECT_B> tags.
        6. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question.
        7. Use <OUTPUT> and </OUTPUT> tags to encapsulate the question, options, answers, and explanations.
        
        Here is a full example output, generating 1 practice problem for the ${this.contentType.valueOf()} Simplex Method, with 3 parts. 

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
        </OUTPUT>`;

        this.singlePartConceptualPrompt =
            `${baseQuestionPrompt}${qualityPrompt}${conceptualPrompt}${singlePartPrompt}`;
        this.singlePartComputationalPrompt =
            `${baseQuestionPrompt}${qualityPrompt}${computationalPrompt}${singlePartPrompt}`;
        this.multiPartConceptualPrompt =
            `${baseQuestionPrompt}${qualityPrompt}${conceptualPrompt}${multiPartPrompt}`;
        this.multiPartComputationalPrompt =
            `${baseQuestionPrompt}${qualityPrompt}${computationalPrompt}${multiPartPrompt}`;
    }

    protected initializeFRQPrompts(): void {
        // To be implemented
        this.singlePartConceptualPrompt = "To be implemented...";
        this.singlePartComputationalPrompt = "To be implemented...";
        this.multiPartConceptualPrompt = "To be implemented...";
        this.multiPartComputationalPrompt = "To be implemented...";
    }

    protected async processBatch(
        numQuestions: number,
        name: string,
        content: string,
        prompt: string,
    ): Promise<string> {
        const flatQuestions = Object.values(this.questions)
            .flat()
            .flat()
            .map((q) => q.question)
            .join("\n");

        const message = new HumanMessage({
            content: [
                { type: "text", text: prompt },
                {
                    type: "text",
                    text:
                        "The following questions have already been generated. Do not repeat them: " +
                        flatQuestions,
                },
                {
                    type: "text",
                    text:
                        `You should generate ${numQuestions} new questions for: ${name}. INPUT: ${content}\n\nYOUR OUTPUT: `,
                },
            ],
        });

        return await this.robustGenerate(message);
    }

    protected cleanResult(result: string, name: string, tags: string[]): void {
        if (this.questionType === QuestionType.MCQ) {
            this.cleanMCQResult(result, name, tags);
        } else {
            this.cleanFRQResult(result, name, tags);
        }
    }

    private cleanMCQResult(result: string, name: string, tags: string[]): void {
        // Remove XML tags if present
        result = result.replace(/```xml|```/g, "");

        const questionBlocks = result.match(/<OUTPUT>.*?<\/OUTPUT>/gs) || [];

        for (const block of questionBlocks) {
            try {
                const questionObjs: Question[][] = [];

                if (tags.includes("multi-part")) {
                    const multiPartQuestionObj: Question[] = [];

                    for (const letter of ["A", "B", "C", "D", "E"]) {
                        const questionMatch = block.match(
                            new RegExp(
                                `<QUESTION_${letter}>(.*?)</QUESTION_${letter}>`,
                                "s",
                            ),
                        );
                        if (questionMatch) {
                            const questionObj = this.processMCQBlock(
                                questionMatch[1].trim(),
                                block,
                                tags,
                            );
                            if (questionObj) {
                                multiPartQuestionObj.push(questionObj);
                            }
                        }
                    }

                    if (multiPartQuestionObj.length > 0) {
                        questionObjs.push(multiPartQuestionObj);
                    }
                } else {
                    const questionMatch = block.match(
                        /<QUESTION>(.*?)<\/QUESTION>/s,
                    );
                    if (questionMatch) {
                        const questionObj = this.processMCQBlock(
                            questionMatch[1].trim(),
                            block,
                            tags,
                        );
                        if (questionObj) {
                            questionObjs.push([questionObj]);
                        }
                    }
                }

                if (questionObjs.length > 0) {
                    if (!this.questions[name]) {
                        this.questions[name] = [];
                    }
                    this.questions[name].push(...questionObjs);
                }
            } catch (e) {
                console.error(
                    `Error processing question block: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                );
            }
        }
    }

    private processMCQBlock(
        question: string,
        block: string,
        tags: string[],
    ): Question | null {
        const slides = Array.from(block.matchAll(/<SLIDE\s+(\d+)>/g))
            .map((match) => parseInt(match[1]))
            .filter((num) => !isNaN(num));

        const options: { [key: string]: string } = {};
        const answers: { [key: string]: boolean } = {};
        const explanations: { [key: string]: string } = {};

        for (const letter of ["A", "B", "C", "D", "E"]) {
            const optionMatch = block.match(
                new RegExp(`<OPTION_${letter}>(.*?)</OPTION_${letter}>`, "s"),
            );
            if (optionMatch) {
                options[letter] = optionMatch[1].trim();
                answers[letter] = false;
            }

            const correctMatch = block.match(
                new RegExp(`<CORRECT_${letter}>(.*?)</CORRECT_${letter}>`, "s"),
            );
            const incorrectMatch = block.match(
                new RegExp(
                    `<INCORRECT_${letter}>(.*?)</INCORRECT_${letter}>`,
                    "s",
                ),
            );

            if (correctMatch) {
                answers[letter] = true;
                explanations[letter] = correctMatch[1].trim();
            } else if (incorrectMatch) {
                explanations[letter] = incorrectMatch[1].trim();
            }
        }

        return {
            question,
            options,
            answers,
            explanations,
            type: "mcq",
            tags,
            slides,
        };
    }

    private cleanFRQResult(result: string, name: string, tags: string[]): void {
        console.log("FRQ result:", result);
        console.log("FRQ name:", name);
        console.log("FRQ tags:", tags);
        // To be implemented
    }
}
