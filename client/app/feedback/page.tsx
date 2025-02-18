/**
 * app/feedback/page.tsx
 * This page is used to display the feedback, with 3 things:
 * 1. what they like about the site
 * 2. what they don't like about the site
 * 3. feature they wish were here
 */
"use client";
import { Button, Container, Stack, Textarea, Title } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { submitFeedback } from '@/utils/services/feedback';
import { GeneralLayout } from '@/components/General/GeneralLayout';

export default function FeedbackPage() {
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
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack p="xl">
                    <Title order={1}>Share Your Feedback</Title>

                    <Textarea
                        label="What do you like about Scribe?"
                        placeholder="Tell us what you enjoy..."
                        minRows={3}
                        value={likes}
                        onChange={(e) => setLikes(e.currentTarget.value)}
                    />

                    <Textarea
                        label="What don't you like about Scribe?"
                        placeholder="Tell us what could be improved..."
                        minRows={3}
                        value={dislikes}
                        onChange={(e) => setDislikes(e.currentTarget.value)}
                    />
    
                    <Textarea
                        label="What features do you wish were on Scribe?"
                        placeholder="Tell us what features you'd like to see..."
                        minRows={3}
                        value={wishlist}
                        onChange={(e) => setWishlist(e.currentTarget.value)}
                    />

                    <Button onClick={handleSubmit} loading={loading}>
                        Submit
                    </Button>
                </Stack>
            </Container>
        </GeneralLayout>
    );
}