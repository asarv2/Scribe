/**
 * DeleteGenerationModal.tsx
 * Modal to remove a generation from the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Modal, Stack, Text, Tooltip, useMantineColorScheme } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { isProfessor } from "@/utils/services/auth"
import { Profile } from "@/types"
import { deleteChat } from "@/utils/services/chat"
type DeleteChatModalProps = {
    classId: string
    chatId: string
    chatTitle: string
    profile: Profile | undefined
}

export default function DeleteChatModal({ chatId, profile, chatTitle, classId }: DeleteChatModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const { colorScheme } = useMantineColorScheme();

    const handleDeleteChat = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteChat(chatId);
            if (!success) { 
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["chat", chatId]
                });
                router.push(`/classes/c/${classId}/chat`);
            }
            notifications.show({
                title: "Chat deleted",
                message: "You have successfully deleted " + chatTitle,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete chat",
                message: error.message,
                color: "red",
            })
        } finally {
            setLoading(false);
            close();
        }

    }

    return (
        <>
            {profile && isProfessor(profile, classId) && <Tooltip label={"Delete Chat"}>
                <IconTrash size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} onClick={open} />
            </Tooltip>}

            <Modal opened={opened} onClose={close} title={"Delete Chat"} centered>
                <Stack>
                    <Text>Are you sure you want to remove {chatTitle}?</Text>
                    <Button onClick={handleDeleteChat} loading={loading} color="red">Delete</Button>
                </Stack>
            </Modal>
        </>
    )
}