/**
 * app/classes/[classId]/generate/summary/new/page.tsx
 * This page is for generating summaries for a class. It will show all the topics/lectures of the class, and the option to generate summaries for a topic/lecture.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"
import GenerateForm from "@/components/GenerateForm";

export default function GenerateSummaryPage({ params }: { params: { classId: string} }) {
    const classId = params.classId;
    return <GenerateForm classId={classId} type="summary" />
}