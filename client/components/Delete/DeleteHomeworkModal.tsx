/**
 * DeleteHomeworkModal.tsx
 * Modal to remove a homework from the mindmap
 * @AshokSaravanan222
 * 02-26-2025
 */

import { Button, Modal, Stack, Text, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Profile } from "@/types"
import { deleteHomework } from "@/utils/services/homework"

type DeleteHomeworkModalProps = {
    classId: string
    homeworkId: string
    homeworkTitle: string
    profile: Profile | undefined
    navigateHome?: boolean
}

export default function DeleteHomeworkModal({ homeworkId, profile, homeworkTitle, classId, navigateHome = true }: DeleteHomeworkModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const handleDeleteClass = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteHomework(homeworkId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["homework", homeworkId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: ["homeworks", classId]
                });
                if (navigateHome) {
                    router.push(`/classes/c/${classId}`);
                }
            }
            notifications.show({
                title: "Homework deleted",
                message: "You have successfully deleted " + homeworkTitle,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete homework",
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
            {profile && (profile.professor || profile.admin) && <Tooltip label="Delete Homework"><IconTrash size={24} style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title="Delete Homework" centered>
                <Stack>
                    <Text>Are you sure you want to remove {homeworkTitle}?</Text>
                    <Button onClick={handleDeleteClass} loading={loading} color="red">Delete</Button>
                </Stack>
            </Modal>
        </>
    )
}