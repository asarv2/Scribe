/**
 * This page is used to display the homework for a class, for the teacher to create and manage homework.
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Button, Card, Container, Flex, Group, Stack, Text, Switch } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus } from "@tabler/icons-react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { useState } from "react";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { updateProblemAnswerEnabled } from "@/utils/services/problems";
import { notifications } from "@mantine/notifications";
import { getChapterExercises } from "@/utils/queries/get-chapter-exercises";
import { getExercises } from "@/utils/queries/get-exercises";

export default function HomeworkPage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const classId = params.classId;
    const supabase = useSupabaseBrowser();
    const [expandedHomeworks, setExpandedHomeworks] = useState<Set<string>>(new Set());

    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId)
    });

    const { data: problems, isLoading: loadingProblems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homeworks?.map(h => h.id) ?? []),
        enabled: !!homeworks
    });

    const { data: problemExercises } = useQuery({
        queryKey: ["problemExercises", classId],
        queryFn: () => getExercises(supabase, problems?.map(p => p.exercise).filter(e => e !== null) ?? []),
        enabled: !!problems
    });

    const toggleHomework = (homeworkId: string) => {
        setExpandedHomeworks(prev => {
            const next = new Set(prev);
            if (next.has(homeworkId)) {
                next.delete(homeworkId);
            } else {
                next.add(homeworkId);
            }
            return next;
        });
    };

    const getProblemsForHomework = (homeworkId: string) => {
        return problems?.filter(problem => problem.homework === homeworkId) ?? [];
    };

    const handleProblemAnswerEnabledChange = async (problemId: string, enabled: boolean) => {
        try {
            const {success, error} = await updateProblemAnswerEnabled(enabled, problemId);
            if (!success) {
                throw new Error(error);
            }
            // notifications.show({
            //     title: "Success",
            //     message: "Problem answer enabled status updated",
            //     color: "green"
            // });
        } catch (error) {
            console.error("Error updating problem answer enabled status:", error);
            notifications.show({
                title: "Error",
                message: "Error updating problem answer enabled status",
                color: "red"
            });
        } finally {
            queryClient.invalidateQueries({ queryKey: ["problems", classId] });
        }
    };

    const getExerciseTitle = (exerciseId: string | null) => {
        if (!exerciseId) return "Unknown Exercise";
        return problemExercises?.find(e => e.id === exerciseId)?.title ?? "Unknown Exercise";
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Text size="xl" fw={700} mb={6} pl={4}>Homework</Text>
                        <Button leftSection={<IconPlus size={14} />}>
                            Create Homework
                        </Button>
                    </Flex>

                    <Stack>
                        {loadingHomeworks ? (
                            <Text>Loading homeworks...</Text>
                        ) : homeworks?.length === 0 ? (
                            <Text c="dimmed">No homework assignments yet</Text>
                        ) : (
                            homeworks?.map((homework) => (
                                <Card key={homework.id} withBorder>
                                    <Stack gap="xs">
                                        <Group justify="space-between">
                                            <Group>
                                                <ActionIcon
                                                    variant="subtle"
                                                    onClick={() => toggleHomework(homework.id)}
                                                >
                                                    {expandedHomeworks.has(homework.id) ? (
                                                        <IconChevronDown size={16} />
                                                    ) : (
                                                        <IconChevronRight size={16} />
                                                    )}
                                                </ActionIcon>
                                                <Stack gap={0}>
                                                    <Text size="lg" fw={500}>{homework.title}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        Created: {new Date(homework.created_at).toLocaleDateString()}
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </Group>

                                        {/* Problems list */}
                                        {expandedHomeworks.has(homework.id) && (
                                            <Stack pl={36} mt="xs">
                                                {loadingProblems ? (
                                                    <Text size="sm">Loading problems...</Text>
                                                ) : getProblemsForHomework(homework.id).length === 0 ? (
                                                    <Text size="sm" c="dimmed">No problems added yet</Text>
                                                ) : (
                                                    getProblemsForHomework(homework.id).map((problem) => (
                                                        <Card 
                                                            key={problem.id} 
                                                            withBorder 
                                                            padding="xs"
                                                        >
                                                            <Flex justify="space-between" align="center" gap="md">
                                                                <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
                                                                    <Text fw={500} truncate>
                                                                        Problem {problem.problem_number} - {getExerciseTitle(problem.exercise)}
                                                                    </Text>
                                                                    <Text size="sm" c="dimmed" truncate>
                                                                        {problem.additional_info}
                                                                    </Text>
                                                                </Flex>
                                                                <Switch
                                                                    label="Allow chat to give answer"
                                                                    size="sm"
                                                                    defaultChecked={problem.answer_enabled}
                                                                    onChange={(event) => handleProblemAnswerEnabledChange(problem.id, event.target.checked)}
                                                                    style={{ flexShrink: 0}}
                                                                />
                                                            </Flex>
                                                        </Card>
                                                    ))
                                                )}
                                            </Stack>
                                        )}
                                    </Stack>
                                </Card>
                            ))
                        )}
                    </Stack>
                </Stack>
            </Container>
        </ClassLayout>
    );
}
