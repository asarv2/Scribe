import { BaseProcessor } from "./base_processor.ts";
import { AIMessage, HumanMessage } from "npm:@langchain/core/messages";

interface Figure {
    bbox: number[];
    description: string;
}

interface CleanedResponse {
    page: number;
    latex: string;
    figures: Figure[];
    description: string;
}

interface TextItem {
    str?: string;
    items?: TextItem[];
}

export class SlideProcessor extends BaseProcessor {
    private handwritten: boolean;
    private courseTitle: string;
    private notes: Record<string, Record<number, CleanedResponse>>;
    private conversationHistory: (HumanMessage | AIMessage)[];

    constructor(courseTitle: string, handwritten = false, apiKey: string) {
        super(apiKey);
        this.courseTitle = courseTitle;
        this.handwritten = handwritten;
        this.notes = {};
        this.conversationHistory = [];
    }

    private parseBbox(bbox: string): number[] {
        bbox = bbox.trim().replace(/[\[\]]/g, "");
        try {
            const [ymin, xmin, ymax, xmax] = bbox.split(",").map((x) =>
                parseFloat(x.trim())
            );
            return [ymin, xmin, ymax, xmax];
        } catch {
            console.log(
                `Warning: Could not parse bbox ${bbox}, using default values`,
            );
            return [0, 0, 1000, 1000];
        }
    }

    private cleanResponse(
        response: string,
        lectureName: string,
        pageNumber: number,
        imageBboxes: Figure[],
    ): CleanedResponse {
        const latexMatch = response.match(/<LATEX>(.*?)<\/LATEX>/s);
        const latex = latexMatch ? latexMatch[1].trim() : "";

        let figures: Figure[] = [];
        if (this.handwritten) {
            const figureMatches = response.matchAll(
                /<FIGURE (.*?)>(.*?)<\/FIGURE>/g,
            );
            figures = Array.from(figureMatches).map((match) => ({
                bbox: this.parseBbox(match[1]),
                description: match[2].trim(),
            }));
        } else {
            figures = imageBboxes;
        }

        const descriptionMatch = response.match(
            /<DESCRIPTION>(.*?)<\/DESCRIPTION>/s,
        );
        const description = descriptionMatch ? descriptionMatch[1].trim() : "";

        const cleanedResponse = { page: pageNumber, latex, figures, description };

        if (!this.notes[lectureName]) {
            this.notes[lectureName] = {};
        }
        this.notes[lectureName][pageNumber] = cleanedResponse;

        return cleanedResponse;
    }

    private async prepareConversationHistory(
        messages: (HumanMessage | AIMessage)[],
        maxTokens = 1048576,
    ) {
        // Get the last few messages that fit within the token limit
        let tokenCount = 0;
        const trimmedMessages: (HumanMessage | AIMessage)[] = [];

        for (const message of messages.reverse()) {
            const messageTokens = await this.llmGeminiFlash8b.getNumTokens(
                message.content,
            );
            if (tokenCount + messageTokens > maxTokens) break;

            tokenCount += messageTokens;
            trimmedMessages.unshift(message);
        }

        console.log(
            `\nTrimmed conversation history to ${trimmedMessages.length} messages from ${messages.length} messages`,
        );
        console.log(`Total tokens: ${tokenCount}`);

        return trimmedMessages;
    }

