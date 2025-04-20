import { Modal, Stack } from "@mantine/core";
import Image from "next/image";
import Latex from "../Latex";
import { ViewerMode } from "@/types";
import { getFile } from "@/utils/queries/get-file";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery } from "@tanstack/react-query";
import { getClass } from "@/utils/queries/get-class";

interface PageDetailsModalProps {
    classId: string;
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
}

export default function PageDetailsModal({ classId, viewerMode, setViewerMode }: PageDetailsModalProps) {
    const supabase = useSupabaseBrowser();
    const fileId = viewerMode.fileId;
    const activeDocumentId = viewerMode.documentId;
    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["fileDocuments", classId, fileId],
        queryFn: () => getFileDocuments(supabase, fileId ? [fileId] : []),
        enabled: !!fileId
    })

    const getActiveImage = (documentId: string | undefined) => {
        if (!documentId || !classId || !fileId) return "/placeholder_image.svg";
        try {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${documentId}.png`;
        } catch (error) {
            console.error("Error generating image URL:", error);
            return "/placeholder_image.svg";
        }
    }

    const getActiveDocumentDescription = (documentId: string | undefined) => {
        if (!classData || !documentId) return "";
        const document = documents?.find(doc => doc.id === documentId);
        if (!document) return "";
        return document.description;
    }

    return (

        <Modal
            opened={viewerMode.showPageDetails}
            onClose={() => setViewerMode({
                ...viewerMode,
                showPageDetails: false
            })}
            size="xl"
            padding="md"
            centered
            title={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
        >
            <Stack
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '80vh'
                }}
            >
                <Image
                    src={getActiveImage(activeDocumentId)}
                    alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                    width={1200}
                    height={1200}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: "contain"
                    }}
                    sizes="100vw"
                />
                <Latex>
                    {getActiveDocumentDescription(activeDocumentId)}
                </Latex>
            </Stack>
        </Modal>
    )
}