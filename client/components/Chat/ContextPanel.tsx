/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, ScrollArea, useMantineColorScheme, Tooltip, ActionIcon, Card, Text, Skeleton, Image } from "@mantine/core";
import { IconSearch, IconPresentation, IconBook, IconFile, IconNotebook, IconPencil, IconSchool, IconChalkboard, IconCaretLeftRight, IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { ContentList } from "./ContentList";
import { getLectures } from "@/utils/queries/get-lectures";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getChapters } from "@/utils/queries/get-chapters";
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { Lecture, Textbook, Chapter, Subchapter, Exercise, Homework, Problem, ChatMessage } from "@/types";
import { useVirtualizer } from "@tanstack/react-virtual";
declare global {
    interface Window {
        scrollToFirstItem?: (type: string) => void;
    }
}

interface ContextPanelProps {
    classId: string;
    isMobile: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    activeChat: ChatMessage;
    scrollToSection: (sectionId: string) => void;
}

// Define consistent colors for different content types
const CONTENT_COLORS = {
    lectures: 'blue',    // matches badge color
    chapters: 'green',   // matches badge color
    exercises: 'cyan',   // matches badge color
    homeworks: 'orange', // matches badge color
} as const;

// Define a reusable ItemCard component directly in ContextPanel
const ItemCard = ({
    item,
    color,
    contextType,
    addContextToChat,
    isVisible
}: {
    item: any,
    color: string,
    contextType: keyof ChatMessage['context'],
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void,
    isVisible: boolean
}) => {
    const { colorScheme } = useMantineColorScheme();
    const [imageLoaded, setImageLoaded] = useState(false);

    return (
        <Card
            shadow="xs"
            p="xs"
            radius="md"
            withBorder
            style={{
                marginBottom: '8px',
                backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderLeft: `3px solid var(--mantine-color-${color}-filled)`,
            }}
            onClick={(e) => {
                e.stopPropagation();
                addContextToChat(contextType, item.id);
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
                            onLoad={() => setImageLoaded(true)}
                        />
                    </div>
                ) : (
                    <Skeleton width={40} height={40} radius={4} />
                )}
                <Stack style={{ flex: 1 }}>
                    <Group justify="space-between">
                        <Text size="sm">
                            {item.newName}
                        </Text>
                    </Group>
                </Stack>
            </Group>
        </Card>
    );
};

// Section loading skeleton
const SectionSkeleton = () => (
    <Stack mt="md">
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
    isMobile,
    searchQuery,
    setSearchQuery,
    expandedSections,
    toggleSection,
    addContextToChat,
    expandedNodes,
    toggleNode,
    activeChat,
    scrollToSection,
}: ContextPanelProps) {
    const supabase = useSupabaseBrowser();
    const { colorScheme } = useMantineColorScheme();
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
    const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // Add refs for the first items of each type
    const firstLectureRef = useRef<string | null>(null);
    const firstChapterRef = useRef<string | null>(null);
    const firstHomeworkRef = useRef<string | null>(null);

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
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

    const { data: homeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId),
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id), homeworks!.map(h => h.id)),
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
                doc.exercise === item.id
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
    const isLoading = loadingLectures || loadingChapters;

    // Find first items of each type for scrolling
    const firstLectureItem = allContentItems.find(item => item.type === 'lectures');
    const firstChapterItem = allContentItems.find(item => item.type === 'chapters');
    const firstHomeworkItem = allContentItems.find(item => item.type === 'homeworks');

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

    // Add a method to scroll to the first item of a specific type
    const scrollToFirstItem = (type: 'lectures' | 'chapters' | 'homeworks') => {
        let itemId = null;

        switch (type) {
            case 'lectures':
                itemId = firstLectureRef.current;
                break;
            case 'chapters':
                itemId = firstChapterRef.current;
                break;
            case 'homeworks':
                itemId = firstHomeworkRef.current;
                break;
        }

        if (itemId) {
            const virtualItemId = `${type}-${itemId}`;
            const element = containerRef.current?.querySelector(`[data-id="${virtualItemId}"]`);

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    };

    // Expose the scroll method through a ref or effect
    useEffect(() => {
        // This makes the scrollToFirstItem method available to the parent component
        // through the scrollToSection prop
        if (scrollToSection && typeof scrollToSection === 'function') {
            // Update the parent's scrollToSection to include our new functionality
            const originalScrollToSection = scrollToSection;

            // Override the scrollToSection to handle our special section IDs
            (window as any).scrollToFirstItem = (type: string) => {
                if (['lectures', 'chapters', 'homeworks'].includes(type)) {
                    scrollToFirstItem(type as 'lectures' | 'chapters' | 'homeworks');
                } else {
                    // Call the original function for other section IDs
                    originalScrollToSection(type);
                }
            };
        }
    }, [scrollToSection, firstLectureRef.current, firstChapterRef.current, firstHomeworkRef.current]);

    return (
        <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{
                height: "80vh",
                overflowY: "auto"
            }}
        >
            <Stack>
                <TextInput
                    placeholder="Search context..."
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    leftSection={<IconSearch size={16} />}
                    styles={(theme) => ({
                        input: {
                            backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                            borderColor: colorScheme === "dark" ? "#373A40" : undefined
                        }
                    })}
                />

                {isLoading ? (
                    <SectionSkeleton />
                ) : (
                    <div
                        ref={containerRef}
                        style={{
                            height: 'calc(80vh - 100px)',
                            overflow: 'auto',
                            position: 'relative'
                        }}
                    >
                        {/* Add section marker divs for scrolling */}
                        <div id="lectures-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                        <div id="chapters-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                        <div id="homeworks-section" style={{ position: 'absolute', top: 0, height: 0 }}></div>
                        
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
                                        (item.type === 'homeworks' && item.id === firstHomeworkItem?.id);

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
                                                color={item.color}
                                                contextType={item.type}
                                                addContextToChat={addContextToChat}
                                                isVisible={isItemVisible || localSearchQuery.length > 0}
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


