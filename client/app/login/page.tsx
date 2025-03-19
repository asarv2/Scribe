/**
 * app/login/page.tsx
 * Will be where the professor logs in
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { Button, Center, Container, Divider, Input, Stack, Text, PasswordInput, Switch } from "@mantine/core"
import { useState } from "react"
import { notifications } from '@mantine/notifications';
import { login, createAnonymousUser, signInWithMicrosoft } from "@/utils/services/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HomeLayout } from "@/components/Home/HomeLayout";
import { getClasses } from "@/utils/queries/get-classes";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Class } from "@/types";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { checkEmail } from "@/utils/services/profile";
import MicrosoftIcon from "@/components/Icons/MicrosoftIcon";

export default function Login() {
    const supabase = useSupabaseBrowser()
    const queryClient = useQueryClient()
    const router = useRouter()

    const [lastName, setLastName] = useState("") // used for student login
    const [email, setEmail] = useState("") // used for both student and professor login
    const [password, setPassword] = useState("") // used for professor login
    const [loading, setLoading] = useState(false)
    const [microsoftButtonLoading, setMicrosoftButtonLoading] = useState(false)
    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    })

    const handleLogin = async () => {
        setLoading(true)
        try {
            // Professor login logic
            if (!email || !password) {
                throw new Error("Please enter email and password")
            }

            if (!email.endsWith("@purdue.edu")) {
                throw new Error("Please enter a valid Purdue email")
            }

            const { success, error, user } = await login(email, password)
            if (!success || !user) {
                throw new Error(error)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
                const profile = await getProfile(supabase, user.id)
                if (!profile) {
                    throw new Error("Profile not found")
                }
                const filteredClasses = classes?.filter((c: Class) => (profile.professor && profile.classes.includes(c.id)) || profile.admin)
                if (filteredClasses?.length === 0) {
                    throw new Error("No classes found")
                }
                const firstClass = filteredClasses?.[0]
                if (!firstClass) {
                    throw new Error("No classes found")
                }
                router.push(`/classes/c/${firstClass.id}`)
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

    const handleSignInWithMicrosoft = async () => {
        setMicrosoftButtonLoading(true);
        try {
            const { success, error, url } = await signInWithMicrosoft(`${window.location.origin}/auth/callback`);
            if (success && url) {
                router.push(url);
            } else {
                throw new Error(error);
            }
        } catch (error: any) {
            notifications.show({
                title: "Error",
                message: error.message,
                color: "red",
            });
        }
        setMicrosoftButtonLoading(false);
    }

    return (
        <HomeLayout>
            <Container fluid style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Center>
                    <Stack w={300} gap="md">
                        <Text size="xl">Login</Text>
                        <Input
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <PasswordInput
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button
                            color="teal"
                            onClick={handleLogin}
                            loading={loading}
                        >
                            Login
                        </Button>

                        <Divider />

                        <Button
                            onClick={handleSignInWithMicrosoft}
                            loading={microsoftButtonLoading}
                            variant="outline"
                            leftSection={
                                <MicrosoftIcon />
                            }
                            styles={{
                                root: {
                                    color: 'white',
                                    '&:hover': {
                                        backgroundColor: '#201F1F'
                                    }
                                }
                            }}
                        >
                            Login with Microsoft
                        </Button>
                    </Stack>
                </Center>
            </Container>
        </HomeLayout>
    )
}