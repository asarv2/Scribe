/**
 * app/classes/c/[classId]/homework/[homeworkId]/page.tsx
 * This page is used to view a single homework.
 * @AshokSaravanan222
 * 02-26-2025
 * 
 */
"use client"

import HomeworkViewer from "@/components/Viewer/HomeworkViewer";

type HomeworkProps = {
    params: {
        classId: string;
        homeworkId: string;
    }
}

export default function HomeworkPage({ params }: HomeworkProps) {
    return <HomeworkViewer classId={params.classId} homeworkId={params.homeworkId} />;
}