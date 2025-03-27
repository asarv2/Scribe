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

import { Chapter, ChatMessage, ChatType, Subchapter, Document, ViewerMode, Exercise } from "@/types";
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
import RecordingPanel from "../RecordingPanel";


export default function ChatCanvas({ classId, chatId, toggle, fullscreen }: { classId: string, chatId: string, toggle: () => void, fullscreen: boolean }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
        immersive: fullscreen,
        contextActive: false,
        contextOpen: chatId === "new",
        audio: false,
        video: false,
        recording: false,
        inputActive: true,
        paused: false,
        saved: false,
    });
    const [loading, setLoading] = useState(false);

    // Search and expansion states
    const [contextSearchQuery, setContextSearchQuery] = useState("");
    const [filesSearchQuery, setFilesSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures']));

    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // video/audio section
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

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
    const isInitializing = !user || !profile || !lectures || !textbooks;

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

    // Handlers
    const handlePromptChange = useCallback((prompt: string) => {
        setActiveChat(prev => ({ ...prev, prompt }));
    }, []);

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
            contextOpen: false,
            filesOpen: false,
        }));
        toggle();
    };

    const exitImmersive = () => {
        setViewerMode(prev => ({
            ...prev,
            immersive: false,
            contextOpen: chatId === "new",
            filesOpen: chatId === "new",
        }));
        toggle();
    };

    const toggleAudio = () => {
        setViewerMode(prev => ({
            ...prev,
            audio: !prev.audio
        }));
    };

    const toggleVideo = () => {
        setViewerMode(prev => ({
            ...prev,
            video: !prev.video
        }));
    };

    // Initialize media devices on component mount
    useEffect(() => {
        getMediaStream();

        // Cleanup on unmount
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }

            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }

            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Update media stream when audio/video toggles change
    useEffect(() => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        getMediaStream();
    }, [viewerMode.audio, viewerMode.video]);

    // Function to get media stream based on enabled devices
    const getMediaStream = async () => {
        if (!viewerMode.audio && !viewerMode.video) {
            setStream(null);
            return;
        }

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: viewerMode.audio,
                video: viewerMode.video
            });

            setStream(newStream);

            // Connect stream to video preview if video is enabled
            if (viewerMode.video && videoPreviewRef.current) {
                videoPreviewRef.current.srcObject = newStream;
            }

            // Create MediaRecorder instance immediately (for visualization)
            const recorder = new MediaRecorder(newStream);
            mediaRecorderRef.current = recorder;

            // Setup data handlers even before recording starts
            mediaChunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    mediaChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                const mimeType = viewerMode.video ? 'video/webm' : 'audio/wav';
                const blob = new Blob(mediaChunksRef.current, { type: mimeType });
                setMediaBlob(blob);

                // Display recorded media for video
                if (viewerMode.video && videoPreviewRef.current) {
                    videoPreviewRef.current.srcObject = null;
                    videoPreviewRef.current.src = URL.createObjectURL(blob);
                    videoPreviewRef.current.controls = true;
                }
            };

        } catch (error) {
            console.error('Error accessing media devices:', error);
            notifications.show({
                title: 'Device Access Error',
                message: 'Could not access requested media devices. Please check permissions.',
                color: 'red',
            });
        }
    };

    // Function to start recording
    const startRecording = () => {
        if (!stream || !mediaRecorderRef.current) {
            notifications.show({
                title: 'Recording Error',
                message: 'No media devices enabled. Please enable audio or video.',
                color: 'red',
            });
            return;
        }

        try {
            // Reset chunks if starting a new recording
            mediaChunksRef.current = [];

            // Start recording
            mediaRecorderRef.current.start();
            setViewerMode(prev => ({
                ...prev,
                recording: true,
                paused: false
            }));
            setRecordingDuration(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('Error starting recording:', error);
            notifications.show({
                title: 'Recording Error',
                message: 'Failed to start recording. Please try again.',
                color: 'red',
            });
        }
    };

    // Function to pause recording
    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
            setViewerMode(prev => ({
                ...prev,
                paused: true
            }));
            // Pause timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    // Function to resume recording
    const resumeRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
            setViewerMode(prev => ({
                ...prev,
                paused: false
            }));
            // Resume timer
            timerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        }
    };

    // Function to stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setViewerMode(prev => ({
                ...prev,
                recording: false,
                saved: true
            }));
        }

        // Clear timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

    };


    const handleDiscardRecording = () => {
        setViewerMode(prev => ({
            ...prev,
            recording: false,
            saved: false
        }));
    };

    const handleSaveRecording = () => {
        // add to chat, reset recording state
        // use media blob to add to chat
        setViewerMode(prev => ({
            ...prev,
            recording: false,
            saved: false
        }));
    };

    const toggleInput = () => {
        setViewerMode(prev => ({
            ...prev,
            inputActive: !prev.inputActive
        }));
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
            setViewerMode(prev => ({ ...prev, contextOpen: !prev.contextOpen }));
        }],
    ], []
    );

    return (
        <ClassLayout classId={classId} showHeader={!viewerMode.immersive}>
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        {viewerMode.immersive ?
                            <Group gap="xs">
                                <div style={{ display: "none" }}>
                                    {viewerMode.recording ?
                                        <>
                                            <Tooltip label={viewerMode.inputActive ? "Hide input" : "Show input"}>
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="md"
                                                    onClick={toggleInput}
                                                    aria-label="Toggle input"
                                                >
                                                    {viewerMode.inputActive ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                                                </ActionIcon>
                                            </Tooltip>
                                            {viewerMode.paused ? <Tooltip label="Resume recording">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="md"
                                                    onClick={resumeRecording}
                                                    aria-label="Resume recording"
                                                >
                                                    <IconPlayerPlay size={18} />
                                                </ActionIcon>
                                            </Tooltip> :
                                                <Tooltip label="Pause recording">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={pauseRecording}
                                                        aria-label="Pause recording"
                                                    >
                                                        <IconPlayerPause size={18} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            }
                                            <Tooltip label="Stop recording">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="md"
                                                    onClick={stopRecording}
                                                    aria-label="Stop recording"
                                                >
                                                    <IconPlayerStop size={18} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </>
                                        : viewerMode.saved ?
                                            <>
                                                <Tooltip label={viewerMode.inputActive ? "Hide input" : "Show input"}>
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={toggleInput}
                                                        aria-label="Toggle input"
                                                    >
                                                        {viewerMode.inputActive ? <IconEye size={18} /> : <IconEyeOff size={18} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                                <Tooltip label="Discard recording">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={handleDiscardRecording}
                                                        aria-label="Discard recording"
                                                    >
                                                        <IconX size={18} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                <Tooltip label="Add to chat">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={handleSaveRecording}
                                                        aria-label="Add to chat"
                                                    >
                                                        <IconFilePlus size={18} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </>
                                            : <>
                                                <Tooltip label="Enable microphone">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={toggleAudio}
                                                        aria-label="Toggle audio"
                                                    >
                                                        {viewerMode.audio ? <IconMicrophone size={18} /> : <IconMicrophoneOff size={18} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                                <Tooltip label="Enable camera">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={toggleVideo}
                                                        aria-label="Toggle video"
                                                    >
                                                        {viewerMode.video ? <IconCamera size={18} /> : <IconCameraOff size={18} />}
                                                    </ActionIcon>
                                                </Tooltip>
                                                {(viewerMode.audio || viewerMode.video) && <Tooltip label="Start recording">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={startRecording}
                                                    >
                                                        <IconPlayerPlay size={18} />
                                                    </ActionIcon>
                                                </Tooltip>}
                                            </>}
                                </div>
                            </Group> :
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
                                    <Tooltip label={viewerMode.contextOpen ? "Hide context" : "Add context"}>
                                        <ActionIcon
                                            variant="subtle"
                                            size="lg"
                                            onClick={() => setViewerMode(prev => ({ ...prev, contextOpen: !prev.contextOpen }))}
                                            aria-label="Toggle context panel"
                                        >
                                            {viewerMode.contextOpen ? <IconCategoryMinus size={20} /> : <IconCategoryPlus size={20} />}
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
                        {viewerMode.immersive && <Grid.Col span={3} >
                            {/* <RecordingPanel
                                viewerMode={viewerMode}
                                mediaBlob={mediaBlob}
                                videoPreviewRef={videoPreviewRef}
                                mediaRecorderRef={mediaRecorderRef}
                                recordingDuration={recordingDuration}
                            /> */}
                        </Grid.Col>
                        }
                        <Grid.Col
                            span={isMobile ? 12 : viewerMode.immersive ? 6 : (8 + (!viewerMode.contextOpen ? 4 : 0))}
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
                                    loading={loading}
                                    classId={classId}
                                    onPromptChange={handlePromptChange}
                                    onSend={handleChat}
                                    onRemoveContext={removeContextFromChat}
                                    onScrollToSection={handleScrollToSection}
                                    viewerMode={viewerMode}
                                    setViewerMode={setViewerMode}
                                    expandedSections={expandedSections}
                                    toggleSection={toggleSection}
                                    toggleImmersive={enterImmersive}
                                />
                            </Card>
                        </Grid.Col>
                        <Grid.Col
                            span={isMobile ? 12 : viewerMode.immersive ? 3 : 4}
                            style={{
                                display: (viewerMode.contextOpen) ? 'block' : 'none',
                                transition: 'width 300ms ease-in-out, flex 300ms ease-in-out, opacity 300ms ease-in-out',
                                opacity: (viewerMode.contextOpen) ? 1 : 0,
                                overflow: 'hidden',
                            }}
                        >
                            {viewerMode.contextActive ? (
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