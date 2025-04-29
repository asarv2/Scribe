import { Modal, Stack, Text, Box, Card } from "@mantine/core";
import Image from "next/image";
import Latex from "../Latex";
import { ViewerMode } from "@/types";
import { getFile } from "@/utils/queries/get-file";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery } from "@tanstack/react-query";
import { getClass } from "@/utils/queries/get-class";
import { useEffect, useRef, useState } from "react";

interface PageDetailsModalProps {
    classId: string;
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
}

export default function PageDetailsModal({ classId, viewerMode, setViewerMode }: PageDetailsModalProps) {
    const supabase = useSupabaseBrowser();
    const fileId = viewerMode.fileId;
    const activeDocumentId = viewerMode.documentId;
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'pdf' | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string>("");
    
    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    });

    const {data: fileData, isLoading: loadingFileData} = useQuery({
        queryKey: ["file", fileId],
        queryFn: () => getFile(supabase, fileId!),
        enabled: !!fileId
    });

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["fileDocuments", classId, fileId],
        queryFn: () => getFileDocuments(supabase, fileId ? [fileId] : []),
        enabled: !!fileId
    });

    // Get the active document
    const activeDocument = documents?.find(doc => doc.id === activeDocumentId);
    
    // Determine media type and URL when document changes
    useEffect(() => {
        if (!activeDocument || !classId || !fileId) return;
        if (fileData?.type === 'video') {
            setMediaType('video');
            setMediaUrl(`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${activeDocumentId}.mp4`);
        } else if (fileData?.type === 'audio') {
            setMediaType('audio');
            setMediaUrl(`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${activeDocumentId}.wav`);
        } else {
            // Default to image
            setMediaType('image');
            setMediaUrl(`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${activeDocumentId}.png`);
        }
    }, [activeDocument, classId, fileId, activeDocumentId]);

    // Auto-play media when URL changes
    useEffect(() => {
        if (mediaType === 'video' && videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
        } else if (mediaType === 'audio' && audioRef.current) {
            audioRef.current.load();
            audioRef.current.play().catch(e => console.error("Error playing audio:", e));
        }
    }, [mediaUrl, mediaType]);

    // Get document text
    const getActiveDocumentText = () => {
        if (!activeDocument) return "";
        return activeDocument.text || "";
    };

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
            title={`${fileData?.title || 'File'} - Page ${activeDocument?.page || ''}`}
            styles={{
                content: {
                    border: '3px solid #581845', // Deep purple border
                },
                header: {
                    borderBottom: 'none' // Remove the bottom border of the header
                },
                title: {
                    fontWeight: 600, // Optional: make title stand out more instead of using a border
                }
            }}
        >
            <Stack
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '80vh',
                    width: '100%',
                    border: 'none' // Remove the yellow border that was here
                }}
                gap="md"
            >
                {mediaType === 'image' && (
                    <Image
                        src={mediaUrl || "/placeholder_image.svg"}
                        alt={`Page ${activeDocument?.page}`}
                        width={1200}
                        height={1200}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '60%',
                            objectFit: "contain"
                        }}
                        sizes="100vw"
                    />
                )}
                
                {mediaType === 'video' && (
                    <Box style={{ width: '100%', maxHeight: '60%' }}>
                        <video 
                            ref={videoRef}
                            controls
                            style={{ width: '100%', maxHeight: '100%' }}
                        >
                            <source src={mediaUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </Box>
                )}
                
                {mediaType === 'audio' && (
                    <Box style={{ width: '100%' }}>
                        <Image
                            src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${activeDocumentId}.png`}
                            alt={`Audio waveform`}
                            width={800}
                            height={300}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '300px',
                                objectFit: "contain"
                            }}
                            sizes="100vw"
                        />
                        <audio 
                            ref={audioRef}
                            controls
                            style={{ width: '100%', marginTop: '10px' }}
                        >
                            <source src={mediaUrl} type="audio/wav" />
                            Your browser does not support the audio tag.
                        </audio>
                    </Box>
                )}
                
                {mediaType !== 'image' && mediaType !== 'pdf' && (
                    <Card 
                        style={{ 
                            width: '100%', 
                            maxHeight: '40%', 
                            overflowY: 'auto',
                            padding: '15px',
                            borderRadius: '8px',
                            border: '2px solid #DAF7A6' // Light green border
                    }}
                >
                    <Latex>
                        {getActiveDocumentText()}
                        </Latex>
                    </Card>
                )}
            </Stack>
        </Modal>
    );
}