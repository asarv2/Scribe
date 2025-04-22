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
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { ContentType, File, Profile } from "@/types"
import { deleteFile } from "@/utils/services/file"
import { getFile } from "@/utils/queries/get-file"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { getUser } from "@/utils/queries/get-user"
import { getProfile } from "@/utils/queries/get-profile"
import { useStudentMode } from "../StudentModeContext"

type DeleteFileModalProps = {
    classId: string
    fileId: string
    onDelete?: () => void
}

export default function DeleteFileModal({ fileId, classId, onDelete }: DeleteFileModalProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const { studentMode } = useStudentMode();

    // User and profile data
    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user?.id ?? ""),
        enabled: !!user
    });

    const { data: file, isLoading: fileLoading } = useQuery({
        queryKey: ["file", fileId],
        queryFn: () => getFile(supabase, fileId)
    })

    const handleDeleteFile = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        if (!file) {
            notifications.show({
                title: "File not found",
                message: "The file you are trying to delete does not exist",
                color: "red",
            })
            return;
        }

        setLoading(true);
        try {
            const { success, error } = await deleteFile(classId, fileId);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["file", fileId]
                });
                queryClient.invalidateQueries({
                    queryKey: ["files", classId]
                });
            }
            if (onDelete) {
                onDelete();
            }
            notifications.show({
                title: "File deleted",
                message: "You have successfully deleted " + file.title,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to delete " + file.title,
                message: error.message,
                color: "red",
            })
        } finally {
            setLoading(false);
            close();
        }
    }

    const getDeleteMessage = (file: File) => {
        switch (file.content_type) {
            case 'lecture':
                return `Delete Lecture`
            case 'homework':
                return `Delete Homework`
            case 'rubric':
                return `Delete Rubric`
            case 'textbook':
                return `Delete Textbook`
            default:
                return `Delete File`
        }
    }

    return file && profile && ((profile.admin || profile.professor) && !studentMode) && (
        <>
            <Tooltip label={getDeleteMessage(file)}>
                <ActionIcon
                    size="lg"
                    variant="subtle"
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
                    <Text>Are you sure you want to remove {file.title}?</Text>
                    <Button
                        onClick={(e) => handleDeleteFile(e)}
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