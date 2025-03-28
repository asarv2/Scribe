/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 */

import { Text, Card, Stack, Group, Grid, Badge, Modal, ActionIcon, Avatar, useMantineColorScheme, Skeleton, Rating, Menu, Button, Tooltip } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconRefresh, IconX, IconSchool, IconCaretLeftRight, IconChalkboard, IconCheck, IconHistory, IconChevronDown, IconPlus, IconMenu2, IconEye, IconEyeOff, IconMaximize, IconMaximizeOff, IconColumnsOff, IconArrowRight, IconClearAll, IconCategoryPlus, IconCategoryMinus, IconVolumeOff, IconVolume, IconFilePlus, IconFileMinus, IconMicrophone, IconCamera, IconMicrophoneOff, IconCameraOff, IconPlayerPlay, IconPlayerStop, IconPlayerPause } from "@tabler/icons-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFullscreen, useMediaQuery, useHotkeys } from "@mantine/hooks";
import { em } from "@mantine/core";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getChat } from "@/utils/queries/get-chat";
import { getMessages } from "@/utils/queries/get-messages";
import { getProfile } from "@/utils/queries/get-profile";
import { getProfessor } from "@/utils/queries/get-professor";
import { createChat, updateChatRating } from "@/utils/services/chat";
import { getAvatarUrl } from "@/utils/services/images";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { TypeAnimation } from 'react-type-animation';

import { Chapter, ChatMessage, ChatType, Subchapter, Document, ViewerMode, Exercise, FileType } from "@/types";
import { getUser } from "@/utils/queries/get-user";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { ContextPanel } from "../ContextPanel";
import { ViewerPanel } from "./ViewerPanel";
import { notifications } from "@mantine/notifications";
import { createMessages } from "@/utils/services/messages";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { getChapters } from "@/utils/queries/get-chapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getExercises } from "@/utils/queries/get-exercises";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import ChatHistoryDropdown from "./ChatHistoryDropdown";
import { getFiles } from "@/utils/queries/get-files";

