/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 */

import { Text, Card, Stack, Group, Grid, Badge, Modal, ActionIcon, Avatar, useMantineColorScheme, Skeleton, Rating, Menu, Button, Tooltip } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
import { IconArrowLeft, IconRefresh, IconX, IconSchool, IconCaretLeftRight, IconChalkboard, IconCheck, IconHistory, IconChevronDown, IconPlus, IconMenu2, IconEye, IconEyeOff } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@mantine/hooks";
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
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getExercises } from "@/utils/queries/get-exercises";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import ChatHistoryDropdown from "./ChatHistoryDropdown";

export default function ChatCanvas({ classId, chatId }: { classId: string, chatId: string }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const [welcomeMessages, setWelcomeMessages] = useState({ followUp: chatId === "new" ? false : true });
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
        active: false
    });
    const [loading, setLoading] = useState(false);
    
    // Add state for context panel visibility
    const [isContextPanelVisible, setIsContextPanelVisible] = useState(() => {
        // For new chats, show the panel by default
        if (chatId === "new") return true;
        
        // For existing chats, check localStorage first, otherwise default based on if it's a new user session
        const savedVisibility = localStorage.getItem(`context-panel-visible-${classId}`);
        return savedVisibility === null ? true : savedVisibility === 'true';
    });
    
    // Add state to track the animation of panel collapse/expand
    const [isPanelAnimating, setIsPanelAnimating] = useState(false);
    const [panelWidth, setPanelWidth] = useState(isContextPanelVisible ? 4 : 0);
    
    // Add state to track if user has sent their first message
    const [hasUserSentFirstMessage, setHasUserSentFirstMessage] = useState(chatId !== "new");

    // Search and expansion states
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['lectures']));

    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);
    const { colorScheme } = useMantineColorScheme();
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

    const { data: professor } = useQuery({
        queryKey: ["professor", classId],
        queryFn: () => getProfessor(supabase, classId),
    });

    // Queries for data
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
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

    const { data: homeworkData } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId),
    });

    const { data: problems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homeworkData!.map(h => h.id)),
        enabled: !!homeworkData
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters?.map(c => c.id) ?? [], homeworkData?.map(h => h.id) ?? []),
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

    // Add state for the thank you message
    const [showThankYou, setShowThankYou] = useState(false);

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

        const allChapters = Array.from(new Set([...(activeChat.context.chapters ?? []), ...previousMessagesChapters]));
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
            
            // Save current immersive mode state before potential navigation
            const currentImmersiveMode = immersiveMode;

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
                
                // Instead of directly using router.replace which causes a full page transition,
                // use router.push with shallow option to preserve state
                router.push(`/classes/c/${classId}/chat/${chat.id}`, undefined, { 
                    shallow: true 
                });
                
                // After the navigation, restore the immersive mode state
                setTimeout(() => {
                    if (currentImmersiveMode) {
                        setImmersiveMode(true);
                    }
                }, 100);
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

            // Trigger generation, no need to wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: newChatId,
                    message_id: messageData.id
                })
            });

            // Reset states
            setActiveChat({
                ...activeChat,
                prompt: "",
                context: {
                    lectures: [],
                    chapters: [],
                    homeworks: [],
                }
            });
            
            // Only collapse the context panel on the first message
            if (!hasUserSentFirstMessage) {
                localStorage.setItem(`context-panel-visible-${classId}`, 'false');
                animateContextPanel(false);
                setHasUserSentFirstMessage(true);
            }

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

    const scrollToSection = (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleRemoveContext = useCallback((contextType: keyof ChatMessage['context'], contextId: string) => {
        setActiveChat(prev => ({
            ...prev,
            context: {
                ...prev.context,
                [contextType]: prev.context[contextType].filter(id => id !== contextId)
            }
        }));
    }, []);

    const handleScrollToSection = useCallback((sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    const handleOptionClick = useCallback((type: ChatType, isTeacherMode: boolean = false, teacherOption: string = '') => {
        setActiveChat(prev => ({
            ...prev,
            chatType: type,
            teacher: isTeacherMode || prev.teacher
        }));
        setWelcomeMessages({ followUp: true });
    }, []);

    const handleContextClick = useCallback((
        contextType: 'lectures' | 'chapters' | 'homeworks',
        contextId: string,
        setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>,
        documentId?: string,
        textbookId?: string,
        exerciseId?: string,
    ) => {
        // For lectures
        if (contextType === 'lectures' && documentId) {
            setViewerMode({
                active: true,
                documentId: documentId,
                lectureId: contextId,
            });
        }
        // For chapters
        else if (contextType === 'chapters' && documentId && textbookId) {
            setViewerMode({
                active: true,
                documentId: documentId,
                textbookId: textbookId,
                chapterId: contextId,
            });
        } else if (contextType === 'chapters' && exerciseId) {
            setViewerMode({
                active: true,
                chapterId: contextId,
                exerciseId: exerciseId,
            });
        } else if (contextType === 'homeworks' && exerciseId) {
            setViewerMode({
                active: true,
                homeworkId: contextId,
                exerciseId: exerciseId,
            });
        }
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

    useEffect(() => {
        if (profile) {
            setActiveChat(prev => ({
                ...prev,
                chatType: profile.admin || profile.professor ? 'general-teacher' : 'general-student',
                teacher: profile.admin || profile.professor
            }));
        }
    }, [profile]);

    // Handle rating change
    const handleRatingChange = async (value: number) => {
        // Set the rating and show thank you message immediately
        setShowThankYou(true);

        // If we have an existing chat, update the rating in the database
        if (existingChat && chatId !== "new") {
            try {
                const { success, error } = await updateChatRating(chatId, value);
                if (!success) {
                    throw new Error(error);
                }

                // Invalidate the query to refresh the chat data
                await queryClient.invalidateQueries({
                    queryKey: ["chat", chatId],
                    exact: true
                });
            } catch (error) {
                console.error("Error updating rating:", error);
                notifications.show({
                    title: "Error",
                    message: "Failed to save your rating. Please try again.",
                    color: "red"
                });
                // Reset thank you message on error
                setShowThankYou(false);
                return;
            }
        }

        // Hide the thank you message after 3 seconds
        setTimeout(() => {
            setShowThankYou(false);
        }, 3000);
    };

    // Add this function to handle chat selection
    const handleChatSelect = (selectedChatId: string) => {
        if (selectedChatId !== chatId) {
            router.push(`/classes/c/${classId}/chat/${selectedChatId}`);
        }
    };

    // Add this handler for dropped items
    const handleDrop = (item: { type: keyof ChatMessage['context'], id: string }) => {
        if (item && item.type && item.id) {
            addContextToChat(item.type, item.id);
        }
    };

    // Handle panel visibility change with animation
    const animateContextPanel = (shouldShow: boolean) => {
        setIsPanelAnimating(true);
        
        // If we're showing the panel, make it visible immediately but animate the width
        if (shouldShow) {
            setIsContextPanelVisible(true);
            // Start animation to expand
            setTimeout(() => setPanelWidth(4), 50);
        } else {
            // Start animation to collapse
            setPanelWidth(0);
            // After animation completes, hide the panel completely
            setTimeout(() => {
                setIsContextPanelVisible(false);
                setIsPanelAnimating(false);
            }, 300); // Match this with the CSS transition duration
        }
    };

    // Toggle context panel visibility and save to localStorage
    const toggleContextPanel = () => {
        const newVisibility = !isContextPanelVisible;
        localStorage.setItem(`context-panel-visible-${classId}`, String(newVisibility));
        animateContextPanel(newVisibility);
    };

    // Also update the useEffect to properly initialize hasUserSentFirstMessage based on messages
    // and apply the correct panel visibility
    useEffect(() => {
        // If there are existing messages, we know the user has sent messages before
        if (messages && messages.length > 0) {
            setHasUserSentFirstMessage(true);
        }
    }, [messages]);

    // Properly initialize panel width when component mounts or isContextPanelVisible changes
    useEffect(() => {
        setPanelWidth(isContextPanelVisible ? 4 : 0);
    }, []);

    const handleViewerModeChange = (newViewerMode: ViewerMode) => {
        // When a viewer is activated, always show the panel
        if (newViewerMode.active) {
            // Ensure the panel is visible
            setIsContextPanelVisible(true);
            setPanelWidth(4);
            
            // Store this in localStorage too
            localStorage.setItem(`context-panel-visible-${classId}`, 'true');
            
            // Remove animating state to avoid timing issues
            setIsPanelAnimating(false);
        } 
        // When viewer is deactivated, close the entire panel
        else if (viewerMode.active) { // This checks if we're actually closing an active viewer
            // Start animation to collapse panel
            animateContextPanel(false);
            
            // Store this state in localStorage
            localStorage.setItem(`context-panel-visible-${classId}`, 'false');
            setIsContextPanelVisible(false);
        }
        
        // Update the viewer mode
        setViewerMode(newViewerMode);
    };

    // Add state for immersive mode with persistence
    const [immersiveMode, setImmersiveMode] = useState(() => {
        // Try to retrieve the state from sessionStorage
        if (typeof window !== 'undefined') {
            const savedState = sessionStorage.getItem(`immersive-mode-${classId}`);
            return savedState === 'true';
        }
        return false;
    });
    
    // When immersive mode changes, save it to sessionStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(`immersive-mode-${classId}`, immersiveMode.toString());
        }
    }, [immersiveMode, classId]);
    
    const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
    const [isUserInterrupting, setIsUserInterrupting] = useState(false);
    
    // Toggle immersive mode function with persistence
    const toggleImmersiveMode = () => {
        setImmersiveMode(prev => {
            const newValue = !prev;
            // Save to session storage immediately
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(`immersive-mode-${classId}`, newValue.toString());
            }
            return newValue;
        });
        
        // Reset chunk index when toggling mode
        setCurrentChunkIndex(0);
        setIsUserInterrupting(false);
    };
    
    // Handle user interruption in immersive mode
    const handleUserInterruption = (isInterrupting: boolean) => {
        setIsUserInterrupting(isInterrupting);
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        {/* Only show title and badges when not in immersive mode */}
                        {!immersiveMode && (
                            <>
                                <Group>
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
                                            existingChat.type === 'homework-student' || existingChat.type === 'homework-professor' ? 'blue' :
                                                existingChat.type === 'concept' ? 'cyan' :
                                                    existingChat.type === 'review' ? 'teal' :
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
                                </Group>

                                {existingChat && existingChat.rating !== null && (
                                    <Group>
                                        <Rating
                                            value={existingChat.rating}
                                            readOnly
                                            size="md"
                                        />
                                    </Group>
                                )}
                            </>
                        )}
                    </Flex>

                    <Grid>
                        <Grid.Col 
                            span={isMobile ? 12 : (viewerMode.active || isContextPanelVisible) && !immersiveMode ? 8 : 12} 
                            style={{
                                transition: 'width 300ms ease-in-out, flex 300ms ease-in-out'
                            }}
                        >
                            <Card
                                shadow={immersiveMode ? "none" : "sm"}
                                padding={immersiveMode ? "0" : "lg"}
                                radius="md"
                                withBorder={!immersiveMode}
                                style={{
                                    height: immersiveMode ? "90vh" : "80vh",
                                    background: immersiveMode ? "transparent" : undefined,
                                    border: immersiveMode ? "none" : undefined
                                }}
                            >
                                {/* Show controls only when not in immersive mode */}
                                {!immersiveMode && (
                                    <Flex justify="space-between" align="center" mb={10}>
                                        {/* Rating component - only show if not yet rated */}
                                        {existingChat && existingChat.rating === null && (
                                            <Group>
                                                {/* ...existing code... */}
                                            </Group>
                                        )}
                                        
                                        {/* Chat history, context toggle, and new chat buttons */}
                                        <Group gap="xs" ml="auto">
                                            {/* Add immersive mode toggle button */}
                                            <Tooltip label="Enter immersive mode">
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="md"
                                                    onClick={toggleImmersiveMode}
                                                    aria-label="Toggle immersive mode"
                                                >
                                                    <IconEye size={18} />
                                                </ActionIcon>
                                            </Tooltip>
                                        
                                            {/* Context panel toggle */}
                                            <Tooltip label={isContextPanelVisible ? "Hide context panel" : "Show context panel"}>
                                                <ActionIcon
                                                    variant="subtle"
                                                    size="md"
                                                    onClick={toggleContextPanel}
                                                    aria-label="Toggle context panel"
                                                >
                                                    <IconMenu2 size={18} />
                                                </ActionIcon>
                                            </Tooltip>
                                        
                                            <ChatHistoryDropdown 
                                                currentChatId={chatId} 
                                                onChatSelect={handleChatSelect} 
                                                classId={classId}
                                            />
                                            
                                            <Tooltip label="Start a new chat">
                                                <ActionIcon 
                                                    variant="subtle" 
                                                    size="md" 
                                                    aria-label="Start a new chat"
                                                    onClick={() => router.push(`/classes/c/${classId}/chat/new`)}
                                                    disabled={chatId === "new"}
                                                >
                                                    <IconPlus size={18} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Flex>
                                )}
                                
                                {/* Add exit button when in immersive mode */}
                                {immersiveMode && (
                                    <Group position="right" p="sm">
                                        <Tooltip label="Exit immersive mode">
                                            <ActionIcon
                                                variant="light"
                                                color="gray"
                                                size="md"
                                                onClick={toggleImmersiveMode}
                                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100 }}
                                            >
                                                <IconEyeOff size={18} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                )}

                                <MessageList
                                    chatId={chatId}
                                    classId={classId}
                                    colorScheme={colorScheme}
                                    existingChat={existingChat ?? null}
                                    activeChat={activeChat}
                                    setActiveChat={setActiveChat}
                                    onOptionClick={handleOptionClick}
                                    setViewerMode={handleViewerModeChange}
                                    isInitializing={isInitializing}
                                    loading={loading}
                                    immersiveMode={immersiveMode}
                                    currentChunkIndex={currentChunkIndex}
                                    setCurrentChunkIndex={setCurrentChunkIndex}
                                    isUserInterrupting={isUserInterrupting}
                                />

                                <ChatInput
                                    activeChat={activeChat}
                                    loading={loading}
                                    classId={classId}
                                    onPromptChange={handlePromptChange}
                                    onSend={handleChat}
                                    onRemoveContext={handleRemoveContext}
                                    onScrollToSection={handleScrollToSection}
                                    setViewerMode={setViewerMode}
                                    expandedSections={expandedSections}
                                    toggleSection={toggleSection}
                                    immersiveMode={immersiveMode}
                                    onUserInterruption={handleUserInterruption}
                                />
                            </Card>
                        </Grid.Col>

                        {/* Only show context panel in normal mode */}
                        {!immersiveMode && (
                            <Grid.Col 
                                span={isMobile ? 12 : 4} 
                                style={{
                                    display: (viewerMode.active || isContextPanelVisible || isPanelAnimating) ? 'block' : 'none',
                                    transition: 'width 300ms ease-in-out, flex 300ms ease-in-out, opacity 300ms ease-in-out',
                                    opacity: (viewerMode.active || panelWidth > 0) ? 1 : 0,
                                    overflow: 'hidden',
                                }}
                            >
                                {viewerMode.active ? (
                                    <ViewerPanel
                                        viewerMode={viewerMode}
                                        setViewerMode={handleViewerModeChange}
                                        classId={classId}
                                    />
                                ) : (
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
                                        scrollToSection={scrollToSection}
                                        makeDraggable={true}
                                    />
                                )}
                            </Grid.Col>
                        )}
                    </Grid>
                </Stack>
            </Container>
        </ClassLayout>
    );
}