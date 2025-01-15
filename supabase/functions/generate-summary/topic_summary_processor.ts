import { ContentType } from "../_shared/base_processor.ts";
import { BaseSummaryProcessor, Summary, SummaryContent } from "./base_summary_processor.ts";
export class TopicSummaryProcessor extends BaseSummaryProcessor {
    private topics: SummaryContent;
    private topicNames: string[];
    constructor(
        apiKey: string,
        courseTitle: string,
        topicNames: string[],
        topics: SummaryContent,
    ) {
        super(apiKey, courseTitle, ContentType.TOPIC);
        this.topics = topics;
        this.topicNames = topicNames;
    }

    async processSummary(
        allLectures: {note_number: number, id: string}[], 
        numBatches: number, 
        onBatchComplete: (batchNumber: number, summary: Summary) => Promise<void>
    ): Promise<Summary> {
        console.log(`Generating summary for ${this.topicNames}`);
        
        const names = this.topicNames.join(", ");
        const batches = this.splitContentIntoBatches(this.topics.content, numBatches);
        
        for (let i = 0; i < batches.length; i++) {
            console.log(`Processing batch ${i + 1} of ${batches.length}`);
            const result = await this.processBatch(
                names,
                batches[i],
            );
            console.log(`Batch ${i + 1} result:`, result);
            this.cleanResult(result, names, allLectures);
            
            // Call the batch completion callback
            await onBatchComplete(i + 1, this.summary[names]);
        }

        return this.summary[names];
    }
}
