/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, ScrollArea, useMantineColorScheme, Tooltip, ActionIcon, Card, Text, Skeleton } from "@mantine/core";
import { IconSearch, IconPresentation, IconBook, IconFile, IconNotebook, IconPencil, IconSchool, IconChalkboard, IconCaretLeftRight } from "@tabler/icons-react";
import { useState, useEffect } from "react";
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
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";

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

    const getExerciseImageUrl = (chapterId: string | null) => {
        if (!chapterId) return '/placeholder_image.svg';
        // find the first exercise in the homework
        const exercise = exercises?.find(e => e.chapter === chapterId);
        if (!exercise) return '/placeholder_image.svg';

        // find the textbook document that has the same page number, but null for the chapter, homework and exercise
        const textbookDocumentExercise = textbookDocuments?.find(d => d.page === exercise.start_page && d.chapter === null && d.homework === null && d.exercise === null);
        if (textbookDocumentExercise) return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentExercise.textbook}/${textbookDocumentExercise.id}.png`;

        return '/placeholder_image.svg';
    }

    const getHomeworkImageUrl = (homeworkId: string) => {
        if (!homeworkId) return '/placeholder_image.svg';
        // find the first exercise in the homework
        const exercise = exercises?.find(e => e.homework === homeworkId);
        if (!exercise) return '/placeholder_image.svg';

        // find the textbook document that has the same page number, but null for the chapter, homework and exercise
        const textbookDocumentExercise = textbookDocuments?.find(d => d.page === exercise.start_page && d.chapter === null && d.homework === null && d.exercise === null);
        if (textbookDocumentExercise) return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentExercise.textbook}/${textbookDocumentExercise.id}.png`;

        return '/placeholder_image.svg';
    }

    // Section loading skeleton
    const SectionSkeleton = () => (
        <Card
            p="md"
            style={{
                backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f8f9fa",
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`
            }}
        >
            <Group justify="space-between" mb="md">
                <Skeleton height={20} width={120} />
                <Skeleton height={16} width={16} circle />
            </Group>
            <Stack>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={60} radius="md" />
                ))}
            </Stack>
        </Card>
    );

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

                <ScrollArea.Autosize>
                    <Stack gap="xs">
                        <div id="lectures-section">
                            {loadingLectures ? (
                                <SectionSkeleton />
                            ) : (
                                <ContentList
                                    title="Lectures"
                                    sectionKey="lectures"
                                    icon={IconPresentation}
                                    items={filterBySearch(lectures || [], lectureDocuments || []).map(l => ({
                                        ...l,
                                        newName: l.name ?? "",
                                        imageUrl: getLectureImageUrl(l, lectureDocuments?.find(d => d.lecture === l.id)?.id ?? "")
                                    })) || []}
                                    isSearching={!!localSearchQuery}
                                    searchActive={!!searchQuery}
                                    expandedSections={expandedSections}
                                    toggleSection={toggleSection}
                                    addContextToChat={addContextToChat}
                                    contextType="lectures"
                                    activeContextIds={activeChat.context.lectures}
                                    color={CONTENT_COLORS.lectures}
                                    documents={lectureDocuments || []}
                                    searchQuery={localSearchQuery}
                                />
                            )}
                        </div>
                        <div id="chapters-section">
                            {loadingChapters ? (
                                <SectionSkeleton />
                            ) : (
                                <ContentList
                                    title="Chapters"
                                    sectionKey="chapters"
                                    icon={IconBook}
                                    items={filterBySearch(chapters || [], textbookDocuments || []).map(c => ({
                                        ...c,
                                        newName: `Chapter ${c.chapter_number}: ${c.title}`,
                                        imageUrl: getChapterImage(c.id)
                                    })) || []}
                                    isSearching={!!localSearchQuery}
                                    searchActive={!!searchQuery}
                                    expandedSections={expandedSections}
                                    toggleSection={toggleSection}
                                    addContextToChat={addContextToChat}
                                    contextType="chapters"
                                    activeContextIds={activeChat.context.chapters}
                                    color={CONTENT_COLORS.chapters}
                                    documents={textbookDocuments || []}
                                    searchQuery={localSearchQuery}
                                />
                            )}
                        </div>

                        <div id="homeworks-section">
                            <ContentList
                                title="Homeworks"
                                sectionKey="homeworks"
                                icon={IconNotebook}
                                items={filterBySearch(homeworks || [], textbookDocuments || []).map(h => ({
                                    ...h,
                                    newName: h.title,
                                    imageUrl: getHomeworkImageUrl(h.id)
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="homeworks"
                                activeContextIds={activeChat.context.homeworks}
                                color={CONTENT_COLORS.homeworks}
                                documents={textbookDocuments || []}
                                searchQuery={localSearchQuery}
                            />
                        </div>

                        <div id="exercises-section">
                            <ContentList
                                title="Exercises"
                                sectionKey="exercises"
                                icon={IconPencil}
                                items={filterBySearch(exercises || [], textbookDocuments || []).map(e => ({
                                    ...e,
                                    newName: e.title,
                                    imageUrl: getExerciseImageUrl(e.chapter)
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="exercises"
                                activeContextIds={activeChat.context.exercises}
                                color={CONTENT_COLORS.exercises}
                                documents={textbookDocuments || []}
                                searchQuery={localSearchQuery}
                            />
                        </div>
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
        </Card>
    );
}


