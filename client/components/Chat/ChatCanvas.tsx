/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 * @AshokSaravanan222
 * 02.06.2025
 */

import { Text, Card, TextInput, Button, Stack, Group, Grid, AspectRatio, Badge, Switch, Modal, Textarea, ActionIcon, Loader, Avatar, useMantineColorScheme } from "@mantine/core";
import { useRouter } from "next/navigation";
import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconPlus, IconCopy, IconTrash, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
import { em } from "@mantine/core";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { v4 as uuidv4 } from 'uuid';
import { createGeneration } from "@/utils/services/generation";
import { createQuestions } from "@/utils/services/questions";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { ContextPanel } from "./ContextPanel";
import { notifications } from "@mantine/notifications";
import { createMessages } from "@/utils/services/messages";
import { getGeneration } from "@/utils/queries/get-generation";
import { getGenerationMessages } from "@/utils/queries/get-generation-messages";
import DeleteGenerationModal from "../Delete/DeleteGenerationModal";
import { getUser } from "@/utils/queries/get-user";
import { Message, Profile } from "@/types";
import { getProfile } from "@/utils/queries/get-profile";
import Latex from "../Latex";

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        textbooks: string[];   // textbook IDs
        chapters: string[];    // chapter IDs
        exercises: string[];   // exercise IDs
    };
}

