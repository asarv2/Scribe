/**
 * app/classes/[classId]/textbook/[textbookId]/chapter/[chapterId]/page.tsx
 * The page for a specific chapter in a textbook.
 * @AshokSaravanan222
 * 02.04.2025
 */
"use client"
import ChapterViewer from "@/components/Viewer/ChapterViewer";

type ChapterProps = {
    params: {
        classId: string;
        textbookId: string;
        chapterId: string;
    }
}
export default function Chapter({ params }: ChapterProps) {
    return <ChapterViewer classId={params.classId} textbookId={params.textbookId} chapterId={params.chapterId} />
}