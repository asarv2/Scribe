/**
 * FileViewer.tsx
 * 
 * This component is used to display the file viewer for the file page.
 * @AshokSaravanan222
 * 02.05.2025
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClass } from "@/utils/queries/get-class";;
import { useSearchParams } from "next/navigation";
import { Box, Stack, Text, Skeleton, Modal } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFile } from "@/utils/queries/get-file";

type FileViewerProps = {
    classId: string;
    fileId: string;
    initialDocumentId?: string;
}

export default function FileViewer({
    classId,
    fileId,
    initialDocumentId,
}: FileViewerProps) {
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const supabase = useSupabaseBrowser();
    const searchParams = useSearchParams();
    const page = searchParams.get("page");

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, [fileId])
    })

    const { data: file, isLoading: loadingFile } = useQuery({
        queryKey: ["file", fileId],
        queryFn: () => getFile(supabase, fileId)
    })

    const filteredDocuments = documents?.filter(doc => doc.file === fileId);

    const getActiveImage = (documentId: string | null) => {
        if (!classData || !file || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${documentId}.png`;
    }

    // Open the full-size image modal with the selected document
    const openImageModal = (documentId: string) => {
        setActiveDocumentId(documentId);
        setIsImageModalOpen(true);
    };

    useEffect(() => {
        if (filteredDocuments && filteredDocuments.length > 0 && !activeDocumentId) {
            if (initialDocumentId) {
                setActiveDocumentId(initialDocumentId);
            } else if (page) {
                // Handle both single page numbers and page ranges (e.g., "p.5" or "pp.5-7")
                const pageNum = parseInt(page.replace(/[^0-9]/g, ''));
                const matchingDoc = filteredDocuments.find(doc => doc.page === pageNum);
                if (matchingDoc) {
                    setActiveDocumentId(matchingDoc.id);
                } else {
                    // Default to first page if specified page not found
                    setActiveDocumentId(filteredDocuments[0].id);
                }
            } else {
                // No page specified, default to first page
                setActiveDocumentId(filteredDocuments[0].id);
            }
        }
    }, [filteredDocuments, activeDocumentId, page, initialDocumentId]);

    // Scroll to the active document when it changes
    useEffect(() => {
        if (activeDocumentId && !isImageModalOpen) {
            const element = document.getElementById(`document-${activeDocumentId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [activeDocumentId, isImageModalOpen]);

    return (
        <>
            <Box 
                style={{ 
                    height: '100%', 
                    width: '100%', 
                    overflowY: 'auto',
                    padding: '10px'
                }}
            >
                {loadingDocuments ? (
                    <Stack>
                        {[...Array(3)].map((_, index) => (
                            <Skeleton key={index} height={300} width="100%" radius="md" />
                        ))}
                    </Stack>
                ) : (
                    <Stack>
                        {filteredDocuments?.map((doc) => (
                            <Box
                                key={doc.id}
                                id={`document-${doc.id}`}
                                style={{
                                    position: 'relative',
                                    width: '100%',
                                    cursor: 'zoom-in',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                                }}
                                onClick={() => openImageModal(doc.id)}
                            >
                                <Image
                                    src={getActiveImage(doc.id)}
                                    alt={`Page ${doc.page}`}
                                    width={800}
                                    height={1100}
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        objectFit: "contain"
                                    }}
                                    sizes="100vw"
                                    placeholder="blur"
                                    blurDataURL={"/placeholder_image.svg"}
                                />
                                <Box
                                    pos="absolute"
                                    bottom={10}
                                    right={10}
                                    p={4}
                                    style={{
                                        zIndex: 100,
                                        backgroundColor: "rgba(0,0,0,0.7)",
                                        borderRadius: "4px",
                                    }}
                                >
                                    <Text
                                        size={"xs"}
                                        fw={500}
                                        style={{
                                            color: "white",
                                            textShadow: "0px 0px 4px rgba(0,0,0,0.5)"
                                        }}
                                    >
                                        Page {doc.page}
                                    </Text>
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                )}
            </Box>

            {/* Full-size image modal */}
            <Modal
                opened={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="xl"
                padding="md"
                centered
                title={`Page ${filteredDocuments?.find(doc => doc.id === activeDocumentId)?.page}`}
            >
                <Box
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '80vh'
                    }}
                >
                    <Image
                        src={getActiveImage(activeDocumentId)}
                        alt={`Page ${filteredDocuments?.find(doc => doc.id === activeDocumentId)?.page}`}
                        width={1200}
                        height={1200}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain"
                        }}
                        sizes="100vw"
                    />
                </Box>
            </Modal>
        </>
    );
}