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
import { Box, Stack, Text, Skeleton, Modal, Tooltip, ActionIcon, Group } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFile } from "@/utils/queries/get-file";
import Latex from "../Latex";
import { IconEye, IconZoomIn } from "@tabler/icons-react";
import { ChatMessage, Document, ViewerMode } from "@/types";
import DraggableWrapper from "../DragDrop/DraggableWrapper";
import { getFiles } from "@/utils/queries/get-files";

type FileViewerProps = {
    classId: string;
    addDocumentToChat: (documentId: string) => void;
    activeChat: ChatMessage;
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
}

export default function FileViewer({
    classId,
    addDocumentToChat,
    activeChat,
    viewerMode,
    setViewerMode
}: FileViewerProps) {
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(viewerMode.documentId ?? null);

    const fileId = viewerMode.fileId;

    const supabase = useSupabaseBrowser();
    const searchParams = useSearchParams();
    const page = searchParams.get("page");

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, [classId])
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["fileDocuments", classId, fileId],
        queryFn: () => getFileDocuments(supabase, fileId ? [fileId] : []),
        enabled: !!fileId
    })

    const filteredDocuments = documents?.filter(doc => !activeChat.documents.includes(doc.id));

    const getActiveImage = (documentId: string | null) => {
        if (!documentId || !classId || !fileId) return "/placeholder_image.svg";
        try {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${documentId}.png`;
        } catch (error) {
            console.error("Error generating image URL:", error);
            return "/placeholder_image.svg";
        }
    }

    const getPageLabel = (document: Document) => {
        const file = files?.find(f => document.file === f.id);
        if (!file) return `Page ${document.page}`;
        if (file.type === 'video' || file.type === 'audio') {
            const formatTime = (seconds: number) => {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = Math.floor(seconds % 60);
                return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            };
            return `${formatTime(document.start_time ?? 0)} - ${formatTime(document.end_time ?? 0)}`;
        } else {
            return `Page ${document.page}`;
        }
    }

    useEffect(() => {
        if (filteredDocuments && filteredDocuments.length > 0) {
            let newActiveId = null;
            
            if (activeDocumentId && filteredDocuments.some(doc => doc.id === activeDocumentId)) {
                newActiveId = activeDocumentId;
            } else if (page) {
                try {
                    const pageNum = parseInt(page.replace(/[^0-9]/g, ''));
                    const matchingDoc = filteredDocuments.find(doc => doc.page === pageNum);
                    newActiveId = matchingDoc ? matchingDoc.id : filteredDocuments[0].id;
                } catch (e) {
                    newActiveId = filteredDocuments[0].id;
                }
            } else {
                newActiveId = filteredDocuments[0].id;
            }
            setActiveDocumentId(newActiveId);
        }
    }, [filteredDocuments, page]);

    // Scroll to the active document when it changes
    useEffect(() => {
        if (activeDocumentId) {
            const element = document.getElementById(`document-${activeDocumentId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [activeDocumentId]);

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
                        {documents?.map((doc) => 
                            activeChat.documents.includes(doc.id) ? (
                                // Empty div with document ID for scrolling purposes
                                <Box 
                                    key={doc.id} 
                                    id={`document-${doc.id}`} 
                                    style={{ height: 0, margin: 0, padding: 0 }}
                                />
                            ) : (
                                <DraggableWrapper key={doc.id} item={doc} type={'document'} makeDraggable={true}>
                                    <Box
                                        id={`document-${doc.id}`}
                                        style={{
                                            position: 'relative',
                                            width: '100%',
                                            cursor: 'grab',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                                        }}
                                        onClick={() => {
                                            addDocumentToChat(doc.id);
                                        }}
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
                                            onError={() => console.log(`Failed to load image for document ${doc.id}`)}
                                        />
                                        {/* Add magnifying glass icon in top right corner to open the image modal */}
                                        <Box
                                            pos="absolute"
                                            top={10}
                                            right={10}
                                            p={4}
                                            style={{
                                                zIndex: 100,
                                                backgroundColor: "rgba(0,0,0,0.7)",
                                                borderRadius: "4px",
                                                cursor: "pointer"
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setViewerMode({
                                                    ...viewerMode,
                                                    documentId: doc.id,
                                                    showPageDetails: true
                                                });
                                            }}
                                        >
                                            <Tooltip label={`Page details`}>
                                                <Group gap={4} align="center">
                                                    <IconZoomIn
                                                        size={16}
                                                        style={{
                                                            color: "white"
                                                        }}
                                                    />
                                                </Group>
                                            </Tooltip>
                                        </Box>
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
                                                {getPageLabel(doc)}
                                            </Text>
                                        </Box>
                                    </Box>
                                </DraggableWrapper>
                            )
                        )}
                    </Stack>
                )}
            </Box>
        </>
    );
}