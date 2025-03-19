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
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getLectures } from "@/utils/queries/get-lectures";
import { getChapters } from "@/utils/queries/get-chapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapterDocuments } from "@/utils/queries/get-chapter-docs";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";

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

    const {data: lectures} = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId]),
        enabled: !!classId
    })

    const {data: textbooks} = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId]),
        enabled: !!classId
    })

    const {data: chapters} = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    })

    const {data: homeworks} = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId]),
        enabled: !!classId
    })

    const {data: lectureDocuments} = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    })

    const {data: textbookDocuments} = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    })

    const {data: chapterDocuments} = useQuery({
        queryKey: ["chapterDocuments", classId],
        queryFn: () => getChapterDocuments(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    })

    const {data: homeworkDocuments} = useQuery({
        queryKey: ["homeworkDocuments", classId],
        queryFn: () => getHomeworkDocuments(supabase, homeworks!.map(h => h.id)),
        enabled: !!homeworks
    })

    // Helper function to get image URL for a chat
    const getChatImageUrl = (chatId: string): string => {
        if (!messages) return '/placeholder_image.svg';
        
        // Get all messages for this chat
        const chatMessages = messages.filter(m => m.chat === chatId);
        if (chatMessages.length === 0) return '/placeholder_image.svg';

        // Try to find a lecture image
        for (const message of chatMessages) {
            if (message.lectures && message.lectures.length > 0) {
                const lectureId = message.lectures[0];
                const lecture = lectures?.find(l => l.id === lectureId);
                if (lecture && lectureDocuments) {
                    const document = lectureDocuments.find(d => d.lecture === lectureId);
                    if (document) {
                        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${lectureId}/${document.id}.png`;
                    }
                }
            }
        }
        
        // Try to find a chapter image
        for (const message of chatMessages) {
            if (message.chapters && message.chapters.length > 0) {
                const chapterId = message.chapters[0];
                const chapter = chapters?.find(c => c.id === chapterId);
                if (chapter && textbookDocuments) {
                    const filteredDocuments = textbookDocuments.filter(
                        document => document.page >= chapter.start_page && document.page <= chapter.end_page && document.chapter === chapterId
                    );
                    if (filteredDocuments.length > 0) {
                        const document = filteredDocuments[0];
                        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${chapter.textbook}/${document.id}.png`;
                    }
                }
            }
        }
        
        // Try to find a homework image
        for (const message of chatMessages) {
            if (message.homeworks && message.homeworks.length > 0) {
                const homeworkId = message.homeworks[0];
                // Find the first exercise in the homework
                const exercise = homeworkDocuments?.find(e => e.homework === homeworkId);
                if (exercise) {
                    // Find textbook document that references this homework
                    const textbookDocumentHomework = textbookDocuments?.find(d => 
                        d.homeworks && d.homeworks.includes(homeworkId)
                    );
                    if (textbookDocumentHomework) {
                        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentHomework.textbook}/${textbookDocumentHomework.id}.png`;
                    }
                    // Return the exercise image
                    return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`;
                }
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
    
    // If no other chats, don't show the dropdown
    if (otherChats?.length === 0) return null;
    
    return (
        <Menu position="bottom-start" shadow="md">
            <Menu.Target>
                <Tooltip label="History">
                    <ActionIcon variant="subtle" size="md" aria-label="View chat history">
                        <IconHistory size={18} />
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
                                    <Text size="sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
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