/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, Tooltip, ActionIcon, Card, Text, Skeleton, Image, Flex, Loader, RingProgress, Menu } from "@mantine/core";
import { IconSearch, IconRefresh, IconEye, IconUpload, IconFileTypePpt, IconFileExcel, IconBookDownload, IconFile, IconCircleX, IconFileCheck } from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ChatMessage, ViewerMode, Document, File as SupabaseFile, ContentType, FileType, CONTENT_COLORS, Profile } from "@/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFiles } from "@/utils/queries/get-files";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClass } from "@/utils/queries/get-class";
import { markFileIdle, updateFileStatus, updateProgress, updateFileNumber } from "@/utils/services/file";
import DraggableWrapper from "../DragDrop/DraggableWrapper";
import { Dropzone } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import * as tus from 'tus-js-client';
import { createFile } from "@/utils/services/file";
import { useStudentMode } from "../StudentModeContext";
import { useDrop } from "react-dnd";
import ItemCard from "./ItemCard";
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

    const openRef = useRef<HTMLDivElement>(null);
    // Add a new ref to track the selected content type
    const contentTypeRef = useRef<ContentType>('other');

    // Add refs for the first items of each type
    const firstLectureRef = useRef<string | null>(null);
    const firstTextbookRef = useRef<string | null>(null);
    const firstHomeworkRef = useRef<string | null>(null);
    const firstOtherRef = useRef<string | null>(null);

    // Initialize lastProgressUpdate state with null
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

    // Add a function to handle file reordering
    const handleReorderFiles = async (draggedId: string, targetId: string) => {
        if (!files) return;

        // Find the dragged and target files
        const draggedFile = files.find(f => f.id === draggedId);
        const targetFile = files.find(f => f.id === targetId);

        if (!draggedFile || !targetFile || draggedFile.id === targetFile.id) return;

        // Get all files of the same content type
        const sameTypeFiles = files.filter(f => f.content_type === draggedFile.content_type);

        // Sort by current file_number
        const sortedFiles = [...sameTypeFiles].sort((a, b) => a.file_number - b.file_number);

        // Remove the dragged file from its current position
        const newOrder = sortedFiles.filter(f => f.id !== draggedId);

        // Find the index where the target file is
        const targetIndex = newOrder.findIndex(f => f.id === targetId);

        // Insert the dragged file at the target position
        newOrder.splice(targetIndex, 0, draggedFile);

        // Update file_number for all files in the new order
        const updates = newOrder.map((file, index) => {
            return {
                id: file.id,
                newNumber: index + 1
            };
        });

        // Update the database with new file numbers
        try {
            // Create an array of promises for all updates
            const updatePromises = updates.map(update =>
                updateFileNumber(update.id, update.newNumber)
            );

            // Wait for all updates to complete
            await Promise.all(updatePromises);

            // Invalidate the files query to refresh the data
            queryClient.invalidateQueries({ queryKey: ["files", classId] });

            // Show success notification
            notifications.show({
                title: 'Files reordered',
                message: 'The file order has been updated',
                color: 'green',
            });
        } catch (error) {
            console.error('Error reordering files:', error);
            notifications.show({
                title: 'Error reordering files',
                message: error instanceof Error ? error.message : 'Please try again.',
                color: 'red',
            });
        }
    };

    // Get all content items combined
    const getAllContentItems = () => {
        const allItems: any[] = [];

        // Define content type order
        const contentTypeOrder = {
            'homework': 1,
            'lecture': 2,
            'rubric': 3,
            'textbook': 4,
            'other': 5
        };

        // Filter files based on visibility rules
        const visibleFiles = files?.filter(f => {
            // If user is professor/admin and not in student mode, show all files
            if ((profile?.professor || profile?.admin) && !studentMode) {
                return true;
            }
            // Otherwise, only show files with a file_date
            return f.file_date !== null;
        });

        if (!visibleFiles) return allItems;

        // Group files by content type
        const filesByType = {
            'homework': visibleFiles.filter(f => f.content_type === 'homework'),
            'lecture': visibleFiles.filter(f => f.content_type === 'lecture'),
            'rubric': visibleFiles.filter(f => f.content_type === 'rubric'),
            'textbook': visibleFiles.filter(f => f.content_type === 'textbook'),
            'other': visibleFiles.filter(f => f.content_type === 'other')
        };

        // Process each content type in the specified order
        Object.entries(filesByType).sort(([typeA], [typeB]) =>
            contentTypeOrder[typeA as keyof typeof contentTypeOrder] -
            contentTypeOrder[typeB as keyof typeof contentTypeOrder]
        ).forEach(([contentType, typeFiles]) => {
            // Sort files by file_number then by created_at
            const sortedFiles = [...typeFiles].sort((a, b) => {
                // First sort by file_number, reverse
                if (a.file_number !== b.file_number) {
                    return b.file_number - a.file_number;
                }
                // Then sort by created_at date
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return dateA - dateB;
            });

            // Apply search filter and map to display format
            const filteredFiles = filterBySearch(sortedFiles, fileDocuments || [])
                .filter(f => !activeChat.files.includes(f.id))
                .map(f => ({
                    ...f,
                    newName: f.title ?? "",
                    imageUrl: getFileImageUrl(f, fileDocuments?.find(d => d.file === f.id)?.id ?? ""),
                    type: contentType === 'homework' ? 'homeworks' :
                        contentType === 'lecture' ? 'lectures' :
                            contentType === 'textbook' ? 'textbooks' :
                                contentType === 'rubric' ? 'rubrics' : 'other',
                    color: CONTENT_COLORS[contentType as keyof typeof CONTENT_COLORS] || CONTENT_COLORS.other,
                }));

            // Store first file ID references for scrolling
            if (filteredFiles.length > 0) {
                if (contentType === 'lecture' && firstLectureRef.current === null) {
                    firstLectureRef.current = filteredFiles[0].id;
                } else if (contentType === 'textbook' && firstTextbookRef.current === null) {
                    firstTextbookRef.current = filteredFiles[0].id;
                } else if (contentType === 'homework' && firstHomeworkRef.current === null) {
                    firstHomeworkRef.current = filteredFiles[0].id;
                } else if (contentType === 'other' && firstOtherRef.current === null) {
                    firstOtherRef.current = filteredFiles[0].id;
                }
            }

            allItems.push(...filteredFiles);
        });

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

                        // Always update the notification UI (this is fine to do frequently)
                        notifications.update({
                            id: `upload-${fileId}`,
                            message: `Uploading ${file.name}: ${percentage.toFixed(2)}%`,
                            loading: true,
                            autoClose: false,
                        });
                        
                        // Throttle updates to Supabase
                        const currentTime = Date.now();
                        if (lastProgressUpdate === null || currentTime - lastProgressUpdate > 100) {
                            updateProgress(fileId, percentage);
                            setLastProgressUpdate(currentTime);
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
        }
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
                        <>
                            {profile && ((profile.admin || profile.professor) && !studentMode) ?
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
                                                if (openRef.current) {
                                                    openRef.current.click();
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
                                                if (openRef.current) {
                                                    openRef.current.click();
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
                                                if (openRef.current) {
                                                    openRef.current.click();
                                                }
                                            }}
                                        >
                                            Homework
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFileCheck size={14} />}
                                            onClick={() => {
                                                // Set content type before clicking
                                                contentTypeRef.current = 'rubric';
                                                if (openRef.current) {
                                                    openRef.current.click();
                                                }
                                            }}
                                        >
                                            Rubric
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFile size={14} />}
                                            onClick={() => {
                                                // Set content type before clicking
                                                contentTypeRef.current = 'other';
                                                if (openRef.current) {
                                                    openRef.current.click();
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
                                            if (openRef.current) {
                                                openRef.current.click();
                                            }
                                        }}>
                                            <IconUpload size={18} />
                                        </ActionIcon>
                                    </Tooltip> : null}
                        </>
                    </Flex>
                )}

                {canUpload ? (
                    <Dropzone
                        ref={openRef}
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
                                    height: "100%",
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
                                                        onReorder={handleReorderFiles}
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
                    </Dropzone>
                ) : (
                    // Regular non-dropzone version when uploads aren't allowed
                    <Stack>
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
                                                        onReorder={handleReorderFiles}
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
            </Stack>

            {/* Hidden file input for manual uploads */}
        </Card>
    );
}


