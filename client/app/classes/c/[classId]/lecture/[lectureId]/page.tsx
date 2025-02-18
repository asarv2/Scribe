/**
 * app/classes/[classId]/lecture/[lectureId]/page.tsx
 * The page for a specific lecture in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"
import LectureViewer from "@/components/Viewer/LectureViewer";

type LectureProps = {
    params: {
        classId: string;
        lectureId: string;
    }
}

export default function Lecture({ params }: LectureProps) {
    return <LectureViewer classId={params.classId} lectureId={params.lectureId} />
}