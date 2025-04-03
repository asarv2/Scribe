/**
 * FeedbackModal.tsx
 * 
 * This component is used to display a modal for feedback on the chat.
 * It is used to collect feedback from the user on the chat and the chatbot.
 * 
 * @AshokSaravanan222
 * 04-01-2025
 * 
 */

import { submitFeedback } from '@/utils/services/feedback';
import { Modal, Button, Text, Group, Rating, Tooltip, ActionIcon, Stack, Title, Textarea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconMessageCircle } from '@tabler/icons-react';
import { useState } from 'react';

export default function FeedbackModal() {
    const [opened, { open, close }] = useDisclosure(false);

    const [likes, setLikes] = useState('');
    const [dislikes, setDislikes] = useState('');
    const [wishlist, setWishlist] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const { success, error } = await submitFeedback(likes, dislikes, wishlist);
            if (success) {
                notifications.show({
                    title: 'Feedback Submitted',
                    message: 'Thank you for your feedback!',
                    color: 'green',
                });
                setLikes('');
                setDislikes('');
                setWishlist('');
            } else {
                throw new Error(error);
            }
        } catch (error) {
            console.error(error);
            notifications.show({
                title: 'Error',
                message: 'An error occurred while submitting your feedback. Please try again.',
                color: 'red',
            });
        } finally {
            setLoading(false);
            close();
        }
    };

    return (
        <>
            <Modal opened={opened} onClose={close} title="Help Us Improve Scribe" centered>
                <Stack gap="md">
                    <Text size="sm" c="dimmed" mb="xs">
                        Your feedback is completely anonymous and helps us improve Scribe.
                    </Text>
                    
                    <Textarea
                        label="What do you like about Scribe?"
                        placeholder="I really enjoy..."
                        minRows={4}
                        value={likes}
                        onChange={(e) => setLikes(e.currentTarget.value)}
                        styles={(theme) => ({
                            label: {
                                fontSize: theme.fontSizes.md,
                                marginBottom: theme.spacing.xs,
                            },
                            description: {
                                marginBottom: theme.spacing.xs,
                            }
                        })}
                    />

                    <Textarea
                        label="What could be improved?"
                        placeholder="I think it would be better if..."
                        minRows={4}
                        value={dislikes}
                        onChange={(e) => setDislikes(e.currentTarget.value)}
                        styles={(theme) => ({
                            label: {
                                fontSize: theme.fontSizes.md,
                                marginBottom: theme.spacing.xs,
                            },
                            description: {
                                marginBottom: theme.spacing.xs,
                            }
                        })}
                    />

                    <Textarea
                        label="What features would you like to see?"
                        placeholder="It would be great to have..."
                        minRows={4}
                        value={wishlist}
                        onChange={(e) => setWishlist(e.currentTarget.value)}
                        styles={(theme) => ({
                            label: {
                                fontSize: theme.fontSizes.md,
                                marginBottom: theme.spacing.xs,
                            },
                            description: {
                                marginBottom: theme.spacing.xs,
                            }
                        })}
                    />

                    <Button
                        onClick={handleSubmit}
                        loading={loading}
                        styles={(theme) => ({
                            root: {
                                marginTop: theme.spacing.md,
                                width: '200px',
                            }
                        })}
                    >
                        Submit Feedback
                    </Button>
                </Stack>
            </Modal>

            <Tooltip label="Feedback">
                <ActionIcon
                    variant="subtle"
                    aria-label="Feedback"
                    onClick={open}
                >
                    <IconMessageCircle size={24} />
                </ActionIcon>
            </Tooltip>
        </>
    );
}
