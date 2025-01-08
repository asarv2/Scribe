import { ContentType } from "../_shared/base_processor.ts";
import {
    BaseProblemsProcessor,
    ProblemsContent,
    Question,
    QuestionType,
} from "./base_problems_processor.ts";

export class LectureProblemsProcessor extends BaseProblemsProcessor {
    private lectures: ProblemsContent;
    private lectureNames: string[];

    constructor(
        apiKey: string,
        courseTitle: string,
        lectureNames: string[],
        lectures: ProblemsContent,
    ) {
        super(apiKey, courseTitle, ContentType.LECTURE, QuestionType.MCQ);
        this.lectures = lectures;
        this.lectureNames = lectureNames;
    }

    async processProblems(
        numQuestions = 3,
        conceptualComputationalRatio = 1,
        singleMultiPartRatio = 1,
    ): Promise<Question[][]> {
        if (conceptualComputationalRatio > 1 || singleMultiPartRatio > 1) {
            throw new Error("Ratios cannot be greater than 1");
        }

        const lectureName = this.lectureNames.join(", ");

        console.log(`Generating ${numQuestions} questions for ${lectureName}`);

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

            const result = await this.processBatch(
                numQ,
                lectureName,
                this.lectures.content,
                prompts[j],
            );
            this.cleanResult(result, lectureName, tags);
        }
        return this.questions[lectureName]
    }
}
