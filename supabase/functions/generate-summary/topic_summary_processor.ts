import { ContentType } from "../_shared/base_processor.ts";
import { BaseSummaryProcessor, SummaryContent } from "./base_summary_processor.ts";
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

    async processSummary(): Promise<string> {
        console.log(`Generating summary for ${this.topicNames}`);
        // want error to be caught by the caller
        const result = await this.processBatch(
            this.topicNames.join(", "),
            this.topics.content,
        );
        console.log("Result:", result);
        this.cleanResult(result, this.topicNames.join(", "));
        return this.summary[this.topicNames.join(", ")];
    }
}
