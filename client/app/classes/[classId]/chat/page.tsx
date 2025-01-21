/**
 * app/classes/[classId]/chat/index.tsx
 * 
 * This page is the chat page for a class. Could be piazza, ed discussion, etc.
 */
"use client"

import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Stack, Text, Button, Input } from "@mantine/core";
import { useState } from "react";
import { notifications } from "@mantine/notifications";


export default function ChatPage({ classId }: { classId: string }) {
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const login = async () => {
        setIsLoading(true);
        try {
            const P = require('piazza-api');
            const user = await P.login(username, password);
            setDisplayName(user.name);
            setUsername("");
            setPassword("");
            notifications.show({
                title: "Logged in",
                message: "You are logged in as " + user.name,
                color: "green",
            });
        } catch (error: any) {
            notifications.show({
                title: "Failed to login",
                message: error.message,
                color: "red",
            });
        } finally {
            setIsLoading(false);
        }
    }

    
    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Text size="xl" fw={700} mb={6} pl={4}>Chat</Text>
                    <Text>
                        {displayName ? `Logged in as ${displayName}` : "Not logged in"}
                    </Text>
                    <Input placeholder="Username" value={username} onChange={(e: any) => setUsername(e.target.value)} />
                    <Input placeholder="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} />
                    <Button onClick={login} loading={isLoading}>Login</Button>
                </Stack>
            </Container>
        </>
    );
}