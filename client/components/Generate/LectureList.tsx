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
import { ProblemCard } from "./GenerateCanvas";

interface LectureListProps {
    classId: string;
    searchQuery: string;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    selectedProblemIds: Set<number>;
    addContextToProblem: (problemId: number, contextType: keyof ProblemCard['context'], contextId: string) => void;
    problems: ProblemCard[];
}

export function LectureList({
    classId,
    searchQuery,
    expandedSections,
    toggleSection,
    selectedProblemIds,
    addContextToProblem,
    problems
}: LectureListProps) {
    const supabase = useSupabaseBrowser();
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const filteredLectures = lectures?.filter(lecture => {
        // First, check if the lecture is already selected in any of the current problems
        const isSelectedInCurrentProblems = Array.from(selectedProblemIds).some(problemId => {
            const problem = problems.find(p => p.id === problemId);
            return problem?.context.lectures.includes(lecture.id);
        });

        // If it's selected in current problems, filter it out
        if (isSelectedInCurrentProblems) return false;

        // Then apply search filter
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
                                    onClick={() => {
                                        selectedProblemIds.forEach(problemId => {
                                            addContextToProblem(problemId, 'lectures', lecture.id);
                                        });
                                    }}
                                    disabled={selectedProblemIds.size === 0}
                                    title={selectedProblemIds.size === 0 ? "Select a problem first" : "Add lecture"}
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

