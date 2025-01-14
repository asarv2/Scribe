import { ContentType } from "../_shared/base_processor.ts";
import {
    BaseProblemsProcessor,
    FRQQuestion,
    MCQQuestion,
    ProblemsContent,
    QuestionType,
} from "./base_problems_processor.ts";

export class TopicProblemsProcessor extends BaseProblemsProcessor {
    private topics: ProblemsContent;
    private topicNames: string[];

    constructor(
        apiKey: string,
        courseTitle: string,
        topicNames: string[],
        topics: ProblemsContent,
        questionType: QuestionType,
    ) {
        super(apiKey, courseTitle, ContentType.TOPIC, questionType);
        this.topics = topics;
        this.topicNames = topicNames;
    }

    async processProblems(
        numQuestions = 3,
        conceptualComputationalRatio = 1,
        singleMultiPartRatio = 1,
        batchSize: number | undefined,
        onBatchComplete: (questions: (MCQQuestion | FRQQuestion)[][]) => Promise<void>,
    ): Promise<(MCQQuestion | FRQQuestion)[][]> {
        if (conceptualComputationalRatio > 1 || singleMultiPartRatio > 1) {
            throw new Error("Ratios cannot be greater than 1");
        }

        const topicName = this.topicNames.join(", ");
        console.log(`Generating ${numQuestions} questions for ${topicName}`);

        // Split questions by type
        const conceptualQuestions = Math.round(
            numQuestions * conceptualComputationalRatio,
        );
        const computationalQuestions = numQuestions - conceptualQuestions;

        const singlePartConceptual = Math.round(
            conceptualQuestions * singleMultiPartRatio,
        );
        const multiPartConceptual = conceptualQuestions - singlePartConceptual;

        const singlePartComputational = Math.round(
            computationalQuestions * singleMultiPartRatio,
        );
        const multiPartComputational = computationalQuestions -
            singlePartComputational;

        const questionNumbers = [
            singlePartConceptual,
            multiPartConceptual,
            singlePartComputational,
            multiPartComputational,
        ];
        const prompts = [
            this.singlePartConceptualPrompt,
            this.multiPartConceptualPrompt,
            this.singlePartComputationalPrompt,
            this.multiPartComputationalPrompt,
        ];
        const allTags = [
            ["conceptual"],
            ["conceptual", "multi-part"],
            ["computational"],
            ["computational", "multi-part"],
        ];

        for (let j = 0; j < questionNumbers.length; j++) {
            const numQ = questionNumbers[j];
            if (numQ === 0) continue;

            const tags = allTags[j];
            const tagDescription = tags.length > 1
                ? `${tags[0]} ${tags[1]}`
                : tags[0];
            console.log(`Generating ${numQ} ${tagDescription} questions`);

            if (batchSize) {
                // Process in batches
                for (let i = 0; i < numQ; i += batchSize) {
                    const currentBatchSize = Math.min(batchSize, numQ - i);
                    const result = await this.processBatch(
                        currentBatchSize,
                        topicName,
                        this.topics.content,
                        prompts[j],
                    );
                    this.cleanResult(result, topicName, tags);
                    
                    // Call onBatchComplete after each batch
                    await onBatchComplete(this.questions[topicName]);
                }
            } else {
                // Process all at once
                const result = await this.processBatch(
                    numQ,
                    topicName,
                    this.topics.content,
                    prompts[j],
                );
                this.cleanResult(result, topicName, tags);
            }
        }

        // If not batching, call onBatchComplete once at the end
        if (!batchSize) {
            await onBatchComplete(this.questions[topicName]);
        }

        return this.questions[topicName];
    }
}
