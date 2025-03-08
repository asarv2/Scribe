/**
 * app/signup/page.tsx
 * Will be where the student signs up
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { Button, Center, Container, Divider, Input, Stack, Text } from "@mantine/core"
import { useState } from "react"
import { notifications } from '@mantine/notifications';
import { login, logout, createAnonymousUser } from "@/utils/services/auth";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Class, Code } from "@/types";
import { HomeLayout } from "@/components/Home/HomeLayout";
import { getClasses } from "@/utils/queries/get-classes";
import { getProfile } from "@/utils/queries/get-profile";
import { checkCode } from "@/utils/services/code";
import { checkEmail, updateClasses } from "@/utils/services/profile";
import { User } from "@supabase/supabase-js";
export default function Login() {
    const supabase = useSupabaseBrowser()
    const queryClient = useQueryClient()
    const router = useRouter()

    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)
    const [errorText, setErrorText] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    })

    const handleSignup = async () => {
        setLoading(true)
        setErrorText("")
        
        try {
            // Validate all fields are filled
            if (!firstName || !lastName || !email || !code) {
                throw new Error("Please fill in all fields")
            }

            // Validate Purdue email
            if (!email.endsWith('@purdue.edu')) {
                throw new Error("Please use a valid Purdue email address")
            }

            // Check if code is valid
            const { success: codeSuccess, error: codeError, code: codeData } = await checkCode(code)
            if (!codeSuccess) {
                throw new Error(codeError || "Invalid class code")
            }

            // Check email
            const { success: emailSuccess, error: emailError, profile: emailProfile } = await checkEmail(email)
            if (!emailSuccess) {
                throw new Error(emailError)
            }

            // Create or update user
            const { success, error, user } = await createAnonymousUser(
                firstName, 
                lastName, 
                email, 
                Array.from(new Set([...emailProfile?.classes ?? [], ...codeData?.classes ?? []])), 
                emailProfile?.id ?? undefined
            )
            
            if (!success) {
                throw new Error(error)
            } else if (emailProfile) {
                notifications.show({
                    title: 'Success',
                    message: `Welcome back, ${emailProfile.first_name}!`,
                    color: 'green',
                });
            } else {
                notifications.show({
                    title: 'Success',
                    message: 'Account created successfully!',
                    color: 'green',
                });
            }

            queryClient.invalidateQueries({
                queryKey: ["user"]
            })
            
            if (!user) {
                throw new Error("User not found")
            }
            
            const profile = await getProfile(supabase, user.id)
            if (!profile) {
                throw new Error("Profile not found")
            }
            
            const filteredClasses = classes?.filter((c: Class) => profile.classes.includes(c.id))
            if (filteredClasses?.length === 0) {
                throw new Error("No classes found")
            }
            
            const firstClass = filteredClasses?.[0]
            if (!firstClass) {
                throw new Error("No classes found")
            }
            
            router.push(`/classes/c/${firstClass.id}/chat/new`)

        } catch (e: any) {
            console.error(e)
            notifications.show({
                title: 'Error',
                message: e.message,
                color: 'red',
            });
            setErrorText(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <HomeLayout>
            <Container fluid style={{ marginTop: "30px" }}>
                <Center>
                    <Stack>
                        <Text size="xl">Create an Account</Text>
                        <Stack>
                            <Input
                                placeholder="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                            />
                            <Input
                                placeholder="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                            />
                            <Input
                                type="email"
                                placeholder="Purdue Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <Input
                                placeholder="Class Code"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                            <Button
                                color="teal"
                                onClick={handleSignup}
                                loading={loading}
                            >
                                Signup
                            </Button>
                        </Stack>
                        {errorText && <Text c="red">{errorText}</Text>}
                        <Divider />
                        <Link href="/login" style={{ width: "100%" }}>
                            <Button color="blue" style={{ width: "100%" }}>
                                I already have an account
                            </Button>
                        </Link>
                    </Stack>
                </Center>
            </Container>
        </HomeLayout>
    )
} 