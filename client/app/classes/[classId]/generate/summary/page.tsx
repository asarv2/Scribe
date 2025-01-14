/**
 * app/classes/[classId]/generate/page.tsx
 * This page is for showing the past generations of the class. It will show all the past generations of the class, and the option to generate new generations.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useState } from "react";
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

import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import { getGenerations } from "@/utils/queries/get-generations";
import { Document, Generation, Lecture, Question, Summary } from "@/types";
import { getGenerationDocuments } from "@/utils/queries/get-generation-documents";
import { getGenerationSummaries } from "@/utils/queries/get-generation-summaries";
import { getGenerationProblems } from "@/utils/queries/get-generation-problems";

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

    const { data: generations, isLoading: loadingGenerations } = useQuery({
        queryKey: ["generations", classId],
        queryFn: () => getGenerations(supabase, classId, "summary")
    })

    const { data: generationSummaries, isLoading: loadingGenerationSummaries } = useQuery({
        queryKey: ["generationSummaries", classId, generations],
        queryFn: () => getGenerationSummaries(supabase, generations ?? []),
        enabled: !!generations
    })

    const { data: generationDocuments, isLoading: loadingGenerationDocuments } = useQuery({
        queryKey: ["generationSummariesDocuments", classId, generations],
        queryFn: () => getGenerationDocuments(supabase, generationSummaries ? generationSummaries.map(summary => summary.documents).flat() : []),
        enabled: !!generationSummaries
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const handleRetry = async (classId: string, generation: Generation) => {
        try {
            const response = await supabase.functions.invoke('generate-summary', {
                body: {
                    class_id: classId,
                    generation_id: generation.id,
                }
            });

            if (response.error) {
                throw new Error(response.error.message);
            }
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
            .channel('realtime-generations')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'generations',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newGeneration = payload.new as Generation;
                        console.log("Generation:", newGeneration);
                        // Update your lectures state with the new data
                        queryClient.setQueryData(["generations", classId], (oldData: Generation[] = []) => {
                            return [...oldData, newGeneration];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedGeneration = payload.new as Generation;
                        console.log("Updated Generation:", updatedGeneration);
                        queryClient.setQueryData(["generations", classId], (oldData: Generation[] = []) => {
                            return oldData?.map(generation => 
                                generation.id === updatedGeneration.id ? updatedGeneration : generation
                            ) || [];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    useEffect(() => {
        if (!generations) return;
        const channel = supabase
            .channel('realtime-summaries')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'summaries',
                    filter: `generation=in.(${generations.map(generation => generation.id).join(',')})`
                },
                (payload) => {
                    console.log("Summary change:", payload);

                    // Update documents in React Query cache
                    queryClient.setQueryData(["generationSummaries", classId], (oldData: Summary[] = []) => {
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
    }, [classId, supabase, generations, queryClient]);

    const getDocument = (generation: Generation): Document | undefined => {
        // first find the summary or question that matches the generation
        const summary = generationSummaries?.find(summary => summary.generation === generation.id);
        if (summary) {
            return generationDocuments?.filter(document => summary.documents.includes(document.id))[0]
        }
        return undefined;
    }


    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>Summaries</Text>
                        </Group>
                        <Group>
                            <Link href={`/classes/${classId}/generate/summary/new`}>
                                <Button>Generate</Button>
                            </Link>
                        </Group>
                    </Flex>

                    <Stack>
                        {(generations && classData) && generations.length > 0 && generations.sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()).map((generation) => {
                            const document = getDocument(generation);
                            if (generation.generation_status !== "complete") {
                                const progress = generation.progress * 100
                                let estimatedSeconds = 0;
                                estimatedSeconds = 10 * (1 - generation.progress) // takes 10 seconds to generate a summary
                                return (
                                    <Card withBorder key={generation.id}>
                                        <Group align="flex-start" justify="space-between">
                                            <Group align="flex-start">
                                                <MantineImage
                                                    src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/lectures/${document?.lecture}/images/${document?.page}.png`}
                                                    alt={`Page ${document?.page} of ${document?.lecture}`}
                                                    width={200}
                                                    height={150}
                                                    fit="contain"
                                                    fallbackSrc="/placeholder_image.svg"
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{generation.name}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        {generation.generation_status === 'generating' ? 'Generating...' :
                                                            generation.generation_status === 'error' ? 'Generation failed' : generation.generation_status === 'idle' ? 'Waiting to generate' : 'Waiting to generate'}
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
                                                            Estimated time remaining: ~{estimatedSeconds} seconds
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
                                    href={`/classes/${classId}/generate/summary/past/${generation.id}`}
                                    key={generation.id}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Card withBorder>
                                        <Group align="flex-start">
                                            <MantineImage
                                                src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/lectures/${document?.lecture}/images/${document?.page}.png`}
                                                alt={`Page ${document?.page} of ${document?.lecture}`}
                                                width={200}
                                                height={150}
                                                fit="contain"
                                                fallbackSrc="/placeholder_image.svg" // You might want to add a placeholder image
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