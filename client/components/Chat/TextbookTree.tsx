/**
 * TextbookTree.tsx
 * 
 * This component is used to display the textbook tree for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, Group, Text, ActionIcon, Stack, Loader } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { ChatMessage } from "./ChatCanvas";
import { useMantineColorScheme } from '@mantine/core';
import { getSubchapters } from "@/utils/queries/get-subchapters";
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useDebouncedValue } from '@mantine/hooks';

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
    const [hasVisibleNodes, setHasVisibleNodes] = useState(true);
    const [isSearching, setIsSearching] = useState(false);

    // Modify the debounce to show loading state
    const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

    // Add effect to handle loading state
    useEffect(() => {
        if (searchQuery !== debouncedSearch) {
            setIsSearching(true);
        } else {
            setIsSearching(false);
        }
    }, [searchQuery, debouncedSearch]);

    const getSearchScore = (node: any, searchLower: string): { score: number; matchDetails: string[] } => {
        if (!searchLower) return { score: 0, matchDetails: [] };
        
        let score = 0;
        const matchDetails: string[] = [];

        // Check title matches (highest priority)
        if (node.title?.toLowerCase().includes(searchLower)) {
            score += 100;
            matchDetails.push('title');
        }

        // Check chapter number matches
        if (node.chapter_number) {
            const chapterSearch = `chapter ${node.chapter_number}`.toLowerCase();
            if (chapterSearch.includes(searchLower)) {
                score += 80;
                matchDetails.push('chapter number');
            }
        }

        // Check subchapter number matches
        if (node.subchapter_number) {
            const subchapterSearch = `${node.subchapter_number}`.toLowerCase();
            if (subchapterSearch.includes(searchLower)) {
                score += 70;
                matchDetails.push('section number');
            }
        }

        // Check exercise number matches
        if (node.exercise_number) {
            const exerciseSearch = `exercise ${node.exercise_number}`.toLowerCase();
            if (exerciseSearch.includes(searchLower)) {
                score += 60;
                matchDetails.push('exercise number');
            }
        }

        return { score, matchDetails };
    };

    const hasMatchingChildren = (node: any): boolean => {
        if (node.chapter_number) {
            // Check for matching exercises
            const hasMatchingExercises = exercises?.some(exercise =>
                exercise.chapter === node.id && matchesSearch(exercise)
            ) ?? false;

            // Check for matching subchapters
            const hasMatchingSubchapters = subchapters?.some(subchapter =>
                subchapter.chapter === node.id && matchesSearch(subchapter)
            ) ?? false;

            return hasMatchingExercises || hasMatchingSubchapters;
        } else if (!node.exercise_number && !node.subchapter_number) {
            // For textbooks, check if any chapters or their children match
            return chapters?.some(chapter =>
                chapter.textbook === node.id &&
                (matchesSearch(chapter) || hasMatchingChildren(chapter))
            ) ?? false;
        }
        return false;
    };

    const shouldShowNode = (node: any): boolean => {
        if (!searchQuery) return true;
        
        // If the node itself matches, show it
        if (matchesSearch(node)) return true;

        // If it's a parent node (textbook or chapter), check children
        if (!node.exercise_number && !node.subchapter_number) {
            return hasMatchingChildren(node);
        }

        return false;
    };

    const renderNode = (node: any, depth = 0) => {
        if (!node) return null;

        const isExerciseGroup = node.type === 'exercises';
        const isTextbook = !isExerciseGroup && !node.chapter_number && !node.exercise_number && !node.subchapter_number;
        const isChapter = !isExerciseGroup && !!node.chapter_number;
        const isSubchapter = !isExerciseGroup && !!node.subchapter_number;
        const isExercise = !isExerciseGroup && !!node.exercise_number;

        const isAlreadySelected = activeChat.context[
            isTextbook ? 'textbooks' : 
            isChapter ? 'chapters' : 
            isSubchapter ? 'subchapters' :
            'exercises'
        ].includes(node.id);

        if (isAlreadySelected) return null;

        // Use new shouldShowNode function instead of previous logic
        if (!shouldShowNode(node)) return null;

        // If searching, automatically expand nodes that have matching children
        const shouldAutoExpand = searchQuery && (matchesSearch(node) || hasMatchingChildren(node));
        const isExpanded = shouldAutoExpand || expandedNodes.has(node.id);

        const getExerciseLabel = (exercise: any) => {
            const parentChapter = chapters?.find(c => c.id === exercise.chapter);
            return exercise.title !== "" ? exercise.title : parentChapter ? 
                `Exercise ${parentChapter.chapter_number}.${exercise.exercise_number}` : 
                `Exercise ${exercise.exercise_number}`;
        };

        return (
            <div key={node.id || node.type} style={{ display: 'contents' }}>
                <Card
                    shadow="xs"
                    p="xs"
                    radius="md"
                    withBorder
                    style={{
                        marginLeft: depth * 20,
                        width: 'auto',
                        display: 'inline-flex',
                        backgroundColor: colorScheme === "dark" ? 
                            (isSubchapter || isExercise ? "#2C2E33" : "#25262b") : 
                            (isSubchapter || isExercise ? "#f1f3f5" : "white"),
                        borderColor: colorScheme === "dark" ? "#373A40" : "#e9ecef"
                    }}
                >
                    <Stack gap={2}>
                        <Group>
                            {(isTextbook || isChapter || isExerciseGroup) && (
                                <ActionIcon
                                    size="sm"
                                    onClick={() => toggleNode(node.id || node.type)}
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
                            {!isExerciseGroup && (
                                <ActionIcon
                                    variant={colorScheme === "dark" ? "filled" : "light"}
                                    color="blue"
                                    onClick={() => {
                                        const contextType = isTextbook ? 'textbooks' : 
                                                          isChapter ? 'chapters' : 
                                                          isSubchapter ? 'subchapters' :
                                                          'exercises';
                                        addContextToChat(contextType, node.id);
                                    }}
                                    title="Add to chat context"
                                >
                                    <IconPlus size={16} />
                                </ActionIcon>
                            )}
                            <Text 
                                size="sm" 
                                c={colorScheme === "dark" ? "gray.3" : "dark"}
                            >
                                {isChapter ? 
                                    `Chapter ${node.chapter_number}: ${node.title}` :
                                    isTextbook ? 
                                        node.title :
                                        isSubchapter ?
                                            `${node.subchapter_number}. ${node.title}` :
                                            isExerciseGroup ?
                                                "Exercises" :
                                                getExerciseLabel(node)
                                }
                            </Text>
                        </Group>
                    </Stack>
                </Card>
                {(isExpanded || shouldAutoExpand) && (
                    isTextbook ? 
                        chapters?.filter(chapter => chapter.textbook === node.id)
                            .map(chapter => renderNode(chapter, depth + 1)) :
                    isChapter ?
                        <>
                            {subchapters?.filter(subchapter => subchapter.chapter === node.id)
                                .map(subchapter => renderNode(subchapter, depth + 1))}
                            {exercises?.some(exercise => exercise.chapter === node.id) && 
                                renderNode({ type: 'exercises', id: `exercises-${node.id}` }, depth + 1)}
                            {(isExpanded || shouldAutoExpand) && expandedNodes.has(`exercises-${node.id}`) &&
                                exercises?.filter(exercise => exercise.chapter === node.id)
                                    .map(exercise => renderNode(exercise, depth + 2))}
                        </> :
                    null
                )}
            </div>
        );
    };

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId)
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const {data: subchapters} = useQuery({
        queryKey: ["subchapters", classId],
        queryFn: () => getSubchapters(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    // Memoize search scores to prevent recalculation
    const nodeScores = useMemo(() => {
        if (!debouncedSearch) return new Map();
        
        const scores = new Map();
        const searchLower = debouncedSearch.toLowerCase();

        // Pre-calculate scores for all nodes
        const calculateNodeScore = (node: any) => {
            const key = `${node.type}-${node.id}`;
            if (scores.has(key)) return scores.get(key);

            const { score, matchDetails } = getSearchScore(node, searchLower);
            scores.set(key, { score, matchDetails });
            return { score, matchDetails };
        };

        // Pre-calculate all scores
        textbooks?.forEach(textbook => {
            calculateNodeScore(textbook);
            chapters?.filter(c => c.textbook === textbook.id).forEach(chapter => {
                calculateNodeScore(chapter);
                subchapters?.filter(s => s.chapter === chapter.id).forEach(calculateNodeScore);
                exercises?.filter(e => e.chapter === chapter.id).forEach(calculateNodeScore);
            });
        });

        return scores;
    }, [debouncedSearch, textbooks, chapters, subchapters, exercises]);

    const matchesSearch = useCallback((node: any): boolean => {
        if (!debouncedSearch) return true;
        const key = `${node.type}-${node.id}`;
        return (nodeScores.get(key)?.score ?? 0) > 0;
    }, [debouncedSearch, nodeScores]);

    // Add new useEffect to handle visibility
    useEffect(() => {
        if (!searchQuery) {
            setHasVisibleNodes(true);
            return;
        }

        const checkForVisibleNodes = () => {
            const hasVisible = textbooks?.some(textbook => 
                shouldShowNode(textbook) || hasMatchingChildren(textbook)
            ) ?? false;
            setHasVisibleNodes(hasVisible);
        };

        checkForVisibleNodes();
    }, [searchQuery, textbooks, debouncedSearch]);

    if (!textbooks?.length) return null;

    const treeContent = (
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
                <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "dark"}>
                    Textbooks {searchQuery && `(Filtered)`}
                </Text>
                {isSearching && <Loader size="xs" />}
            </Group>
            {expandedSections.has('textbooks') && (
                <Stack align="flex-start">
                    {!isSearching ? (
                        textbooks.map(textbook => renderNode(textbook))
                    ) : (
                        // Show skeleton or previous results while searching
                        textbooks.map(textbook => renderNode(textbook))
                    )}
                </Stack>
            )}
        </Card>
    );

    return hasVisibleNodes || !searchQuery ? treeContent : null;
}

