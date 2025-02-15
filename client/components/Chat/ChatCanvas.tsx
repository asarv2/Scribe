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
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { ContextPanel } from "./ContextPanel";
import { notifications } from "@mantine/notifications";
import { createMessages } from "@/utils/services/messages";
import { getUser } from "@/utils/queries/get-user";
import { Document, Message, Profile } from "@/types";
import { getProfile } from "@/utils/queries/get-profile";
import Latex from "../Latex";
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getProfessor } from "@/utils/queries/get-professor";
import { getHomework } from "@/utils/queries/get-homework";
import { getProblems } from "@/utils/queries/get-problems";
import { getChat } from "@/utils/queries/get-chat";
import { getMessages } from "@/utils/queries/get-messages";
import DeleteChatModal from "../Delete/DeleteChatModal";
import { createChat } from "@/utils/services/chat";

export interface ChatMessage {
    id: number;
    title: string
    prompt: string;
    context: {
        lectures: string[];     // lecture IDs
        textbooks: string[];   // textbook IDs
        chapters: string[];    // chapter IDs
        subchapters: string[]; // subchapter IDs
        exercises: string[];   // exercise IDs
        homework: string[];   // homework IDs
        problems: string[];   // problem IDs
    };
}

// Add a new type for streaming state
type StreamingState = {
    messageId: string;
    content: string;
};

