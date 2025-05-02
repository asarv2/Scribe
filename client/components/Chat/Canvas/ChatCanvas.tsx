/**
 * ChatCanvas.tsx
 * This component is for chatting with the AI.
 */

// Ensure necessary Mantine components are imported, remove Paper if not used elsewhere
import { Text, Card, Stack, Group, Grid, Badge, Modal, ActionIcon, Avatar, useMantineColorScheme, Skeleton, Rating, Menu, Button, Tooltip, Box, useMantineTheme, ScrollArea } from "@mantine/core"; // Added useMantineTheme if not already there
import { useRouter } from "next/navigation";
import { Container, Flex } from "@mantine/core";
// Updated icon imports
import { IconPlus, IconArrowBarLeft, IconArrowBarToRight, IconEdit, IconChevronDown, IconArrowBarRight } from "@tabler/icons-react";
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

import { AgentType, ChatMessage, ViewerMode } from "@/types";
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
import { getChats } from "@/utils/queries/get-chats";
import { format } from "date-fns";

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

    // Get other chats for the dropdown
    const { data: userChats } = useQuery({
        queryKey: ["userChats", classId, profile?.id],
        queryFn: () => getChats(supabase, classId, [profile!.id]),
        enabled: !!profile
    });

    // Format date helper function
    const formatDate = (dateString: string): string => {
        try {
            return format(new Date(dateString), 'MMM d, yyyy');
        } catch (error) {
            return dateString;
        }
    };

    // Get chat image URL helper function
    const getChatImageUrl = (chatId: string): string => {
        if (!messages || !files || !fileDocuments) return '/placeholder_image.svg';

        // Get all messages for this chat
        const chatMessages = messages.filter(m => m.chat === chatId);
        if (chatMessages.length === 0) return '/placeholder_image.svg';

        const references = Array.from(new Set(chatMessages.flatMap(m => m.references || [])));

        for (const reference of references) {
            const document = fileDocuments?.find(d => d.id === reference);
            if (document) {
                return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${document.file}/${document.id}.png`;
            }
        }
        // Default placeholder
        return '/placeholder_image.svg';
    };

    // Filter and sort chats
    const otherChats = userChats
        ?.filter(chat => chat.id !== chatId && chat.id !== "new")
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const [activeChat, setActiveChat] = useState<ChatMessage>({
        id: 1,
        title: "Office Hours",
        prompt: "",
        files: [],
        documents: [],
        agentType: 'learn',
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
                documents: getContextDocuments(),
                start_agent: activeChat.agentType
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
            setActiveChat(prev => ({
                ...prev,
                prompt: "",
                files: [],
                documents: []
            }));

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

    const handleOptionClick = useCallback((type: AgentType) => {
        setActiveChat(prev => ({
            ...prev,
            agentType: type,
        }));
    }, []);

    useEffect(() => {
        if (profile) {
            const isTeacherView = (profile.admin || profile.professor) && !studentMode;
            setActiveChat(prev => ({
                ...prev,
                // Only reset title/type if it's a new chat or if the mode fundamentally changes the default
                title: chatId === "new" ? (isTeacherView ? "Chat" : "Office Hours") : prev.title,
                teacher: isTeacherView,
                agentType: isTeacherView ? 'content' : 'learn',
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

    const [menuOpened, setMenuOpened] = useState(false);

    // ... existing code ...

    useEffect(() => {
        if (messages && messages.length > 0 && existingChat) {
            // Sort messages by created_at in descending order to get the latest one
            const sortedMessages = [...messages].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            // Get the latest message
            const latestMessage = sortedMessages[0];

            // If the latest message has an end_agent, use it to set the agent type
            if (latestMessage.end_agent) {
                setActiveChat(prev => ({
                    ...prev,
                    agentType: latestMessage.end_agent
                }));
            } else if (latestMessage.start_agent) {
                // If end_agent isn't available yet but start_agent is, use that
                setActiveChat(prev => ({
                    ...prev,
                    agentType: latestMessage.start_agent
                }));
            }
        }
    }, [messages, existingChat]);

    return (
        <Container fluid pb={0} pt={0} pl={"xs"} pr={"xs"}> {/* Ensure no padding on the main container */}
            <Grid p={0}
            >
                <Grid.Col
                    // Adjust span: use 'auto' when context is closed on desktop
                    span={isMobile ? 12 : viewerMode.open ? 9 : 'auto'}
                    style={{
                        transition: 'all 300ms ease-in-out',
                        position: 'relative',
                        height: 'calc(100vh - 75px)',
                        flex: '1 1 auto', // Allow this column to grow and fill available space
                        width: isMobile ? undefined : viewerMode.open ? undefined : 'calc(100% - 60px)',
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
                                        <Menu
                                            position="bottom-start"
                                            shadow="md"
                                            opened={menuOpened}
                                            onChange={setMenuOpened}
                                            trigger="click-hover"
                                        >
                                            <Menu.Target>
                                                <Box
                                                    style={{
                                                        cursor: 'pointer',
                                                        opacity: menuOpened ? 0.8 : 1,
                                                        transition: 'opacity 150ms ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        '&:hover': { opacity: 0.8 }
                                                    }}
                                                >
                                                    <Text size="xl" fw={700} mb={0} component="span"> {/* Title Style */}
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
                                                    <IconChevronDown size={18} style={{ marginTop: '2px' }} />
                                                </Box>
                                            </Menu.Target>

                                            <Menu.Dropdown>
                                                <Menu.Label>Previous Chats</Menu.Label>
                                                <ScrollArea h={otherChats && otherChats.length > 5 ? 300 : undefined} scrollbarSize={8}>
                                                    {otherChats?.slice(0, 10).map(chat => (
                                                        <Menu.Item
                                                            key={chat.id}
                                                            onClick={() => handleChatSelect(chat.id)}
                                                        >
                                                            <Group>
                                                                <Avatar
                                                                    src={getChatImageUrl(chat.id)}
                                                                    size="sm"
                                                                    radius="sm"
                                                                />
                                                                <Stack gap={0} w={250}>
                                                                    <Text size="sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                        {chat.name || `Chat ${chat.id.substring(0, 6)}`}
                                                                    </Text>
                                                                    <Text size="xs" c="dimmed">
                                                                        {formatDate(chat.created_at)}
                                                                    </Text>
                                                                </Stack>
                                                            </Group>
                                                        </Menu.Item>
                                                    ))}
                                                </ScrollArea>
                                            </Menu.Dropdown>
                                        </Menu>
                                    </Group>
                                    <Group gap="xs" ml="auto">
                                        {viewerMode.open ? <Tooltip label="Close Context">
                                            <ActionIcon
                                                variant="subtle"
                                                size="lg"
                                                aria-label="Close Context"
                                                onClick={() => setViewerMode(prev => ({ ...prev, open: false }))}
                                                mb={3}
                                            >
                                                <IconArrowBarRight size={20} />
                                            </ActionIcon>
                                        </Tooltip> : <Tooltip label="Open Context">
                                            <ActionIcon
                                                variant="subtle"
                                                size="lg"
                                                aria-label="Open Context"
                                                onClick={() => setViewerMode(prev => ({ ...prev, open: true }))}
                                                mb={3}
                                            >
                                                <IconArrowBarLeft size={20} />
                                            </ActionIcon>
                                        </Tooltip>}
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
                                messages={messages}
                            />
                        </Box>

                    </Card>

                </Grid.Col>
                <Grid.Col
                    // Fixed width column with right alignment
                    span={isMobile ? 12 : viewerMode.open ? 3 : 0}
                    style={{
                        transition: 'width 300ms ease-in-out',
                        padding: 0,
                        display: 'flex', // Use flexbox for column layout
                        flexDirection: 'column', // Stack header and content vertically
                        height: 'calc(100vh - 75px)', // Explicit height for the column
                        position: 'relative',
                    }}
                >
                    {/* <Box
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
                    </Box> */}

                    {/* Content Area Box */}
                    <Box style={{
                        flex: 1,
                        overflow: 'hidden',
                        width: '100%',
                        visibility: viewerMode.open ? 'visible' : 'hidden', // Hide content when closed
                        opacity: viewerMode.open ? 1 : 0,
                        transition: 'opacity 200ms ease-in-out',
                        paddingTop: 2
                    }}>
                        {viewerMode.open && (
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