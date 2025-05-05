import { Modal, Stack, Text, Box, Card, ActionIcon, Group } from "@mantine/core";
import Image from "next/image";
import Latex from "../Latex";
import { ViewerMode } from "@/types";
import { getFile } from "@/utils/queries/get-file";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery } from "@tanstack/react-query";
import { getClass } from "@/utils/queries/get-class";
import { useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

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
    
    // Handle navigation between pages
    const navigateToPage = (direction: 'prev' | 'next') => {
        if (!documents || documents.length === 0 || !activeDocument) return;
        
        // Sort documents by page number
        const sortedDocuments = [...documents].sort((a, b) => 
            (a.page || 0) - (b.page || 0)
        );
        
        const currentIndex = sortedDocuments.findIndex(doc => doc.id === activeDocumentId);
        if (currentIndex === -1) return;
        
        let newIndex;
        if (direction === 'prev') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : sortedDocuments.length - 1; // Loop to end if at first page
        } else {
            newIndex = currentIndex < sortedDocuments.length - 1 ? currentIndex + 1 : 0; // Loop to start if at last page
        }
        
        // Update viewerMode with new documentId
        setViewerMode({
            ...viewerMode,
            documentId: sortedDocuments[newIndex].id
        });
    };
    
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

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!viewerMode.showPageDetails) return;
            
            if (e.key === 'ArrowLeft') {
                navigateToPage('prev');
            } else if (e.key === 'ArrowRight') {
                navigateToPage('next');
            }
        };
        
        // Add event listener
        window.addEventListener('keydown', handleKeyDown);
        
        // Clean up
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [viewerMode.showPageDetails, documents, activeDocumentId]);
    
    // Handle touch navigation
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    
    // Minimum swipe distance (in px)
    const minSwipeDistance = 50;
    
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };
    
    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;
        
        if (isLeftSwipe) {
            navigateToPage('next');
        } else if (isRightSwipe) {
            navigateToPage('prev');
        }
    };

    // Add this function to determine aspect ratio
    const getAspectRatio = () => {
        if (!fileData) return { width: 1, height: 1 }; // Default square
        
        // First check if the file has a specific aspect_ratio set
        if (fileData.aspect_ratio) {
            switch (fileData.aspect_ratio) {
                case 'square':
                    return { width: 1, height: 1 }; // 1:1 square
                case 'landscape':
                    return { width: 16, height: 9 }; // 16:9 landscape
                case 'portrait':
                    return { width: 8.5, height: 11 }; // 8.5x11 portrait
                default:
                    // Fall through to content type logic
                    break;
            }
        }
        
        // Fallback to content type
        if (fileData.content_type === 'lecture') {
            return { width: 16, height: 9 }; // Landscape for lectures
        } else if (['textbook', 'homework', 'rubric'].includes(fileData.content_type || '')) {
            return { width: 8.5, height: 11 }; // Portrait for text-heavy content
        }
        
        return { width: 1, height: 1 }; // Square for all other cases
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
                    // Removed the deep purple border
                },
                header: {
                    borderBottom: 'none'
                },
                title: {
                    fontWeight: 600
                },
                body: {
                    height: '80vh', // Ensure consistent height
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <Stack
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flex: 1,
                    width: '100%',
                    border: 'none',
                    position: 'relative'
                }}
                gap="md"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Navigation Controls - Now with better positioning */}
                <Group style={{ 
                    width: '100%', 
                    position: 'absolute', 
                    top: 0, 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    zIndex: 10, 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0 10px'
                }}>
                    <ActionIcon 
                        variant="filled"
                        color="gray"
                        opacity={0.7}
                        onClick={() => navigateToPage('prev')}
                        disabled={!documents || documents.length <= 1}
                        style={{ cursor: 'pointer' }}
                    >
                        <IconChevronLeft size={24} />
                    </ActionIcon>
                    
                    <ActionIcon 
                        variant="filled"
                        color="gray"
                        opacity={0.7}
                        onClick={() => navigateToPage('next')}
                        disabled={!documents || documents.length <= 1}
                        style={{ cursor: 'pointer' }}
                    >
                        <IconChevronRight size={24} />
                    </ActionIcon>
                </Group>
                
                {mediaType === 'image' && (
                    <Box 
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            height: '100%',
                            padding: '0 40px', // Make room for navigation arrows
                            boxSizing: 'border-box'
                        }}
                    >
                        <Image
                            src={mediaUrl || "/placeholder_image.svg"}
                            alt={`Page ${activeDocument?.page}`}
                            width={1200}
                            height={1200}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: "contain",
                                // Use aspect ratio to determine dimensions
                                ...(getAspectRatio().width > getAspectRatio().height 
                                    ? { width: 'auto', height: '90%' } // Landscape
                                    : { width: '90%', height: 'auto' }) // Portrait or square
                            }}
                            sizes="100vw"
                            unoptimized
                        />
                    </Box>
                )}
                
                {mediaType === 'video' && (
                    <Box style={{ width: '100%', height: '70%', padding: '0 40px' }}>
                        <video 
                            ref={videoRef}
                            controls
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        >
                            <source src={mediaUrl} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </Box>
                )}
                
                {mediaType === 'audio' && (
                    <Box style={{ width: '100%', height: '70%', padding: '0 40px' }}>
                        <Box style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            height: 'calc(100% - 60px)' // Leave room for audio controls
                        }}>
                            <Image
                                src={`${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${activeDocumentId}.png`}
                                alt={`Audio waveform`}
                                width={800}
                                height={300}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: "contain"
                                }}
                                sizes="100vw"
                                unoptimized
                            />
                        </Box>
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
                            maxHeight: '30%', 
                            overflowY: 'auto',
                            padding: '15px',
                            borderRadius: '8px',
                            border: '2px solid #DAF7A6', // Light green border
                            marginTop: 'auto' // Push to bottom
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