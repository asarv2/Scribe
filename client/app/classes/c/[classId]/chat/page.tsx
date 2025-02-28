"use client"

import { useEffect, useMemo, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";
import { IconArrowLeft, IconMessageCirclePlus, IconPlus, IconRefresh } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, Center, em, Flex, Group, Stack, Skeleton, Card, Badge, Tabs, SimpleGrid, Select } from "@mantine/core";
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
import { getStudents } from "@/utils/queries/get-students";
import { IconUser, IconUsers } from '@tabler/icons-react';

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

    const {data: students, isLoading: loadingStudents } = useQuery({
        queryKey: ["students", classId],
        queryFn: () => getStudents(supabase, classId),
        enabled: !!classData
    })

    const { data: userChats, isLoading: loadingUserChats } = useQuery({
        queryKey: ["userChats", classId, profile?.id],
        queryFn: () => getChats(supabase, classId, [profile!.id]),
        enabled: !!profile
    })

    const {data: studentChats, isLoading: loadingStudentChats } = useQuery({
        queryKey: ["studentChats", classId, profile?.id],
        queryFn: () => getChats(supabase, classId, students?.map(student => student.id) ?? []),
        enabled: !!profile && (profile.admin || profile.professor) && !!students
    })

    const {data: chats, isLoading: loadingChats } = useQuery({
        queryKey: ["chats", classId, userChats, studentChats],
        queryFn: () => {
            if (!profile?.admin && !profile?.professor) {
                return userChats ?? [];
            }
            return [...(userChats ?? []), ...(studentChats ?? [])];
        },
        enabled: !!userChats || !!studentChats
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

    // Add state for student and type filters
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const chatTypes = [
        { value: 'all', label: 'All Types' },
        { value: 'homework', label: 'Homework' },
        { value: 'summary', label: 'Summary' },
        { value: 'conceptual', label: 'Conceptual' },
        { value: 'review', label: 'Review' },
        { value: 'general-student', label: 'General Student' },
        { value: 'general-teacher', label: 'General Teacher' },
        { value: 'approach', label: 'Approach' },
        { value: 'faq', label: 'FAQ' },
        { value: 'misconception', label: 'Misconception' }
    ];

    // Filter chats based on selected student and type
    const filteredStudentChats = useMemo(() => {
        if (!studentChats) return [];
        
        let filtered = [...studentChats];
        
        if (selectedStudent && selectedStudent !== 'all') {
            filtered = filtered.filter(chat => chat.profile === selectedStudent);
        }
        
        if (selectedType && selectedType !== 'all') {
            filtered = filtered.filter(chat => chat.type === selectedType);
        }
        
        return filtered;
    }, [studentChats, selectedStudent, selectedType]);

    // Create student options for Select
    const studentOptions = useMemo(() => {
        if (!students) return [];
        return [
            { value: 'all', label: 'All Students' },
            ...students.map(student => ({
                value: student.id,
                label: student.first_name + " " + student.last_name || student.email || 'Unknown Student'
            }))
        ];
    }, [students]);

    const renderChatList = (chatList: Chat[] | undefined, title: string) => {
        if (!chatList || chatList.length === 0) return null;
        
        return (
            <Stack>
                {title && <Text size="lg" fw={600}>{title}</Text>}
                <SimpleGrid
                    cols={{ base: 1, sm: 2, lg: 3 }}
                    spacing="xl"
                    verticalSpacing="xl"
                    p="md"
                >
                    {chatList
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
                                    <Card withBorder h="100%" padding="lg">
                                        <Stack>
                                            <Image
                                                src={getActiveImage(context)}
                                                alt={`Chat context`}
                                                width={0}
                                                height={0}
                                                sizes="100vw"
                                                style={{ 
                                                    width: '100%', 
                                                    height: '200px',
                                                    objectFit: "contain", 
                                                    borderRadius: "10px" 
                                                }}
                                            />
                                            <Stack gap="md">
                                                <Group justify="space-between" align="flex-start">
                                                    <Text size="lg" fw={500} lineClamp={1}>{chat.name}</Text>
                                                    <Group gap="xs">
                                                        <Badge color={chat.teacher ? 'blue' : 'green'}>
                                                            {chat.teacher ? 'Teacher' : 'Student'}
                                                        </Badge>
                                                        <Badge color="grape">
                                                            {chat.type}
                                                        </Badge>
                                                    </Group>
                                                </Group>
                                                <Text size="sm" c="dimmed">
                                                    Created {new Date(chat.created_at ?? "").toLocaleDateString()}
                                                </Text>
                                            </Stack>
                                        </Stack>
                                    </Card>
                                </Link>
                            );
                        })}
                </SimpleGrid>
            </Stack>
        );
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack gap="xl">
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Text size="xl" fw={700} mb={6} pl={4}>History</Text>
                        </Group>
                    </Flex>

                    {loadingChats || loadingMessages || loadingMessagesReferences ? (
                        <Stack gap="xl">
                            <ChatSkeleton />
                            <ChatSkeleton />
                            <ChatSkeleton />
                        </Stack>
                    ) : (chats && classData) && chats.length > 0 ? (
                        profile?.admin || profile?.professor ? (
                            <Tabs defaultValue="student">
                                <Tabs.List>
                                    <Tabs.Tab value="student" leftSection={<IconUsers size={16} />}>
                                        Student Chats
                                    </Tabs.Tab>
                                    <Tabs.Tab value="teacher" leftSection={<IconUser size={16} />}>
                                        My Chats
                                    </Tabs.Tab>
                                </Tabs.List>

                                <Tabs.Panel value="student" pt="xl">
                                    <Stack gap="md">
                                        <Group align="flex-start" grow>
                                            <Select
                                                label="Filter by Student"
                                                placeholder="Select a student"
                                                data={studentOptions}
                                                value={selectedStudent}
                                                onChange={setSelectedStudent}
                                                defaultValue="all"
                                                clearable
                                            />
                                            <Select
                                                label="Filter by Type"
                                                placeholder="Select chat type"
                                                data={chatTypes}
                                                value={selectedType}
                                                onChange={setSelectedType}
                                                defaultValue="all"
                                                clearable
                                            />
                                        </Group>
                                        {renderChatList(filteredStudentChats, "")}
                                    </Stack>
                                </Tabs.Panel>

                                <Tabs.Panel value="teacher" pt="xl">
                                    {renderChatList(userChats, "")}
                                </Tabs.Panel>
                            </Tabs>
                        ) : (
                            renderChatList(userChats, "My Chats")
                        )
                    ) : (
                        <Text c="dimmed" ta="center">No chats found</Text>
                    )}
                </Stack>
            </Container>
        </ClassLayout>   
    );
}