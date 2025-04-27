/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 */

// Ensure necessary Mantine components are imported, remove Paper if not used elsewhere
import { Text, Card, Stack, Group, Grid, Badge, Modal, ActionIcon, Avatar, useMantineColorScheme, Skeleton, Rating, Menu, Button, Tooltip, Box } from "@mantine/core";
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
import { IconPlus, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFavicon, useHotkeys, useMediaQuery } from "@mantine/hooks";
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

import { ChatMessage, ChatType, ViewerMode } from "@/types";
import { getUser } from "@/utils/queries/get-user";
import { notifications } from "@mantine/notifications";
import { createMessages } from "@/utils/services/messages";
import { getFiles } from "@/utils/queries/get-files";
import { ViewerPanel } from "../ViewerPanel";
import { ClassLayout } from "@/components/Class/ClassLayout";
import ChatHistoryDropdown from "./ChatHistoryDropdown";
import { ContextPanel } from "../ContextPanel";
import { useOs } from '@mantine/hooks';
import PageDetailsModal from "../PageDetailsModal";
import { useStudentMode } from "@/components/StudentModeContext";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
// Import types and components needed for animation
import { CONTENT_COLORS, File as SupabaseFile, Document as SupabaseDocument } from "@/types";
import ItemCard from "../ItemCard"; // Re-import ItemCard
import classes from './ChatCanvas.module.css'; // Import the CSS module
// Remove imports only needed for placeholder if they aren't used elsewhere
// import { Paper } from "@mantine/core";


export interface RecordedVideo {
    id: string;
    url: string;
    fileId?: string;
    uploadProgress?: number;
    parseStatus?: string;
}

