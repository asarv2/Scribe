/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, ScrollArea, useMantineColorScheme, Tooltip, ActionIcon, Card, Text, Skeleton, Image, Button } from "@mantine/core";
import { IconSearch, IconPresentation, IconBook, IconFile, IconNotebook, IconPencil, IconSchool, IconChalkboard, IconCaretLeftRight, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { getLectures } from "@/utils/queries/get-lectures";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { Lecture, Textbook, Chapter, Subchapter, Exercise, Homework, Problem, ChatMessage, ViewerMode, Document, File } from "@/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDrag } from 'react-dnd';
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getFiles } from "@/utils/queries/get-files";
import DeleteFileModal from "../Delete/DeleteFileModal";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
declare global {
    interface Window {
        scrollToFirstItem?: (type: string) => void;
    }
}

interface ContextPanelProps {
    classId: string;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    activeChat: ChatMessage;
    makeDraggable?: boolean;
    viewerMode: ViewerMode;
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    onFileDelete?: () => void;
}

// Define consistent colors for different content types
const CONTENT_COLORS = {
    lectures: 'blue',    // matches badge color
    chapters: 'green',   // matches badge color
    exercises: 'cyan',   // matches badge color
    homeworks: 'orange', // matches badge color
    files: 'violet',     // now matches badge color in ContextBadges
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
    type: keyof ChatMessage['context'];
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
    lectureDocuments,
    textbookDocuments,
    fileDocuments,
    exercises,
    chapters,
    textbooks,
    onFileDelete
}: {
    item: any,
    classId: string,
    profileId: string,
    color: string,
    contextType: keyof ChatMessage['context'],
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void,
    isVisible: boolean,
    makeDraggable?: boolean,
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    lectureDocuments?: Document[],
    textbookDocuments?: Document[],
    fileDocuments?: Document[],
    exercises?: Exercise[],
    chapters?: Chapter[],
    textbooks?: Textbook[],
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
                    addContextToChat(contextType, item.id);
                } else if (setViewerMode) {
                    if (contextType === 'lectures') {
                        const document = lectureDocuments?.find(d => d.lecture === item.id) // first page of the lecture
                        if (document) {
                            handleDocumentClick('lectures', item.id, setViewerMode, document.id);
                        }
                    } else if (contextType === 'chapters') {
                        const chapter = chapters?.find(c => c.id === item.id)
                        if (chapter) {
                            const textbook = textbooks?.find(t => t.id === chapter.textbook)
                            if (textbook) {
                                const document = textbookDocuments?.find(d => d.page >= chapter.start_page && d.page <= chapter.end_page && d.textbook === textbook.id) // first page of the chapter
                                if (document) {
                                    handleDocumentClick('chapters', item.id, setViewerMode, document.id, textbook.id);
                                }
                            }
                        }
                    } else if (contextType === 'homeworks') {
                        const exercise = exercises?.filter(e => e.homework === item.id).sort((a, b) => a.problem_number - b.problem_number).sort((a, b) => a.problem_part_number - b.problem_part_number)[0] // find first exercise of the homework
                        if (exercise) {
                            handleDocumentClick('homeworks', item.id, setViewerMode, undefined, undefined, exercise.id);
                        }
                    } else if (contextType === 'files') {
                        const document = fileDocuments?.find(d => d.file === item.id)
                        if (document) {
                            handleDocumentClick('files', item.id, setViewerMode, document.id);
                        }
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
                                objectFit: 'contain',
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
                        {contextType === 'files' && <DeleteFileModal
                            fileId={item.id}
                            classId={classId}
                            fileName={item.newName}
                            navigateHome={false}
                            profileId={profileId}
                            onDelete={onFileDelete}
                        />}
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
    const firstChapterRef = useRef<string | null>(null);
    const firstHomeworkRef = useRef<string | null>(null);
    const firstFileRef = useRef<string | null>(null);

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId])
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId]),
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId]),
    });

    const { data: exercises, isLoading: loadingExercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id), homeworks!.map(h => h.id)),
    });

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", profile?.id, classId],
        queryFn: () => getFiles(supabase, profile!.id, [classId]),
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

    const getLectureImageUrl = (item: Lecture, documentId: string) => {
        if (documentId.length > 0) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${item.id}/${documentId}.png`;
        }
        return "/placeholder_image.svg";
    }

    const getChapterImage = (chapterId: string) => {
        const chapter = chapters?.find(chapter => chapter.id === chapterId);
        if (!chapter) return '/placeholder_image.svg';
        const filteredDocuments = textbookDocuments?.filter(document => document.page >= chapter.start_page && document.page <= chapter.end_page);
        if (!filteredDocuments) return '/placeholder_image.svg';
        const document = filteredDocuments[0];
        if (!document) return '/placeholder_image.svg';
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${chapter.textbook}/${document.id}.png`
    }

    const getHomeworkImageUrl = (homeworkId: string) => {
        if (!homeworkId) return '/placeholder_image.svg';
        // find the first exercise in the homework
        const exercise = exercises?.find(e => e.homework === homeworkId);
        if (!exercise) return '/placeholder_image.svg';

        // find the textbook document that has the same page number, but null for the chapter, homework and exercise
        const textbookDocumentHomework = textbookDocuments?.find(d => d.homeworks.includes(homeworkId));
        if (textbookDocumentHomework) return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentHomework.textbook}/${textbookDocumentHomework.id}.png`;

        // return the /classid/exerciseid.png
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`;
    }

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

            // Check item numbers (note_number, homework_number, chapter_number)
            if ((item.note_number !== undefined && item.note_number.toString().includes(query)) ||
                (item.homework_number !== undefined && item.homework_number.toString().includes(query)) ||
                (item.chapter_number !== undefined && item.chapter_number.toString().includes(query))) {
                return true;
            }

            // Check for type keywords (lecture, chapter, homework)
            if ((query.includes('lecture') && item.hasOwnProperty('note_number')) ||
                (query.includes('chapter') && item.hasOwnProperty('chapter_number')) ||
                (query.includes('homework') && item.hasOwnProperty('homework_number'))) {
                return true;
            }

            // Check associated documents
            const itemDocs = documents?.filter(doc =>
                doc.lecture === item.id ||
                doc.chapter === item.id ||
                doc.homework === item.id ||
                doc.exercise === item.id ||
                doc.file === item.id
            );

            return itemDocs?.some(doc =>
                doc.text?.toLowerCase().includes(query) ||
                doc.description?.toLowerCase().includes(query)
            );
        });
    };

    // Get all content items combined
    const getAllContentItems = () => {
        const allItems = [];

        // Add files
        if (files) {
            const filteredFiles = filterBySearch(files.sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())), fileDocuments || [])
                .filter(f => !activeChat.context.files.includes(f.id))
                .map(f => ({
                    ...f,
                    newName: f.title ?? "",
                    imageUrl: getFileImageUrl(f, fileDocuments?.find(d => d.file === f.id)?.id ?? ""),
                    type: 'files' as keyof ChatMessage['context'],
                    color: CONTENT_COLORS.files
                }));

            // Store the first file ID if available
            if (filteredFiles.length > 0 && firstFileRef.current === null) {
                firstFileRef.current = filteredFiles[0].id;
            }

            allItems.push(...filteredFiles);
        }

        // Add homeworks
        if (homeworks) {
            const filteredHomeworks = filterBySearch(homeworks.sort((a, b) => b.homework_number - a.homework_number), textbookDocuments || [])
                .filter(h => !activeChat.context.homeworks.includes(h.id))
                .map(h => ({
                    ...h,
                    newName: h.title,
                    imageUrl: getHomeworkImageUrl(h.id),
                    type: 'homeworks' as keyof ChatMessage['context'],
                    color: CONTENT_COLORS.homeworks
                }));

            // Store the first homework ID if available
            if (filteredHomeworks.length > 0 && firstHomeworkRef.current === null) {
                firstHomeworkRef.current = filteredHomeworks[0].id;
            }

            allItems.push(...filteredHomeworks);
        }

        // Add lectures
        if (lectures) {
            const filteredLectures = filterBySearch(lectures.sort((a, b) => (b.note_number ?? 0) - (a.note_number ?? 0)), lectureDocuments || [])
                .filter(l => !activeChat.context.lectures.includes(l.id))
                .map(l => ({
                    ...l,
                    newName: l.name ?? "",
                    imageUrl: getLectureImageUrl(l, lectureDocuments?.find(d => d.lecture === l.id)?.id ?? ""),
                    type: 'lectures' as keyof ChatMessage['context'],
                    color: CONTENT_COLORS.lectures
                }));

            // Store the first lecture ID if available
            if (filteredLectures.length > 0 && firstLectureRef.current === null) {
                firstLectureRef.current = filteredLectures[0].id;
            }

            allItems.push(...filteredLectures);
        }

        // Add chapters
        if (chapters) {
            const filteredChapters = filterBySearch(chapters.sort((a, b) => (a.chapter_number ?? 0) - (b.chapter_number ?? 0)), textbookDocuments || [])
                .filter(c => !activeChat.context.chapters.includes(c.id))
                .map(c => ({
                    ...c,
                    newName: `Chapter ${c.chapter_number}: ${c.title}`,
                    imageUrl: getChapterImage(c.id),
                    type: 'chapters' as keyof ChatMessage['context'],
                    color: CONTENT_COLORS.chapters
                }));

            // Store the first chapter ID if available
            if (filteredChapters.length > 0 && firstChapterRef.current === null) {
                firstChapterRef.current = filteredChapters[0].id;
            }

            allItems.push(...filteredChapters);
        }

        // Sort by type and then by name
        return allItems.sort((a, b) => {
            // If searching, sort by relevance
            if (localSearchQuery) {
                const scoreA = calculateRelevance(a, [...(lectureDocuments || []), ...(textbookDocuments || [])], localSearchQuery.toLowerCase());
                const scoreB = calculateRelevance(b, [...(lectureDocuments || []), ...(textbookDocuments || [])], localSearchQuery.toLowerCase());
                return scoreB - scoreA;
            }

            // Otherwise sort by type first, then by name
            if (a.type !== b.type) {
                const typeOrder = { homeworks: 1, lectures: 2, chapters: 3 };
                return typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
            }

            return 0; // No additional sorting needed as we've already sorted within each type
        });
    };

    // Calculate relevance score for search results
    const calculateRelevance = (item: any, documents: any[], query: string): number => {
        if (!query) return 0;

        let score = 0;

        // Title match has highest weight
        if (item.newName.toLowerCase().includes(query)) {
            score += 10;
        }

        // Check documents content
        const itemDocs = documents?.filter(doc =>
            doc.lecture === item.id ||
            doc.chapter === item.id ||
            doc.homework === item.id ||
            doc.exercise === item.id
        );

        itemDocs?.forEach(doc => {
            // Text content matches
            if (doc.text?.toLowerCase().includes(query)) {
                score += 5;
            }
            // Description matches
            if (doc.description?.toLowerCase().includes(query)) {
                score += 3;
            }
        });

        return score;
    };

    const allContentItems = getAllContentItems();
    const isLoading = loadingLectures || loadingChapters || loadingFiles || loadingExercises || loadingHomeworks || loadingTextbooks;

    // Find first items of each type for scrolling
    const firstLectureItem = allContentItems.find(item => item.type === 'lectures');
    const firstChapterItem = allContentItems.find(item => item.type === 'chapters');
    const firstHomeworkItem = allContentItems.find(item => item.type === 'homeworks');
    const firstFileItem = allContentItems.find(item => item.type === 'files');
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
                height: viewerMode.immersive ? "90vh" : "80vh",
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
                            height: viewerMode.immersive ? 'calc(90vh - 100px)' : 'calc(80vh - 100px)',
                            overflow: 'auto',
                            position: 'relative'
                        }}
                    >
                        {/* Add section marker divs for scrolling */}
                        <div id="lectures-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                        <div id="chapters-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                        <div id="homeworks-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                        <div id="files-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>

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
                                        (item.type === 'chapters' && item.id === firstChapterItem?.id) ||
                                        (item.type === 'homeworks' && item.id === firstHomeworkItem?.id) ||
                                        (item.type === 'files' && item.id === firstFileItem?.id);

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
                                                lectureDocuments={lectureDocuments}
                                                textbookDocuments={textbookDocuments}
                                                fileDocuments={fileDocuments}
                                                exercises={exercises}
                                                chapters={chapters}
                                                textbooks={textbooks}
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


