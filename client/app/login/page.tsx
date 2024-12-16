/**
 * app/login/page.tsx
 * Will be where the professor logs in
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { HeaderSimple } from "@/components/HeaderSimple"
import { Button, Center, Container, Input, Stack, Text } from "@mantine/core"
import { useState } from "react"
import { notifications } from '@mantine/notifications';
import { login, logout } from "@/utils/services/auth";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";

export default function Login() {

    const queryClient = useQueryClient()
    const supabase = useSupabaseBrowser();

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)


    const handleLogin = async () => {
        setLoading(true)
        try {
            // Login logic here
            if (!email || !password) {
                throw new Error("Please enter email and password")
            }

            if (!email.endsWith("@purdue.edu")) {
                throw new Error("Please enter a valid Purdue email")
            }

            const { success, error } = await login(email, password)
            if (!success) {
                throw new Error(error)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
            }

            notifications.show({
                title: 'Success',
                message: 'Logged in',
                color: 'green',
            });

        } catch (e: any) {
            console.error(e)
            notifications.show({
                title: 'Error',
                message: e.message,
                color: 'red',
            });
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            // Logout logic here
            const { success, error } = await logout()
            if (!success) {
                throw new Error(error)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
            }

            notifications.show({
                title: 'Success',
                message: 'Logged out',
                color: 'green',
            });

        } catch (e: any) {
            console.error(e)
            notifications.show({
                title: 'Error',
                message: e.message,
                color: 'red',
            });
        } finally {
            setLoading(false)
        }
    }

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })



    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Center key={String(loadingUser)}>
                    {user ? <Stack>
                        <Text>Logged in as {user.email}</Text>
                        <Button color="red" onClick={handleLogout} loading={loading}>Logout</Button>
                    </Stack> : <Stack>
                        <Text size="xl">Professor Login</Text>
                        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <Input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <Button color="teal" onClick={handleLogin} loading={loading}>Login</Button>
                    </Stack>}
                </Center>
            </Container>
        </>
    )
}