"use client"

import { useEffect, useMemo, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, Center, em, Flex, Group, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Container } from "@mantine/core";
import { Text, Card } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Progress } from "@mantine/core";
import { getGenerations } from "@/utils/queries/get-generations";
import { Document, Generation, Message } from "@/types";
import { getGenerationDocuments } from "@/utils/queries/get-generation-documents";
import { getGenerationMessages } from "@/utils/queries/get-generation-messages";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import Image from "next/image";
import { getProfile } from "@/utils/queries/get-profile";

export default function ChatPage({ params }: { params: { classId: string } }) {
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
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: chatGenerations, isLoading: loadingChatGenerations } = useQuery({
        queryKey: ["chatGenerations", classId, profile?.id],
        queryFn: () => getGenerations(supabase, classId, 'chat', (profile?.admin || profile?.professor) ? null : profile!.id),
        enabled: !!profile
    })

    const { data: generationMessages, isLoading: loadingGenerationMessages } = useQuery({
        queryKey: ["generationMessages", classId, chatGenerations],
        queryFn: () => getGenerationMessages(supabase, chatGenerations ?? []),
        enabled: !!chatGenerations
    })

    const { data: generationMessagesDocuments, isLoading: loadingGenerationMessagesDocuments } = useQuery({
        queryKey: ["generationMessagesDocuments", classId, generationMessages],
        queryFn: () => getGenerationDocuments(supabase, generationMessages!.map(message => message.documents).flat()),
        enabled: !!generationMessages
    })

    const handleRetry = async (classId: string, generation: Generation) => {
        try {
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    generation_id: generation.id,
                })
            });

            queryClient.invalidateQueries({ queryKey: ["generationMessages", classId, chatGenerations] });
        } catch (error) {
            console.error('Error retrying:', error);
            notifications.show({
                title: 'Error',
                message: `Failed to retry chat generation. Please try again.`,
                color: 'red'
            });
        }
    };

    // Realtime subscription for generations
    useEffect(() => {
        const channel = supabase
            .channel(`realtime-chat-generations-${classId}`)
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
                            ["chatGenerations", classId], 
                            (oldData: Generation[] = []) => [...oldData, newGeneration]
                        );
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedGeneration = payload.new as Generation;
                        queryClient.setQueryData(
                            ["chatGenerations", classId], 
                            (oldData: Generation[] = []) => 
                                oldData?.map(generation =>
                                    generation.id === updatedGeneration.id ? updatedGeneration : generation
                                ) || []
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Realtime subscription for messages
    useEffect(() => {
        if (!chatGenerations) return;
        const channel = supabase
            .channel('realtime-messages')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'messages',
                    filter: `generation=in.(${chatGenerations.map(generation => generation.id).join(',')})`
                },
                (payload) => {
                    console.log("Message change:", payload);
                    queryClient.setQueryData(["generationMessages", classId, chatGenerations], (oldData: Message[] = []) => {
                        let newData;
                        if (payload.eventType === 'INSERT') {
                            newData = [...oldData, payload.new];
                        } else if (payload.eventType === 'DELETE') {
                            newData = oldData.filter(msg => msg.id !== payload.old.id);
                        } else if (payload.eventType === 'UPDATE') {
                            newData = oldData.map(msg =>
                                msg.id === payload.new.id ? payload.new : msg
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
    }, [classId, supabase, chatGenerations, queryClient]);

    const getDocument = (generation: Generation): Document | undefined => {
        const message = generationMessages?.find(message => message.generation === generation.id);
        if (message) {
            return generationMessagesDocuments?.filter(document => message.documents.includes(document.id))[0]
        }
        return undefined;
    }

    const getActiveImage = (document: Document | undefined) => {
        if (!document) return "/placeholder_image.svg";
        if (document.lecture) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${document.lecture}/${document.id}.png`
        } else if (document.textbook) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`
        }
        return "/placeholder_image.svg";
    }

    const getEstimatedTime = useMemo(() => {
        return (generation: Generation) => {
            if (!generationMessages) return 0;
            const genMessages = generationMessages.filter(message => message.generation === generation.id);
            // takes 5 seconds per message
            return genMessages.length * 5 * (1 - generation.progress);
        };
    }, [generationMessages]);

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Text size="xl" fw={700} mb={6} pl={4}>Chats</Text>
                        </Group>
                        <Group>
                            <Link href={`/classes/${classId}/chat/new`}>
                                <Button>New Chat</Button>
                            </Link>
                        </Group>
                    </Flex>

                    <Stack>
                        {(chatGenerations && classData) && chatGenerations.length > 0 && chatGenerations
                            .sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime())
                            .map((generation) => {
                                const document = getDocument(generation);
                                if (generation.generation_status !== "complete") {
                                    const progress = generation.progress * 100;
                                    return (
                                        <Card withBorder key={generation.id}>
                                            <Group align="flex-start" justify="space-between">
                                                <Group align="flex-start">
                                                    <Image
                                                        src={getActiveImage(document)}
                                                        alt={`Chat context`}
                                                        style={{ objectFit: "contain", borderRadius: "10px" }}
                                                        width={150}
                                                        height={150}
                                                    />
                                                    <Stack gap="xs">
                                                        <Text size="lg" fw={500}>{generation.name}</Text>
                                                        <Text size="sm" c="dimmed">
                                                            {generation.generation_status === 'generating' ? 'Generating response...' :
                                                                generation.generation_status === 'error' ? 'Generation failed' : 
                                                                generation.generation_status === 'idle' ? 'Waiting to generate' : 
                                                                'Processing...'}
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
                                                    {generation.generation_status === 'generating' ? 'Processing...' :
                                                        generation.generation_status === 'error' ? 'Retry' :
                                                        'Retry'}
                                                </Button>
                                            </Group>
                                        </Card>
                                    )
                                }
                                return (
                                    <Link
                                        href={`/classes/${classId}/chat/${generation.id}`}
                                        key={generation.id}
                                        style={{ textDecoration: 'none' }}
                                    >
                                        <Card withBorder>
                                            <Group align="flex-start">
                                                <Image
                                                    src={getActiveImage(document)}
                                                    alt={`Chat context`}
                                                    width={150}
                                                    height={150}
                                                    style={{ objectFit: "contain", borderRadius: "10px" }}
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{generation.name}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        Created {new Date(generation.created_at ?? "").toLocaleDateString()}
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