/**
 * DeleteGenerationModal.tsx
 * Modal to remove a generation from the mindmap
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
import { deleteGeneration } from "@/utils/services/generation"

type DeleteGenerationModalProps = {
    classId: string
    generationId: string
    generationTitle: string
    user: User | undefined
    type: "summary" | "problems"
}

export default function DeleteGenerationModal({ generationId, user, generationTitle, classId, type }: DeleteGenerationModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const handleDeleteClass = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteGeneration(generationId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: [type === "summary" ? "generationSummaries" : "generationProblems", classId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: [type === "summary" ? "summariesGenerations" : "problemsGenerations", classId]
                });
                router.push(`/classes/${classId}/generate/${type === "summary" ? "summary" : "problems"}`);
            }
            notifications.show({
                title: "Generation deleted",
                message: "You have successfully deleted " + generationTitle,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete generation",
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
            {isProfessor(user, classId) && <Tooltip label="Delete Generation"><IconTrash size={24} color="black" style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title="Delete Generation" centered>
                <Stack>
                    <Text>Are you sure you want to remove {generationTitle}?</Text>
                    <Button onClick={handleDeleteClass} loading={loading} color="red">Delete</Button>
                </Stack>
            </Modal>
        </>
    )
}