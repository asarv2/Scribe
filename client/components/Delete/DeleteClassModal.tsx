/**
 * DeleteClassModal.tsx
 * Used to delete a class
 * @AshokSaravanan222
 * 04-08-2025
 */

import { Modal, Button, Text, Stack, Group, Tooltip, ActionIcon } from "@mantine/core";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { deleteClass } from "@/utils/services/class";
import { IconTrash } from "@tabler/icons-react";

export default function DeleteClassModal({ classId }: { classId: string }) {
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const queryClient = useQueryClient();

    const handleDeleteClass = async () => {
        setDeleteLoading(true);
        try {
            const { success, error } = await deleteClass(classId);

            if (!success) {
                throw new Error(error);
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            notifications.show({
                title: 'Success',
                message: 'Class deleted successfully',
                color: 'green'
            });
            setDeleteModalOpen(false);
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setDeleteLoading(false);
        }
    };

    return <>
        <Tooltip label="Delete Class">
            <ActionIcon
                variant="subtle"
                size="lg"
                color="red"
                onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModalOpen(true);
                }}
            >
                <IconTrash size={20} />
            </ActionIcon>
        </Tooltip>
        <Modal
            opened={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            title="Delete Class"
            size="sm"
        >
            <Stack>
                <Text size="sm">
                    Are you sure you want to delete this class? This action cannot be undone.
                </Text>
                <Group justify="flex-end">
                    <Button
                        variant="subtle"
                        onClick={() => setDeleteModalOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="red"
                        loading={deleteLoading}
                        onClick={handleDeleteClass}
                    >
                        Delete
                    </Button>
                </Group>
            </Stack>
        </Modal>
    </>
}