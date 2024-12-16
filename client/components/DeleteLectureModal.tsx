/**
 * DeleteLeactureModal.tsx
 * Modal to remove a lecture from the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Modal, Stack, Text, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { User } from "@supabase/supabase-js"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { deleteSlide } from "@/utils/services/lecture"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { isProfessor } from "@/utils/lecture/isProfessor"

type DeleteLectureModalProps = {
    classId: string
    slideId: string
    slideTitle: string
    user: User | undefined
}

export default function DeleteLectureModal({ slideId, user, slideTitle, classId }: DeleteLectureModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const handleDeleteClass = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteSlide(slideId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["slide", slideId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: ["slides", classId]
                });
                router.push(`/classes/${classId}`);
            }
            notifications.show({
                title: "Lecture deleted",
                message: "You have successfully deleted " + slideTitle,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete lecture",
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
            {isProfessor(user, classId) && <Tooltip label="Delete Lecture"><IconTrash size={24} color="black" style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title="Delete Lecture" centered>
                <Stack>
                    <Text>Are you sure you want to remove {slideTitle}?</Text>
                    <Button onClick={handleDeleteClass} loading={loading} color="red">Delete</Button>
                </Stack>
            </Modal>
        </>
    )
}