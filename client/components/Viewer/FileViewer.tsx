/**
 * FileViewer.tsx
 * 
 * This component is used to display the file viewer for the file page.
 * @AshokSaravanan222
 * 02.05.2025
 */
import { useEffect, useState, useRef } from "react";
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
    const viewerRef = useRef<HTMLDivElement | null>(null);

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
        queryFn: () => getFiles(supabase, classId!)
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

    // const calculatePosition = (size: { x: number, y: number, w: number, h: number } | null) => {
    //     if (!size || size.w === undefined) {
    //         return '50% 50%'; // Default to center if no size data is available
    //     }
    //     const x = size.w === 100 ? size.x : (size.x / (100 - size.w)) * 100;
    //     const y = size.h === 100 ? size.y : (size.y / (100 - size.h)) * 100;
    //     return `${x}% ${y}%`;
    // };

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

    const getAspectRatio = (document: Document) => {
        const file = files?.find(f => document.file === f.id);
        if (!file) return { width: 1, height: 1 }; // Default square
        
        // First check if the file has a specific aspect_ratio set
        if (file.aspect_ratio) {
            switch (file.aspect_ratio) {
                case 'square':
                    return { width: 1.25, height: 1 }; // 1:1 square. A little wider than square
                case 'landscape':
                    return { width: 16, height: 9 }; // 16:9 landscape (presentations)
                case 'portrait':
                    return { width: 8.5, height: 11 }; // 8.5x11 portrait (papers)
                default:
                    // Fall through to the existing logic for 'default' or unrecognized values
                    break;
            }
        }
        
        // Fallback to existing logic based on file type and content_type
        if (file.type !== 'other' && file.type !== 'image') {
            if (file.content_type === 'lecture') {
                return { width: 16, height: 9 }; // Landscape 16:9 for lectures
            } else {
                return { width: 8.5, height: 11 }; // Paper 8.5x11 for other PDFs
            }
        }
        
        return { width: 1, height: 1 }; // Square for all other cases
    };

    const getImageDimensions = (document: Document) => {
        const ratio = getAspectRatio(document);
        // Calculate height based on a fixed width to maintain aspect ratio
        const baseWidth = 800;
        const height = (baseWidth * ratio.height) / ratio.width;
        return { width: baseWidth, height };
    };

    useEffect(() => {
        // Update activeDocumentId when viewerMode.documentId changes
        if (viewerMode.documentId && viewerMode.documentId !== activeDocumentId) {
            setActiveDocumentId(viewerMode.documentId);
        } else if (filteredDocuments && filteredDocuments.length > 0) {
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
    }, [filteredDocuments, page, viewerMode.documentId]);

    // Replace the problematic scroll effect with a more reliable approach
    useEffect(() => {
        if (!activeDocumentId) return;
        
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            const el = document.getElementById(`document-${activeDocumentId}`);
            if (el) {
                el.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        }, 100);
    }, [activeDocumentId]);

    return (
        <>
            <Box
                ref={viewerRef}
                data-viewer-container="true"
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
                    <>
                        {/* Render empty divs outside the Stack for scrolling purposes */}
                        {documents?.filter(doc => activeChat.documents.includes(doc.id)).map(doc => (
                            <Box 
                                key={doc.id} 
                                id={`document-${doc.id}`} 
                                style={{ height: 0, margin: 0, padding: 0 }}
                            />
                        ))}
                        
                        <Stack>
                            {documents?.filter(doc => !activeChat.documents.includes(doc.id)).map((doc) => (
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
                                        {/* Add a wrapper div to enforce aspect ratio */}
                                        <Box 
                                            style={{
                                                position: 'relative',
                                                width: '100%',
                                                paddingBottom: `${(getAspectRatio(doc).height / getAspectRatio(doc).width) * 100}%`,
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <Image
                                                src={getActiveImage(doc.id)}
                                                alt={`Page ${doc.page}`}
                                                width={getImageDimensions(doc).width}
                                                height={getImageDimensions(doc).height}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: "cover",
                                                    // objectPosition: calculatePosition(doc.size as any),
                                                    borderRadius: '8px' // Add border radius to the image itself as well
                                                }}
                                                sizes="100vw"
                                                placeholder="blur"
                                                blurDataURL={"/placeholder_image.svg"}
                                                onError={() => console.log(`Failed to load image for document ${doc.id}`)}
                                                unoptimized
                                            />
                                        </Box>
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
                            ))}
                        </Stack>
                    </>
                )}
            </Box>
        </>
    );
}