/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 */

// Ensure necessary Mantine components are imported, remove Paper if not used elsewhere
import { Text, Card, Stack, Group, Grid, Badge, Modal, ActionIcon, Avatar, useMantineColorScheme, Skeleton, Rating, Menu, Button, Tooltip, Box, useMantineTheme } from "@mantine/core"; // Added useMantineTheme if not already there
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
// Updated icon imports
import { IconPlus, IconArrowBarLeft, IconArrowBarToRight } from "@tabler/icons-react";
import { useEffect, useState, useCallback } from "react"; // Added back useState, useEffect, useCallback
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFavicon, useHotkeys, useMediaQuery } from "@mantine/hooks"; // Removed useHotkeys if only used for toggle
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
// Removed animation-related imports if no longer needed elsewhere
// import { CONTENT_COLORS, File as SupabaseFile, Document as SupabaseDocument } from "@/types";
// import ItemCard from "../ItemCard"; // Re-import ItemCard
// import classes from './ChatCanvas.module.css'; // Import the CSS module
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
        open: true, // Added back the 'open' property as it's required
        showPageDetails: false,
    });
    const [loading, setLoading] = useState(false);
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
        // not using previous messages, since we are tracking a combined history in the chat
        // const previousMessagesFiles = messages?.flatMap(message =>
        //     // Check if references exists and is an array before accessing
        //     Array.isArray(message.files) ? message.files : []
        // ) ?? [];
        const allFiles = Array.from(new Set([...(activeChat.files ?? [])]));
        return allFiles;

    }

    const getContextDocuments = () => {
        // not using previous messages, since we are tracking a combined history in the chat
        // const previousMessagesDocuments = messages?.flatMap(message =>
        //     Array.isArray(message.documents) ? message.documents : []
        // ) ?? [];
        const allDocuments = Array.from(new Set([...(activeChat.documents ?? [])]));
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

            // find the last message of the chat
            const lastMessage = messages?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const startAgent = lastMessage?.end_agent ?? "general";

            // Create the message
            const newMessage = {
                chat: newChatId,
                class: classId,
                profile: profileId,
                bare_question: activeChat.prompt,
                question: activeChat.prompt,
                files: getContextFiles(),
                documents: getContextDocuments(),
                start_agent: startAgent
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
            // open: true, // Removed setting open state
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
            const isTeacherView = (profile.admin || profile.professor) && !studentMode;
            setActiveChat(prev => ({
                ...prev,
                // Only reset title/type if it's a new chat or if the mode fundamentally changes the default
                title: chatId === "new" ? (isTeacherView ? "Chat" : "Office Hours") : prev.title,
                chatType: chatId === "new" ? (isTeacherView ? 'professor' : 'student') : prev.chatType, // Keep existing type for existing chats unless logic dictates otherwise
                teacher: isTeacherView,
            }));
        }
    }, [profile, studentMode, chatId]); // Add studentMode and chatId to dependency array

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

    const theme = useMantineTheme(); // Ensure theme is available
    const { colorScheme } = useMantineColorScheme(); // Get color scheme
    const [isContextPanelOpen, setIsContextPanelOpen] = useState(true); // State for context panel

    return (
        <Container fluid p={0}> {/* Ensure no padding on the main container */}
            <Grid p={0}
            >
                <Grid.Col
                    // Adjust span: use 'auto' when context is closed on desktop
                    span={isMobile ? 12 : isContextPanelOpen ? 9 : 'auto'} 
                    style={{
                        transition: 'all 300ms ease-in-out',
                        position: 'relative',
                        height: 'calc(100vh - 75px)',
                        flex: '1 1 auto', // Allow this column to grow and fill available space
                        width: isMobile ? undefined : isContextPanelOpen ? undefined : 'calc(100% - 60px)',
                    }}
                    p={0}
                >
                    <Card
                        h="100%"
                        style={{
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '8px',
                            overflow: 'hidden',
                        }}
                        p={0}
                        bg="transparent"
                    >
                        {/* Header Flex */}
                        <Flex justify="space-between" align="center" h={46} p="xs" style={{ 
                            flexShrink: 0, 
                            // Removed borderBottom style
                        }}>
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
                                        <Text size="xl" fw={700} mb={0}> {/* Title Style */}
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

                        <Box p="xs" style={{ 
                            flexShrink: 0,
                            // Removed borderTop style
                        }}> {/* Added borderTop for better visual separation */}
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
                                fileDocuments={fileDocuments}
                                onAddFileContext={addFileToChat}
                                onAddDocumentContext={addDocumentToChat}
                            />
                        </Box>

                    </Card>

                </Grid.Col>
                <Grid.Col
                    // Fixed width column with right alignment
                    span={isMobile ? 12 : 'content'} 
                    style={{
                        transition: 'width 300ms ease-in-out',
                        padding: 0,
                        display: 'flex', // Use flexbox for column layout
                        flexDirection: 'column', // Stack header and content vertically
                        height: 'calc(100vh - 75px)', // Explicit height for the column
                        width: isMobile ? undefined : isContextPanelOpen ? '25%' : '60px',
                        minWidth: isMobile ? undefined : isContextPanelOpen ? '250px' : '60px',
                        maxWidth: isMobile ? undefined : isContextPanelOpen ? '400px' : '60px',
                        position: 'relative',
                    }}
                >
                    {/* Context Header Box */}
                    <Box
                        style={{
                            height: 46,
                            width: '100%', // Full width of the parent column
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end', // Keep icon to the right
                            padding: `0 ${theme.spacing.xs}`, // Consistent horizontal padding
                            flexShrink: 0, // Prevent header from shrinking vertically
                            backgroundColor: colorScheme === 'dark' ? theme.colors.dark[7] : theme.white,
                            overflow: 'hidden',
                            position: 'relative', // Allow absolute positioning within
                        }}
                    >
                        {/* Fixed position toggle button */}
                        <ActionIcon
                            variant="transparent"
                            onClick={() => setIsContextPanelOpen((o) => !o)}
                            size="lg"
                            style={{
                                width: 36, 
                                height: 36, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                position: 'absolute', // Fixed position
                                // Adjust 'right' based on panel state for visual stability
                                right: isContextPanelOpen ? theme.spacing.xs : `${(60 - 36) / 2}px`, 
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 2,
                            }}
                            aria-label={isContextPanelOpen ? "Hide Context" : "Show Context"}
                        >
                            {isContextPanelOpen ? <IconArrowBarToRight size={25} /> : <IconArrowBarLeft size={25} />}
                        </ActionIcon>
                    </Box>

                    {/* Content Area Box */}
                    <Box style={{ 
                        flex: 1, 
                        overflow: 'hidden',
                        width: '100%',
                        visibility: isContextPanelOpen ? 'visible' : 'hidden', // Hide content when closed
                        opacity: isContextPanelOpen ? 1 : 0,
                        transition: 'opacity 200ms ease-in-out',
                    }}>
                        {isContextPanelOpen && (
                            viewerMode.active ? (
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
                                />
                            )
                        )}
                    </Box>
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