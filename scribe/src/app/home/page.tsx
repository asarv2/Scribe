/**
 * app/home/page.tsx
 * The home page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { HeaderSimple } from "@/components/HeaderSimple";
import { AspectRatio, Box, Button, Center, Group, Input, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { createQuestion } from "../../../utils/services/question";
import { notifications } from '@mantine/notifications';

export default function Home() {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState("");

    const handleClick = async () => {
        setLoading(true);
        try {
            if (!value) {
                throw new Error("Please enter a question");
            }
            const response = await createQuestion(value);
            if (!response) {
                throw new Error("Failed to get response");
            }
            setResponse(response);
            notifications.show({
                title: "Question asked",
                message: "Your question has been answered",
                color: "blue",
            })
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to ask question",
                message: error.message,
                color: "red",
            })
        } finally {
            setLoading(false);
            setValue("");
        }
    }


    return (
        <>
            <HeaderSimple />
            <Box p={30}>
                <Stack>
                    <Text fw={700}>Lecture Video 1</Text>
                    <AspectRatio ratio={16 / 9}>
                        <video controls width="300" height="300">
                            <source type="video/mp4" src="/videos/community.mp4" />
                        </video>
                    </AspectRatio>
                    <Text>Enter your question</Text>
                    <Input size="md" radius="md" placeholder="Your question here..." value={value} onChange={(e) => {
                        setValue(e.currentTarget.value);
                    }} disabled={loading} />
                    <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleClick}>Ask Question</Button>
                    <Text>Response: {response}</Text>
                </Stack>
            </Box>
        </>
    );
}