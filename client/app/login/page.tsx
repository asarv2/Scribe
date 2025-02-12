/**
 * app/login/page.tsx
 * Will be where the professor logs in
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { HeaderSimple } from "@/components/HeaderSimple"
import { Button, Center, Container, Divider, Input, Stack, Text, PasswordInput } from "@mantine/core"
import { useState } from "react"
import { notifications } from '@mantine/notifications';
import { login, logout } from "@/utils/services/auth";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProfile } from "@/utils/queries/get-profile";
import { ProfilePage } from "@/components/Profile";

export default function Login() {

    const queryClient = useQueryClient()
    const supabase = useSupabaseBrowser();
    const router = useRouter()

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
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                })
                router.push("/")
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
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                })
                throw new Error(error)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                })
                router.push("/")
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

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })





    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <div key={String(loadingUser)}>
                    {user && profile ? <ProfilePage user={user} profile={profile} handleLogout={handleLogout} loading={loading} /> :
                        <Center>
                            <Stack>
                                <Text size="xl">Professor Login</Text>
                                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                <PasswordInput placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                <Button color="teal" onClick={handleLogin} loading={loading}>Login</Button>
                                <Divider />
                                <Link href="/login/student" style={{ width: "100%" }}>
                                    <Button color="blue" style={{ width: "100%" }}>I'm a Student</Button>
                                </Link>
                            </Stack>
                        </Center>
                    }
                </div>
            </Container>
        </>
    )
}