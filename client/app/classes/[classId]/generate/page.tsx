/**
 * app/classes/[classId]/generate/page.tsx
 * This page is for showing the past generations of the class. It will show all the past generations of the class, and the option to generate new generations.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useMemo, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconRefresh, IconUpload } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, Center, em, Group, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";

import { Text, Card } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import { getGenerations } from "@/utils/queries/get-generations";
import { Document, Generation, Lecture, Question, Summary } from "@/types";
import { getGenerationDocuments } from "@/utils/queries/get-generation-documents";
import { getGenerationSummaries } from "@/utils/queries/get-generation-summaries";
import { getGenerationProblems } from "@/utils/queries/get-generation-problems";
import { getProfile } from "@/utils/queries/get-profile";

export default function GeneratePage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const router = useRouter();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user!.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: problemGenerations, isLoading: loadingProblemGenerations } = useQuery({
        queryKey: ["problemGenerations", classId, profile!.id],
        queryFn: () => getGenerations(supabase, classId, 'problem', profile?.admin ? null : profile!.id),
        enabled: !!profile
    })

    const { data: generationProblems, isLoading: loadingGenerationProblems } = useQuery({
        queryKey: ["generationProblems", classId, problemGenerations],
        queryFn: () => getGenerationProblems(supabase, problemGenerations ?? []),
        enabled: !!problemGenerations
    })


    const { data: generationProblemsDocuments, isLoading: loadingGenerationProblemsDocuments } = useQuery({
        queryKey: ["generationProblemsDocuments", classId, generationProblems],
        queryFn: () => getGenerationDocuments(supabase, generationProblems!.map(problem => problem.references).flat()),
        enabled: !!generationProblems
    })


    const handleRetry = async (classId: string, generation: Generation) => {
        try {
            // invoke the generate/problems endpoint, do not wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/problems`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    class_id: classId,
                    generation_id: generation.id,
                })
            });

            queryClient.invalidateQueries({ queryKey: ["generationProblems", classId, problemGenerations] });
        } catch (error) {
            console.error('Error retrying:', error);
            notifications.show({
                title: 'Error',
                message: `Failed to retry generation. Please try again.`,
                color: 'red'
            });
        }
    };


    useEffect(() => {
        const channel = supabase
            .channel(`realtime-generations-${classId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'generations',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    console.log("Received realtime payload:", payload);
                    if (payload.eventType === 'INSERT') {
                        const newGeneration = payload.new as Generation;
                        queryClient.setQueryData(
                            ["problemGenerations", classId], 
                            (oldData: Generation[] = []) => [...oldData, newGeneration]
                        );
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedGeneration = payload.new as Generation;
                        queryClient.setQueryData(
                            ["problemGenerations", classId], 
                            (oldData: Generation[] = []) => 
                                oldData?.map(generation =>
                                    generation.id === updatedGeneration.id ? updatedGeneration : generation
                                ) || []
                        );
                    }
                }
            )
            .subscribe();

        console.log("Subscribed to realtime channel:", channel.state);

        return () => {
            console.log("Unsubscribing from channel");
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    useEffect(() => {
        if (!problemGenerations) return;
        const channel = supabase
            .channel('realtime-problems')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'questions',
                    filter: `generation=in.(${problemGenerations.map(generation => generation.id).join(',')})`
                },
                (payload) => {
                    console.log("Problem change:", payload);
                    // Update documents in React Query cache
                    queryClient.setQueryData(["generationProblems", classId, problemGenerations], (oldData: Question[] = []) => {
                        let newData;
                        if (payload.eventType === 'INSERT') {
                            newData = [...oldData, payload.new];
                        } else if (payload.eventType === 'DELETE') {
                            newData = oldData.filter(doc => doc.id !== payload.old.id);
                        } else if (payload.eventType === 'UPDATE') {
                            newData = oldData.map(doc =>
                                doc.id === payload.new.id ? payload.new : doc
                            );
                        } else {
                            newData = oldData;
                        }
                        return newData;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, generationProblems, queryClient]);

    const getDocument = (generation: Generation): Document | undefined => {
        // first find the summary or question that matches the generation
        const question = generationProblems?.find(question => question.generation === generation.id);
        if (question) {
            return generationProblemsDocuments?.filter(document => question.references.includes(document.id))[0]
        }
        return undefined;
    }

    const getActiveImage = (document: Document | undefined) => {
        if (!document) return "/placeholder_image.svg";
        if (document.lecture) {
            console.log(`${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${document.lecture}/${document.id}.png`)
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${document.lecture}/${document.id}.png`
        } else if (document.textbook) {
            console.log(`${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`)
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`
        }
        return "/placeholder_image.svg";
    }

    const getEstimatedTime = useMemo(() => {
        return (generation: Generation) => {
            if (!generationProblems) return 0;
            const genProblems = generationProblems.filter(problem => problem.generation === generation.id);
            // takes 10 seconds per question 
            return genProblems.length * 10 * (1 - generation.progress);
        };
    }, [generationProblems]);


    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Text size="xl" fw={700} mb={6} pl={4}>Generations</Text>
                        </Group>
                        <Group>
                            <Link href={`/classes/${classId}/generate/new`}>
                                <Button>Generate Problems</Button>
                            </Link>
                        </Group>
                    </Flex>

                    <Stack>
                        {(problemGenerations && classData) && problemGenerations.length > 0 && problemGenerations.sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()).map((generation) => {
                            const document = getDocument(generation);
                            if (generation.generation_status !== "complete") {
                                const progress = generation.progress * 100
                                let estimatedSeconds = 0;
                                estimatedSeconds = ((generation.single ? 10 : 20) * (1 - generation.progress)) * (generation.num_questions) // takes 5 seconds per question
                                return (
                                    <Card withBorder key={generation.id}>
                                        <Group align="flex-start" justify="space-between">
                                            <Group align="flex-start">
                                                <Image
                                                    src={getActiveImage(document)}
                                                    alt={`Page ${document?.page} of ${document?.lecture}`}
                                                    width={200}
                                                    height={150}
                                                    style={{ objectFit: "contain" }}
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{generation.name}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        {generation.generation_status === 'generating' ? 'Generating...' :
                                                            generation.generation_status === 'error' ? 'Generation failed' : generation.generation_status === 'idle' ? 'Waiting to generate' : generation.generation_status === 'generating' ? "Generating..." : 'Waiting to generate'}
                                                    </Text>
                                                    {generation.generation_error && (
                                                        <Text size="sm" c="red">
                                                            Error: {generation.generation_error}
                                                        </Text>
                                                    )}
                                                    <Progress
                                                        value={progress}
                                                        size="sm"
                                                        color={'blue'}
                                                        animated={generation.generation_status === 'generating'}
                                                        striped={generation.generation_status === 'generating'}
                                                    />
                                                    {(generation.generation_status === 'generating') && (
                                                        <Text size="sm" c="dimmed">
                                                            Estimated time remaining: ~{getEstimatedTime(generation)} seconds
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Group>
                                            <Button
                                                variant="light"
                                                color={'blue'}
                                                onClick={() => handleRetry(classId, generation)}
                                                leftSection={<IconRefresh size={16} />}
                                                disabled={generation.generation_status === 'generating' || generation.generation_status === 'idle'}
                                                loading={generation.generation_status === 'generating'}
                                            >
                                                {generation.generation_status === 'generating' ? 'Retrying...' :
                                                    generation.generation_status === 'error' ? 'Retry' :
                                                        generation.generation_status === 'idle' ? 'Retry' :
                                                            'Retry'}
                                            </Button>
                                        </Group>
                                    </Card>
                                )
                            }
                            return (
                                <Link
                                    href={`/classes/${classId}/generate/past/${generation.id}`}
                                    key={generation.id}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Card withBorder>
                                        <Group align="flex-start">
                                            <Image
                                                src={getActiveImage(document)}
                                                alt={`Page ${document?.page} of ${document?.lecture}`}
                                                width={200}
                                                height={150}
                                                style={{ objectFit: "contain" }}
                                            />
                                            <Stack gap="xs">
                                                <Text size="lg" fw={500}>{generation.name}</Text>
                                                <Text size="sm" c="dimmed">
                                                    Uploaded {new Date(generation.created_at ?? "").toLocaleDateString()}
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Card>
                                </Link>
                            );
                        })}
                    </Stack>
                </Stack>
            </Container>

        </>
    );
}