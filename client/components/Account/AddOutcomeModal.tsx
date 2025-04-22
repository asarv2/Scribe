/**
 * AddOutcomeModal.tsx
 * Used for someone to add an outcome to a class
 * @AshokSaravanan222
 * 04/22/2025
 */

import { addOutcome } from "@/utils/services/outcome";
import { Modal, TextInput, Textarea, Group, Button, ActionIcon, Tooltip, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function AddOutcomeModal({classId}: {classId: string}) {
    const queryClient = useQueryClient();
    const [newTitle, setNewTitle] = useState("");
    const [opened, { open, close }] = useDisclosure();
    const [loading, setLoading] = useState(false);
    
    const handleAddOutcome = async () => {
        if (!newTitle.trim()) return;
        
        try {
            setLoading(true);
            const { success, error } = await addOutcome(classId, newTitle.trim());
            
            if (success) {
                notifications.show({
                    title: 'Success',
                    message: 'Outcome added successfully',
                    color: 'green',
                });
                queryClient.invalidateQueries({ queryKey: ["outcomes", classId] });
                setNewTitle("");
                close();
            } else {
                notifications.show({
                    title: 'Error',
                    message: error || 'Failed to add outcome',
                    color: 'red',
                });
            }
        } catch (error) {
            console.error(error);
            notifications.show({
                title: 'Error',
                message: 'An unexpected error occurred',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Tooltip label="Add new outcome">
                <ActionIcon
                    color="blue"
                    variant="filled"
                    onClick={open}
                >
                    <IconPlus size={16} />
                </ActionIcon>
            </Tooltip>

            <Modal
                opened={opened}
                onClose={close}
                title="Add Learning Outcome"
                centered
            >
                <Stack>
                    <TextInput
                        label="Title"
                        placeholder="Enter outcome title"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.currentTarget.value)}
                        required
                        disabled={loading}
                    />
                    <Group justify="flex-end" mt="md">
                        <Button variant="outline" onClick={close} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddOutcome}
                            loading={loading}
                            disabled={!newTitle.trim() || loading}
                        >
                            Add
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </>
    );
}