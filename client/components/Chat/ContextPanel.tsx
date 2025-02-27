/**
 * ContextPanel.tsx
 * 
 * This component is used to display the context panel for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { TextInput, Group, Stack, ScrollArea, useMantineColorScheme, Tooltip, ActionIcon, Card, Text } from "@mantine/core";
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
    setActiveChat: React.Dispatch<React.SetStateAction<ChatMessage>>;
    scrollToSection: (sectionId: string) => void;
}

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
    setActiveChat,
    scrollToSection,
}: ContextPanelProps) {
    const supabase = useSupabaseBrowser();
    const { colorScheme } = useMantineColorScheme();
    const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);


    const { data: lectures } = useQuery({
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

    const { data: chapters } = useQuery({
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

    console.log("Exercises", exercises);

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

    const getTextbookImageUrl = (item: Textbook, documentId: string) => {
        // if (documentId.length > 0) {
        //     return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${item.id}/${documentId}.png`;
        // }
        return "/placeholder_image.svg";
    }

    const getChapterImageUrl = (item: Chapter, documentId: string) => {
        // if (documentId.length > 0) {
        //     return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${item.textbook}/${documentId}.png`;
        // }
        return "/placeholder_image.svg";
    }

    // const getChapterImageUrl = (item: Chapter, documentId: string) => {
    //     const chapter = chapters?.find(chapter => chapter.id === item.id);
    //     if (!chapter) return '/placeholder_image.svg';
    //     const filteredDocuments = textbookDocuments?.filter(document => document.page >= chapter.start_page && document.page <= chapter.end_page);
    //     if (!filteredDocuments) return '/placeholder_image.svg';
    //     const document = filteredDocuments.find(d => d.id === documentId);
    //     return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${chapter.textbook}/${document.id}.png`
    // }

    // const getSubchapterImageUrl = (item: Subchapter, documentId: string) => {
    //     const document = textbookDocuments?.find(d => d.id === documentId);
    //     if (document) {
    //         return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${documentId}.png`;
    //     }
    //     return "/placeholder_image.svg";
    // }

    const getExerciseImageUrl = (item: Exercise, documentId: string) => {
        const document = textbookDocuments?.find(d => d.id === documentId);
        if (document) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${documentId}.png`;
        }
        return "/placeholder_image.svg";
    }

    const getHomeworkImageUrl = (item: Homework, documentId: string) => {
        const document = textbookDocuments?.find(d => d.id === documentId);
        if (document) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${documentId}.png`;
        }
        return "/placeholder_image.svg";
    }

    // const getProblemImageUrl = (item: Problem, documentId: string) => {
    //     const document = textbookDocuments?.find(d => d.id === documentId);
    //     if (document) {
    //         return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${documentId}.png`;
    //     }
    //     return "/placeholder_image.svg";
    // }

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
                <Text size="lg" fw={700}>
                    Content
                </Text>

                {/* Add user mode toggle */}
                <Group justify="space-between">
                    <Group gap="xs">
                        <IconSchool size={18} color={!activeChat.teacher ? 'currentColor' : 'gray'} />
                        <Text size="sm" c={!activeChat.teacher ? undefined : 'dimmed'}>Student</Text>
                    </Group>

                    <ActionIcon
                        variant="transparent"
                        onClick={() => setActiveChat({ ...activeChat, teacher: !activeChat.teacher })}
                        title={`Switch to ${activeChat.teacher ? 'student' : 'teacher'} mode`}
                    >
                        <IconCaretLeftRight size={24} />
                    </ActionIcon>

                    <Group gap="xs">
                        <Text size="sm" c={activeChat.teacher ? undefined : 'dimmed'}>Teacher</Text>
                        <IconChalkboard size={18} color={activeChat.teacher ? 'currentColor' : 'gray'} />
                    </Group>
                </Group>

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
                {/* <Group>
                    <Tooltip label="Jump to Lectures">
                        <ActionIcon
                            variant="subtle"
                            onClick={() => scrollToSection('lectures-section')}
                            aria-label="Jump to lectures"
                        >
                            <IconPresentation size={20} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Jump to Textbooks">
                        <ActionIcon
                            variant="subtle"
                            onClick={() => scrollToSection('textbooks-section')}
                            aria-label="Jump to textbooks"
                        >
                            <IconBook size={20} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Jump to Homework">
                        <ActionIcon
                            variant="subtle"
                            onClick={() => scrollToSection('homework-section')}
                            aria-label="Jump to homework"
                        >
                            <IconFile size={20} />
                        </ActionIcon>
                    </Tooltip>
                </Group> */}

                <ScrollArea.Autosize>
                    <Stack gap="xs">
                        <div id="lectures-section">
                            <ContentList
                                title="Lectures"
                                sectionKey="lectures"
                                icon={IconPresentation}
                                items={lectures?.map(l => ({
                                    ...l,
                                    newName: l.name ?? "",
                                    imageUrl: getLectureImageUrl(l, lectureDocuments?.find(d => d.lecture === l.id)?.id ?? "")
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="lectures"
                                activeContextIds={activeChat.context.lectures}
                            />
                        </div>
                        <div id="chapters-section">
                            <ContentList
                                title="Chapters"
                                sectionKey="chapters"
                                icon={IconBook}
                                items={chapters?.map(c => ({
                                    ...c,
                                    newName: c.title,
                                    imageUrl: getChapterImageUrl(c, textbookDocuments?.find(d => d.textbook === c.textbook && d.page >= c.start_page && d.page <= c.end_page)?.id ?? "")
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="chapters"
                                activeContextIds={activeChat.context.chapters}
                            />
                        </div>

                        <div id="homeworks-section">
                            <ContentList
                                title="Homeworks"
                                sectionKey="homeworks"
                                icon={IconNotebook}
                                items={homeworks?.map(h => ({
                                    ...h,
                                    newName: h.title,
                                    imageUrl: getHomeworkImageUrl(h, textbookDocuments?.find(t => {
                                        const exercise = exercises?.find(e => e.homework === h.id);
                                        return exercise !== undefined && t.page >= exercise.start_page && t.page <= exercise.end_page;
                                    })?.id ?? "")
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="homeworks"
                                activeContextIds={activeChat.context.homeworks}
                            />
                        </div>

                        <div id="exercises-section">
                            <ContentList
                                title="Exercises"
                                sectionKey="exercises"
                                icon={IconPencil}
                                items={exercises?.map(e => ({
                                    ...e,
                                    newName: e.title,
                                    imageUrl: getExerciseImageUrl(e, textbookDocuments?.find(t => {
                                        return t.page >= e.start_page && t.page <= e.end_page;
                                    })?.id ?? "")
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="exercises"
                                activeContextIds={activeChat.context.exercises}
                            />
                        </div>

                        {/* <div id="problems-section">
                            <ContentList
                                title="Problems"
                                sectionKey="problems"
                                items={problems?.map(p => ({
                                    ...p,
                                    newName: p.homework + " - " + p.problem_number,
                                    imageUrl: getProblemImageUrl(p, textbookDocuments?.find(t => {
                                        const problem = problems?.find(p => p.id === p.id);
                                        const exercise = exercises?.find(e => e.id === problem?.exercise);
                                        return exercise !== undefined && t.page >= exercise.start_page && t.page <= exercise.end_page;
                                    })?.id ?? "")
                                })) || []}
                                isSearching={false}
                                searchActive={!!searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                contextType="problems"
                                activeContextIds={activeChat.context.problems}
                            />
                        </div> */}

                        {/* <div id="textbooks-section">
                            <TextbookTree
                                classId={classId}
                                searchQuery={searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                activeChat={activeChat}
                            />
                        </div>

                        <div id="homework-section">
                            <HomeworkTree
                                classId={classId}
                                searchQuery={searchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                activeChat={activeChat}
                            />
                        </div> */}
                    </Stack>
                </ScrollArea.Autosize>
            </Stack>
        </Card>
    );
}


