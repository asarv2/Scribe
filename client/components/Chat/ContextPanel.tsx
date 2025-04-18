/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, ScrollArea, useMantineColorScheme, Tooltip, ActionIcon, Card, Text, Skeleton, Image, Button, Box } from "@mantine/core";
import { IconSearch, IconPresentation, IconBook, IconFile, IconNotebook, IconPencil, IconSchool, IconChalkboard, IconCaretLeftRight, IconChevronDown, IconChevronRight, IconGripVertical } from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Lecture, Textbook, Chapter, Subchapter, Exercise, Homework, Problem, ChatMessage, ViewerMode, Document, File } from "@/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDrag } from 'react-dnd';
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFiles } from "@/utils/queries/get-files";
import DeleteFileModal from "../Delete/DeleteFileModal";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClass } from "@/utils/queries/get-class";
declare global {
    interface Window {
        scrollToFirstItem?: (type: string) => void;
    }
}

interface ContextPanelProps {
    classId: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addContextToChat: (contextId: string) => void;
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

// Define a wrapper component that makes an item draggable
function DraggableWrapper({
    children,
    item,
    type,
    makeDraggable = false
}: {
    children: React.ReactNode;
    item: { id: string };
    type: 'lectures' | 'textbooks' | 'homeworks' | 'other';
    makeDraggable?: boolean;
}) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'CONTEXT_ITEM',
        item: { id: item.id, type },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [item.id, type]);

    if (!makeDraggable) {
        return <>{children}</>;
    }

    return (
        <div
            ref={(drag as unknown) as React.LegacyRef<HTMLDivElement>}
            style={{
                opacity: isDragging ? 0.5 : 1,
                cursor: 'move',
                position: 'relative'
            }}
        >
            {children}
            {/* {isDragging && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    background: 'rgba(0, 120, 255, 0.8)',
                    color: 'white',
                    fontSize: '11px',
                    padding: '2px 5px',
                    borderRadius: '0 0 0 4px',
                    zIndex: 10
                }}>
                    Dragging
                </div>
            )} */}
        </div>
    );
}

// Define a reusable ItemCard component directly in ContextPanel
const ItemCard = ({
    item,
    classId,
    profileId,
    color,
    contextType,
    addContextToChat,
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
    addContextToChat: (contextId: string) => void,
    isVisible: boolean,
    makeDraggable?: boolean,
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    fileDocuments?: Document[],
    onFileDelete?: () => void
}) => {

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
                if (!makeDraggable) {
                    addContextToChat(item.id);
                } else if (setViewerMode) {
                    const document = fileDocuments?.find(d => d.file === item.id)
                    if (document) {
                        handleDocumentClick(item.id, document.id, setViewerMode);
                    }
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
                        <Group gap={2}>
                            {contextType === 'other' && (item.profile && item.profile === profileId) && (
                                <DeleteFileModal
                                    fileId={item.id}
                                    classId={classId}
                                    fileName={item.newName}
                                    navigateHome={false}
                                    profileId={profileId}
                                    onDelete={onFileDelete}
                                    contentType="other"
                                />
                            )}
                            {makeDraggable && (
                                <Tooltip label="Drag to chat">
                                    <ActionIcon variant="transparent" size="md" color="gray">
                                        <IconGripVertical size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </Group>
                    </Group>
                </Stack>
            </Group>
        </Card>
    );

    // Wrap in draggable component if needed
    return makeDraggable ? (
        <DraggableWrapper item={item} type={contextType} makeDraggable={makeDraggable}>
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
    classId,
    searchQuery,
    setSearchQuery,
    addContextToChat,
    activeChat,
    makeDraggable = false,
    viewerMode,
    setViewerMode,
    onFileDelete
}: ContextPanelProps) {
    const supabase = useSupabaseBrowser();
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // Add refs for the first items of each type
    const firstLectureRef = useRef<string | null>(null);
    const firstTextbookRef = useRef<string | null>(null);
    const firstHomeworkRef = useRef<string | null>(null);
    const firstOtherRef = useRef<string | null>(null);

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
        queryFn: () => getFiles(supabase, [classId]),
        enabled: !!profile
    });

    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files
    });

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

    const getFileImageUrl = (item: File, documentId: string) => {
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

        const lectureEnabled = classData?.lecture_enabled;
        const textbookEnabled = classData?.textbook_enabled;
        const homeworkEnabled = classData?.homework_enabled;
        const otherEnabled = classData?.files_enabled;

        // Add files
        if (lectureFiles && lectureEnabled) {
            const filteredFiles = filterBySearch(lectureFiles.sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())), fileDocuments || [])
                .filter(f => !activeChat.context.includes(f.id))
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

        if (textbookFiles && textbookEnabled) {
            const filteredFiles = filterBySearch(textbookFiles.sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())), fileDocuments || [])
                .filter(f => !activeChat.context.includes(f.id))
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

        if (homeworkFiles && homeworkEnabled) {
            const filteredFiles = filterBySearch(homeworkFiles.sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())), fileDocuments || [])
                .filter(f => !activeChat.context.includes(f.id))
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

        if (otherFiles && otherEnabled) {
            const filteredFiles = filterBySearch(otherFiles.sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())), fileDocuments || [])
                .filter(f => !activeChat.context.includes(f.id))
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
            <Stack>
                <TextInput
                    placeholder="Search context..."
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    leftSection={<IconSearch size={16} />}
                />

                {isLoading ? (
                    <>
                        <SectionSkeleton />
                        <SectionSkeleton />
                        <SectionSkeleton />
                    </>

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
                                                addContextToChat={addContextToChat}
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
        </Card>
    );
}


