import { HumanMessage } from "npm:@langchain/core/messages";
import {
    BaseProcessor,
    ContentType,
    Figure,
} from "../_shared/base_processor.ts";

export interface SummaryContent {
    figures: { [key: number]: Figure[] };
    content: string;
}

export interface Summary {
    preamble: string;
    content: string;
    conclusion: string;
    slides: { [key: string]: number[] };
}

export class BaseSummaryProcessor extends BaseProcessor {
    protected courseTitle: string;
    protected contentType: ContentType;
    protected summary: { [key: string]: Summary };
    protected summaryPrompt: string;

    constructor(apiKey: string, courseTitle: string, contentType: ContentType) {
        super(apiKey);
        this.courseTitle = courseTitle;
        this.contentType = contentType;
        this.summary = {};

        const baseQuestionPrompt =
            `You are an expert summarization assistant tasked with creating a comprehensive and cohesive summary, in the context of the class ${this.courseTitle}. You will be given documents from lectures and be asked to generate a complete summary. If your response contains math symbols, be sure to use LaTeX formatting.`;

        const qualityPrompt =
            `To generate summaries of the highest quality, here are some guidelines you should follow.
            
            CRITICAL REQUIREMENTS:
            1. This course is a graduate level class, so you will need to generate complex, multi-step summaries.
            2. Summaries should directly relate to the core content of the ${this.contentType.valueOf()}.
            3. Make each summary complete and self-contained.
            4. Make sure the summaries cover a diverse set of concepts from the ${this.contentType.valueOf()}.`;

        const summaryRequirementsPropmt =
            `TASK: Generate a summary for the given ${this.contentType.valueOf()}(s).
        
        WHAT TO DO:
        1. Use <PREAMBLE> and </PREAMBLE> tags to encapsulate the preamble.
        2. Use <SUMMARY> and </SUMMARY> tags to encapsulate the summary.
        3. Use <CONCLUSION> and </CONCLUSION> tags to encapsulate the conclusion.
        4. For any slides, that you use, add <SLIDE x> tags, where x is the slide number. Remember to place the <SLIDE x> tags at the end of each question. You should encapsulate all of the slide tags for a given lecture in <LECTURE y> and </LECTURE> tags, where y is the lecture number. An example is <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>.
        5. Use <OUTPUT> and </OUTPUT> tags to encapsulate the summary.`;

        const summaryFormattingPrompt =
            `IMPORTANT: Follow these precise guidelines:

            1. Synthesize Information:
            - Generate a summary that captures the OVERALL essence of the lecture
            - Exclude details specific to individual slides or instances
            - Focus on broad, generalizable concepts and key insights

            2. Formatting Requirements:
            - Combine term and definition into a SINGLE, concise bullet point
            - Ensure each bullet point is a complete, informative sentence
            - Avoid breaking definitions across multiple bullet points
            - Maintain a clear, flowing narrative that connects key points logically

            3. Content Criteria:
            - Prioritize the most significant and impactful information
            - Eliminate redundant or overly specific details
            - Present information in a way that provides a holistic understanding
            - Use precise, academic language that conveys depth and nuance

            4. Structure:
            - Begin with a brief introductory statement defining the core concept in <PREAMBLE> and </PREAMBLE> tags.
            - Organize bullet points to create a logical progression of ideas in <SUMMARY> and </SUMMARY> tags.
            - Ensure each point adds unique value to the overall summary

            5. Final Review:
            - Check that the summary reads as a cohesive, integrated overview and add a <CONCLUSION> and </CONCLUSION> tag.
            - Verify that no point feels isolated or disconnected from the whole
            - Confirm that the summary provides a comprehensive yet concise understanding

            Generate the summary strictly adhering to these guidelines.
            
            Here is a complete example of a summary for the ${
                this.contentType.valueOf() === "lecture"
                    ? "lecture 2024-08-27-ExSimplex"
                    : "topic Simplex Method"
            }.
            
            <OUTPUT>
            <PREAMBLE>
            This explores the simplex method and its variants for solving linear programming problems. The simplex method iteratively moves from one vertex of the feasible region to another, improving the objective function value at each step until the optimal solution is found.
            </PREAMBLE>
            <SUMMARY>
            - **Basic Variables/Basic Feasible Solution**: Basic variables are those that define a vertex of the feasible region; setting non-basic variables to zero yields a basic feasible solution.
            - **Non-Basic Variables**: Non-basic variables are set to zero in a basic feasible solution.
            - **Entering/Leaving Arc**: In each iteration, a non-basic variable (entering variable) is selected to enter the basis, and a basic variable (leaving variable) is selected to leave the basis. The selection criteria can vary (e.g., largest-coefficient rule, largest-increase rule).
            - **Variables and Coefficients**: $x_j$ represents a variable in the linear program, and $a_{ij}$ represents the coefficient of variable $x_j$ in the $i$-th constraint.
            - **Slack Variable**: Slack variables are added to convert inequality constraints into equality constraints.
            - **Feasible Region**: The feasible region is the set of all points satisfying all constraints of the linear program.
            - **Optimal Dictionary**: The optimal dictionary represents the optimal solution of the linear program, expressing basic variables in terms of non-basic variables and providing the optimal objective function value.
            - **Reduced Costs**: Reduced costs (Reduced Cost $z_{ij}$) represent the change in the objective function value per unit increase in a non-basic variable. Non-negativity of reduced costs is a necessary and sufficient condition for optimality.
            - **Largest-Coefficient Rule/Largest-Increase Rule**: These are rules for selecting the entering variable in the simplex method. The largest-coefficient rule selects the variable with the largest coefficient in the objective function, while the largest-increase rule selects the variable that yields the largest increase in the objective function value.
            - **Klee-Minty Cube**: This is a worst-case example demonstrating that the simplex method can take an exponential number of iterations under certain pivot rules.
            - **Simplex Method in Matrix Form**: This is a compact matrix representation of the simplex method, facilitating efficient computation, especially for large problems.
            - **Revised Simplex Method**: A variant of the simplex method that uses matrix operations to update the solution efficiently.
            - **Parametric Analysis/Sensitivity Analysis**: These techniques analyze how changes in the objective function coefficients or the right-hand side values of the constraints affect the optimal solution.
            - **Auxiliary Problem**: An auxiliary problem is introduced to find an initial feasible solution when the origin is not feasible in the original problem. This is often used in the two-phase simplex method.
            - **Dictionary of Variables**: A representation of the linear program at a given iteration, expressing basic variables in terms of non-basic variables.
            </SUMMARY>
            <CONCLUSION>
            This also covers the network simplex method (both primal and dual), which leverages the network structure of certain linear programs for efficient solution. The algorithm iteratively improves the solution by modifying the spanning tree and updating primal and dual flows. Different variants of the network simplex method are discussed, including two-phased approaches that combine primal and dual methods to handle infeasible starting points.
            </CONCLUSION>
            <LECTURE 1><SLIDE 1><SLIDE 2><SLIDE 3><SLIDE 4><SLIDE 5></LECTURE>
            </OUTPUT>
            `;

        this.summaryPrompt =
            `${baseQuestionPrompt}\n${qualityPrompt}\n${summaryRequirementsPropmt}\n${summaryFormattingPrompt}`;
    }

