/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, Tooltip, ActionIcon, Card, Text, Skeleton, Image, Flex, Loader, RingProgress, Menu } from "@mantine/core";
import { IconSearch, IconRefresh, IconEye, IconUpload, IconFileTypePpt, IconFileExcel, IconBookDownload, IconFile, IconCircleX } from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ChatMessage, ViewerMode, Document, File as SupabaseFile, ContentType, FileType } from "@/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFiles } from "@/utils/queries/get-files";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClass } from "@/utils/queries/get-class";
import { markFileIdle, updateFileStatus, updateProgress } from "@/utils/services/file";
import DraggableWrapper from "../DragDrop/DraggableWrapper";
import { Dropzone } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import * as tus from 'tus-js-client';
import { createFile } from "@/utils/services/file";
import { useStudentMode } from "../StudentModeContext";
declare global {
    interface Window {
        scrollToFirstItem?: (type: string) => void;
    }
}

interface ContextPanelProps {
    classId: string;
    isInitializing: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addFileToChat: (fileId: string) => void;
    addDocumentToChat: (documentId: string) => void;
    activeChat: ChatMessage;
    makeDraggable?: boolean;
    viewerMode: ViewerMode;
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    onFileDelete?: () => void;
}

// Define consistent colors for different content types
const CONTENT_COLORS = {
    lectures: 'blue',    // matches badge color
    textbooks: 'green',   // matches badge color
    homeworks: 'orange', // matches badge color
    other: 'violet',     // now matches badge color in ContextBadges
} as const;

