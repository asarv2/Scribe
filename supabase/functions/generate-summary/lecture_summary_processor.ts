import { ContentType } from "../_shared/base_processor.ts";
import { BaseSummaryProcessor, Summary, SummaryContent } from "./base_summary_processor.ts";

export class LectureSummaryProcessor extends BaseSummaryProcessor {
    private lectures: SummaryContent;
    private lectureNames: string[];
    constructor(
        apiKey: string,
        courseTitle: string,
        lectureNames: string[],
        lectures: SummaryContent,
    ) {
        super(apiKey, courseTitle, ContentType.LECTURE);
        this.lectures = lectures;
        this.lectureNames = lectureNames;
    }

    async processSummary(
        allLectures: {note_number: number, id: string}[], 
        numBatches: number, 
        onBatchComplete: (batchNumber: number, summary: Summary) => Promise<void>
    ): Promise<Summary> {
        console.log(`Generating summary for ${this.lectureNames.join(", ")}`);
        
        const names = this.lectureNames.join(", ");
        const batches = this.splitContentIntoBatches(this.lectures.content, numBatches);
        
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