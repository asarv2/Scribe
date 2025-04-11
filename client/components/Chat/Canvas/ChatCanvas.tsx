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

import { Chapter, ChatMessage, ChatType, Subchapter, Document, ViewerMode, Exercise, FileType, Message } from "@/types";
import { getUser } from "@/utils/queries/get-user";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { ContextPanel } from "../ContextPanel";
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
import { ViewerPanel } from "../ViewerPanel";

export interface RecordedVideo {
    id: string;
    url: string;
    fileId?: string;
    uploadProgress?: number;
    parseStatus?: string;
}

export default function ChatCanvas({ classId, chatId, toggle, fullscreen }: { classId: string, chatId: string, toggle: () => void, fullscreen: boolean }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
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

    const [recordedVideos, setRecordedVideos] = useState<RecordedVideo[]>([]);

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

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, [classId]),
        enabled: !!profile
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

    const [isWaitingForVideos, setIsWaitingForVideos] = useState(false);

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

        const allChapters = Array.from(new Set([...(activeChat.context.chapters ?? []), ...exerciseChapters, ...previousMessagesChapters]));
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

    const getFileContext = () => {
        const previousMessagesFiles = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.files) ? message.files : []
        ) ?? [];

        const allFiles = Array.from(new Set([...(activeChat.context.files ?? []), ...previousMessagesFiles]));
        return allFiles;

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

    // Define sendMessage with useCallback
    const sendMessage = useCallback(async () => {
        setLoading(true);
        try {
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
                lectures: getLectureContext(),
                chapters: getChapterContext(),
                homeworks: getHomeworkContext(),
                files: getFileContext(),
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
        } finally {
            setLoading(false);
        }
    }, [
        profile,
        chatId,
        classId,
        activeChat,
        router,
        getAdditionalContextForBareQuestion,
        getLectureContext,
        getChapterContext,
        getHomeworkContext,
        getFileContext
    ]);

    const handleChat = async () => {
        if (!activeChat.prompt.trim() && recordedVideos.length === 0) return;

        try {
            // Check if there are any unprocessed videos or videos still being processed
            const hasUnprocessedVideos = recordedVideos.some(video => {
                // If no fileId, it's still uploading
                if (video.fileId === undefined) return true;
                
                // Find the corresponding file and check its parse_status
                const file = files?.find(f => f.id === video.fileId);
                
                // If file exists, check if it's complete, otherwise consider it unprocessed
                return !file || file.parse_status !== 'complete';
            });

            if (hasUnprocessedVideos) {
                console.log("Waiting for videos to fully process before sending message");
                // Set flags to indicate we're waiting for videos and should send when ready
                setIsWaitingForVideos(true);
                return; // Exit early, the useEffect will handle sending when videos are ready
            }

            // If all videos are already processed or there are no videos, send immediately
            await sendMessage();

        } catch (error) {
            console.error("Error in message processing:", error);
            notifications.show({
                title: "Error",
                message: "Failed to send message. Please try again.",
                color: "red"
            });
        }
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

    const handleFileDelete = () => {
        // close the window
        setViewerMode(prev => ({
            ...prev,
            active: false,
        }));
        // remove from context
        removeContextFromChat("files", viewerMode.fileId ?? "");
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

    // Add this useEffect to monitor video processing status
    useEffect(() => {
        // Only run this effect if we're actively waiting for videos to process
        if (!isWaitingForVideos || !files) return;

        // Check if all videos have fileIds AND are fully processed
        const allVideosProcessed = recordedVideos.every(video => {
            // If no fileId, it's not processed
            if (video.fileId === undefined) return false;
            
            // Find the corresponding file
            const file = files.find(f => f.id === video.fileId);
            
            // Consider it processed if file exists and status is complete
            return file && file.parse_status === 'complete';
        });

        if (allVideosProcessed) {
            console.log("All videos processed, sending message now");
            setIsWaitingForVideos(false);

            // Trigger the message sending
            // Make sure we're not already in a loading state
            if (!loading) {
                console.log("Executing sendMessage function");
                sendMessage()
                    .then(() => {
                        console.log("Message sent successfully");
                    })
                    .catch(error => {
                        console.error("Error sending message:", error);
                        notifications.show({
                            title: "Error",
                            message: "Failed to send message. Please try again.",
                            color: "red"
                        });
                    });
            } else {
                console.log("Already in loading state, not sending message");
            }
        } else {
            // Set up a timer to check again
            const timer = setTimeout(() => {
                console.log("Checking video processing status...");
                // This will trigger this effect to run again
                setIsWaitingForVideos(state => state);
            }, 250);

            return () => clearTimeout(timer);
        }
    }, [isWaitingForVideos, recordedVideos, files, sendMessage, loading]);

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
                                // Check if this message already exists in our data
                                const messageExists = oldData.some((msg: any) => msg.id === payload.new.id);
                                if (messageExists) {
                                    console.log("Message already exists in cache, not adding duplicate");
                                    return oldData;
                                }
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
        ['mod+M', () => {
            setViewerMode(prev => ({ ...prev, open: !prev.open }));
        }],
    ], []
    );

    useEffect(() => {
        if (classId === "547a83a8-ab2c-4f3c-9112-b1cb6414ff36") {

            setActiveChat(prev => ({
                ...prev,
                chatType: "present"
            }));
        }
    }, [classId]);

    return (
        <ClassLayout classId={classId}>
            <Container fluid>
                <Grid>
                    <Grid.Col
                        span={isMobile ? 12 : 8 + (!viewerMode.open ? 4 : 0)}
                        style={{
                            transition: 'width 300ms ease-in-out, flex 300ms ease-in-out'
                        }}
                    >
                        <Card
                            shadow={"md"}
                            withBorder
                            padding={"lg"}
                            radius={"md"}
                            h="calc(100vh - 100px)"
                        >
                            {/* Show controls only when not in immersive mode */}
                            <Flex justify="space-between" align="center" mb={10}>
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
                                    {existingChat?.type === "present" && <Badge color="orange" variant="light">Present</Badge>}
                                    {existingChat?.type === "review" && <Badge color="cyan" variant="light">Review</Badge>}
                                    {existingChat?.type === "homework-student" && <Badge color="indigo" variant="light">Homework</Badge>}
                                    {existingChat?.type === "concept" && <Badge color="green" variant="light">Learn</Badge>}
                                </Group>
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
                                </Group>
                            </Flex>

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
                                chatId={chatId}
                                onSend={handleChat}
                                onRemoveContext={removeContextFromChat}
                                onScrollToSection={handleScrollToSection}
                                viewerMode={viewerMode}
                                setViewerMode={setViewerMode}
                                expandedSections={expandedSections}
                                toggleSection={toggleSection}
                                toggleImmersive={enterImmersive}
                                recordedVideos={recordedVideos}
                                setRecordedVideos={setRecordedVideos}
                            />
                        </Card>
                    </Grid.Col>
                    <Grid.Col
                        span={isMobile ? 12 : 4}
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
                                onFileDelete={handleFileDelete}
                            />
                        )}
                    </Grid.Col>
                </Grid>
            </Container>
        </ClassLayout>
    );
}