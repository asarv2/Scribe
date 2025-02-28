/**
 * app/login/student/page.tsx
 * Will be where the student logs in
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

    const [codeValid, setCodeValid] = useState(false)
    const [codeData, setCodeData] = useState<Code | null>(null)
    const [errorText, setErrorText] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    })


    const handleCheckCode = async () => {
        setLoading(true)
        setErrorText("")
        setCodeValid(false)
        try {
            // Login logic here
            if (!code) {
                throw new Error("Please enter code")
            }

            const { success, error, code: codeData } = await checkCode(code)
            if (!success) {
                throw new Error(error)
            } else {
                setCodeValid(true)
                setCodeData(codeData)
            }

            notifications.show({
                title: 'Success',
                message: 'The code is valid',
                color: 'green',
            });

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

    const handleCreateAnonymousUser = async () => {
        setLoading(true)
        try {
            if (!codeData) {
                throw new Error("Could not find any classes for this code")
            }

            // Validate Purdue email
            if (!email.endsWith('@purdue.edu')) {
                throw new Error("Please use a valid Purdue email address")
            }

            // Validate all fields are filled
            if (!firstName || !lastName || !email) {
                throw new Error("Please fill in all fields")
            }

            const { success: emailSuccess, error: emailError, profile: emailProfile } = await checkEmail(email)
            if (!emailSuccess) {
                throw new Error(emailError)
            }
            // we will create a new profile if they do not exist, or otherwise, update their existing profile
            const { success, error, user } = await createAnonymousUser(firstName, lastName, email, Array.from(new Set([...emailProfile?.classes ?? [], ...codeData.classes])), emailProfile?.id ?? undefined)
            if (!success) {
                throw new Error(error)
            } else if (emailProfile) {
                notifications.show({
                    title: 'Success',
                    message: `Welcome back, ${emailProfile.first_name}!`,
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
            router.push(`/classes/c/${firstClass.id}`)

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
            <Container fluid style={{ marginTop: "30px" }}>
                <Center>
                    <Stack>
                        <Text size="xl">Student Login</Text>
                        {codeValid ? (
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
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <Text size="xs" c="dimmed">Please use your Purdue email address</Text>
                                <Button
                                    color="teal"
                                    onClick={handleCreateAnonymousUser}
                                    loading={loading}
                                >
                                    Create Account
                                </Button>
                            </Stack>
                        ) : (
                            <Stack>
                                <Input
                                    placeholder="Enter Code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                                <Button
                                    color="teal"
                                    onClick={handleCheckCode}
                                    loading={loading}
                                >
                                    Submit
                                </Button>
                            </Stack>
                        )}
                        {errorText && <Text color="red">{errorText}</Text>}
                        <Divider />
                        <Link href="/login" style={{ width: "100%" }}>
                            <Button color="blue" style={{ width: "100%" }}>
                                I'm a Professor
                            </Button>
                        </Link>
                    </Stack>
                </Center>
            </Container>
        </HomeLayout >
    )
}