export default function ChatCanvas({ classId, chatId, chatTitleUpdated }: { classId: string, chatId: string, chatTitleUpdated: boolean }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const [viewerMode, setViewerMode] = useState<ViewerMode>({
        active: false,
        open: chatId === "new",
        showPageDetails: false,
    });
    const [loading, setLoading] = useState(false);

    // Update state for animation
    const [isAnimating, setIsAnimating] = useState(false);
    const [animatingItemId, setAnimatingItemId] = useState<string | null>(null);

    // Search and expansion states
    const [contextSearchQuery, setContextSearchQuery] = useState("");

    const router = useRouter();
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { studentMode } = useStudentMode();

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

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
        enabled: !!profile
    });

    // Fetch file documents based on files data
    const { data: fileDocuments, isLoading: loadingFileDocuments } = useQuery({
        queryKey: ["fileDocuments", files?.map(f => f.id) ?? []],
        queryFn: () => getFileDocuments(supabase, files?.map(f => f.id) ?? []),
        enabled: !!files && files.length > 0 // Ensure files are loaded
    });


    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "Office Hours",
        prompt: "",
        files: [],
        documents: [],
        chatType: 'student',
        teacher: false,
        rating: null
    });

    // Combine all loading states, including fileDocuments
    const isInitializing = !user || !profile || loadingFiles || loadingFileDocuments;


    const [shouldAnimateTitle, setShouldAnimateTitle] = useState<boolean>(false);

    const getContextFiles = () => {
        const previousMessagesFiles = messages?.flatMap(message =>
            // Check if references exists and is an array before accessing
            Array.isArray(message.files) ? message.files : []
        ) ?? [];

        const allFiles = Array.from(new Set([...(activeChat.files ?? []), ...previousMessagesFiles]));
        return allFiles;

    }

    const getContextDocuments = () => {
        const previousMessagesDocuments = messages?.flatMap(message =>
            Array.isArray(message.documents) ? message.documents : []
        ) ?? [];
        const allDocuments = Array.from(new Set([...(activeChat.documents ?? []), ...previousMessagesDocuments]));
        return allDocuments;
    }

    // MOVED: Define these functions BEFORE handleAnimateContextAdd
    const addFileToChat = (fileId: string) => {
        setActiveChat(prev => ({
            ...prev,
            files: [...prev.files, fileId]
        }));
    };

    const addDocumentToChat = (documentId: string) => {
        setActiveChat(prev => ({
            ...prev,
            documents: [...prev.documents, documentId]
        }));
    };

    const removeFileFromChat = (fileId: string) => {
        setActiveChat(prev => ({
            ...prev,
            files: prev.files.filter((id: string) => id !== fileId)
        }));
    };

    const removeDocumentFromChat = (documentId: string) => {
        setActiveChat(prev => ({
            ...prev,
            documents: prev.documents.filter((id: string) => id !== documentId)
        }));
    };

    // AFTER function definitions, now we can use them in useCallback
    const handleAnimateContextAdd = useCallback(() => {
        if (isAnimating || isInitializing || !files || !profile || !fileDocuments) return;

        // --- Replicate filtering/sorting logic from ContextPanel ---
        const contentTypeOrder = { 'homework': 1, 'lecture': 2, 'rubric': 3, 'textbook': 4, 'other': 5 };
        const visibleFiles = files.filter(f => {
            if ((profile.professor || profile.admin) && !studentMode) return true;
            return f.file_date !== null;
        });

        const sortedFiles = [...visibleFiles].sort((a, b) => {
            const typeOrderDiff = contentTypeOrder[a.content_type as keyof typeof contentTypeOrder] - contentTypeOrder[b.content_type as keyof typeof contentTypeOrder];
            if (typeOrderDiff !== 0) return typeOrderDiff;
            if (a.file_number !== b.file_number) return b.file_number - a.file_number;
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateA - dateB;
        });

        // Find the first available file not already in context
        const topItem = sortedFiles.find(f => !activeChat.files.includes(f.id));

        if (topItem) {
            // Clear any existing animation state
            setAnimatingItemId(null);
            setIsAnimating(false);
            
            // Use requestAnimationFrame to ensure DOM has updated
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Set animating item ID 
                    setAnimatingItemId(topItem.id);
                    setIsAnimating(true);
                    
                    // Add context after animation duration
                    setTimeout(() => {
                        console.log("Animation finished, adding item to context:", topItem.id);
                        addFileToChat(topItem.id);
                        setIsAnimating(false);
                        setAnimatingItemId(null);
                    }, 1200); // Match CSS animation duration
                });
            });
        } else {
            notifications.show({
                title: "No Context Available",
                message: "There are no more items to add to the chat context.",
                color: "yellow",
            });
        }
    }, [isAnimating, isInitializing, files, fileDocuments, profile, studentMode, activeChat.files]);

    // Define sendMessage with useCallback
    const sendMessage = useCallback(async () => {
        setLoading(true);
        try {
            let profileId = profile?.id;
            let newChatId = chatId;

            if (chatId === "new") {
                // Create new generation with type and metadata including teacherOption
                const chat = await createChat(
                    classId,
                    activeChat.title,
                    profileId,
                    activeChat.chatType,
                    activeChat.teacher,
                );
                newChatId = chat.id;
            }

            // Create the message
            const newMessage = {
                chat: newChatId,
                class: classId,
                profile: profileId,
                bare_question: activeChat.prompt,
                question: activeChat.prompt,
                files: getContextFiles(),
                documents: getContextDocuments()
            };

            const { success, error, data: messagesData } = await createMessages([newMessage]);
            if (!success) {
                throw new Error(error);
            }
            queryClient.invalidateQueries({ queryKey: ["messages", chatId] });

            const messageData = messagesData?.[0];
            if (!messageData) {
                throw new Error("No message data returned");
            }

            // use form data instead of json
            const formData = new FormData();
            formData.append("chat_id", newChatId);
            formData.append("message_id", messageData.id);

            // Trigger generation, no need to wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/message`, {
                method: 'POST',
                body: formData
            });

            // Reset states
            setActiveChat({
                ...activeChat,
                prompt: "",
                files: [],
                documents: []
            });

            router.push(`/class/${classId}/chat/${newChatId}`);
        } finally {
            setLoading(false);
        }
    }, [
        profile,
        chatId,
        classId,
        activeChat,
        router,
        getContextFiles,
        getContextDocuments,
        fileDocuments // Add fileDocuments if used inside
    ]);

    const handleChat = async () => {
        if (!activeChat.prompt.trim()) return;
        try {
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

    const handleFileDelete = () => {
        // close the window
        setViewerMode(prev => ({
            ...prev,
            active: false,
        }));
        // remove from context
        removeFileFromChat(viewerMode.fileId ?? "");
    };

    const handleOptionClick = useCallback((type: ChatType) => {
        setActiveChat(prev => ({
            ...prev,
            chatType: type,
        }));
    }, []);

    useEffect(() => {
        if (profile) {
            setActiveChat(prev => ({
                ...prev,
                title: studentMode ? "Office Hours" : "Chat",
                chatType: ((profile.admin || profile.professor) && !studentMode) ? 'professor' : 'student',
                teacher: ((profile.admin || profile.professor) && !studentMode),
            }));
        }
    }, [profile]);

    // Use the chatTitleUpdated prop to trigger animation when title changes
    useEffect(() => {
        if (chatTitleUpdated && existingChat) {
            setShouldAnimateTitle(true);
        }
    }, [chatTitleUpdated, existingChat]);

    // Add this function to handle chat selection
    const handleChatSelect = (selectedChatId: string) => {
        if (selectedChatId !== chatId) {
            router.push(`/class/${classId}/chat/${selectedChatId}`);
        }
    };

    // Add keyboard shortcuts
    useHotkeys([
        ['mod+M', () => {
            setViewerMode(prev => ({ ...prev, open: !prev.open }));
        }],
    ], []
    );

    return (
        <Container fluid>
            <Grid p={0}>
                <Grid.Col
                    span={isMobile ? 12 : viewerMode.open ? 8 : 12}
                    style={{
                        transition: 'width 300ms ease-in-out, flex 300ms ease-in-out',
                        position: 'relative', // Needed for absolute positioning
                    }}
                    p={0}
                >
                    <Card
                        h="calc(100vh - 75px)"
                        style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
                        p="xs"
                        bg="transparent"
                    >
                        {/* Show controls only when not in immersive mode */}
                        <Flex justify="space-between" align="center" mb={10}>
                            {isInitializing ? (
                                <>
                                    <Group gap="sm">
                                        <Skeleton height={28} width={200} radius="md" />
                                        <Skeleton height={22} width={80} radius="xl" />
                                    </Group>
                                    <Group gap="xs" ml="auto">
                                        <Skeleton height={36} width={36} radius="md" />
                                    </Group>
                                </>
                            ) : (
                                <>
                                    {/* Reduce gap further */}
                                    <Group gap={0} align="center"> 
                                        <Text size="xl" fw={700} mb={0}> 
                                            {existingChat ? (
                                                shouldAnimateTitle ? (
                                                    <TypeAnimation
                                                        key={`${existingChat.id}-${existingChat.name}-animate`}
                                                        sequence={[
                                                            existingChat.name || '',
                                                        ]}
                                                        wrapper="span"
                                                        cursor={false}
                                                        repeat={0}
                                                        speed={50}
                                                        preRenderFirstString={false}
                                                        style={{
                                                            fontSize: '1.25rem',
                                                            fontWeight: 700,
                                                            display: 'inline-block',
                                                        }}
                                                    />
                                                ) : (
                                                    <span style={{
                                                        fontSize: '1.25rem',
                                                        fontWeight: 700,
                                                        display: 'inline-block',
                                                    }}>
                                                        {existingChat.name}
                                                    </span>
                                                )
                                            ) : (
                                                activeChat.title
                                            )}
                                        </Text>
                                        {/* Moved ChatHistoryDropdown here */}
                                        <ChatHistoryDropdown
                                            currentChatId={chatId}
                                            onChatSelect={handleChatSelect}
                                            classId={classId}
                                        />
                                        {existingChat?.chat_type === "grade" && <Badge color="orange" variant="light">Grade</Badge>}
                                        {existingChat?.chat_type === "test" && <Badge color="cyan" variant="light">Test-Prep</Badge>}
                                        {existingChat?.chat_type === "homework" && <Badge color="indigo" variant="light">Homework</Badge>}
                                        {existingChat?.chat_type === "learn" && <Badge color="green" variant="light">Learn</Badge>}
                                        {existingChat?.chat_type === "figure" && <Badge color="grape" variant="light">Figure</Badge>}
                                        {existingChat?.chat_type === "summary" && <Badge color="yellow" variant="light">Summary</Badge>}
                                        {existingChat?.chat_type === "question" && <Badge color="blue" variant="light">Question</Badge>}
                                    </Group>
                                    <Group gap="xs" ml="auto">
                                        {chatId !== "new" && <Tooltip label="New chat">
                                            <ActionIcon
                                                variant="subtle"
                                                size="lg"
                                                aria-label="Start a new chat"
                                                onClick={() => router.push(`/class/${classId}/chat/new`)}
                                                mb={3}
                                            >
                                                <IconPlus size={20} />
                                            </ActionIcon>
                                        </Tooltip>}
                                        {/* Removed ChatHistoryDropdown from here */}
                                    </Group>
                                </>
                            )}
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
                            viewerMode={viewerMode}
                            activeChat={activeChat}
                            setActiveChat={setActiveChat}
                            loading={loading}
                            isInitializing={isInitializing}
                            classId={classId}
                            chatId={chatId}
                            onSend={handleChat}
                            onRemoveFile={removeFileFromChat}
                            onRemoveDocument={removeDocumentFromChat}
                            setViewerMode={setViewerMode}
                            files={files}
                            fileDocuments={fileDocuments} // Pass fetched fileDocuments
                            onAddFileContext={addFileToChat}
                            onAddDocumentContext={addDocumentToChat}
                            // Pass animation handler and state
                            onAnimateContextAdd={handleAnimateContextAdd}
                            isAnimating={isAnimating}
                        />
                        
                        {/* Add toggle button for context panel - only chevron visible */}
                        {!isMobile && (
                            <ActionIcon
                                variant="transparent"
                                color="blue"
                                radius="xl"
                                size="lg"
                                style={{
                                    position: 'absolute',
                                    right: -14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    zIndex: 1000,
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    width: 36,
                                    height: 36,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                              }}
                                onClick={() => setViewerMode(prev => ({ ...prev, open: !prev.open }))}
                                title={viewerMode.open ? "Close context panel" : "Open context panel"}
                            >
                                {viewerMode.open ? <IconChevronRight size={24} stroke={2.5} /> : <IconChevronLeft size={24} stroke={2.5} />}
                            </ActionIcon>
                        )}
                    </Card>
                </Grid.Col>
                <Grid.Col
                    span={isMobile ? 12 : 4}
                    style={{
                        display: (viewerMode.open) ? 'block' : 'none',
                        transition: 'width 300ms ease-in-out, flex 300ms ease-in-out',

                    }}
                    p={0}
                >
                    {viewerMode.active ? (
                        <ViewerPanel
                            viewerMode={viewerMode}
                            setViewerMode={setViewerMode}
                            addFileToChat={addFileToChat}
                            addDocumentToChat={addDocumentToChat}
                            classId={classId}
                            activeChat={activeChat}
                        />
                    ) : (
                        <ContextPanel
                            classId={classId}
                            searchQuery={contextSearchQuery}
                            setSearchQuery={setContextSearchQuery}
                            addFileToChat={addFileToChat}
                            addDocumentToChat={addDocumentToChat}
                            activeChat={activeChat}
                            makeDraggable={true}
                            viewerMode={viewerMode}
                            setViewerMode={setViewerMode}
                            onFileDelete={handleFileDelete}
                            isInitializing={isInitializing}
                            isAnimating={isAnimating}
                            animatingItemId={animatingItemId} // Pass the ID of item being animated
                        />
                    )}
                </Grid.Col>
            </Grid>
            <PageDetailsModal
                classId={classId}
                viewerMode={viewerMode}
                setViewerMode={setViewerMode}
            />
        </Container>
    );
}