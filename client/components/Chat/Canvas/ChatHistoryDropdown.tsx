import { getChats } from "@/utils/queries/get-chats";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Menu, ActionIcon, ScrollArea, Group, Text, Avatar, Stack, Tooltip } from "@mantine/core";
import { IconHistory } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getMessages } from "@/utils/queries/get-messages";
import { format } from "date-fns";
import { getFiles } from "@/utils/queries/get-files";
import { getDocuments } from "@/utils/queries/get-documents";
import { getFileDocuments } from "@/utils/queries/get-file-docs";

interface ChatHistoryDropdownProps {
    currentChatId: string;
    onChatSelect: (chatId: string) => void;
    classId: string;
}

function ChatHistoryDropdown({ currentChatId, onChatSelect, classId }: ChatHistoryDropdownProps) {
    const router = useRouter();
    const supabase = useSupabaseBrowser();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
        enabled: !!supabase
    })

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    })

    // Filter out current chat and sort by most recent
    const { data: userChats, isLoading: loadingUserChats } = useQuery({
        queryKey: ["userChats", classId, profile?.id],
        queryFn: () => getChats(supabase, classId, [profile!.id]),
        enabled: !!profile
    })

    // Get messages for all chats to extract context for images
    const { data: messages } = useQuery({
        queryKey: ["allChatMessages", userChats?.map(c => c.id)],
        queryFn: () => getMessages(supabase, userChats?.map(c => c.id) || []),
        enabled: !!userChats && userChats.length > 0
    })

    // Get files and documents for image references
    const { data: files } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
        enabled: !!messages && messages.length > 0
    })

    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", files?.map(f => f.id) || []],
        queryFn: () => getFileDocuments(supabase, files?.map(f => f.id) || []),
        enabled: !!files && files.length > 0
    })

    // Helper function to get image URL for a chat
    const getChatImageUrl = (chatId: string): string => {
        if (!messages || !files || !fileDocuments) return '/placeholder_image.svg';

        // Get all messages for this chat
        const chatMessages = messages.filter(m => m.chat === chatId);
        if (chatMessages.length === 0) return '/placeholder_image.svg';

        const references = Array.from(new Set(chatMessages.flatMap(m => m.references)));

        for (const reference of references) {
            const document = fileDocuments.find(d => d.id === reference);
            if (document) {
                return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${document.file}/${document.id}.png`;
            }
        }
        // Default placeholder
        return '/placeholder_image.svg';
    };

    const formatDate = (dateString: string): string => {
        try {
            return format(new Date(dateString), 'MMM d, yyyy'); // e.g., "Apr 29, 2023"
        } catch (error) {
            return dateString;
        }
    };

    const otherChats = userChats
        ?.filter(chat => chat.id !== currentChatId && chat.id !== "new")
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // // If no other chats, don't show the dropdown
    // if (otherChats?.length === 0) return null;

    return (
        <Menu position="bottom-start" shadow="md">
            <Menu.Target>
                <Tooltip label="History">
                    <ActionIcon variant="subtle" size="lg" aria-label="View chat history">
                        <IconHistory size={20} />
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>

            <Menu.Dropdown>
                <Menu.Label>Previous Chats</Menu.Label>
                <ScrollArea h={otherChats && otherChats.length > 5 ? 300 : undefined} scrollbarSize={8}>
                    {otherChats?.slice(0, 10).map(chat => (
                        <Menu.Item
                            key={chat.id}
                            onClick={() => onChatSelect(chat.id)}
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
    );
}

export default ChatHistoryDropdown;