// Define a reusable ItemCard component directly in ContextPanel
const ItemCard = ({
    item,
    classId,
    profileId,
    color,
    contextType,
    addFileToChat,
    isVisible,
    makeDraggable = false,
    setViewerMode,
    fileDocuments,
    onFileDelete
}: {
    item: any,
    classId: string,
    profileId: string,
    color: string,
    contextType: 'lectures' | 'textbooks' | 'homeworks' | 'other',
    addFileToChat: (fileId: string) => void,
    isVisible: boolean,
    makeDraggable?: boolean,
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    fileDocuments?: Document[],
    onFileDelete?: () => void
}) => {
    const queryClient = useQueryClient();

    // Get color based on parse status
    const getStatusColor = () => {
        switch (item.parse_status) {
            case 'uploading':
                return 'blue';
            case 'compressing':
                return 'yellow';
            case 'extracting':
                return 'violet';
            case 'parsing':
                return 'indigo';
            case 'processing':
                return 'green';
            case 'error':
                return 'red';
            case 'complete':
                return 'teal';
            default:
                return 'gray';
        }
    };

    // Centralized file progress calculation based on parse_status
    const getFileProgress = (fileId: string) => {
        // If no file documents, return 0
        if (!fileDocuments) return 0;

        // Handle different states with appropriate progress calculations
        switch (item.parse_status) {
            case 'compressing':
                // Use compression_progress (0-100) for compressing state
                return item.compression_progress ? item.compression_progress : 0;

            case 'extracting':
            case 'parsing':
                // Get documents associated with this file
                const fileRelatedDocs = fileDocuments.filter(doc => doc.file === fileId);

                // If no documents or file has no length property, return 0
                if (fileRelatedDocs.length === 0 || !item.length) return 0;

                // Calculate percentage based on document count vs expected length
                return (fileRelatedDocs.length / item.length) * 100;

            case 'processing':
                // Use file size and time-based heuristic for processing
                if (!item.file_size || !item.last_parse_attempt) return 50; // Default to 50% if missing data

                // Calculate time elapsed since processing started
                const startTime = new Date(item.last_parse_attempt).getTime();
                const currentTime = new Date().getTime();
                const elapsedSeconds = (currentTime - startTime) / 1000;

                // Estimate total processing time based on file size (KB)
                // Assuming ~1MB per 10 seconds processing time as a rough heuristic
                const fileSizeKB = item.file_size / 1024;
                const estimatedTotalSeconds = (fileSizeKB / 100) * 10;

                // Calculate progress percentage
                let progressPercentage = (elapsedSeconds / estimatedTotalSeconds) * 100;

                // Cap at 95% until complete
                return Math.min(progressPercentage, 95);

            case 'uploading':
                // For uploading, we rely on the tus progress updates
                // This is handled separately in the notifications
                return item.upload_progress ? item.upload_progress * 100 : 0;

            case 'complete':
                return 100;

            default:
                return 0;
        }
    };

    // Get progress label based on status
    const getProgressLabel = () => {
        const progress = Math.round(getFileProgress(item.id));

        switch (item.parse_status) {
            case 'compressing':
                return `Compressing: ${progress}%`;
            case 'extracting':
                return `Extracting: ${progress}%`;
            case 'parsing':
                return `Parsing: ${progress}%`;
            case 'processing':
                return `Processing: ${progress}%`;
            case 'uploading':
                return `Uploading: ${progress}%`;
            default:
                return `${progress}%`;
        }
    };

    const originalCard = (
        <Card
            shadow="xs"
            p="xs"
            radius="md"
            withBorder
            style={{
                marginBottom: '8px',
                cursor: makeDraggable ? 'grab' : 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
            }}
            onClick={(e) => {
                e.stopPropagation();
                // Only allow clicking if the file is complete or in processing stages
                if (item.parse_status === 'complete' || item.parse_status === 'parsing' || item.parse_status === 'extracting' || item.parse_status === 'processing') {
                    addFileToChat(item.id);
                }
            }}
        >
            <Group>
                {isVisible ? (
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '4px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f0f0f0'
                    }}>
                        <Image
                            src={item.imageUrl}
                            alt={item.newName}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                            loading="lazy"
                        />
                    </div>
                ) : (
                    <Skeleton width={40} height={40} radius={4} />
                )}
                <Stack style={{ flex: 1 }}>
                    <Group justify="space-between" wrap="nowrap">
                        <Text
                            size="sm"
                            lineClamp={2}
                            title={item.newName}
                            style={{
                                wordBreak: 'break-word',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                flex: 1
                            }}
                        >
                            {item.newName}
                        </Text>
                        <>
                            {/* Status indicators based on parse_status */}
                            {item.parse_status === 'idle' ? (
                                <Tooltip label="Loading...">
                                    <ActionIcon variant="transparent" color="blue" size="sm">
                                        <Loader size={"xs"} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : item.parse_status === 'error' ? (
                                <Tooltip label="Error Processing">
                                    <ActionIcon variant="light" color="red" size="sm">
                                        <IconCircleX size={16} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : (item.parse_status === 'uploading' || item.parse_status === 'compressing' ||
                                item.parse_status === 'parsing' || item.parse_status === 'extracting' ||
                                item.parse_status === 'processing') ? (
                                <Tooltip label={getProgressLabel()}>
                                    <RingProgress
                                        size={40}
                                        thickness={2}
                                        sections={[{
                                            value: getFileProgress(item.id),
                                            color: getStatusColor()
                                        }]}
                                        label={
                                            <Text size="xs" ta="center" fw={500} c={getStatusColor()}>
                                                {Math.round(getFileProgress(item.id))}%
                                            </Text>
                                        }
                                    />
                                </Tooltip>
                            ) : (
                                <Tooltip label="Open in viewer">
                                    <ActionIcon variant="subtle" size="md" onClick={(e) => {
                                        e.stopPropagation();
                                        if (setViewerMode) {
                                            const document = fileDocuments?.find(d => d.file === item.id)
                                            if (document) {
                                                handleDocumentClick(item.id, document.id, setViewerMode, false);
                                            }
                                        }
                                    }}>
                                        <IconEye size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </>
                    </Group>
                </Stack>
            </Group >
        </Card >
    );

    // Wrap in draggable component if needed
    return makeDraggable && item.parse_status === 'complete' ? (
        <DraggableWrapper item={item} type={'file'} makeDraggable={makeDraggable}>
            {originalCard}
        </DraggableWrapper>
    ) : originalCard;
};

// Section loading skeleton
const SectionSkeleton = () => (
    <Stack>
        {[1, 2, 3].map((i) => (
            <Card key={i} shadow="xs" p="xs" radius="md" withBorder>
                <Group>
                    <Skeleton width={40} height={40} radius="md" />
                    <Stack style={{ flex: 1 }}>
                        <Skeleton height={12} width="60%" />
                        <Skeleton height={8} width="40%" />
                    </Stack>
                </Group>
            </Card>
        ))}
    </Stack>
);

export function ContextPanel({
    isInitializing,
    classId,
    searchQuery,
    setSearchQuery,
    addFileToChat,
    addDocumentToChat,
    activeChat,
    makeDraggable = false,
    viewerMode,
    setViewerMode,
    onFileDelete
}: ContextPanelProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);
    const { studentMode } = useStudentMode();


    const fileInputRef = useRef<HTMLInputElement>(null);
    // Add a new ref to track the selected content type
    const contentTypeRef = useRef<ContentType>('other');

    // Add refs for the first items of each type
    const firstLectureRef = useRef<string | null>(null);
    const firstTextbookRef = useRef<string | null>(null);
    const firstHomeworkRef = useRef<string | null>(null);
    const firstOtherRef = useRef<string | null>(null);

    const [lastProgressUpdate, setLastProgressUpdate] = useState<number | null>(null);

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId),
        enabled: !!classId
    })

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
        enabled: !!profile
    });

    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files
    });

    // Add this function inside the ContextPanel component but outside any effects
    const calculateFileProgress = (file: SupabaseFile, fileDocuments?: Document[]) => {
        const fileId = file.id;
        const status = file.parse_status;

        // Calculate progress based on status
        if (status === 'compressing' && file.compression_progress) {
            return Math.round(file.compression_progress);
        }
        else if ((status === 'extracting' || status === 'parsing') && file.length) {
            // Get documents for this file
            if (fileDocuments) {
                const fileRelatedDocs = fileDocuments.filter(doc => doc.file === fileId);
                return Math.round((fileRelatedDocs.length / file.length) * 100);
            }
        }
        else if (status === 'processing' && file.file_size && file.last_parse_attempt) {
            // Calculate time-based progress for processing
            const startTime = new Date(file.last_parse_attempt).getTime();
            const currentTime = new Date().getTime();
            const elapsedSeconds = (currentTime - startTime) / 1000;

            // Estimate total processing time based on file size (KB)
            const fileSizeKB = file.file_size / 1024;
            const estimatedTotalSeconds = (fileSizeKB / 100) * 10;

            return Math.min(Math.round((elapsedSeconds / estimatedTotalSeconds) * 100), 95);
        } else if (status === 'uploading') {
            return Math.round(file.upload_progress);
        } else if (status === 'complete') {
            return 100;
        }

        return 0; // Default for other states
    };

    // Get color based on parse status (for notifications)
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'uploading':
                return 'blue';
            case 'compressing':
                return 'yellow';
            case 'extracting':
                return 'violet';
            case 'parsing':
                return 'indigo';
            case 'processing':
                return 'green';
            case 'error':
                return 'red';
            case 'complete':
                return 'teal';
            default:
                return 'gray';
        }
    };

    useEffect(() => {
        // for the notifications
        if (files) {
            const filteredFiles = files.filter(f => f.parse_status !== 'complete');
            for (const file of filteredFiles) {
                const progress = calculateFileProgress(file, fileDocuments);
                const statusColor = getStatusColor(file.parse_status);
                const status = file.parse_status;
                if (status === 'uploading') {
                notifications.update({
                        id: `upload-${file.id}`,
                        title: 'Uploading file',
                        message: `Uploading ${file.title}... ${progress}%`,
                        color: statusColor,
                        loading: true,
                        autoClose: false
                    });
                } else if (status === 'compressing') {
                    notifications.update({
                        id: `upload-${file.id}`,
                        title: 'Compressing file',
                        message: `Compressing ${file.title}... ${progress}%`,
                        color: statusColor,
                        loading: true,
                        autoClose: false
                    });
                } else if (status === 'extracting') {
                    notifications.update({
                        id: `upload-${file.id}`,
                        title: 'Extracting content',
                        message: `Extracting ${file.title}... ${progress}%`,
                        color: statusColor,
                        loading: true,
                        autoClose: false
                    });
                } else if (status === 'parsing') {
                    notifications.update({
                        id: `upload-${file.id}`,
                        title: 'Parsing content',
                        message: `Parsing ${file.title}... ${progress}%`,
                        color: statusColor,
                        loading: true,
                        autoClose: false
                    });
                } else if (status === 'processing') {
                    notifications.update({
                        id: `upload-${file.id}`,
                        title: 'Processing content',
                        message: `Processing ${file.title}... ${progress}%`,
                        color: statusColor,
                        loading: true,
                        autoClose: false
                    });
                } else if (status === 'error') {
                    notifications.update({
                        id: `upload-${file.id}`,
                        title: 'Error processing file',
                        message: `Error processing ${file.title}`,
                        color: 'red',
                        autoClose: 5000
                    });
                }
            }
        }
    }, [files])

    useEffect(() => {
        setLocalSearchQuery(searchQuery);
    }, [searchQuery]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSearchQuery(localSearchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [localSearchQuery, setSearchQuery]);


    // Track which items are currently visible in the viewport
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const id = entry.target.getAttribute('data-id');
                    if (id) {
                        setVisibleItems(prev => {
                            const newSet = new Set(prev);
                            if (entry.isIntersecting) {
                                newSet.add(id);
                            } else {
                                // Optional: remove items that are no longer visible
                                // Keeping them in the set will act as a cache
                                // newSet.delete(id);
                            }
                            return newSet;
                        });
                    }
                });
            },
            {
                root: containerRef.current,
                threshold: 0.1,
                rootMargin: '100px' // Load images slightly before they come into view
            }
        );

        return () => {
            observer.disconnect();
        };
    }, []);

    const getFileImageUrl = (item: SupabaseFile, documentId: string) => {
        if (documentId.length > 0) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${item.id}/${documentId}.png`;
        }
        return "/placeholder_image.svg";
    }

    // Add search filtering function
    const filterBySearch = (items: any[], documents: any[]) => {
        if (!localSearchQuery) return items;
        const query = localSearchQuery.toLowerCase();

        return items.filter(item => {
            // Check item name/title
            if (item.name?.toLowerCase().includes(query) ||
                item.title?.toLowerCase().includes(query)) {
                return true;
            }

            return documents?.some(doc =>
                doc.text?.toLowerCase().includes(query) ||
                doc.description?.toLowerCase().includes(query)
            );
        });
    };

    // Get all content items combined
    const getAllContentItems = () => {
        const allItems = [];

        const lectureFiles = files?.filter(f => f.content_type === 'lecture');
        const textbookFiles = files?.filter(f => f.content_type === 'textbook');
        const homeworkFiles = files?.filter(f => f.content_type === 'homework');
        const otherFiles = files?.filter(f => f.content_type === 'other');

        // Add files
        if (lectureFiles) {
            const filteredFiles = filterBySearch(lectureFiles, fileDocuments || [])
                .filter(f => !activeChat.files.includes(f.id))
                .map(f => ({
                    ...f,
                    newName: f.title ?? "",
                    imageUrl: getFileImageUrl(f, fileDocuments?.find(d => d.file === f.id)?.id ?? ""),
                    type: 'lectures',
                    color: CONTENT_COLORS.lectures,
                }));

            // Store the first file ID if available
            if (filteredFiles.length > 0 && firstLectureRef.current === null) {
                firstLectureRef.current = filteredFiles[0].id;
            }

            allItems.push(...filteredFiles);
        }

        if (textbookFiles) {
            const filteredFiles = filterBySearch(textbookFiles, fileDocuments || [])
                .filter(f => !activeChat.files.includes(f.id))
                .map(f => ({
                    ...f,
                    newName: f.title ?? "",
                    imageUrl: getFileImageUrl(f, fileDocuments?.find(d => d.file === f.id)?.id ?? ""),
                    type: 'textbooks',
                    color: CONTENT_COLORS.textbooks,
                }));

            // Store the first file ID if available
            if (filteredFiles.length > 0 && firstTextbookRef.current === null) {
                firstTextbookRef.current = filteredFiles[0].id;
            }

            allItems.push(...filteredFiles);
        }

        if (homeworkFiles) {
            const filteredFiles = filterBySearch(homeworkFiles, fileDocuments || [])
                .filter(f => !activeChat.files.includes(f.id))
                .map(f => ({
                    ...f,
                    newName: f.title ?? "",
                    imageUrl: getFileImageUrl(f, fileDocuments?.find(d => d.file === f.id)?.id ?? ""),
                    type: 'homeworks',
                    color: CONTENT_COLORS.homeworks,
                }));

            // Store the first file ID if available
            if (filteredFiles.length > 0 && firstHomeworkRef.current === null) {
                firstHomeworkRef.current = filteredFiles[0].id;
            }

            allItems.push(...filteredFiles);
        }

        if (otherFiles) {
            const filteredFiles = filterBySearch(otherFiles, fileDocuments || [])
                .filter(f => !activeChat.files.includes(f.id))
                .map(f => ({
                    ...f,
                    newName: f.title ?? "",
                    imageUrl: getFileImageUrl(f, fileDocuments?.find(d => d.file === f.id)?.id ?? ""),
                    type: 'other',
                    color: CONTENT_COLORS.other,
                }));

            // Store the first file ID if available
            if (filteredFiles.length > 0 && firstOtherRef.current === null) {
                firstOtherRef.current = filteredFiles[0].id;
            }

            allItems.push(...filteredFiles);
        }

        return allItems;
    };


    const allContentItems = getAllContentItems();
    const isLoading = loadingFiles || loadingClassData;

    // Find first items of each type for scrolling
    const firstLectureItem = allContentItems.find(item => item.type === 'lectures');
    const firstChapterItem = allContentItems.find(item => item.type === 'textbooks');
    const firstHomeworkItem = allContentItems.find(item => item.type === 'homeworks');
    const firstOtherItem = allContentItems.find(item => item.type === 'other');
    // Virtualized list setup
    const rowVirtualizer = useVirtualizer({
        count: allContentItems.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => 70, // Approximate height of each item
        overscan: 5, // Number of items to render outside of the visible area
    });

    // Connect observer to virtualized items
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    const id = entry.target.getAttribute('data-id');
                    if (id) {
                        setVisibleItems(prev => {
                            const newSet = new Set(prev);
                            if (entry.isIntersecting) {
                                newSet.add(id);
                            }
                            return newSet;
                        });
                    }
                });
            },
            {
                root: containerRef.current,
                threshold: 0.1,
                rootMargin: '100px'
            }
        );

        // Observe all virtual items
        const elements = containerRef.current.querySelectorAll('[data-id]');
        elements.forEach(el => observer.observe(el));

        return () => {
            elements.forEach(el => observer.unobserve(el));
        };
    }, [rowVirtualizer.getVirtualItems()]);

    // Handle file upload (similar to UploadFileButton)
    const handleUploadFile = async (file: File) => {
        try {
            if (!profile) {
                throw new Error("Profile not found");
            }

            // Use the contentTypeRef value
            const contentType = contentTypeRef.current;

            const fullFileName = file.name;
            // get the file name without the extension
            const fileName = fullFileName.split('.').slice(0, -1).join('.');
            let fileType: FileType = "other";
            // find the file type
            if (file.type === "application/pdf") {
                fileType = "pdf";
            } else if (file.type === "video/mp4") {
                fileType = "video";
            } else if (file.type === "audio/wav") {
                fileType = "audio";
            } else if (file.type === "video/webm") {
                fileType = "video";
            } else if (file.type === "image/jpeg" || file.type === "image/png") {
                fileType = "image";
            }

            // find the file number (1 more than the highest file number in the class)
            const fileNumber = files?.length ? Math.max(...files.map(file => file.file_number)) + 1 : 1;

            // create a new file
            const fileId = await createFile(classId, fileName, fileNumber, fileType, contentType, profile.id);

            const addProfile = !((profile.admin || profile.professor) && !studentMode); // if they are not a professor

            // Show upload notification
            const notificationId = notifications.show({
                id: `upload-${fileId}`,
                title: 'Uploading file',
                message: `Uploading ${file.name}: 0%`,
                loading: true,
                autoClose: false,
                color: 'blue',
            });
            console.log("Upload notification ID:", notificationId);

            // Create a new tus upload
            return new Promise((resolve, reject) => {
                // Get the base URL for the API
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

                let metadata = {};
                if (addProfile) {
                    metadata = {
                        filename: file.name,
                        filetype: file.type,
                        fileId: fileId,
                        classId: classId,
                        startParse: 'true', // Always start parsing for dropped files
                        baseUrl: baseUrl,
                        contentType: contentType,
                    };
                } else {
                    metadata = {
                        filename: file.name,
                        filetype: file.type,
                        fileId: fileId,
                        classId: classId,
                        startParse: 'true',
                        baseUrl: baseUrl,
                        contentType: contentType,
                        profile: profile.id,
                    };
                }
                // Create a new tus upload
                const upload = new tus.Upload(file, {
                    // Endpoint for creating uploads
                    endpoint: `${baseUrl}/upload/tus`,
                    // Store URL in localStorage to resume upload after browser restart
                    storeFingerprintForResuming: true,
                    // Add metadata
                    metadata: metadata,
                    onBeforeRequest() {
                        // update the status to uploading in supabase
                        updateFileStatus(fileId, 'uploading');
                    },
                    // Called when upload progress changes
                    onProgress(bytesUploaded, bytesTotal) {
                        const percentage = (bytesUploaded / bytesTotal) * 100;

                        notifications.update({
                            id: `upload-${fileId}`,
                            message: `Uploading ${file.name}: ${percentage.toFixed(2)}%`,
                            loading: true,
                            autoClose: false,
                        });
                        // 2b. Push progress to Supabase (throttle to 100ms)
                        if (lastProgressUpdate && Date.now() - lastProgressUpdate > 100) {
                            updateProgress(fileId, percentage); // your edge function
                            setLastProgressUpdate(Date.now());
                        }
                    },
                    // Called when upload is completed successfully
                    onSuccess() {
                        console.log('Upload completed successfully');

                        // Finalize the upload by calling the finalize endpoint
                        fetch(`${baseUrl}/upload/tus/finalize`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ fileId: fileId }),
                        })
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to finalize upload');
                                }
                                return response.json();
                            })
                            .then(data => {
                                notifications.update({
                                    id: `upload-${fileId}`,
                                    title: 'Upload complete',
                                    message: `${file.name} uploaded successfully`,
                                    color: 'green',
                                    loading: false,
                                    autoClose: 3000,
                                });

                                queryClient.invalidateQueries({ queryKey: ['files', classId] });

                                // Reset the file input to allow re-uploading the same file
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }

                                resolve(data);
                            })
                            .catch(error => {
                                console.error('Error finalizing upload:', error);
                                notifications.update({
                                    id: `upload-${fileId}`,
                                    title: 'Upload error',
                                    message: error.message,
                                    color: 'red',
                                    loading: false,
                                    autoClose: 5000,
                                });
                                reject(error);
                            });
                    },
                    // Called when an error occurs
                    onError(error) {
                        console.error('Error uploading file:', error);
                        notifications.update({
                            id: `upload-${fileId}`,
                            title: 'Upload error',
                            message: `Failed to upload ${file.name}: ${error.message}`,
                            loading: false,
                            autoClose: 5000,
                            color: 'red',
                        });
                        reject(error);
                    },
                });

                // Start the upload
                upload.start();
            });

        } catch (error) {
            console.error('Error uploading file:', error);
            notifications.show({
                title: 'Error uploading file',
                message: error instanceof Error ? error.message : 'Please try again.',
                color: 'red',
            });

            // Reset the file input even on error
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Render the upload button with menu options
    const renderUploadButton = () => {
        return profile && ((profile.admin || profile.professor) && !studentMode) ?
            <Menu
                openDelay={100}
                closeDelay={200}
                width={200}
                shadow="md"
                trigger="click-hover"
                transitionProps={{ transition: 'fade', duration: 200 }}
            >
                <Menu.Target>
                    <ActionIcon size={30} aria-label="Upload content">
                        <IconUpload size={18} />
                    </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Label>Upload Content</Menu.Label>
                    <Menu.Item
                        leftSection={<IconFileTypePpt size={14} />}
                        onClick={() => {
                            // Set content type before clicking
                            contentTypeRef.current = 'lecture';
                            if (fileInputRef.current) {
                                fileInputRef.current.click();
                            }
                        }}
                    >
                        Lecture
                    </Menu.Item>
                    <Menu.Item
                        leftSection={<IconBookDownload size={14} />}
                        onClick={() => {
                            // Set content type before clicking
                            contentTypeRef.current = 'textbook';
                            if (fileInputRef.current) {
                                fileInputRef.current.click();
                            }
                        }}
                    >
                        Textbook
                    </Menu.Item>
                    <Menu.Item
                        leftSection={<IconFileExcel size={14} />}
                        onClick={() => {
                            // Set content type before clicking
                            contentTypeRef.current = 'homework';
                            if (fileInputRef.current) {
                                fileInputRef.current.click();
                            }
                        }}
                    >
                        Homework
                    </Menu.Item>
                    <Menu.Item
                        leftSection={<IconFile size={14} />}
                        onClick={() => {
                            // Set content type before clicking
                            contentTypeRef.current = 'other';
                            if (fileInputRef.current) {
                                fileInputRef.current.click();
                            }
                        }}
                    >
                        Other
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu> : classData?.files_enabled ?
                <Tooltip label={"Upload files"}>
                    <ActionIcon size={30} aria-label="Upload files" onClick={() => {
                        // Set content type before clicking
                        contentTypeRef.current = 'other';
                        if (fileInputRef.current) {
                            fileInputRef.current.click();
                        }
                    }}>
                        <IconUpload size={18} />
                    </ActionIcon>
                </Tooltip> : null;
    };

    // Check if uploads are allowed
    const canUpload = classData?.files_enabled || (profile && ((profile.admin || profile.professor) && !studentMode));

    return (
        <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
                height: "calc(100vh - 100px)",
                overflowY: "auto"
            }}
        >
            {canUpload ? (
                <Dropzone
                    onDrop={(files) => {
                        files.forEach(file => handleUploadFile(file));
                    }}
                    onReject={(files) => {
                        notifications.show({
                            title: 'Invalid file',
                            message: 'Only PDF, video, audio, and image files are allowed.',
                            color: 'red',
                        });
                    }}
                    accept={['application/pdf', 'video/*', 'audio/*', 'image/*', 'text/*']}
                    multiple={true}
                    styles={{
                        root: {
                            border: 'none',
                            backgroundColor: 'transparent',
                            height: '100%',
                            padding: 0,
                            margin: 0,
                            // Allow pointer events to pass through when not in active drop state
                            pointerEvents: 'none'
                        },
                        inner: {
                            // This ensures the inner content receives pointer events
                            pointerEvents: 'auto'
                        }
                    }}
                    activateOnDrag={true}
                >
                    <div style={{
                        pointerEvents: 'auto', // Ensure children receive events
                        height: '100%',
                        width: '100%'
                    }}>
                        <Stack style={{ height: '100%' }}>
                            {isInitializing ? (
                                // Skeleton for search bar and upload button when initializing
                                <Flex justify="space-between" align="center" gap="md">
                                    <Skeleton height={36} radius="md" style={{ flex: 1 }} />
                                    <Skeleton height={36} width={36} radius="md" />
                                </Flex>
                            ) : (
                                <Flex justify="space-between" align="center" gap="md">
                                    <TextInput
                                        placeholder="Search context..."
                                        value={localSearchQuery}
                                        onChange={(e) => setLocalSearchQuery(e.target.value)}
                                        leftSection={<IconSearch size={16} />}
                                        style={{ flex: 1 }}
                                    />
                                    {renderUploadButton()}
                                </Flex>
                            )}

                            {isLoading || isInitializing ? (
                                // Always show 10 skeleton items when loading or initializing
                                <Stack>
                                    {Array(10).fill(0).map((_, i) => (
                                        <Card key={i} shadow="xs" p="xs" radius="md" withBorder>
                                            <Group>
                                                <Skeleton width={40} height={40} radius="md" />
                                                <Stack style={{ flex: 1 }}>
                                                    <Skeleton height={12} width="60%" />
                                                    <Skeleton height={8} width="40%" />
                                                </Stack>
                                            </Group>
                                        </Card>
                                    ))}
                                </Stack>
                            ) : (
                                <div
                                    ref={containerRef}
                                    style={{
                                        height: "calc(100vh - 100px)",
                                        overflow: 'auto',
                                        position: 'relative'
                                    }}
                                >
                                    {/* Add section marker divs for scrolling */}
                                    <div id="lectures-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                                    <div id="textbooks-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                                    <div id="homeworks-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                                    <div id="other-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>

                                    {allContentItems.length > 0 ? (
                                        <div
                                            style={{
                                                height: `${rowVirtualizer.getTotalSize()}px`,
                                                width: '100%',
                                                position: 'relative'
                                            }}
                                        >
                                            {rowVirtualizer.getVirtualItems().map(virtualRow => {
                                                const item = allContentItems[virtualRow.index];
                                                const itemId = `${item.type}-${item.id}`;
                                                const isItemVisible = visibleItems.has(itemId);

                                                // Add section-specific IDs to the first item of each type
                                                const isFirstOfType =
                                                    (item.type === 'lectures' && item.id === firstLectureItem?.id) ||
                                                    (item.type === 'textbooks' && item.id === firstChapterItem?.id) ||
                                                    (item.type === 'homeworks' && item.id === firstHomeworkItem?.id) ||
                                                    (item.type === 'other' && item.id === firstOtherItem?.id);

                                                return (
                                                    <div
                                                        key={itemId}
                                                        data-id={itemId}
                                                        id={isFirstOfType ? `${item.type}-section-first-item` : undefined}
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: `${virtualRow.size}px`,
                                                            transform: `translateY(${virtualRow.start}px)`,
                                                        }}
                                                    >
                                                        <ItemCard
                                                            item={item}
                                                            classId={classId}
                                                            profileId={profile?.id ?? ""}
                                                            color={item.color}
                                                            contextType={item.type}
                                                            addFileToChat={addFileToChat}
                                                            isVisible={isItemVisible || localSearchQuery.length > 0}
                                                            makeDraggable={makeDraggable}
                                                            setViewerMode={setViewerMode}
                                                            fileDocuments={fileDocuments}
                                                            onFileDelete={onFileDelete}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <Text c="dimmed" ta="center" py="md">
                                            {localSearchQuery ? "No results found" : "No content available"}
                                        </Text>
                                    )}
                                </div>
                            )}
                        </Stack>
                    </div>
                </Dropzone>
            ) : (
                // Regular non-dropzone version when uploads aren't allowed
                <Stack>
                    {isInitializing ? (
                        // Skeleton for search bar when initializing
                        <Flex justify="space-between" align="center" gap="md">
                            <Skeleton height={36} radius="md" style={{ flex: 1 }} />
                        </Flex>
                    ) : (
                        <TextInput
                            placeholder="Search context..."
                            value={localSearchQuery}
                            onChange={(e) => setLocalSearchQuery(e.target.value)}
                            leftSection={<IconSearch size={16} />}
                            style={{ flex: 1 }}
                        />
                    )}

                    {isLoading || isInitializing ? (
                        // Always show 10 skeleton items when loading or initializing
                        <Stack>
                            {Array(10).fill(0).map((_, i) => (
                                <Card key={i} shadow="xs" p="xs" radius="md" withBorder>
                                    <Group>
                                        <Skeleton width={40} height={40} radius="md" />
                                        <Stack style={{ flex: 1 }}>
                                            <Skeleton height={12} width="60%" />
                                            <Skeleton height={8} width="40%" />
                                        </Stack>
                                    </Group>
                                </Card>
                            ))}
                        </Stack>
                    ) : (
                        <div
                            ref={containerRef}
                            style={{
                                height: "calc(100vh - 100px)",
                                overflow: 'auto',
                                position: 'relative'
                            }}
                        >
                            {/* Add section marker divs for scrolling */}
                            <div id="lectures-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                            <div id="textbooks-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                            <div id="homeworks-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                            <div id="other-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>

                            {allContentItems.length > 0 ? (
                                <div
                                    style={{
                                        height: `${rowVirtualizer.getTotalSize()}px`,
                                        width: '100%',
                                        position: 'relative'
                                    }}
                                >
                                    {rowVirtualizer.getVirtualItems().map(virtualRow => {
                                        const item = allContentItems[virtualRow.index];
                                        const itemId = `${item.type}-${item.id}`;
                                        const isItemVisible = visibleItems.has(itemId);

                                        // Add section-specific IDs to the first item of each type
                                        const isFirstOfType =
                                            (item.type === 'lectures' && item.id === firstLectureItem?.id) ||
                                            (item.type === 'textbooks' && item.id === firstChapterItem?.id) ||
                                            (item.type === 'homeworks' && item.id === firstHomeworkItem?.id) ||
                                            (item.type === 'other' && item.id === firstOtherItem?.id);

                                        return (
                                            <div
                                                key={itemId}
                                                data-id={itemId}
                                                id={isFirstOfType ? `${item.type}-section-first-item` : undefined}
                                                style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: `${virtualRow.size}px`,
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                }}
                                            >
                                                <ItemCard
                                                    item={item}
                                                    classId={classId}
                                                    profileId={profile?.id ?? ""}
                                                    color={item.color}
                                                    contextType={item.type}
                                                    addFileToChat={addFileToChat}
                                                    isVisible={isItemVisible || localSearchQuery.length > 0}
                                                    makeDraggable={makeDraggable}
                                                    setViewerMode={setViewerMode}
                                                    fileDocuments={fileDocuments}
                                                    onFileDelete={onFileDelete}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <Text c="dimmed" ta="center" py="md">
                                    {localSearchQuery ? "No results found" : "No content available"}
                                </Text>
                            )}
                        </div>
                    )}
                </Stack>
            )}

            {/* Hidden file input for manual uploads */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                    e.preventDefault();
                    if (e.target.files?.length) {
                        Array.from(e.target.files).forEach(file => handleUploadFile(file));
                        // Reset the input value after handling files
                        e.currentTarget.value = '';
                    }
                }}
                accept="application/pdf,video/*,audio/*,image/*,text/*"
                style={{ display: 'none' }}
                multiple
            />
        </Card>
    );
}