export default function ChatCanvas({ classId, chatId, toggle, fullscreen }: { classId: string, chatId: string, toggle: () => void, fullscreen: boolean }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
        immersive: fullscreen,
        active: false,
        open: chatId === "new",
    });
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [contextSearchQuery, setContextSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures']));

    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // Fetch necessary data
    const { data: existingChat } = useQuery({
        queryKey: ["chat", chatId],
        queryFn: () => getChat(supabase, chatId),
        enabled: chatId !== "new"
    });

    const { data: messages } = useQuery({
        queryKey: ["messages", chatId],
        queryFn: () => getMessages(supabase, [chatId]),
        enabled: !!existingChat
    });

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });

    // Queries for data
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId])
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId]),
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: homeworkData } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId]),
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters!.map(c => c.id), homeworkData!.map(h => h.id)),
        enabled: !!chapters && !!homeworkData
    });

    const { data: files, isLoading: filesLoading } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, [classId]),
    });

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "Chat",
        prompt: "",
        context: {
            lectures: [],
            chapters: [],
            homeworks: [],
            exercises: [],
            files: []
        },
        chatType: 'general-student',
        teacher: false,
        rating: null
    });

    // Combine all loading states
    const isInitializing = !user || !profile || !lectures || !textbooks || !homeworkData || !exercises || !files;

    // Add this state to track when we receive a realtime update
    const [receivedRealtimeUpdate, setReceivedRealtimeUpdate] = useState(false);

    // Add this state to track message submission
    const getLectureContext = () => {
        const previousMessagesLectures = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.lectures) ? message.lectures : []
        ) ?? [];

        const allLectures = Array.from(new Set([...(activeChat.context.lectures ?? []), ...previousMessagesLectures]));
        return allLectures;
    }

    const getChapterContext = () => {
        const previousMessagesChapters = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.chapters) ? message.chapters : []
        ) ?? [];

        const exerciseChapters = activeChat.context.exercises.map(e => exercises?.find(ex => ex.id === e)?.chapter).filter((chapter): chapter is string => chapter !== undefined);

        const allChapters = Array.from(new Set([...(activeChat.context.chapters ?? []), ...previousMessagesChapters, ...exerciseChapters]));
        return allChapters;
    }

    const getHomeworkContext = () => {
        const previousMessagesHomeworks = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.homeworks) ? message.homeworks : []
        ) ?? [];

        const allHomeworks = Array.from(new Set([...(activeChat.context.homeworks ?? []), ...previousMessagesHomeworks]));
        return allHomeworks;
    }

    const getAdditionalContextForBareQuestion = () => {
        const contextParts: string[] = [];

        // Add lecture context
        activeChat.context.lectures.forEach(lectureId => {
            const lecture = lectures?.find(l => l.id === lectureId);
            if (lecture) {
                contextParts.push(`Lecture ${lecture.note_number}: ${lecture.name}`);
            }
        });

        // Add chapter context
        activeChat.context.chapters.forEach(chapterId => {
            const chapter = chapters?.find(c => c.id === chapterId);
            if (chapter) {
                contextParts.push(`Chapter ${chapter.chapter_number}: ${chapter.title}`);
            }
        });

        // Add homework context
        activeChat.context.homeworks.forEach(homeworkId => {
            const homework = homeworkData?.find(h => h.id === homeworkId);
            if (homework) {
                contextParts.push(`Homework ${homework.homework_number}: ${homework.title}`);
            }
        });

        // Add exercise context
        activeChat.context.exercises.forEach(exerciseId => {
            const exercise = exercises?.find(e => e.id === exerciseId);
            if (exercise) {
                contextParts.push(`Exercise ${exercise.exercise_number}: ${exercise.title}`);
            }
        });

        // If there's any context, add a prefix
        if (contextParts.length > 0) {
            return `\n\nContext:\n\n${contextParts.join('\n')}\n`;
        }

        return '';
    };

    const addFile = async (uploadedFile: File) => {
        try {
            if (!profile?.id) {
                throw new Error("No profile found");
            }

            const responseUrl = `${process.env.NEXT_PUBLIC_API_URL}`

            const formData = new FormData();
            formData.append("file", uploadedFile);
            formData.append("class_id", classId);
            formData.append("profile_id", profile.id);
            formData.append("response_url", responseUrl);
            formData.append("start_parse", "false"); // for now, we don't want to parse the file

            const fileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/file`, {
                method: 'POST',
                body: formData
            });

            const fileData = await fileResponse.json();
            const fileId = fileData.file_id;

            setActiveChat(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    files: [...prev.context.files, fileId]
                }
            }));
        } catch (error) {
            console.error("Error in addFile:", error);
            notifications.show({
                title: "Error",
                message: "Failed to add file. Please try again.",
                color: "red"
            });
        }
    };

    const handleChat = async () => {
        if (!activeChat.prompt.trim()) return;

        try {
            setLoading(true);
            let profileId = profile?.id;
            let newChatId = chatId;

            const responseUrl = `${process.env.NEXT_PUBLIC_API_URL}`

            if (chatId === "new") {
                // Create new generation with type and metadata including teacherOption
                const chat = await createChat(
                    classId,
                    activeChat.title,
                    profileId,
                    activeChat.chatType,
                    activeChat.teacher,
                    responseUrl
                );
                newChatId = chat.id;
            }

            const additionalContextForBareQuestion = getAdditionalContextForBareQuestion();

            // Create the message
            const newMessage = {
                chat: newChatId,
                profile: profileId,
                bare_question: activeChat.prompt + additionalContextForBareQuestion,
                question: activeChat.prompt,
                response_url: responseUrl,
                // documents: getDocuments().map(doc => doc.id), // will need to remove this later
                lectures: getLectureContext(),
                chapters: getChapterContext(),
                homeworks: getHomeworkContext(),
                // exercises: activeChat.context.exercises, // these can stay as they are
            };

            const { success, error, data: messagesData } = await createMessages([newMessage]);
            if (!success) {
                throw new Error(error);
            }

            const messageData = messagesData?.[0];
            if (!messageData) {
                throw new Error("No message data returned");
            }

            // use form data instead of json
            const formData = new FormData();
            formData.append("chat_id", newChatId);
            formData.append("message_id", messageData.id);

            // Trigger generation, no need to wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                method: 'POST',
                body: formData
            });

            // Reset states
            setActiveChat({
                ...activeChat,
                prompt: "",
                context: {
                    lectures: [],
                    chapters: [],
                    homeworks: [],
                    exercises: [],
                    files: []
                }
            });

            router.push(`/classes/c/${classId}/chat/${newChatId}`);

        } catch (error) {
            console.error("Error in message processing:", error);
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

    // Modify addContextToChat to remove drag-related state updates
    const addContextToChat = (contextType: keyof ChatMessage['context'], contextId: string) => {
        if (contextType === "exercises") {
            const chapterExercises = exercises?.filter(e => e.chapter === contextId);
            setActiveChat(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    exercises: [...prev.context.exercises, ...chapterExercises?.map(e => e.id) ?? []],
                }
            }));
        } else {
            setActiveChat(prev => ({
                ...prev,
                context: {
                    ...prev.context,
                    [contextType]: [...prev.context[contextType], contextId]
                }
            }));
        }
    };

    const removeContextFromChat = (contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: prev.context[contextType].filter(id => id !== contextId)
            }
        }));
    };

    const handleScrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    const handleOptionClick = useCallback((type: ChatType) => {
        setActiveChat(prev => ({
            ...prev,
            chatType: type,
        }));
    }, []);

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


    // Set up realtime subscription for chat
    useEffect(() => {
        const channel = supabase
            .channel(`realtime-chats-${chatId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'chats',
                    filter: `id=eq.${chatId}`
                },
                async (payload) => {
                    console.log("Received chat update:", payload);

                    // Set flag to indicate we received a realtime update
                    if (payload.eventType === 'UPDATE' && payload.new.name !== existingChat?.name) {
                        setReceivedRealtimeUpdate(true);
                    }

                    // Immediately update the cache with the new data
                    queryClient.setQueryData(
                        ["chat", chatId],
                        (oldData: any) => {
                            // The existing chat data is a single object, not an array
                            if (!oldData) return payload.new;  // Return single object, not array

                            // For UPDATE, just return the new data
                            if (payload.eventType === 'UPDATE') {
                                return payload.new;
                            }

                            return oldData;
                        }
                    );

                    // Then trigger a refetch to ensure we're in sync
                    await queryClient.invalidateQueries({
                        queryKey: ["chat", chatId],
                        exact: true
                    });
                }
            )
            .subscribe();

        console.log("Subscribed to channel:", `realtime-chats-${chatId}`);

        return () => {
            console.log("Unsubscribing from channel:", `realtime-chats-${chatId}`);
            supabase.removeChannel(channel);
        };
    }, [chatId, queryClient, supabase]);

    // Add this function to handle chat selection
    const handleChatSelect = (selectedChatId: string) => {
        if (selectedChatId !== chatId) {
            router.push(`/classes/c/${classId}/chat/${selectedChatId}`);
        }
    };

    const enterImmersive = () => {
        setViewerMode(prev => ({
            ...prev,
            immersive: true,
            open: false,
        }));
        toggle();
    };

    const exitImmersive = () => {
        setViewerMode(prev => ({
            ...prev,
            immersive: false,
            open: chatId === "new",
        }));
        toggle();
    };
    // Add keyboard shortcuts
    useHotkeys([
        // ['mod+I', () => {
        //     if (viewerMode.immersive) {
        //         exitImmersive();
        //     } else {
        //         enterImmersive();
        //     }
        // }],
        ['mod+M', () => {
            setViewerMode(prev => ({ ...prev, open: !prev.open }));
        }],
    ], []
    );

    // Add realtime subscriptions for lecture documents
    useEffect(() => {
        if (!files || files.length === 0) return;

        const channel = supabase
            .channel('realtime-file-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                },
                (payload) => {
                    const document = payload.new as Document;
                    console.log("Document updated:", document);
                    if (document.file) {
                        queryClient.refetchQueries({
                            queryKey: ["files", classId]
                        })
                        queryClient.refetchQueries({
                            queryKey: ["fileDocuments", classId]
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, files, queryClient]);

    return (
        <ClassLayout classId={classId} showHeader={!viewerMode.immersive}>
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        {viewerMode.immersive ? <div /> :
                            <Group gap="sm">
                                <Text size="xl" fw={700} mb={6}>
                                    {existingChat ? (
                                        <TypeAnimation
                                            key={`${existingChat.id}-${receivedRealtimeUpdate}`}
                                            sequence={[
                                                existingChat.name || '',
                                            ]}
                                            wrapper="span"
                                            cursor={false}
                                            repeat={0}
                                            speed={50}
                                            preRenderFirstString={!receivedRealtimeUpdate}
                                            style={{
                                                fontSize: '1.25rem',
                                                fontWeight: 700,
                                                display: 'inline-block',
                                            }}
                                        />
                                    ) : (
                                        activeChat.title
                                    )}
                                </Text>
                                {existingChat?.type && (existingChat.type !== 'general-student' && existingChat.type !== 'general-teacher') && (
                                    <Badge color={
                                        existingChat.type === 'homework-student' || existingChat.type === 'homework-professor' ? 'indigo' :
                                            existingChat.type === 'concept' ? 'green' :
                                                existingChat.type === 'review' ? 'cyan' :
                                                    existingChat.type === 'method' ? 'green' :
                                                        existingChat.type === 'generate' ? 'indigo' :
                                                            existingChat.type === 'other' ? 'orange' :
                                                                'gray'
                                    }>
                                        {existingChat.type.startsWith('homework-')
                                            ? 'Homework'
                                            : existingChat.type === 'concept'
                                                ? 'Conceptual'
                                                : existingChat.type === 'method'
                                                    ? 'Approach'
                                                    : existingChat.type === 'generate'
                                                        ? 'Generated'
                                                        : existingChat.type === 'other'
                                                            ? 'Other'
                                                            : existingChat.type.charAt(0).toUpperCase() + existingChat.type.slice(1)}
                                    </Badge>
                                )}
                            </Group>}
                        <Group gap="xs">
                            {viewerMode.immersive ?
                                <Tooltip label="Exit immersive">
                                    <ActionIcon
                                        variant="subtle"
                                        size="md"
                                        onClick={exitImmersive}
                                        aria-label="Toggle immersive"
                                    >
                                        <IconEyeOff size={18} />
                                    </ActionIcon>
                                </Tooltip> :
                                <>
                                    {/* <Tooltip label={viewerMode.filesOpen ? "Hide files" : "Add files"}>
                                        <ActionIcon
                                            variant="subtle"
                                            size="md"
                                            onClick={() => setViewerMode(prev => ({ ...prev, filesOpen: !prev.filesOpen }))}
                                            aria-label="Toggle file panel"
                                        >
                                            {viewerMode.filesOpen ? <IconFileMinus size={18} /> : <IconFilePlus size={18} />}
                                        </ActionIcon>
                                    </Tooltip> */}
                                    <Tooltip label={viewerMode.open ? "Hide context" : "Add context"}>
                                        <ActionIcon
                                            variant="subtle"
                                            size="lg"
                                            onClick={() => setViewerMode(prev => ({ ...prev, open: !prev.open }))}
                                            aria-label="Toggle context panel"
                                        >
                                            {viewerMode.open ? <IconCategoryMinus size={20} /> : <IconCategoryPlus size={20} />}
                                        </ActionIcon>
                                    </Tooltip>
                                </>
                            }

                            {/* <Tooltip label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                                <ActionIcon
                                    variant="subtle"
                                    size="md"
                                    onClick={toggle}
                                    aria-label="Toggle fullscreen"
                                >
                                    {fullscreen ? <IconMaximizeOff size={18} /> : <IconMaximize size={18} />}
                                </ActionIcon>
                            </Tooltip> */}
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col
                            span={isMobile ? 12 : viewerMode.immersive ? 6 : (8 + (!viewerMode.open ? 4 : 0))}
                            style={{
                                transition: 'width 300ms ease-in-out, flex 300ms ease-in-out'
                            }}
                        >
                            <Card
                                shadow={viewerMode.immersive ? "none" : "sm"}
                                padding={viewerMode.immersive ? "none" : "lg"}
                                radius={viewerMode.immersive ? "none" : "md"}
                                withBorder={viewerMode.immersive ? false : true}
                                style={{
                                    height: viewerMode.immersive ? "90vh" : "80vh"
                                }}
                            >
                                {/* Show controls only when not in immersive mode */}
                                {!viewerMode.immersive && <Flex justify="space-between" align="center" mb={10}>
                                    {/* Chat history, context toggle, and new chat buttons */}
                                    <Group gap="xs" ml="auto">
                                        {chatId !== "new" && <Tooltip label="New chat">
                                            <ActionIcon
                                                variant="subtle"
                                                size="lg"
                                                aria-label="Start a new chat"
                                                onClick={() => router.push(`/classes/c/${classId}/chat/new`)}
                                                mb={3}
                                            >
                                                <IconPlus size={20} />
                                            </ActionIcon>
                                        </Tooltip>}
                                        <ChatHistoryDropdown
                                            currentChatId={chatId}
                                            onChatSelect={handleChatSelect}
                                            classId={classId}
                                        />
                                    </Group>
                                </Flex>}

                                <MessageList
                                    chatId={chatId}
                                    classId={classId}
                                    existingChat={existingChat ?? null}
                                    activeChat={activeChat}
                                    setActiveChat={setActiveChat}
                                    onOptionClick={handleOptionClick}
                                    viewerMode={viewerMode}
                                    setViewerMode={setViewerMode}
                                    isInitializing={isInitializing}
                                    loading={loading}
                                />

                                <ChatInput
                                    activeChat={activeChat}
                                    setActiveChat={setActiveChat}
                                    loading={loading}
                                    classId={classId}
                                    onSend={handleChat}
                                    onRemoveContext={removeContextFromChat}
                                    onScrollToSection={handleScrollToSection}
                                    viewerMode={viewerMode}
                                    setViewerMode={setViewerMode}
                                    expandedSections={expandedSections}
                                    toggleSection={toggleSection}
                                    toggleImmersive={enterImmersive}
                                    addFile={addFile}
                                />
                            </Card>
                        </Grid.Col>
                        <Grid.Col
                            span={isMobile ? 12 : viewerMode.immersive ? 3 : 4}
                            style={{
                                display: (viewerMode.open) ? 'block' : 'none',
                                transition: 'width 300ms ease-in-out, flex 300ms ease-in-out, opacity 300ms ease-in-out',
                                opacity: (viewerMode.open) ? 1 : 0,
                                overflow: 'hidden',
                            }}
                        >
                            {viewerMode.active ? (
                                <ViewerPanel
                                    viewerMode={viewerMode}
                                    setViewerMode={setViewerMode}
                                    addContextToChat={addContextToChat}
                                    classId={classId}
                                    activeChat={activeChat}
                                />
                            ) : (
                                <ContextPanel
                                    classId={classId}
                                    searchQuery={contextSearchQuery}
                                    setSearchQuery={setContextSearchQuery}
                                    addContextToChat={addContextToChat}
                                    activeChat={activeChat}
                                    makeDraggable={true}
                                    viewerMode={viewerMode}
                                    setViewerMode={setViewerMode}
                                />
                            )}
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>
        </ClassLayout>
    );
}