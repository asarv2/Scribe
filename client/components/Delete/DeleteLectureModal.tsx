/**
 * DeleteLeactureModal.tsx
 * Modal to remove a lecture from the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Input, Modal, Stack, Text, Tooltip, useMantineColorScheme } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { deleteLecture } from "@/utils/services/lecture"
import { Profile } from "@/types"
import { isProfessor } from "@/utils/services/auth"

type DeleteLectureModalProps = {
    classId: string
    lectureId: string
    lectureTitle: string
    profile: Profile | undefined
}

export default function DeleteLectureModal({ lectureId, profile, lectureTitle, classId }: DeleteLectureModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const { colorScheme } = useMantineColorScheme();

    const handleDeleteClass = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteLecture(lectureId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["lecture", lectureId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: ["lectures", classId]
                });
                router.push(`/classes/${classId}`);
            }
            notifications.show({
                title: "Lecture deleted",
                message: "You have successfully deleted " + lectureTitle,
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
            {profile && isProfessor(profile, classId) && <Tooltip label="Delete Lecture"><IconTrash size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title="Delete Lecture" centered>
                <Stack>
                    <Text>Are you sure you want to remove {lectureTitle}?</Text>
                    <Button onClick={handleDeleteClass} loading={loading} color="red">Delete</Button>
                </Stack>
            </Modal>
        </>
    )
}