    async processBatch(name: string, content: string): Promise<string> {
        const existingSummaries = Object.values(this.summary).map((summary) => summary.content).join("\n");
        const message = new HumanMessage({
            content: [
                { type: "text", text: this.summaryPrompt },
                {
                    type: "text",
                    text:
                        "The following summaries have already been generated. Modify the preamble and conclusion accordingly to encompass the new information. Do not repeat the summaries: " +
                        existingSummaries,
                },
                {
                    type: "text",
                    text:
                        `You should generate a summary for: ${name}. INPUT: ${content}\n\nYOUR OUTPUT: `,
                },
            ],
        });
        const trimmedMessages = await this.prepareConversationHistory([
            message,
        ]);
        return await this.robustGenerate(trimmedMessages[0]);
    }

    protected cleanResult(
        result: string,
        names: string,
        lectures: { id: string; note_number: number }[],
    ): void {
        try {
            // Clean XML code blocks
            result = result.replace(/```xml|```/g, "");

            // Extract content between <OUTPUT> and </OUTPUT> tags
            const outputMatch = result.match(/<OUTPUT>(.*?)<\/OUTPUT>/s);
            if (!outputMatch) {
                throw new Error("No output content found");
            }
            result = outputMatch[1].trim();

            // Extract lecture and slides information
            const lectureSlides: { [lecture: string]: number[] } = {};
            const lectureMatches = result.matchAll(/<LECTURE\s+(\d+)>(.*?)<\/LECTURE>/gs);

            for (const match of Array.from(lectureMatches)) {
                const lectureNumber = parseInt(match[1].trim());
                const lectureContent = match[2];

                // Find the lecture by note_number
                const lecture = lectures.find(l => l.note_number === lectureNumber);
                if (!lecture) continue;

                // Extract slide numbers for this lecture
                const slideNumbers = Array.from(lectureContent.matchAll(/<SLIDE\s+(\d+)>/g))
                    .map(slideMatch => parseInt(slideMatch[1]))
                    .filter(num => !isNaN(num));

                if (slideNumbers.length > 0) {
                    lectureSlides[lecture.id] = slideNumbers;
                }
            }

            // Extract preamble, summary, and conclusion content
            const preambleMatch = result.match(/<PREAMBLE>(.*?)<\/PREAMBLE>/s);
            const summaryMatch = result.match(/<SUMMARY>(.*?)<\/SUMMARY>/s);
            const conclusionMatch = result.match(/<CONCLUSION>(.*?)<\/CONCLUSION>/s);

            const preambleContent = preambleMatch?.[1].trim() || "";
            const summaryContent = summaryMatch?.[1].trim() || "";
            const conclusionContent = conclusionMatch?.[1].trim() || "";

            if (!summaryContent) {
                throw new Error("No summary content found");
            }

            // Update or create summary entry
            if (!this.summary[names]) {
                this.summary[names] = {
                    preamble: preambleContent,
                    content: summaryContent,
                    conclusion: conclusionContent,
                    slides: lectureSlides,
                };
            } else {
                // Update preamble if present in new batch
                if (preambleContent) {
                    this.summary[names].preamble = preambleContent;
                }
                
                // Concatenate summary content
                this.summary[names].content += "\n\n" + summaryContent;
                
                // Update conclusion if present in new batch
                if (conclusionContent) {
                    this.summary[names].conclusion = conclusionContent;
                }
                
                // Update slides
                this.summary[names].slides = {
                    ...this.summary[names].slides,
                    ...lectureSlides,
                };
            }
        } catch (e) {
            console.error(
                `Error processing summary block: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            );
        }
    }

    protected splitContentIntoBatches(content: string, numBatches: number): string[] {
        // Split content by double newlines to get individual sections
        const sections = content.split('\n\n');
        const batchSize = Math.ceil(sections.length / numBatches);
        
        const batches: string[] = [];
        for (let i = 0; i < sections.length; i += batchSize) {
            const batch = sections.slice(i, i + batchSize).join('\n\n');
            batches.push(batch);
        }
        
        return batches;
    }
}
