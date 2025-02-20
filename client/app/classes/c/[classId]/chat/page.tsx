"use client"

import { useEffect, useMemo, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";
import { IconArrowLeft, IconMessageCirclePlus, IconPlus, IconRefresh } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, Center, em, Flex, Group, Stack, Skeleton, Card } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Container } from "@mantine/core";
import { Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Progress } from "@mantine/core";
import { Chat, Document, Message } from "@/types";
import { getDocuments } from "@/utils/queries/get-documents";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import Image from "next/image";
import { getProfile } from "@/utils/queries/get-profile";
import { getChats } from "@/utils/queries/get-chats";
import { getMessages } from "@/utils/queries/get-messages";
import { getDocument } from "pdfjs-dist";
import { ClassLayout } from "@/components/Class/ClassLayout";

// Add the skeleton component
function ChatSkeleton() {
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

    const { data: chats, isLoading: loadingChats } = useQuery({
        queryKey: ["chats", classId, profile?.id],
        queryFn: () => getChats(supabase, classId, profile!.id),
        enabled: !!profile
    })

    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["messages", classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
    })

    const { data: messagesReferences, isLoading: loadingMessagesReferences } = useQuery({
        queryKey: ["messagesReferences", classId, messages],
        queryFn: () => getDocuments(supabase, messages!.map(message => message.references).flat()),
        enabled: !!messages
    })

    // Realtime subscription for generations
    useEffect(() => {
        const channel = supabase
            .channel(`realtime-chats-${classId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'chats',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    console.log("Received realtime payload:", payload);
                    if (payload.eventType === 'INSERT') {
                        const newChat = payload.new as Chat;
                        queryClient.setQueryData(
                            ["chats", classId, profile?.id], 
                            (oldData: Chat[] = []) => [...oldData, newChat]
                        );
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedChat = payload.new as Chat;
                        queryClient.setQueryData(
                            ["chats", classId, profile?.id], 
                            (oldData: Chat[] = []) => 
                                oldData?.map(chat =>
                                    chat.id === updatedChat.id ? updatedChat : chat
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
        if (!chats) return;
        const channel = supabase
            .channel('realtime-messages')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'messages',
                    filter: `chat=in.(${chats.map(chat => chat.id).join(',')})`
                },
                (payload) => {
                    console.log("Message change:", payload);
                    queryClient.setQueryData(["messages", classId, chats], (oldData: Message[] = []) => {
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
    }, [classId, supabase, chats, queryClient]);

    const getReferences = (message: Message): Document[] | undefined => {
        const references = messagesReferences?.filter(document => message.references.includes(document.id));
        if (references) {
            return references;
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

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Text size="xl" fw={700} mb={6} pl={4}>History</Text>
                        </Group>
                        {/* <Group>
                            <Link href={`/classes/c/${classId}/chat/new`}>
                                <Button leftSection={<IconMessageCirclePlus />}>New Chat</Button>
                            </Link>
                        </Group> */}
                    </Flex>

                    <Stack>
                        {loadingChats || loadingMessages || loadingMessagesReferences ? (
                            <>
                                <ChatSkeleton />
                                <ChatSkeleton />
                                <ChatSkeleton />
                            </>
                        ) : (chats && classData) && chats.length > 0 ? (
                            chats
                                .sort((a, b) => new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime())
                                .map((chat) => {
                                    const messagesForChat = messages?.filter(message => message.chat === chat.id) ?? [];
                                    const references = messagesForChat.map(message => getReferences(message) ?? []).flat()
                                    const context = references?.[0]
                                    return (
                                        <Link
                                            href={`/classes/c/${classId}/chat/${chat.id}`}
                                            key={chat.id}
                                            style={{ textDecoration: 'none' }}
                                        >
                                            <Card withBorder>
                                                <Group align="flex-start">
                                                    <Image
                                                        src={getActiveImage(context)}
                                                        alt={`Chat context`}
                                                        width={150}
                                                        height={150}
                                                        style={{ objectFit: "contain", borderRadius: "10px" }}
                                                    />
                                                    <Stack gap="xs">
                                                        <Text size="lg" fw={500}>{chat.name}</Text>
                                                        <Text size="sm" c="dimmed">
                                                            Created {new Date(chat.created_at ?? "").toLocaleDateString()}
                                                        </Text>
                                                    </Stack>
                                                </Group>
                                            </Card>
                                        </Link>
                                    );
                                })
                        ) : (
                            <Text c="dimmed" ta="center">No chats found</Text>
                        )}
                    </Stack>
                </Stack>
            </Container>
        </ClassLayout>   
    );
}