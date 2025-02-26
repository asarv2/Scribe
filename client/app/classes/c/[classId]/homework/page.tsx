/**
 * This page is used to display the homework for a class, for the teacher to create and manage homework.
 */
"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Button, Card, Container, Flex, Group, Stack, Text, Switch, Progress } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconPlus, IconRefresh } from "@tabler/icons-react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { useState, useMemo, useEffect } from "react";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { updateExerciseAnswerEnabled } from "@/utils/services/exercises";
import { notifications } from "@mantine/notifications";
import { getExercises } from "@/utils/queries/get-exercises";
import { Skeleton } from "@mantine/core";
import { Homework } from "@/types";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";
import Image from "next/image";
import Link from "next/link";

export default function HomeworkPage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const [processingHomeworks, setProcessingHomeworks] = useState<Set<string>>(new Set());

    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId)
    });

    const {data: homeworkDocuments, isLoading: loadingHomeworkDocuments} = useQuery({
        queryKey: ["homeworkDocuments", classId],
        queryFn: () => getHomeworkDocuments(supabase, homeworks?.map(h => h.id) ?? []),
        enabled: !!homeworks
    });

    const {data: exercises, isLoading: loadingExercises} = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, [], homeworks?.map(h => h.id) ?? []),
        enabled: !!homeworks
    });

    const handleProblemAnswerEnabledChange = async (exerciseId: string, enabled: boolean) => {
        try {
            const {success, error} = await updateExerciseAnswerEnabled(enabled, exerciseId);
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

    const handleRetry = async (classId: string, homework: Homework) => {
        try {
            setProcessingHomeworks(prev => new Set(prev).add(homework.id));
            // Call the parse-textbook endpoint, do not wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/homework`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    homework_id: homework.id,
                })
            });
            queryClient.invalidateQueries({ queryKey: ["homeworks", classId] });
        } catch (error) {
            console.error('Error retrying:', error);
            notifications.show({
                title: 'Error',
                message: `Failed to retry parsing. Please try again.`,
                color: 'red'
            });
        } finally {
            setProcessingHomeworks(prev => {
                const next = new Set(prev);
                next.delete(homework.id);
                return next;
            });
        }
    };

    // Add realtime subscription for homeworks
    useEffect(() => {
        const channel = supabase
            .channel('realtime-homeworks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'homeworks',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newHomework = payload.new as Homework;
                        console.log("Homework:", newHomework);
                        queryClient.setQueryData(["homeworks", classId], (oldData: Homework[]) => {
                            return [...oldData, newHomework];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedHomework = payload.new as Homework;
                        console.log("Updated Homework:", updatedHomework);
                        queryClient.setQueryData(["homeworks", classId], (oldData: Homework[]) => {
                            return oldData.map(homework => 
                                homework.id === updatedHomework.id ? updatedHomework : homework
                            );
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscription for exercises
    useEffect(() => {
        if (!homeworks) return;
        const channel = supabase
            .channel('realtime-homework-exercises')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'exercises',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                (payload) => {
                    console.log("Exercise change:", payload);

                    // Immediately invalidate the exercises query to trigger a refresh
                    queryClient.invalidateQueries({
                        queryKey: ["exercises", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, homeworks, queryClient]);

    // Add realtime subscription for homework documents
    useEffect(() => {
        if (!homeworks) return;
        const channel = supabase
            .channel('realtime-homework-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                (payload) => {
                    console.log("Document change:", payload);

                    // Immediately invalidate the documents query to trigger a refresh
                    queryClient.invalidateQueries({
                        queryKey: ["homeworkDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, homeworks, queryClient]);

    const getDocumentImage = (homeworkId: string) => {
        if (!homeworkId) return '/placeholder_image.svg';
        const document = homeworkDocuments?.find(document => document.homework === homeworkId);
        if (!document) return '/placeholder_image.svg';
        if (document.textbook) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`
        } else if (document.exercise) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${document.exercise}/${document.id}.png`
        }
        return '/placeholder_image.svg';
    }

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
                        {loadingHomeworks || loadingExercises ? (
                            <>
                                <HomeworkSkeleton />
                                <HomeworkSkeleton />
                                <HomeworkSkeleton />
                            </>
                        ) : homeworks?.length === 0 ? (
                            <Text c="dimmed" ta="center">No homework assignments yet</Text>
                        ) : (
                            homeworks?.sort((a, b) => 
                                new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()
                            ).map((homework) => {
                                const homeworkExercises = exercises?.filter(e => e.homework === homework.id) ?? [];
                                const isProcessing = homework.parse_status !== "complete";
                                
                                if (isProcessing) {
                                    return (
                                        <Card withBorder key={homework.id}>
                                            <Group align="flex-start" justify="space-between">
                                                <Group align="flex-start">
                                                    <Image
                                                        src={getDocumentImage(homework.id)}
                                                        alt={`First page of ${homework.title}`}
                                                        width={150}
                                                        height={150}
                                                        style={{ objectFit: "contain", borderRadius: "10px" }}
                                                    />
                                                    <Stack gap="xs">
                                                        <Text size="lg" fw={500}>{homework.title}</Text>
                                                        <Text size="sm" c="dimmed">
                                                            {homework.parse_status === 'parsing' ? 'Processing exercises...' :
                                                                homework.parse_status === 'error' ? 'Processing failed' : 
                                                                homework.parse_status === 'idle' ? 'Waiting to process' : 
                                                                'Could not process exercises.'}
                                                        </Text>
                                                        {homework.parse_error && (
                                                            <Text size="sm" c="red">
                                                                Error: {homework.parse_error}
                                                            </Text>
                                                        )}
                                                        <Progress
                                                            value={100}
                                                            size="sm"
                                                            color="blue"
                                                            animated={homework.parse_status === 'parsing'}
                                                            striped={homework.parse_status === 'parsing'}
                                                        />
                                                        {homework.parse_status === 'parsing' && (
                                                            <Text size="sm" c="dimmed">
                                                                Estimated time remaining: ~{10} seconds
                                                            </Text>
                                                        )}
                                                    </Stack>
                                                </Group>
                                                <Button
                                                    variant="light"
                                                    color="blue"
                                                    onClick={() => handleRetry(classId, homework)}
                                                    leftSection={<IconRefresh size={16} />}
                                                    disabled={homework.parse_status === 'parsing' || homework.parse_status === 'idle'}
                                                    loading={processingHomeworks.has(homework.id)}
                                                >
                                                    {processingHomeworks.has(homework.id) ? 'Retrying...' :
                                                        homework.parse_status === 'parsing' ? 'Processing...' :
                                                        homework.parse_status === 'error' ? 'Retry Processing' :
                                                        'Processing...'}
                                                </Button>
                                            </Group>
                                        </Card>
                                    );
                                }

                                return (
                                    <Link
                                        href={`/classes/c/${classId}/homework/${homework.id}`}
                                        key={homework.id}
                                        style={{ textDecoration: 'none' }}
                                    >
                                        <Card withBorder>
                                            <Group align="flex-start">
                                                <Image
                                                    src={getDocumentImage(homework.id)}
                                                    alt={`First page of ${homework.title}`}
                                                    width={150}
                                                    height={150}
                                                    style={{ objectFit: "contain", borderRadius: "10px" }}
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{homework.title}</Text>
                                                    <Group gap="xs">
                                                        <Text size="sm" c="dimmed">
                                                            Created: {new Date(homework.created_at).toLocaleDateString()}
                                                        </Text>
                                                        <Text size="sm" c="dimmed">•</Text>
                                                        <Text size="sm" c="dimmed">
                                                            {homeworkExercises.length} exercises
                                                        </Text>
                                                    </Group>
                                                </Stack>
                                            </Group>
                                        </Card>
                                    </Link>
                                );
                            })
                        )}
                    </Stack>
                </Stack>
            </Container>
        </ClassLayout>
    );
}

function HomeworkSkeleton() {
    return (
        <Card withBorder>
            <Group align="flex-start">
                <Skeleton height={150} width={150} radius="md" />
                <Stack gap="xs">
                    <Skeleton height={24} width={200} />
                    <Skeleton height={16} width={150} />
                </Stack>
            </Group>
        </Card>
    );
}
