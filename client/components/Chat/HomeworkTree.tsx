/**
 * client/components/Chat/HomeworkTree.tsx
 * This component is used to display the homework tree in the chat.
 * @AshokSaravanan222
 * 01.03.2025
 */

import { Card, Group, Text, ActionIcon, Stack, Loader } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useMantineColorScheme } from '@mantine/core';
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useDebouncedValue } from '@mantine/hooks';
import { ChatMessage } from "./ChatCanvas";
import { getProblems } from "@/utils/queries/get-problems";
import { getHomework } from "@/utils/queries/get-homework";

interface HomeworkTreeProps {
    classId: string;
    searchQuery: string;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    expandedNodes: Set<string>;
    toggleNode: (nodeId: string) => void;
    activeChat: ChatMessage;
}

export function HomeworkTree({
    classId,
    searchQuery,
    expandedSections,
    toggleSection,
    addContextToChat,
    expandedNodes,
    toggleNode,
    activeChat
}: HomeworkTreeProps) {
    const supabase = useSupabaseBrowser();
    const { colorScheme } = useMantineColorScheme();
    const [hasVisibleNodes, setHasVisibleNodes] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

    const { data: homework } = useQuery({
        queryKey: ["homework", classId],
        queryFn: () => getHomework(supabase, classId)
    });

    const { data: problems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homework!.map(h => h.id)),
        enabled: !!homework
    });

    useEffect(() => {
        if (searchQuery !== debouncedSearch) {
            setIsSearching(true);
        } else {
            setIsSearching(false);
        }
    }, [searchQuery, debouncedSearch]);

    const getSearchScore = (node: any): { score: number; matchDetails: string[] } => {
        if (!debouncedSearch) return { score: 0, matchDetails: [] };
        const searchLower = debouncedSearch.toLowerCase();
        let score = 0;
        const matchDetails: string[] = [];

        if (node.title?.toLowerCase().includes(searchLower)) {
            score += 100;
            matchDetails.push('title');
        }

        if (node.problem_number) {
            const problemSearch = `problem ${node.problem_number}`.toLowerCase();
            if (problemSearch.includes(searchLower)) {
                score += 80;
                matchDetails.push('problem number');
            }
        }

        return { score, matchDetails };
    };

    // Memoize search scores to prevent recalculation
    const nodeScores = useMemo(() => {
        if (!debouncedSearch) return new Map();

        const scores = new Map();
        const searchLower = debouncedSearch.toLowerCase();

        // Pre-calculate scores for all nodes
        const calculateNodeScore = (node: any) => {
            const key = `${node.problem_number ? 'problem' : 'homework'}-${node.id}`;
            if (scores.has(key)) return scores.get(key);

            const { score, matchDetails } = getSearchScore(node);
            scores.set(key, { score, matchDetails });
            return { score, matchDetails };
        };

        // Pre-calculate all scores
        homework?.forEach(hw => {
            calculateNodeScore(hw);
            problems?.filter(p => p.homework === hw.id).forEach(calculateNodeScore);
        });

        return scores;
    }, [debouncedSearch, homework, problems]);

    const matchesSearch = useCallback((node: any): boolean => {
        if (!debouncedSearch) return true;
        const key = `${node.problem_number ? 'problem' : 'homework'}-${node.id}`;
        return (nodeScores.get(key)?.score ?? 0) > 0;
    }, [debouncedSearch, nodeScores]);

    const hasMatchingChildren = (node: any): boolean => {
        if (!node.problem_number) { // If it's a homework
            return problems?.some(problem =>
                problem.homework === node.id && matchesSearch(problem)
            ) ?? false;
        }
        return false;
    };

    const shouldShowNode = (node: any): boolean => {
        if (!searchQuery) return true;

        // If the node itself matches, show it
        if (matchesSearch(node)) return true;

        // If it's a homework, check its problems
        if (!node.problem_number) {
            return hasMatchingChildren(node);
        }

        return false;
    };

    const renderNode = (node: any, depth = 0) => {
        if (!node) return null;

        const isHomework = !node.problem_number;
        const isProblem = !!node.problem_number;

        const isAlreadySelected = activeChat.context[
            isHomework ? 'homework' : 'problems'
        ].includes(node.id);

        if (isAlreadySelected) return null;

        // Use new shouldShowNode function
        if (!shouldShowNode(node)) return null;

        // If searching, automatically expand nodes that have matching children
        const shouldAutoExpand = searchQuery && (matchesSearch(node) || hasMatchingChildren(node));
        const isExpanded = shouldAutoExpand || expandedNodes.has(node.id);

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
                        backgroundColor: colorScheme === "dark" ?
                            (isProblem ? "#2C2E33" : "#25262b") :
                            (isProblem ? "#f1f3f5" : "white"),
                        borderColor: colorScheme === "dark" ? "#373A40" : "#e9ecef"
                    }}
                >
                    <Stack gap={2}>
                        <Group>
                            {isHomework && (
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
                                    const contextType = isHomework ? 'homework' : 'problems';
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
                                {isHomework ?
                                    node.title :
                                    `Problem ${node.problem_number}`
                                }
                            </Text>
                        </Group>
                    </Stack>
                </Card>
                {isExpanded && isHomework && (
                    problems?.filter(problem => problem.homework === node.id)
                        .map(problem => renderNode(problem, depth + 1))
                )}
            </div>
        );
    };

    // Add useEffect to handle visibility
    useEffect(() => {
        if (!searchQuery) {
            setHasVisibleNodes(true);
            return;
        }

        const checkForVisibleNodes = () => {
            const hasVisible = homework?.some(hw =>
                shouldShowNode(hw) || hasMatchingChildren(hw)
            ) ?? false;
            setHasVisibleNodes(hasVisible);
        };

        checkForVisibleNodes();
    }, [searchQuery, homework, debouncedSearch]);

    if (!homework?.length) {
        return null;
    }

    const treeContent = (
        <Card
            shadow="sm"
            p="md"
            style={{
                backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f8f9fa",
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`
            }}
        >
            <Group mb={expandedSections.has('homework') ? "md" : 0}>
                <ActionIcon
                    variant="subtle"
                    onClick={() => toggleSection('homework')}
                    color={colorScheme === "dark" ? "gray.4" : "gray.7"}
                >
                    {expandedSections.has('homework') ? (
                        <IconChevronDown size={16} />
                    ) : (
                        <IconChevronRight size={16} />
                    )}
                </ActionIcon>
                <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "dark"}>
                    Homework {searchQuery && `(Filtered)`}
                </Text>
                {isSearching && <Loader size="xs" />}
            </Group>
            {expandedSections.has('homework') && (
                <Stack align="flex-start">
                    {homework.map(hw => renderNode(hw))}
                </Stack>
            )}
        </Card>
    );

    return hasVisibleNodes || !searchQuery ? treeContent : null;
}


