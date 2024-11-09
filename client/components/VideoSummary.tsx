/**
 * NewSummary.tsx
 * Component for showing the bold summary of the lecture, with the different timestamps for the sections.
 * @AshokSaravanan222
 * 11-08-2024
 */

import { DocData } from "../types";
import { Skeleton } from "@mantine/core";
import Link from "next/link";


type VideoSummaryProps = {
    lectureLength: number
    documents: DocData[]
    loading: boolean
    clickPlayer: (timestamp: number) => void
}

// should be 10 headings
const headings = ["Section 1", "Section 2", "Section 3", "Section 4", "Section 5", "Section 6", "Section 7", "Section 8", "Section 9", "Section 10"]


export default function VideoSummary({ documents, loading, clickPlayer, lectureLength }: VideoSummaryProps) {
    
    const headingsSplit: number[] = [Math.round(lectureLength / 10), Math.round(lectureLength / 10) * 2, Math.round(lectureLength / 10) * 3, Math.round(lectureLength / 10) * 4, Math.round(lectureLength / 10) * 5, Math.round(lectureLength / 10) * 6, Math.round(lectureLength / 10) * 7, Math.round(lectureLength / 10) * 8, Math.round(lectureLength / 10) * 9, Math.round(lectureLength / 10) * 10]

    const formatTimestamp = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60)
        return <div style={{ cursor: "pointer" }} onClick={() => {
            clickPlayer(seconds)
        }}>{`(${minutes}:${remainingSeconds.toString().padStart(2, "0")})`}</div>
    }

    return (
        <Skeleton visible={loading}>
            <div id="summaries">
                {headingsSplit.map((timestamp, index) => {
                    const timestampBefore = headingsSplit[index - 1] || 0
                    const documentsInHeading = documents.filter((document) => document.timestamp <= timestamp && document.timestamp > headingsSplit[index - 1] || (index === 0 && document.timestamp <= timestamp))
                    return (
                        <div key={timestamp + index}>
                            <h2>{formatTimestamp(timestampBefore)}{headings[index]}</h2>
                            {documentsInHeading.map((document, index) => {
                                const words = (document.content.split(" "))
                                if (words.length <= 10) {
                                    return;
                                }

                                if (index % 3 === 0) {
                                    return (
                                        <p>{formatTimestamp(document.timestamp)} {document.content}</p>
                                    )
                                }
                            })}
                        </div>
                    )
                })}

            </div>
        </Skeleton>
    );
}