    private async processPage(
        image: ArrayBuffer,
        text: string,
        pageNumber: number,
        lectureName: string,
        numPages: number,
        imageBboxes: Figure[],
    ) {
        try {
            const uint8Array = new Uint8Array(image);
            const chunks = [];
            for (let i = 0; i < uint8Array.length; i += 8192) {
                chunks.push(Array.from(uint8Array.slice(i, i + 8192)));
            }
            const base64Image = btoa(
                chunks.map(chunk => String.fromCharCode.apply(null, chunk)).join('')
            );
            // Prepare message for AI
            const basePrompt = this.handwritten
                ? `Follow the 3 instructions carefully to extract the content from the handwritten notes, in the context of the course: ${this.courseTitle}.` +
                    `1. Re-create the content exactly as it is written on the slide in LaTeX format, preserving the formatting. Use <LATEX> and </LATEX> tags to enclose the LaTeX content, do not use \`\`\`latex or \`\`\`.\n` +
                    `Take note of direction of arrows, placement of labels, and other notations. Assume that major math libraries are available, so you can use them to re-create the content. Here is an example:\n\n` +
                    `<LATEX>{{'''\n` +
                    `\\textbf{{Thm 10.1}} \\quad $S$ is convex if and only if\n` +
                    `it contains all conv. comb. of points in $S$\n` +
                    `$pf$ $\\iff$\n\n` +
                    `Suppose $S$ contains all conv. comb. of pts in $S$.\n` +
                    `Then clearly, for any $z_1, z_2 \\in S$\n` +
                    `\\underline{{tz_1 + (1-t)z_2 \\in S}}\n` +
                    `Conv. comb. of $z_1, z_2$\n` +
                    `\\implies \\underline{{S \\text{{ is convex}}}}\n` +
                    `'''}}</LATEX>\n\n` +
                    `2. Find any important figures on the slides and provide the 4 bounding box coordinates: [ymin, xmin, ymax, xmax]` +
                    `Use <FIGURE> and </FIGURE> tags to enclose the figure coordinates. If there are no figures present, simply do not write any <FIGURE> tags. Example:\n` +
                    `<FIGURE [200, 90, 745, 527]>A description of the figure.</FIGURE>\n\n` +
                    `3. Provide a text based description of what you see, including specific details that ` +
                    `would not be known unless you were given the context of the slide. Be very detailed and specific, ` +
                    `but make sure to stay concise and to the point. Use LaTeX to describe any mathematical content you see on the slide. Use <DESCRIPTION> and </DESCRIPTION> tags to enclose the description. Example: <DESCRIPTION>{'''This slide presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points.  The proof is outlined, focusing on one direction of the implication.  It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex.  The underlining highlights the key steps and conclusions of the proof.  The notation \"pf\" indicates \"proof,\" and the double-headed arrow indicates the \"if and only if\" nature of the theorem.  The term \"conv. comb.\" is an abbreviation for \"convex combination.\"  The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''}</DESCRIPTION>`
                : `Follow the 3 instructions carefully to extract the content from the lecture slides, in the context of the course: ${this.courseTitle}.` +
                    `1. Re-create the content exactly as it is written on the slide in LaTeX format, preserving the formatting. Use <LATEX> and </LATEX> tags to enclose the LaTeX content, do not use \`\`\`latex or \`\`\`.\n` +
                    `Take note of direction of arrows, placement of labels, and other notations. Assume that major math libraries are available, so you can use them to re-create the content. Here is an example:\n\n` +
                    `<LATEX>{{'''\n` +
                    `\\textbf{{Thm 10.1}} \\quad $S$ is convex if and only if\n` +
                    `it contains all conv. comb. of points in $S$\n` +
                    `$pf$ $\\iff$\n\n` +
                    `Suppose $S$ contains all conv. comb. of pts in $S$.\n` +
                    `Then clearly, for any $z_1, z_2 \\in S$\n` +
                    `\\underline{{tz_1 + (1-t)z_2 \\in S}}\n` +
                    `Conv. comb. of $z_1, z_2$\n` +
                    `\\implies \\underline{{S \\text{{ is convex}}}}\n` +
                    `'''}}</LATEX>\n\n` +
                    `2. Provide a text based description of what you see, including specific details that ` +
                    `would not be known unless you were given the context of the slide. Be very detailed and specific, ` +
                    `but make sure to stay concise and to the point. Use LaTeX to describe any mathematical content you see on the slide. Use <DESCRIPTION> and </DESCRIPTION> tags to enclose the description. Example: <DESCRIPTION>{'''This slide presents Theorem 10.1, which states that a set $S$ is convex if and only if it contains all convex combinations of its points.  The proof is outlined, focusing on one direction of the implication.  It starts by assuming that $S$ contains all convex combinations of its points. Then, it shows that for any two points $z_1$ and $z_2$ in $S$, their convex combination $tz_1 + (1-t)z_2$ (where $0 \\leq t \\leq 1$) is also in $S$. This directly satisfies the definition of a convex set from the previous slide, thus proving that $S$ is convex.  The underlining highlights the key steps and conclusions of the proof.  The notation \"pf\" indicates \"proof,\" and the double-headed arrow indicates the \"if and only if\" nature of the theorem.  The term \"conv. comb.\" is an abbreviation for \"convex combination.\"  The context of the course (Linear Programming) is crucial for understanding the significance of convex sets in optimization problems.'''}</DESCRIPTION>`;

            const additionalPrompt = this.handwritten
                ? `Use the previous slide's generation to help you understand the context of the current slide. Remember, you should enclose everything in <LATEX> and </LATEX>, <FIGURE> and </FIGURE>, and <DESCRIPTION> and </DESCRIPTION> tags. Do not include any other formats like \`\`\`latex or \`\`\`.\n` +
                `Here is a complete example of what you should output. INPUT: SLIDE 3 of 15. OUTPUT: ` 
                + `
                <LATEX>
                \\textbf{Thm 10.1} \\quad S \\text{ is convex } \\iff \\\\
                \\text{it contains all conv. comb. of points in } S \\\\
                pf \\quad \\iff \\\\
                \\underline{\\text{Suppose } S \\text{ is convex}} \\\\
                n=2: \\quad z_1, z_2 \\in S \\implies t_1 z_1 + t_2 z_2 \\in S, \\quad t_1, t_2 \\ge 0 \\\\
                \\quad t_1 + t_2 = 1 \\\\
                n=3: \\quad z_1, z_2, z_3 \\in S \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 = \\left( t_1 + t_2 \\right) \\left( \\frac{t_1}{t_1 + t_2} z_1 + \\frac{t_2}{t_1 + t_2} z_2 \\right) + t_3 z_3 \\\\
                t_1 + t_2 + t_3 = 1 \\\\
                t_1 + t_2 \\ge 0, \\quad t_3 \\ge 0 \\\\
                \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 \\in S
                </LATEX>
                
                <FIGURE [200, 90, 745, 527]>Theorem 10.1 statement.</FIGURE>
                <FIGURE [400, 490, 800, 700]>Conclusion of the proof for n=3.</FIGURE>
                
                <DESCRIPTION>This slide continues the proof of Theorem 10.1 from the previous slide, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof. The underlining highlights key assumptions and conclusions. The notation "pf" stands for "proof," and "conv. comb." is short for "convex combination." The context of linear programming is crucial because this theorem is fundamental to understanding the properties of feasible regions in linear programming problems, which are often convex sets.</DESCRIPTION>''' + f". Now its your turn. INPUT: SLIDE ${pageNumber} of ${numPages}. OUTPUT: `
                : `Use the previous slide's generation to help you understand the context of the current slide. Remember, you should enclose everything in <LATEX> and </LATEX> and <DESCRIPTION> and </DESCRIPTION> tags. Do not include any other formats like \`\`\`latex or \`\`\`.\n` +
                `Here is a complete example of what you should output. INPUT: SLIDE 3 of 15. OUTPUT: ` +
                `
                <LATEX>
                \\textbf{Thm 10.1} \\quad S \\text{ is convex } \\iff \\\\
                \\text{it contains all conv. comb. of points in } S \\\\
                pf \\quad \\iff \\\\
                \\underline{\\text{Suppose } S \\text{ is convex}} \\\\
                n=2: \\quad z_1, z_2 \\in S \\implies t_1 z_1 + t_2 z_2 \\in S, \\quad t_1, t_2 \\ge 0 \\\\
                \\quad t_1 + t_2 = 1 \\\\
                n=3: \\quad z_1, z_2, z_3 \\in S \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 = \\left( t_1 + t_2 \\right) \\left( \\frac{t_1}{t_1 + t_2} z_1 + \\frac{t_2}{t_1 + t_2} z_2 \\right) + t_3 z_3 \\\\
                t_1 + t_2 + t_3 = 1 \\\\
                t_1 + t_2 \\ge 0, \\quad t_3 \\ge 0 \\\\
                \\implies t_1 z_1 + t_2 z_2 + t_3 z_3 \\in S
                </LATEX>
                
                <DESCRIPTION>This slide continues the proof of Theorem 10.1 from the previous slide, demonstrating that if a set $S$ is convex, then it contains all convex combinations of its points. The proof is done by induction. The base case ($n=2$) is shown: if $z_1, z_2 \\in S$, then any convex combination $t_1z_1 + t_2z_2$ (with $t_1, t_2 \\ge 0$ and $t_1 + t_2 = 1$) is also in $S$ by the definition of convexity. The inductive step ($n=3$) is then demonstrated. It shows that if $z_1, z_2, z_3 \\in S$, then a convex combination $t_1z_1 + t_2z_2 + t_3z_3$ can be rewritten as a convex combination of a convex combination of $z_1$ and $z_2$ and $z_3$. Since the inner convex combination is in $S$ (by the base case), and the outer convex combination is also in $S$ (by the definition of convexity), the entire expression is in $S$. This inductive argument can be extended to any number of points, completing the proof. The underlining highlights key assumptions and conclusions. The notation "pf" stands for "proof," and "conv. comb." is short for "convex combination." The context of linear programming is crucial because this theorem is fundamental to understanding the properties of feasible regions in linear programming problems, which are often convex sets.</DESCRIPTION>''' + f". Now its your turn. INPUT: SLIDE ${pageNumber} of ${numPages}. OUTPUT: `;

            const message = new HumanMessage({
                content: [
                    {
                        type: "text",
                        text: basePrompt + "\n\n" + additionalPrompt,
                    },
                    {
                        type: "image_url",
                        image_url: `data:image/png;base64,${base64Image}`,
                    },
                    ...(text.length > 0 ? [{ type: "text", text }] : []),
                ],
            });

            // Add message to conversation history
            this.conversationHistory.push(message);

            // // Trim conversation history if needed
            // const _trimmedHistory = await this.prepareConversationHistory(
            //     this.conversationHistory,
            // );

            // Generate response using AI with conversation history
            const response = await this.robustGenerate(message);

            // Add AI response to conversation history
            this.conversationHistory.push(new AIMessage({ content: response }));

            return this.cleanResponse(
                response,
                lectureName,
                pageNumber,
                imageBboxes,
            );
        } catch (error) {
            console.error(`Error processing page ${pageNumber}:`, error);
            throw error;
        }
    }

    async processSlides(
        lectureName: string,
        images: ArrayBuffer[],
        texts: string[],
        numPages: number,
        imageBboxes: Figure[][],
        documentsProcessed: number,
        afterGenerate: (result: CleanedResponse) => Promise<void>,
        numSlides?: number,
    ) {
        try {
            const results = [];

            for (let i = documentsProcessed; i < (numSlides ?? numPages); i++) {
                const result = await this.processPage(
                    images[i],
                    texts.length === 0 ? "" : texts[i],
                    i + 1,
                    lectureName,
                    numPages,
                    imageBboxes.length === 0 ? [] : imageBboxes[i],
                );
                results.push(result);
                afterGenerate(result);
            }

            return results;
        } catch (error) {
            console.error("Error processing PDF:", error);
            throw error;
        }
    }
}
