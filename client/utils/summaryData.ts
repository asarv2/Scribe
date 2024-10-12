/**
 * summaryData.ts
 * Will be used to convert docs from supabase into hierarchical data.
 */

import { DocData, SummaryData } from "../types";

const convertDocsToSummaryData = (docs: DocData[]): SummaryData => {
    const summaryData: SummaryData = [];
    let currentHeading: SummaryData[0] | undefined;
    let currentSubheading: SummaryData[0]["children"][0] | undefined;

    docs.forEach((doc) => {
        const timestamp = convertSecondsToTimestamp(doc.timestamp);
        const text = doc.content;

        if (text.startsWith("# ")) {
            currentHeading = {
                heading: text.slice(2),
                timestamp,
                children: []
            };
            summaryData.push(currentHeading);
            currentSubheading = undefined;
        } else if (text.startsWith("## ")) {
            currentSubheading = {
                subheading: text.slice(3),
                timestamp,
                children: []
            };
            currentHeading?.children.push(currentSubheading);
        } else {
            currentSubheading?.children.push({
                text,
                timestamp
            });
        }
    });

    return summaryData;

}

const convertSecondsToTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}