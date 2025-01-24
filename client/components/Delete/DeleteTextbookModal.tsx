/**
 * DeleteLeactureModal.tsx
 * Modal to remove a lecture from the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Input, Modal, Stack, Text, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { User } from "@supabase/supabase-js"
import { IconPlus, IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { uploadLectureImages } from "@/utils/services/storage"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { isProfessor } from "@/utils/lecture/isProfessor"
import { deleteLecture } from "@/utils/services/lecture"
import { deleteTextbook } from "@/utils/services/textbook"

type DeleteTextbookModalProps = {
    classId: string
    textbookId: string
    textbookTitle: string
    user: User | undefined
}

export default function DeleteTextbookModal({ textbookId, user, textbookTitle, classId }: DeleteTextbookModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const handleDeleteClass = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteTextbook(textbookId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["textbook", textbookId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: ["textbooks", classId]
                });
                router.push(`/classes/${classId}`);
            }
            notifications.show({
                title: "Textbook deleted",
                message: "You have successfully deleted " + textbookTitle,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete textbook",
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
            {isProfessor(user, classId) && <Tooltip label="Delete Textbook"><IconTrash size={24} color="black" style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title="Delete Textbook" centered>
                <Stack>
                    <Text>Are you sure you want to remove {textbookTitle}?</Text>
                    <Button onClick={handleDeleteClass} loading={loading} color="red">Delete</Button>
                </Stack>
            </Modal>
        </>
    )
}