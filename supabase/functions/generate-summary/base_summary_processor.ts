import { HumanMessage } from "npm:@langchain/core/messages";
import { BaseProcessor, ContentType } from "../_shared/base_processor.ts";

export interface Figure {
    id: string;
    document: string;
    y_min: number;
    x_min: number;
    y_max: number;
    x_max: number;
    description: string;
}

export interface SummaryContent {
    figures: { [key: number]: Figure[] };
    content: string;
}

export class BaseSummaryProcessor extends BaseProcessor {
    protected courseTitle: string;
    protected contentType: ContentType;
    protected summary: Record<string, string>;
    protected summaryPrompt: string;

    constructor(apiKey: string, courseTitle: string, contentType: ContentType) {
        super(apiKey);
        this.courseTitle = courseTitle;
        this.contentType = contentType;
        this.summary = {};

        this.summaryPrompt =
            `You are an expert summarization assistant tasked with creating a comprehensive and cohesive summary of a lecture, in the context of the class ${this.courseTitle}. Follow these precise guidelines:

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
            - Begin with a brief introductory statement defining the core concept
            - Organize bullet points to create a logical progression of ideas
            - Ensure each point adds unique value to the overall summary

            5. Final Review:
            - Check that the summary reads as a cohesive, integrated overview
            - Verify that no point feels isolated or disconnected from the whole
            - Confirm that the summary provides a comprehensive yet concise understanding

            Generate the summary strictly adhering to these guidelines. CRITICAL: Your output should be in LaTeX format.`;
    }

    async processBatch(name: string, content: string): Promise<string> {
        const message = new HumanMessage({
            content: [
                { type: "text", text: this.summaryPrompt },
                {
                    type: "text",
                    text:
                        `You should generate a summary for: ${name}. INPUT: ${content}\n\nYOUR OUTPUT: `,
                },
            ],
        });
        const trimmedMessages = await this.prepareConversationHistory([message]);
        return await this.robustGenerate(trimmedMessages[0]);
    }
    
    protected cleanResult(result: string, names: string): void {
        try {
            result = result.trim();
            if (!this.summary[names]) {
                this.summary[names] = "";
            }
            this.summary[names] += result;
        } catch (e) {
            console.error(
                `Error processing summary block: ${
                    e instanceof Error ? e.message : String(e)
                }`,
            );
        }
    }
}
