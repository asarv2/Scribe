/**
 * app/feedback/page.tsx
 * This page is used to display the feedback, with 3 things:
 * 1. what they like about the site
 * 2. what they don't like about the site
 * 3. feature they wish were here
 */
"use client";
import { Button, Container, Stack, Textarea, Title, useMantineColorScheme } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { submitFeedback } from '@/utils/services/feedback';
import { GeneralLayout } from '@/components/General/GeneralLayout';

export default function FeedbackPage() {
    const [likes, setLikes] = useState('');
    const [dislikes, setDislikes] = useState('');
    const [wishlist, setWishlist] = useState('');
    const [loading, setLoading] = useState(false);

    const { colorScheme } = useMantineColorScheme();

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
        }
    };

    return (
        <GeneralLayout>
            <Container size="md" py="xl">
                <Stack gap="md">
                    <Title 
                        order={1} 
                        styles={(theme) => ({
                            root: {
                                fontSize: '2.5rem',
                                marginBottom: theme.spacing.xl,
                                color: colorScheme === 'dark' ? theme.white : theme.black,
                            }
                        })}
                    >
                        Help Us Improve Scribe
                    </Title>

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
            </Container>
        </GeneralLayout>
    );
}