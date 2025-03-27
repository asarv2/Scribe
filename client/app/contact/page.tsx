/**
 * app/contact/page.tsx
 * This is a page where people can reach out for more contact information
 */

"use client";
import { Button, Container, Stack, TextInput, Textarea, Title } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { HomeLayout } from '@/components/Home/HomeLayout';
import { IconAt, IconUser } from '@tabler/icons-react';
import { submitContact } from '@/utils/services/contact';

export default function ContactPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Validate inputs
            if (!email.includes('@')) {
                throw new Error('Please enter a valid email address');
            }
            const { success, error } = await submitContact(name, email, message);

            if (!success) {
                throw new Error(error);
            }
            
            notifications.show({
                title: 'Message Sent',
                message: 'Thank you for reaching out! We\'ll get back to you soon.',
                color: 'green',
            });
            
            // Clear form
            setName('');
            setEmail('');
            setMessage('');
            
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: 'Error',
                message: error.message || 'An error occurred while sending your message. Please try again.',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <HomeLayout>
            <Container size="md" py="xl">
                <Stack gap="md">
                    <Title 
                        order={1} 
                        styles={(theme) => ({
                            root: {
                                fontSize: '2.5rem',
                                marginBottom: theme.spacing.xl,
                            }
                        })}
                    >
                        Contact Us
                    </Title>

                    <TextInput
                        label="Name"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                        leftSection={<IconUser size={16} />}
                        styles={(theme) => ({
                            label: {
                                fontSize: theme.fontSizes.md,
                                marginBottom: theme.spacing.xs,
                            }
                        })}
                    />

                    <TextInput
                        label="Email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.currentTarget.value)}
                        leftSection={<IconAt size={16} />}
                        styles={(theme) => ({
                            label: {
                                fontSize: theme.fontSizes.md,
                                marginBottom: theme.spacing.xs,
                            }
                        })}
                    />

                    <Textarea
                        label="Message"
                        placeholder="How can we help you?"
                        minRows={4}
                        value={message}
                        onChange={(e) => setMessage(e.currentTarget.value)}
                        styles={(theme) => ({
                            label: {
                                fontSize: theme.fontSizes.md,
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
                        Send Message
                    </Button>
                </Stack>
            </Container>
        </HomeLayout>
    );
}