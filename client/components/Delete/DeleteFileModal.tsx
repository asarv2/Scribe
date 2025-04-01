/**
 * DeleteFileModal.tsx
 * Modal to remove a file from the mindmap
 * @AshokSaravanan222
 * 03-28-2025
 */
import { ActionIcon, Button, Input, Modal, Stack, Text, Tooltip, useMantineColorScheme } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Profile } from "@/types"
import { deleteFile } from "@/utils/services/file"

type DeleteFileModalProps = {
    classId: string
    fileId: string
    fileName: string
    navigateHome?: boolean
    profileId: string
    onDelete?: () => void
}

export default function DeleteFileModal({ fileId, fileName, classId, navigateHome = true, onDelete, profileId }: DeleteFileModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter()

    const handleDeleteClass = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        setLoading(true);
        try {
            const { success, error } = await deleteFile(fileId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["file", fileId]
                });
                queryClient.invalidateQueries({
                    queryKey: ["files", profileId, classId]
                });
                if (onDelete) {
                    onDelete();
                }
                if (navigateHome) {
                    router.push(`/classes/c/${classId}`);
                }
            }
            notifications.show({
                title: "File deleted",
                message: "You have successfully deleted " + fileName,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete file",
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
            <Tooltip label="Delete File">
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    color="red"
                    onClick={(e) => {
                        e.stopPropagation();
                        open();
                    }}
                >
                    <IconTrash size={20} />
                </ActionIcon>
            </Tooltip>
            <Modal 
                opened={opened} 
                onClose={() => {
                    close();
                }} 
                title="Delete File" 
                centered
                onClick={(e) => e.stopPropagation()}
            >
                <Stack>
                    <Text>Are you sure you want to remove {fileName}?</Text>
                    <Button 
                        onClick={(e) => handleDeleteClass(e)} 
                        loading={loading} 
                        color="red"
                    >
                        Delete
                    </Button>
                </Stack>
            </Modal>
        </>
    )
}