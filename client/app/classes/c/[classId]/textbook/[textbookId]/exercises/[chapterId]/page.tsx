/**
 * app/classes/[classId]/textbook/[textbookId]/exercises/[chapterId]/page.tsx
 * The page for a specific chapter in a textbook.
 * @AshokSaravanan222
 * 02.04.2025
 */
"use client"

import ExerciseViewer from "@/components/Viewer/ExerciseViewer";

type ChapterProps = {
    params: {
        classId: string;
        textbookId: string;
        chapterId: string;
    }
}
export default function Exercises({ params }: ChapterProps) {
    return <ExerciseViewer classId={params.classId} textbookId={params.textbookId} chapterId={params.chapterId} />
}