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
import { ChatMessage } from "./ChatCanvas";

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

    const filteredLectures = lectures?.filter(lecture => {
        // Check if the lecture is already in the active chat's context
        const isAlreadySelected = activeChat.context.lectures.includes(lecture.id);

        // If it's already selected, filter it out
        if (isAlreadySelected) return false;

        // Apply search filter
        return lecture.name?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (!filteredLectures?.length) return null;

    return (
        <Card p="md">
            <Group mb={expandedSections.has('lectures') ? "md" : 0}>
                <ActionIcon
                    variant="subtle"
                    onClick={() => toggleSection('lectures')}
                >
                    {expandedSections.has('lectures') ? (
                        <IconChevronDown size={16} />
                    ) : (
                        <IconChevronRight size={16} />
                    )}
                </ActionIcon>
                <Text fw={700}>Lectures</Text>
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
                                width: 'fit-content'
                            }}
                        >
                            <Group>
                                <ActionIcon
                                    variant="light"
                                    color="blue"
                                    onClick={() => addContextToChat('lectures', lecture.id)}
                                    title="Add lecture to chat context"
                                >
                                    <IconPlus size={16} />
                                </ActionIcon>
                                <Text size="sm">{lecture.name}</Text>
                            </Group>
                        </Card>
                    ))}
                </Group>
            )}
        </Card>
    );
}

