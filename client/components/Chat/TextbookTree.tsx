/**
 * TextbookTree.tsx
 * 
 * This component is used to display the textbook tree for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, Group, Text, ActionIcon, Stack } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { ChatMessage } from "./ChatCanvas";
import { useMantineColorScheme } from '@mantine/core';

interface TextbookTreeProps {
    classId: string;
    searchQuery: string;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    activeChat: ChatMessage;
}

export function TextbookTree({
    classId,
    searchQuery,
    expandedSections,
    toggleSection,
    addContextToChat,
    expandedNodes,
    toggleNode,
    activeChat
}: TextbookTreeProps) {
    const supabase = useSupabaseBrowser();
    const { colorScheme } = useMantineColorScheme();

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId)
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const matchesSearch = (node: any): boolean => {
        if (!searchQuery) return true;

        const searchLower = searchQuery.toLowerCase();
        const titleMatches = node.title?.toLowerCase().includes(searchLower);

        if (node.chapter_number) {
            const chapterSearch = `chapter ${node.chapter_number}`.toLowerCase();
            if (chapterSearch.includes(searchLower)) return true;
        }

        if (node.exercise_number) {
            const exerciseSearch = `exercise ${node.exercise_number}`.toLowerCase();
            if (exerciseSearch.includes(searchLower)) return true;
        }

        return titleMatches;
    };

    const hasMatchingChildren = (node: any): boolean => {
        if (node.chapter_number) {
            return exercises?.some(exercise =>
                exercise.chapter === node.id && matchesSearch(exercise)
            ) ?? false;
        } else if (!node.exercise_number) {
            return chapters?.some(chapter =>
                chapter.textbook === node.id &&
                (matchesSearch(chapter) || hasMatchingChildren(chapter))
            ) ?? false;
        }
        return false;
    };

    const renderNode = (node: any, depth = 0) => {
        if (!node) return null;

        const isTextbook = !node.chapter_number && !node.exercise_number;
        const isChapter = !!node.chapter_number;
        const isExercise = !!node.exercise_number;

        const isAlreadySelected = activeChat.context[
            isTextbook ? 'textbooks' : 
            isChapter ? 'chapters' : 
            'exercises'
        ].includes(node.id);

        if (isAlreadySelected) return null;

        if (!matchesSearch(node) && !hasMatchingChildren(node)) return null;

        const isExpanded = expandedNodes.has(node.id);

        const getExerciseLabel = (exercise: any) => {
            const parentChapter = chapters?.find(c => c.id === exercise.chapter);
            return parentChapter ? 
                `Exercise ${parentChapter.chapter_number}.${exercise.exercise_number}` : 
                `Exercise ${exercise.exercise_number}`;
        };

        return (
            <div key={node.id} style={{ display: 'contents' }}>
                <Card
                    shadow="xs"
                    p="xs"
                    radius="md"
                    withBorder
                    style={{
                        marginLeft: depth * 20,
                        width: 'auto',
                        display: 'inline-flex',
                        backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                        borderColor: colorScheme === "dark" ? "#373A40" : "#e9ecef"
                    }}
                >
                    <Group>
                        {(isTextbook || isChapter) && (
                            <ActionIcon
                                size="sm"
                                onClick={() => toggleNode(node.id)}
                                variant={colorScheme === "dark" ? "filled" : "outline"}
                                color={colorScheme === "dark" ? "gray.6" : "blue"}
                            >
                                {isExpanded ? (
                                    <IconChevronDown size={16} />
                                ) : (
                                    <IconChevronRight size={16} />
                                )}
                            </ActionIcon>
                        )}
                        <ActionIcon
                            variant={colorScheme === "dark" ? "filled" : "light"}
                            color="blue"
                            onClick={() => {
                                const contextType = isTextbook ? 'textbooks' : 
                                                  isChapter ? 'chapters' : 
                                                  'exercises';
                                addContextToChat(contextType, node.id);
                            }}
                            title="Add to chat context"
                        >
                            <IconPlus size={16} />
                        </ActionIcon>
                        <Text 
                            size="sm" 
                            c={colorScheme === "dark" ? "gray.3" : "dark"}
                        >
                            {isChapter ? 
                                `Chapter ${node.chapter_number}: ${node.title}` :
                                isTextbook ? 
                                    node.title :
                                    getExerciseLabel(node)
                            }
                        </Text>
                    </Group>
                </Card>
                {isExpanded && !isExercise && (
                    isTextbook ? 
                        chapters?.filter(chapter => chapter.textbook === node.id)
                            .map(chapter => renderNode(chapter, depth + 1)) :
                        isChapter ?
                            exercises?.filter(exercise => exercise.chapter === node.id)
                                .map(exercise => renderNode(exercise, depth + 1)) :
                            null
                )}
            </div>
        );
    };

    if (!textbooks?.length) return null;

    return (
        <Card 
            shadow="sm" 
            p="md"
            style={{
                backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f8f9fa",
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`
            }}
        >
            <Group mb={expandedSections.has('textbooks') ? "md" : 0}>
                <ActionIcon
                    variant="subtle"
                    onClick={() => toggleSection('textbooks')}
                    color={colorScheme === "dark" ? "gray.4" : "gray.7"}
                >
                    {expandedSections.has('textbooks') ? (
                        <IconChevronDown size={16} />
                    ) : (
                        <IconChevronRight size={16} />
                    )}
                </ActionIcon>
                <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "dark"}>Textbooks</Text>
            </Group>
            {expandedSections.has('textbooks') && (
                <Stack align="flex-start">
                    {textbooks.map(textbook => renderNode(textbook))}
                </Stack>
            )}
        </Card>
    );
}

