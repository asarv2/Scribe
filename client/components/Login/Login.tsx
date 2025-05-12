/**
 * Login.tsx
 * Used for the login page, since we need to check the query params for the class code
 * @AshokSaravanan222
 * 04-17-2025
 */

import { Button, Center, Container, Divider, Input, Stack, Text, PasswordInput, Switch, useMantineColorScheme, useComputedColorScheme, Paper, Group, Anchor } from "@mantine/core"
import { useState } from "react"
import { notifications } from '@mantine/notifications';
import { login, createAnonymousUser, signInWithMicrosoft } from "@/utils/services/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HomeLayout } from "@/components/Home/HomeLayout";
import { getClasses } from "@/utils/queries/get-classes";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Class, Profile } from "@/types";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { checkEmail, updateProfile } from "@/utils/services/profile";
import MicrosoftIcon from "@/components/Icons/MicrosoftIcon";
import MicrosoftLoginButton from "@/components/Buttons/MicrosoftLoginButton";
import Image from "next/image";
import { checkCode } from "@/utils/services/code";

export default function Login() {
    const supabase = useSupabaseBrowser()
    const queryClient = useQueryClient()
    const router = useRouter()
    const [email, setEmail] = useState("") // used for both student and professor login
    const [password, setPassword] = useState("") // used for professor login
    const [loading, setLoading] = useState(false)
    const [processingCode, setProcessingCode] = useState(false)
    const searchParams = useSearchParams()
    const classCode = searchParams.get("code")


    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    })

    // Function to handle joining a class with a code
    const handleJoinClass = async (userId: string, profile: Profile) => {
        if (!classCode) return null
        
        try {
            setProcessingCode(true)
            const { success, error, code } = await checkCode(classCode)
            
            if (!success || !code) {
                throw new Error(error)
            } else {
                // Add class to profile if not admin
                if (!profile.admin) {
                    const { success: profileSuccess, error: profileError } = await updateProfile(profile.id, {
                        classes: Array.from(new Set([...profile.classes, code.class]))
                    })
                    
                    if (!profileSuccess) {
                        throw new Error(profileError)
                    }
                }
                
                queryClient.invalidateQueries({ queryKey: ["classes"] })
                queryClient.invalidateQueries({ queryKey: ["profile"] })
                
                notifications.show({
                    title: 'Success',
                    message: 'Class joined successfully',
                    color: 'green'
                })
                
                return code.class
            }
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            })
            return null
        } finally {
            setProcessingCode(false)
        }
    }

    const handleLogin = async () => {
        setLoading(true)
        try {
            // Professor login logic
            if (!email || !password) {
                throw new Error("Please enter email and password")
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
                
                // If we have a class code in the URL, try to join that class
                let joinedClassId = null
                if (classCode) {
                    joinedClassId = await handleJoinClass(user.id, profile)
                }
                
                // If we joined a class, navigate to it
                if (joinedClassId) {
                    const suffix = (profile.professor || profile.admin) ? joinedClassId : `${joinedClassId}/chat/new`
                    router.push(`/class/${suffix}`)
                    return
                }
                
                // Otherwise, navigate to the first class as before
                const filteredClasses = classes?.filter((c: Class) => (profile.classes.includes(c.id) || profile.admin))
                const firstClass = filteredClasses?.[0]
                const firstClassId = firstClass?.id
                const firstClassSuffix = (profile.professor || profile.admin) ? firstClassId : `${firstClassId}/chat/new`;
                if (firstClass) {
                    router.push(`/class/${firstClassSuffix}`)
                }
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

    return (
        <HomeLayout>
            <Container size="xs" style={{ height: '70vh', display: 'flex', alignItems: 'center' }}>
                <Paper radius="md" p="xl" withBorder shadow="md" w="100%">
                    <Group align="center" justify="center">
                        <Image src="/icon.png" alt="Logo" width={60} height={60} unoptimized />
                        <Text size="xl" fw={500}>Scribe Login</Text>
                    </Group>
                    <Group grow mb="md" mt="md">
                        <MicrosoftLoginButton code={classCode} />
                        <MicrosoftLoginButton professor code={classCode} />
                    </Group>

                    <Divider label="Or login as admin" labelPosition="center" my="lg" />

                    <Stack>
                        <Input
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            radius="md"
                        />
                        <PasswordInput
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            radius="md"
                        />
                        <Button
                            onClick={handleLogin}
                            loading={loading}
                            radius="md"
                        >
                            Login
                        </Button>
                    </Stack>
                </Paper>
            </Container>
        </HomeLayout>
    )
}