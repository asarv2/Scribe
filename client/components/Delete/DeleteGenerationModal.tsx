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
import { deleteGeneration } from "@/utils/services/generation"
import { GenerationType, Profile } from "@/types"
type DeleteGenerationModalProps = {
    classId: string
    generationId: string
    generationTitle: string
    profile: Profile | undefined
    type: GenerationType
}

export default function DeleteGenerationModal({ generationId, profile, generationTitle, classId, type }: DeleteGenerationModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const { colorScheme } = useMantineColorScheme();

    const handleDeleteProblem = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteGeneration(generationId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["generationProblems", classId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: ["problemGenerations", classId]
                });
                router.push(`/classes/${classId}/generate`);
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

    const handleDeleteChat = async () => {
        setLoading(true);
        try {
            const { success, error } = await deleteGeneration(generationId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["generationChats", classId]
                });
                queryClient.invalidateQueries({ 
                    queryKey: ["chatGenerations", classId]
                });
                router.push(`/classes/${classId}/chat`);
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
            {profile && isProfessor(profile, classId) && <Tooltip label="Delete Generation"><IconTrash size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} onClick={open} /></Tooltip>}

            <Modal opened={opened} onClose={close} title="Delete Generation" centered>
                <Stack>
                    <Text>Are you sure you want to remove {generationTitle}?</Text>
                    {type === "problem" && <Button onClick={handleDeleteProblem} loading={loading} color="red">Delete</Button>}
                    {type === "chat" && <Button onClick={handleDeleteChat} loading={loading} color="red">Delete</Button>}
                </Stack>
            </Modal>
        </>
    )
}