export default function ChatCanvas({ classId, chatId }: { classId: string, chatId: string }) {
    const supabase = useSupabaseBrowser();

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "New Chat",
        prompt: "",
        context: {
            lectures: [],
            textbooks: [],
            chapters: [],
            subchapters: [],
            exercises: [],
            homework: [],
            problems: [],
        }
    });
    const [loading, setLoading] = useState(false);
    const [streamingState, setStreamingState] = useState<StreamingState | null>(null);

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures', 'textbooks', 'homework']));

    const queryClient = useQueryClient();
    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { colorScheme } = useMantineColorScheme();

    const { data: existingChat } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(supabase, chatId),
        enabled: chatId !== "new"
    });

    // Single source of truth for messages
    const { data: messages } = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(supabase, [chatId]),
        enabled: !!existingChat
    });

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: subchapters } = useQuery({
        queryKey: ["subchapters", classId],
        queryFn: () => getSubchapters(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: homeworkData } = useQuery({
        queryKey: ["homework", classId],
        queryFn: () => getHomework(supabase, classId),
    });

    const { data: problems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homeworkData!.map(h => h.id)),
        enabled: !!homeworkData
    });

    const { data: professor } = useQuery({
        queryKey: ["professor", classId],
        queryFn: () => getProfessor(supabase, classId),
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

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    })

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
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
        if (chatId === "new") return;

        const channel = supabase
            .channel(`realtime-messages-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'messages',
                    filter: `chat=eq.${chatId}`
                },
                async (payload) => {
                    console.log("Received message update:", payload);

                    // Immediately update the cache with the new data
                    queryClient.setQueryData(
                        ["messages", chatId],
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
                        queryKey: ["messages", chatId],
                        exact: true
                    });
                }
            )
            .subscribe();

        console.log("Subscribed to channel:", `realtime-messages-${chatId}`);

        return () => {
            console.log("Unsubscribing from channel:", `realtime-messages-${chatId}`);
            supabase.removeChannel(channel);
        };
    }, [chatId, queryClient, supabase]);

    useEffect(() => {
        if (textbooks) {
            setExpandedNodes(new Set(textbooks.map(t => t.id)));
        }
    }, [textbooks]);

    const getDocuments = () => {
        // Previous document references from context
        const lectureDocs = lectureDocuments?.filter(document =>
            activeChat.context.lectures.includes(document.lecture ?? "")
        ) ?? [];
        const textbookDocs = textbookDocuments?.filter(document =>
            activeChat.context.textbooks.includes(document.textbook ?? "")
        ) ?? [];
        const chapterDocs = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            return chapter && activeChat.context.chapters.includes(chapter.id);
        }) ?? [];
        const subchapterDocs = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            const subchapter = subchapters?.find(s => s.chapter === chapter?.id && activeChat.context.subchapters.includes(s.id));
            return subchapter && chapter;
        }) ?? [];
        const exerciseDocs = textbookDocuments?.filter(document => {
            const chapter = chapters?.find(c => c.id === document.textbook);
            const exercise = exercises?.find(e => e.chapter === chapter?.id && activeChat.context.exercises.includes(e.id));
            return exercise && chapter;
        }) ?? [];

        // Previous message references
        const previousMessagesDocs = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.documents) ? message.documents : []
        ) ?? [];

        // Get the actual documents from the references
        const messageDocuments = ([...textbookDocuments ?? [], ...lectureDocuments ?? []]).filter(document =>
            previousMessagesDocs.includes(document.id)
        ) ?? [];

        // Combine all references, removing duplicates
        return Array.from(new Set([
            ...lectureDocs,
            ...textbookDocs,
            ...chapterDocs,
            ...subchapterDocs,
            ...exerciseDocs,
            ...messageDocuments
        ]));
    }

    const getAvatarUrl = (profile: Profile) => {
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/profiles/${profile.id}.png`
    }

    const getProfessorAvatarUrl = () => {
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/profiles/${professor?.id}.png`
    }

    const handleChat = async () => {
        if (!activeChat.prompt.trim()) return;

        try {
            setLoading(true);
            let profileId = profile?.admin ? null : profile?.id;
            let newChatId = chatId;

            if (chatId === "new") {
                // Create new generation
                const chat = await createChat(
                    classId,
                    activeChat.title,
                    profileId
                );
                newChatId = chat.id;
                router.replace(`/classes/${classId}/chat/${chat.id}`);
            }

            // Create the message
            const newMessage = {
                chat: newChatId,
                question: activeChat.prompt,
                response_url:`${process.env.NEXT_PUBLIC_API_URL}`,
                documents: getDocuments().map(doc => doc.id)
            };

            const {success, error, data: messagesData} = await createMessages([newMessage]);
            if (!success) {
                throw new Error(error);
            }

            const messageData = messagesData?.[0];
            if (!messageData) {
                throw new Error("No message data returned");
            }

            // Start streaming
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: newChatId,
                    message_id: messageData.id
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No reader available');
            }

            // Initialize streaming state before starting the stream
            setStreamingState({
                messageId: messageData.id,
                content: ''
            });

            console.log("Starting stream reading...");
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    console.log("Stream complete");
                    break;
                }

                const chunk = decoder.decode(value);
                console.log("Raw chunk received:", chunk);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.trim() && line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log("Parsed data:", data);

                            if (data.error) {
                                console.error('Error:', data.error);
                                notifications.show({
                                    title: "Error",
                                    message: "Failed to generate response. Please try again.",
                                    color: "red"
                                });
                                break;
                            }

                            if (data.chunk) {
                                console.log("Processing chunk:", data.chunk);
                                
                                // Use a Promise to ensure state updates are processed sequentially
                                await new Promise<void>(resolve => {
                                    setStreamingState((prev) => {
                                        const nextState = !prev
                                            ? { messageId: messageData.id, content: data.chunk }
                                            : { ...prev, content: prev.content + data.chunk };
                                        console.log("Updated streaming state:", nextState);
                                        return nextState;
                                    });
                                    
                                    // Give React time to process the state update
                                    setTimeout(resolve, 10);
                                });
                            }

                            if (data.done) {
                                console.log("Received done signal");
                                break;
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                            console.log('Problematic line:', line);
                        }
                    }
                }
            }

            // Reset states
            setActiveChat({ ...activeChat, prompt: "", context: { lectures: [], textbooks: [], chapters: [], exercises: [], subchapters: [], homework: [], problems: [] } });
            queryClient.invalidateQueries({ queryKey: ["chat", chatId] });

        } catch (error) {
            console.error("Error in stream processing:", error);
            notifications.show({
                title: "Error",
                message: "Failed to send message. Please try again.",
                color: "red"
            });
        } finally {
            setLoading(false);
            setStreamingState(null);
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
                            {exercise.title !== "" ? exercise.title : `Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                        </Badge>
                    );
                })}
                {chat.context.subchapters.map(subchapterId => {
                    const subchapter = subchapters?.find(s => s.id === subchapterId);
                    return subchapter && (
                        <Badge
                            key={subchapterId}
                            color="purple"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('subchapters', subchapterId);
                                    }}
                                />
                            }
                        >
                            {`Subchapter ${subchapter.subchapter_number}: ${subchapter.title}`}
                        </Badge>
                    );
                })}
                {chat.context.homework.map(homeworkId => {
                    const homework = homeworkData?.find(h => h.id === homeworkId);
                    return homework && (
                        <Badge
                            key={homeworkId}
                            color="orange"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('homework', homeworkId);
                                    }}
                                />
                            }
                        >
                            {`${homework.title}`}
                        </Badge>
                    );
                })}
                {chat.context.problems.map(problemId => {
                    const problem = problems?.find(p => p.id === problemId);
                    const homework = homeworkData?.find(h => h.id === problem?.homework);
                    return problem && homework && (
                        <Badge
                            key={problemId}
                            color="cyan"
                            rightSection={
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeContextFromChat('problems', problemId);
                                    }}
                                />
                            }
                        >
                            {`${homework.title}: Problem ${problem.problem_number}`}
                        </Badge>
                    );
                })}
                
            </Group>
        );
    };

    const renderDocuments = (lectureDocuments: Document[], textbookDocuments: Document[], chatDocuments: string[]) => {
        // Add safety check
        if (!Array.isArray(lectureDocuments) || !Array.isArray(textbookDocuments)) {
            return null;
        }

        const documents = [...lectureDocuments, ...textbookDocuments];
        // Filter to only matching documents
        const matchingDocs = documents.filter(doc => chatDocuments.includes(doc.id));

        // Group documents by source (lecture/textbook) and sort by page
        const groupedDocs = matchingDocs.reduce((acc, doc) => {
            const key = doc.lecture ?
                `lecture-${doc.lecture}` :
                `textbook-${doc.textbook}`;

            if (!acc[key]) acc[key] = [];
            acc[key].push(doc);
            return acc;
        }, {} as Record<string, typeof documents>);

        // Process each group to combine consecutive pages
        const processedDocs = Object.entries(groupedDocs).flatMap(([key, docs]) => {
            docs.sort((a, b) => a.page - b.page);

            const ranges: { start: number; end: number; doc: any; }[] = [];
            let current = { start: docs[0].page, end: docs[0].page, doc: docs[0] };

            for (let i = 1; i < docs.length; i++) {
                if (docs[i].page === current.end + 1) {
                    current.end = docs[i].page;
                } else {
                    ranges.push({ ...current });
                    current = { start: docs[i].page, end: docs[i].page, doc: docs[i] };
                }
            }
            ranges.push(current);

            return ranges.map(range => ({
                ...range.doc,
                pageRange: range.start === range.end ?
                    `p.${range.start}` :
                    `pp.${range.start}-${range.end}`
            }));
        });

        // Take only the 3 most important documents (prioritizing shorter page ranges)
        const topDocs = processedDocs
            .sort((a, b) => {
                const aPages = a.pageRange.includes('-') ?
                    Number(a.pageRange.split('-')[1]) - Number(a.pageRange.split('-')[0]) :
                    0;
                const bPages = b.pageRange.includes('-') ?
                    Number(b.pageRange.split('-')[1]) - Number(b.pageRange.split('-')[0]) :
                    0;
                return aPages - bPages;
            })
            .slice(0, 3);

        return (
            <Group>
                {topDocs.map(doc => (
                    <Link href={`/classes/${classId}/lecture/${doc.lecture}?page=${doc.page}`} key={doc.id}>
                        <Badge key={doc.id}>
                            {doc.lecture ?
                                `${lectures?.find(l => l.id === doc.lecture)?.name} ${doc.pageRange}` :
                                `${textbooks?.find(t => t.id === doc.textbook)?.title} ${doc.pageRange}`
                            }
                        </Badge>
                    </Link>
                ))}
            </Group>
        );
    };

    // Modify the messages rendering to include streaming state
    const renderMessages = () => {
        return messages?.map((message) => (
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
                        {profile ? `${profile.first_name[0]}${profile.last_name[0]}` : 'U'}
                    </Avatar>
                </Group>

                {/* AI response */}
                <Group align="flex-start">
                    <Avatar
                        src={professor ? getProfessorAvatarUrl() : undefined}
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
                            streamingState?.messageId === message.id ? (
                                // Show streaming content
                                <Text>
                                    <Latex>{streamingState.content || ''}</Latex>
                                </Text>
                            ) : (
                                // Show loading state
                                <Group align="center">
                                    <Loader size="sm" color="blue" />
                                    <Text c="dimmed" size="sm">
                                        AI is generating response...
                                    </Text>
                                </Group>
                            )
                        ) : (
                            // Show completed response
                            <Text>
                                <Latex>{message.response}</Latex>
                                {message.references && lectureDocuments && textbookDocuments &&
                                    renderDocuments(
                                        lectureDocuments ?? [],
                                        textbookDocuments ?? [],
                                        message.references
                                    )
                                }
                            </Text>
                        )}
                    </Card>
                </Group>
            </Stack>
        ));
    };

    useEffect(() => {
        console.log("Streaming state changed:", streamingState);
      }, [streamingState]);

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
                            {existingChat && <Text size="xl" fw={700} mb={6}>{existingChat.name}</Text>}
                            {!existingChat && <TextInput
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
                            {existingChat && <DeleteChatModal chatId={chatId} chatTitle={existingChat?.name ?? ""} profile={profile ?? undefined} classId={classId} />}
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
                                    {renderMessages()}
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