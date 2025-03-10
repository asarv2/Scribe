/**
 * app/classes/[classId]/lecture/[lectureId]/page.tsx
 * The page for a specific lecture in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"
import DeleteLectureModal from "@/components/Delete/DeleteLectureModal";
import LectureViewer from "@/components/Viewer/LectureViewer";
import Viewer from "@/components/Viewer/Viewer";
import { useQuery } from "@tanstack/react-query";
import { getClass } from "@/utils/queries/get-class";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getLecture } from "@/utils/queries/get-lecture";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useState, useEffect } from "react";
import LectureRules from "@/components/Rules/LectureRules";

type LectureProps = {
    params: {
        classId: string;
        lectureId: string;
    }
}

export default function Lecture({ params }: LectureProps) {

    // const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

    // const supabase = useSupabaseBrowser();

    // const { data: classData, isLoading: loadingClassData } = useQuery({
    //     queryKey: ["class", params.classId],
    //     queryFn: () => getClass(supabase, params.classId)
    // })

    // const { data: documents, isLoading: loadingDocuments } = useQuery({
    //     queryKey: ["lectureDocuments", params.lectureId],
    //     queryFn: () => getLectureDocuments(supabase, [params.lectureId])
    // })

    // const { data: lecture, isLoading: loadingLecture } = useQuery({
    //     queryKey: ["lecture", params.lectureId],
    //     queryFn: () => getLecture(supabase, params.lectureId)
    // })

    // const { data: user, isLoading: loadingUser } = useQuery({
    //     queryKey: ["user"],
    //     queryFn: () => getUser(supabase),
    // })

    // const { data: profile, isLoading: loadingProfile } = useQuery({
    //     queryKey: ["profile", user?.id],
    //     queryFn: () => getProfile(supabase, user!.id),
    //     enabled: !!user
    // })


    // const getActiveImage = (documentId: string | null) => {
    //     if (!classData || !lecture || !documentId) return "/placeholder_image.svg";
    //     return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${params.classId}/${params.lectureId}/${documentId}.png`;
    // }

    // const images = documents?.map(doc => ({
    //     id: doc.id,
    //     src: getActiveImage(doc.id),
    //     alt: `Page ${doc.page}`,
    //     label: `Page ${doc.page}`
    // })) || [];

    // useEffect(() => {
    //     if (documents && documents.length > 0) {
    //         setActiveDocumentId(documents[0].id);
    //     }
    // }, [documents]);

    // return (
    //     <Viewer
    //         images={images}
    //         initialImageId={undefined}
    //         embedded={false}
    //         title={lecture?.name ?? ""}
    //         description={documents?.find(doc => doc.id === activeDocumentId)?.description}
    //         DeleteComponent={
    //             <DeleteLectureModal
    //                 lectureId={params.lectureId}
    //                 lectureTitle={lecture?.name ?? ""}
    //                 profile={profile}
    //                 classId={params.classId}
    //             />
    //         }
    //         SideComponent={
    //             lecture && <LectureRules lecture={lecture} />
    //         }
    //         classId={params.classId}
    //         loading={loadingDocuments}
    //         loadingTitle={loadingLecture}
    //     />
    // );
    return <LectureViewer classId={params.classId} lectureId={params.lectureId} />
}