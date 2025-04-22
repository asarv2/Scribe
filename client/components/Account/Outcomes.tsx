/**
 * Outcomes.tsx
 * Used to show the learning outcomes for a class
 * @AshokSaravanan222
 * 2025-04-22
 */

import { useState } from "react";
import { 
  Button, Modal, Paper, Text, Textarea, Card, Group, 
  ActionIcon, Tooltip, TextInput, Stack, Title, Box,
  Skeleton
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOutcomes } from "@/utils/queries/get-outcomes";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { addOutcome, updateOutcome, deleteOutcome } from "@/utils/services/outcome";
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import { notifications } from '@mantine/notifications';

export default function Outcomes({ classId }: { classId: string }) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingOutcome, setEditingOutcome] = useState<{id: string, title: string, description: string} | null>(null);
    const [loading, setLoading] = useState(false);

    const {data: outcomes, isLoading} = useQuery({
        queryKey: ["outcomes", classId],
        queryFn: () => getOutcomes(supabase, classId)
    });

    const handleUpdateOutcome = async () => {
        if (!editingOutcome || !editingOutcome.title.trim()) return;
        
        try {
            setLoading(true);
            const { success, error } = await updateOutcome(
                editingOutcome.id, 
                editingOutcome.title.trim(), 
                editingOutcome.description || ""
            );
            
            if (success) {
                notifications.show({
                    title: 'Success',
                    message: 'Outcome updated successfully',
                    color: 'green',
                });
                queryClient.invalidateQueries({ queryKey: ["outcomes", classId] });
                setEditingOutcome(null);
                setEditModalOpen(false);
            } else {
                notifications.show({
                    title: 'Error',
                    message: error || 'Failed to update outcome',
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

    const handleDeleteOutcome = async (outcomeId: string) => {
        try {
            setLoading(true);
            const { success, error } = await deleteOutcome(outcomeId);
            
            if (success) {
                notifications.show({
                    title: 'Success',
                    message: 'Outcome deleted successfully',
                    color: 'green',
                });
                queryClient.invalidateQueries({ queryKey: ["outcomes", classId] });
            } else {
                notifications.show({
                    title: 'Error',
                    message: error || 'Failed to delete outcome',
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

    // Render loading skeletons
    if (isLoading) {
        return (
            <Paper p="md" withBorder mt="md">
                <Stack gap="md">
                    <Skeleton height={40} width="200px" />
                    {[1, 2, 3].map((i) => (
                        <Card key={i} shadow="sm" p="md" withBorder>
                            <Group justify="space-between" wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    <Skeleton height={20} width="70%" mb={10} />
                                    <Skeleton height={15} width="90%" />
                                    <Skeleton height={15} width="50%" mt={5} />
                                </Box>
                                <Group gap="xs">
                                    <Skeleton height={28} width={28} radius="sm" />
                                    <Skeleton height={28} width={28} radius="sm" />
                                </Group>
                            </Group>
                        </Card>
                    ))}
                </Stack>
            </Paper>
        );
    }

    return (
        <Paper p="md" withBorder mt="md">
            {outcomes && outcomes.length > 0 ? (
                <Stack gap="md">
                    {outcomes.map((outcome) => (
                        <Card key={outcome.id} shadow="sm" p="md" withBorder>
                            <Group justify="space-between" wrap="nowrap">
                                <Box style={{ flex: 1 }}>
                                    <Text fw={500}>{outcome.title}</Text>
                                    {outcome.description && (
                                        <Text size="sm" color="dimmed" mt="xs">
                                            {outcome.description}
                                        </Text>
                                    )}
                                </Box>
                                <Group gap="xs">
                                    <Tooltip label="Edit outcome">
                                        <ActionIcon 
                                            color="blue" 
                                            onClick={() => {
                                                setEditingOutcome({
                                                    id: outcome.id,
                                                    title: outcome.title || "",
                                                    description: outcome.description || ""
                                                });
                                                setEditModalOpen(true);
                                            }}
                                        >
                                            <IconEdit size={16} />
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Delete outcome">
                                        <ActionIcon 
                                            color="red" 
                                            onClick={() => handleDeleteOutcome(outcome.id)}
                                            loading={loading}
                                        >
                                            <IconTrash size={16} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Group>
                            </Group>
                        </Card>
                    ))}
                </Stack>
            ) : (
                <Text c="dimmed" ta="center" py="xl">
                    No learning outcomes yet. Add your first one!
                </Text>
            )}

            {/* Edit Outcome Modal */}
            <Modal
                opened={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                title="Edit Learning Outcome"
                centered
            >
                {editingOutcome && (
                    <Stack>
                        <TextInput
                            label="Title"
                            placeholder="Enter outcome title"
                            value={editingOutcome.title}
                            onChange={(e) => setEditingOutcome({
                                ...editingOutcome,
                                title: e.currentTarget.value
                            })}
                            required
                        />
                        <Textarea
                            label="Description (optional)"
                            placeholder="Enter outcome description"
                            value={editingOutcome.description}
                            onChange={(e) => setEditingOutcome({
                                ...editingOutcome,
                                description: e.currentTarget.value
                            })}
                            minRows={3}
                        />
                        <Group justify="flex-end" mt="md">
                            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleUpdateOutcome} 
                                loading={loading}
                                disabled={!editingOutcome.title.trim()}
                            >
                                Save
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Paper>
    );
}
