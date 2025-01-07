import { ContentType } from "../_shared/base_processor.ts";
import { BaseSummaryProcessor, SummaryContent } from "./base_summary_processor.ts";

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

    async processSummary(): Promise<string> {
        console.log(`Generating summary for ${this.lectureNames.join(", ")}`);
        const result = await this.processBatch(
            this.lectureNames.join(", "),
            this.lectures.content,
        );
        console.log("Result:", result);
        this.cleanResult(result, this.lectureNames.join(", "));
        return this.summary[this.lectureNames.join(", ")];
    }
}
