/**
 * LectureList.tsx
 * 
 * This component is used to display the lecture list for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, Group, Text, ActionIcon, Stack, Loader } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getLectures } from "@/utils/queries/get-lectures";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { ChatMessage } from "./ChatCanvas";
import { useMantineColorScheme } from '@mantine/core';
import React, { useState, useEffect } from "react";
import { useDebouncedValue } from '@mantine/hooks';

interface LectureListProps {
    classId: string;
    searchQuery: string;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    activeChat: ChatMessage;
}

export function LectureList({
    classId,
    searchQuery,
    expandedSections,
    toggleSection,
    addContextToChat,
    activeChat
}: LectureListProps) {
    const supabase = useSupabaseBrowser();
    const { colorScheme } = useMantineColorScheme();
    const [isSearching, setIsSearching] = useState(false);
    
    // Add debounced search
    const [debouncedSearch] = useDebouncedValue(searchQuery, 300);

    // Handle loading state
    useEffect(() => {
        if (searchQuery !== debouncedSearch) {
            setIsSearching(true);
        } else {
            setIsSearching(false);
        }
    }, [searchQuery, debouncedSearch]);

    // Simplified queries using the same pattern as ChatCanvas
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    });


    // Calculate search scores and sort results
    const getSearchResults = React.useMemo(() => {
        if (!lectures || !debouncedSearch) {
            return lectures?.filter(lecture => 
                !activeChat.context.lectures.includes(lecture.id)
            ) || [];
        }

        const searchQueryLower = debouncedSearch.toLowerCase();
        
        return lectures
            .filter(lecture => !activeChat.context.lectures.includes(lecture.id))
            .map(lecture => {
                let score = 0;
                let matchDetails: string[] = [];

                // Check lecture name (highest priority)
                if (lecture.name?.toLowerCase().includes(searchQueryLower)) {
                    score += 100;
                    matchDetails.push('title');
                }

                // Check lecture number
                if (lecture.note_number?.toString().includes(searchQuery)) {
                    score += 80;
                    matchDetails.push('lecture number');
                }

                // Check summaries (medium priority)
                const lectureSummaries = lectureDocuments?.filter(s => s.lecture === lecture.id) || [];
                lectureSummaries.forEach(summary => {
                    if (summary.description?.toLowerCase().includes(searchQueryLower)) {
                        score += 50;
                        matchDetails.push('summary');
                    }
                });

                return {
                    lecture,
                    score,
                    matchDetails: matchDetails.length > 0 ? matchDetails : undefined
                };
            })
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(result => ({
                ...result.lecture,
                matchDetails: result.matchDetails
            }));
    }, [lectures, debouncedSearch, activeChat.context.lectures, lectureDocuments]);

    if (!getSearchResults.length) return null;

    return (
        <Card 
            p="md"
            style={{
                backgroundColor: colorScheme === "dark" ? "#2C2E33" : "#f8f9fa",
                border: `1px solid ${colorScheme === "dark" ? "#373A40" : "#e9ecef"}`
            }}
        >
            <Group mb={expandedSections.has('lectures') ? "md" : 0}>
                <ActionIcon
                    variant="subtle"
                    onClick={() => toggleSection('lectures')}
                    color={colorScheme === "dark" ? "gray.4" : "gray.7"}
                >
                    {expandedSections.has('lectures') ? (
                        <IconChevronDown size={16} />
                    ) : (
                        <IconChevronRight size={16} />
                    )}
                </ActionIcon>
                <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "gray.8"}>
                    Lectures {searchQuery && `(${getSearchResults.length} results)`}
                </Text>
                {isSearching && <Loader size="xs" />}
            </Group>
            {expandedSections.has('lectures') && (
                <Group align="flex-start" style={{ flexWrap: 'wrap' }}>
                    {getSearchResults.map(lecture => (
                        <Card
                            key={lecture.id}
                            shadow="xs"
                            p="xs"
                            radius="md"
                            withBorder
                            style={{
                                marginBottom: '8px',
                                width: 'fit-content',
                                backgroundColor: colorScheme === "dark" ? "#25262b" : "white",
                                borderColor: colorScheme === "dark" ? "#373A40" : "#e9ecef"
                            }}
                        >
                            <Group>
                                <Group>
                                    <ActionIcon
                                        variant={colorScheme === "dark" ? "filled" : "light"}
                                        color="blue"
                                        onClick={() => addContextToChat('lectures', lecture.id)}
                                        title="Add lecture to chat context"
                                    >
                                        <IconPlus size={16} />
                                    </ActionIcon>
                                    <Stack>
                                        <Text size="sm" c={colorScheme === "dark" ? "gray.3" : "gray.7"}>
                                            {lecture.name}
                                        </Text>
                                        {/* {(lecture as any).matchDetails && searchQuery && (
                                            <Text size="xs" c="dimmed">
                                                Matches: {(lecture as any).matchDetails.join(', ')}
                                            </Text>
                                        )} */}
                                    </Stack>
                                </Group>
                            </Group>
                        </Card>
                    ))}
                </Group>
            )}
        </Card>
    );
}