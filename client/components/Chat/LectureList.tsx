/**
 * LectureList.tsx
 * 
 * This component is used to display the lecture list for the generate page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Card, Group, Text, ActionIcon } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getLectures } from "@/utils/queries/get-lectures";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getSummaries } from "@/utils/queries/get-summary";
import { ChatMessage } from "./ChatCanvas";
import { useMantineColorScheme } from '@mantine/core';

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
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { colorScheme } = useMantineColorScheme();
    // Fetch documents for all lectures
    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: async () => {
            const documents: Record<string, any[]> = {};
            if (lectures) {
                for (const lecture of lectures) {
                    documents[lecture.id] = await getLectureDocuments(supabase, [lecture.id]);
                }
            }
            console.log('📚 LECTURE DOCUMENTS:', documents);
            return documents;
        },
        enabled: !!lectures
    });

    // Fetch summaries for all documents
    const { data: documentSummaries } = useQuery({
        queryKey: ["documentSummaries", classId],
        queryFn: async () => {
            const summaries: Record<string, Record<string, any[]>> = {};
            if (lectureDocuments) {
                for (const [lectureId, docs] of Object.entries(lectureDocuments)) {
                    summaries[lectureId] = {};
                    for (const doc of docs) {
                        summaries[lectureId][doc.id] = await getSummaries(supabase, lectureId);
                    }
                }
            }
            return summaries;
        },
        enabled: !!lectureDocuments
    });
    // console.log('📝 DOCUMENT SUMMARIES:', documentSummaries);

    // we now have a list of summaries for each document of each lecture

    const filteredLectures = lectures?.filter(lecture => {
        // Check if the lecture is already in the active chat's context
        const isAlreadySelected = activeChat.context.lectures.includes(lecture.id);

        // If it's already selected, filter it out
        if (isAlreadySelected) return false;

        const searchQueryLower = searchQuery.toLowerCase();

        // Check lecture name
        if (lecture.name?.toLowerCase().includes(searchQueryLower)) {
            return true;
        }

        // Check summaries for all documents under this lecture
        const documents = lectureDocuments?.[lecture.id] || [];
        for (const doc of documents) {
            const summaries = documentSummaries?.[lecture.id]?.[doc.id] || [];
            for (const summary of summaries) {
                if (summary.description?.toLowerCase().includes(searchQueryLower)) {
                    return true;
                }
            }
        }

        return false;
    });

    if (!filteredLectures?.length) return null;

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
                <Text fw={700} c={colorScheme === "dark" ? "gray.1" : "gray.8"}>Lectures</Text>
            </Group>
            {expandedSections.has('lectures') && (
                <Group align="flex-start" style={{ flexWrap: 'wrap' }}>
                    {filteredLectures.map(lecture => (
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
                                <ActionIcon
                                    variant={colorScheme === "dark" ? "filled" : "light"}
                                    color="blue"
                                    onClick={() => addContextToChat('lectures', lecture.id)}
                                    title="Add lecture to chat context"
                                >
                                    <IconPlus size={16} />
                                </ActionIcon>
                                <Text size="sm" c={colorScheme === "dark" ? "gray.3" : "gray.7"}>
                                    {lecture.name}
                                </Text>
                            </Group>
                        </Card>
                    ))}
                </Group>
            )}
        </Card>
    );
}