export default function ChatCanvas({ classId, generationId }: { classId: string, generationId: string }) {
    const supabase = useSupabaseBrowser();

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "New Chat",
        prompt: "",
        context: {
            lectures: [],
            textbooks: [],
            chapters: [],
            exercises: [],
        }
    });
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'textbooks']));

    const queryClient = useQueryClient();
    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { colorScheme } = useMantineColorScheme();

    // Add query for existing chat if generationId is not "new"
    const { data: existingGeneration } = useQuery({
        queryKey: ["generation", generationId],
        queryFn: () => getGeneration(supabase, generationId),
        enabled: generationId !== "new"
    });

    // Single source of truth for messages
    const { data: messages } = useQuery({
        queryKey: ["generationMessages", generationId],
        queryFn: () => getGenerationMessages(supabase, existingGeneration ? [existingGeneration] : []),
        enabled: !!existingGeneration
    });

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    })

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    })

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });


    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    // Ref for message container
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom whenever messages change
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Set up realtime subscription for messages
    useEffect(() => {
        if (generationId === "new") return;

        const channel = supabase
            .channel(`realtime-messages-${generationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'messages',
                    filter: `generation=eq.${generationId}`
                },
                async (payload) => {
                    console.log("Received message update:", payload);
                    
                    // Immediately update the cache with the new data
                    queryClient.setQueryData(
                        ["generationMessages", generationId],
                        (oldData: any) => {
                            if (!oldData) return [payload.new];
                            
                            // For INSERT, add the new message
                            if (payload.eventType === 'INSERT') {
                                return [...oldData, payload.new];
                            }
                            
                            // For UPDATE, update the existing message
                            if (payload.eventType === 'UPDATE') {
                                return oldData.map((message: any) =>
                                    message.id === payload.new.id ? payload.new : message
                                );
                            }
                            
                            return oldData;
                        }
                    );

                    // Then trigger a refetch to ensure we're in sync
                    await queryClient.invalidateQueries({ 
                        queryKey: ["generationMessages", generationId],
                        exact: true 
                    });
                }
            )
            .subscribe();

        console.log("Subscribed to channel:", `realtime-messages-${generationId}`);

        return () => {
            console.log("Unsubscribing from channel:", `realtime-messages-${generationId}`);
            supabase.removeChannel(channel);
        };
    }, [generationId, queryClient, supabase]);

    useEffect(() => {
        if (textbooks) {
            setExpandedNodes(new Set(textbooks.map(t => t.id)));
        }
    }, [textbooks]);

    const getReferences = () => {
        // Previous document references from context
        const lectureReferences = lectureDocuments?.filter(document => 
            activeChat.context.lectures.includes(document.lecture ?? "")
        ) ?? [];
        const textbookReferences = textbookDocuments?.filter(document => 
            activeChat.context.textbooks.includes(document.textbook ?? "")
        ) ?? [];
        const chapterReferences = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            return chapter && activeChat.context.chapters.includes(chapter.id);
        }) ?? [];
        const exerciseReferences = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            const exercise = exercises?.find(e => e.chapter === chapter?.id && activeChat.context.exercises.includes(e.id));
            return exercise && chapter;
        }) ?? [];

        // Previous message references
        const previousMessagesReferences = messages?.flatMap(message => 
            // Check if references exists and is an array before accessing
            Array.isArray(message.references) ? message.references : []
        ) ?? [];

        // Get the actual documents from the references
        const messageReferences = ([...textbookDocuments ?? [], ...lectureDocuments ?? []]).filter(document => 
            previousMessagesReferences.includes(document.id)
        ) ?? [];

        // Combine all references, removing duplicates
        return Array.from(new Set([
            ...lectureReferences, 
            ...textbookReferences, 
            ...chapterReferences, 
            ...exerciseReferences, 
            ...messageReferences
        ]));
    }

    const getAvatarUrl = (profile: Profile) => {
        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${profile.id}.png`
    }

    const handleChat = async () => {
        if (!activeChat.prompt.trim()) return;

        try {
            setLoading(true);

            if (generationId === "new") {
                // Create new generation
                const generation = await createGeneration(
                    classId,
                    activeChat.title,
                    'chat',
                    `${process.env.NEXT_PUBLIC_API_URL}`
                );

                // Update URL without refresh
                router.replace(`/classes/${classId}/chat/${generation.id}`);

                // Create the first message
                const newMessage = {
                    generation: generation.id,
                    question: activeChat.prompt,
                    references: getReferences().map(ref => ref.id)
                };

                const { success, error } = await createMessages([newMessage]);
                if (!success) {
                    throw new Error(error);
                }

                // Invalidate queries to show new message
                queryClient.invalidateQueries({
                    queryKey: ["generationMessages", generationId]
                });
                

                // Trigger generation
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        generation_id: generation.id,
                    })
                });
            } else {
                // Add message to existing chat
                const newMessage = {
                    generation: generationId,
                    question: activeChat.prompt,
                    references: getReferences().map(ref => ref.id)
                };

                const { success, error } = await createMessages([newMessage]);
                if (!success) {
                    throw new Error(error);
                }

                // Invalidate queries to show new message
                queryClient.invalidateQueries({
                    queryKey: ["generationMessages", generationId]
                });

                // Trigger generation
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        generation_id: generationId,
                    })
                });
            }

            setActiveChat({ ...activeChat, prompt: "", context: { lectures: [], textbooks: [], chapters: [], exercises: [] } });
            queryClient.invalidateQueries({ queryKey: ["chatGenerations", classId] });

        } catch (error) {
            console.error("Error in chat:", error);
            notifications.show({
                title: "Error",
                message: "Failed to send message. Please try again.",
                color: "red"
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleNode = (nodeId: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    // Add context to chat
    const addContextToChat = (contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: [...prev.context[contextType], contextId]
            }
        }));
    };

    // Remove context from chat
    const removeContextFromChat = (contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: prev.context[contextType].filter(id => id !== contextId)
            }
        }));
    };

    const renderContextBadges = (chat: ChatMessage) => {
        return (
            <Group>
                {chat.context.lectures.map(lectureId => {
                    const lecture = lectures?.find(l => l.id === lectureId);
                    return lecture && (
                        <Badge
                            key={lectureId}
                            color="blue"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('lectures', lectureId);
                                    }}
                                />
                            }
                        >
                            {lecture.name}
                        </Badge>
                    );
                })}
                {chat.context.textbooks.map(textbookId => {
                    const textbook = textbooks?.find(t => t.id === textbookId);
                    return textbook && (
                        <Badge
                            key={textbookId}
                            color="green"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('textbooks', textbookId);
                                    }}
                                />
                            }
                        >
                            {textbook.title}
                        </Badge>
                    );
                })}
                {chat.context.chapters.map(chapterId => {
                    const chapter = chapters?.find(c => c.id === chapterId);
                    return chapter && (
                        <Badge
                            key={chapterId}
                            color="orange"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('chapters', chapterId);
                                    }}
                                />
                            }
                        >
                            {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                        </Badge>
                    );
                })}
                {chat.context.exercises.map(exerciseId => {
                    const exercise = exercises?.find(e => e.id === exerciseId);
                    const chapter = exercise ? chapters?.find(c => c.id === exercise.chapter) : null;
                    return exercise && chapter && (
                        <Badge
                            key={exerciseId}
                            color="cyan"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('exercises', exerciseId);
                                    }}
                                />
                            }
                        >
                            {`Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                        </Badge>
                    );
                })}
            </Group>
        );
    };

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}/chat`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
                            </Link>
                            {existingGeneration && <Text size="xl" fw={700} mb={6}>{existingGeneration.name}</Text>}
                            {!existingGeneration && <TextInput
                                placeholder="Enter chat name"
                                value={activeChat.title}
                                onChange={(e) => setActiveChat({ ...activeChat, title: e.target.value })}
                                style={{ flex: 1 }}
                                fw={600}
                                size="md"
                                mb={6}
                            />}
                        </Group>
                        <Group>
                            <DeleteGenerationModal generationId={generationId} generationTitle={existingGeneration?.name ?? ""} profile={profile ?? undefined} classId={classId} type={existingGeneration?.type ?? "problem"} />
                        </Group>
                    </Flex>
                    <Grid>
                        {/* Chat Section */}
                        <Grid.Col span={isMobile ? 12 : 8}>
                            <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: "80vh", display: "flex", flexDirection: "column" }}>
                                {/* Messages Area */}
                                <Stack 
                                    style={{ 
                                        flex: 1, 
                                        overflowY: "auto", 
                                        marginBottom: "1rem",
                                        maxHeight: "calc(80vh - 150px)"
                                    }}
                                >
                                    {messages?.map((message) => (
                                        <Stack key={message.id}>
                                            {/* User message */}
                                            <Group align="flex-start" justify="flex-end">
                                                <Card
                                                    padding="sm"
                                                    radius="md"
                                                    style={{
                                                        maxWidth: "70%",
                                                        backgroundColor: "#228be6"
                                                    }}
                                                >
                                                    <Text c="white"><Latex>{message.question}</Latex></Text>
                                                </Card>
                                                <Avatar
                                                    src={profile ? getAvatarUrl(profile) : undefined}
                                                    radius="xl"
                                                    size="md"
                                                    alt={`${profile?.first_name} ${profile?.last_name}`}
                                                >
                                                    {/* Fallback to initials if no avatar */}
                                                    {profile ? `${profile.first_name[0]}${profile.last_name[0]}` : 'U'}
                                                </Avatar>
                                            </Group>

                                            {/* AI response */}
                                            <Group align="flex-start">
                                                <Avatar
                                                    src="/images/professors/yip.jpg"
                                                    size="md"
                                                    radius="xl"
                                                    alt="AI Assistant"
                                                />
                                                <Card
                                                    padding="sm"
                                                    radius="md"
                                                    style={{
                                                        alignSelf: "flex-start",
                                                        maxWidth: "70%",
                                                        backgroundColor: colorScheme === "dark" ? "#25262b" : "#f1f3f5",
                                                        minWidth: "200px",
                                                        border: colorScheme === "dark" ? "1px solid #373A40" : "1px solid #e9ecef"
                                                    }}
                                                >
                                                    {message.response === "" ? (
                                                        <Group align="center">
                                                            <Loader size="sm" color="blue" />
                                                            <Text c="dimmed" size="sm">
                                                                AI is generating response...
                                                            </Text>
                                                        </Group>
                                                    ) : (
                                                        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} c={colorScheme === "dark" ? "white" : "black"}>
                                                            <Latex>{message.response}</Latex>
                                                        </Text>
                                                    )}
                                                </Card>
                                            </Group>
                                        </Stack>
                                    ))}
                                    {/* Invisible div for scrolling */}
                                    <div ref={messagesEndRef} />
                                </Stack>

                                {/* Context Badges */}
                                <Card p="xs" withBorder mb="sm">
                                    <Group>
                                        <Text fw={600}>Context: </Text>
                                        {renderContextBadges(activeChat)}
                                    </Group>
                                </Card>

                                {/* Input Area */}
                                <Group align="flex-end">
                                    <TextInput
                                        placeholder="Type your message..."
                                        value={activeChat.prompt}
                                        onChange={(e) => setActiveChat({ ...activeChat, prompt: e.currentTarget.value })}
                                        style={{ flex: 1 }}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleChat();
                                            }
                                        }}
                                    />
                                    <Button onClick={handleChat} loading={loading}>
                                        Send
                                    </Button>
                                </Group>
                            </Card>
                        </Grid.Col>

                        {/* Context Panel */}
                        <Grid.Col span={isMobile ? 12 : 4}>
                            <ContextPanel
                                classId={classId}
                                isMobile={isMobile ?? false}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                addContextToChat={addContextToChat}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                activeChat={activeChat}
                            />
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>
        </>
    );
}