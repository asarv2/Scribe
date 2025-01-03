/**
 * app/classes/[classId]/generate/new/page.tsx
 * This page is for generating problems or summaries for a class. It will show all the topics/lectures of the class, and the option to generate summaries or problems for a topic/lecture.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"
import GenerateForm from "@/components/GenerateForm";

export default function GenerateNewPage({ params }: { params: { classId: string} }) {
    const classId = params.classId;
    return <GenerateForm classId={classId} />
}