/**
 * app/login/student/page.tsx
 * Will be where the student logs in
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { HeaderSimple } from "@/components/HeaderSimple"
import { Button, Center, Container, Divider, Input, Stack, Text } from "@mantine/core"
import { useState } from "react"
import { notifications } from '@mantine/notifications';
import { login, logout, createAnonymousUser, checkCode } from "@/utils/services/auth";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code } from "@/types";
export default function Login() {

    const queryClient = useQueryClient()
    const supabase = useSupabaseBrowser();
    const router = useRouter()

    const [code, setCode] = useState("")
    const [loading, setLoading] = useState(false)

    const [codeValid, setCodeValid] = useState(false)
    const [codeData, setCodeData] = useState<Code | null>(null)
    const [errorText, setErrorText] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")


    const handleCheckCode = async () => {
        setLoading(true)
        setErrorText("")
        setCodeValid(false)
        try {
            // Login logic here
            if (!code) {
                throw new Error("Please enter code")
            }

            if (code.length !== 6) {
                throw new Error("Please enter a valid code")
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

    const handleCreateAnonymousUser = async () => {
        setLoading(true)
        try {
            if (!codeData) {
                throw new Error("Could not find any classes for this code")
            }
            const { success, error } = await createAnonymousUser(firstName, lastName, codeData.classes)
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
            <Container fluid style={{ marginTop: "30px" }}>
                <Center key={String(loadingUser)}>
                    {user ? <Stack>
                        <Text>Logged in as {user.email}</Text>
                        <Button color="red" onClick={handleLogout} loading={loading}>Logout</Button>
                    </Stack> : <Stack>
                        <Text size="xl">Student Login</Text>
                        {codeValid ? <Stack>
                            <Input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                            <Input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                            <Button color="teal" onClick={handleCreateAnonymousUser} loading={loading}>Create Account</Button>
                        </Stack> : <Stack>
                            <Input placeholder="Enter Code" value={code} onChange={(e) => setCode(e.target.value)} />
                            <Button color="teal" onClick={handleCheckCode} loading={loading}>Submit</Button>
                        </Stack>}
                        {errorText && <Text color="red">{errorText}</Text>}
                        <Divider />
                        <Link href="/login" style={{ width: "100%" }}>
                            <Button color="blue" style={{ width: "100%" }}>I'm a Professor</Button>
                        </Link>
                    </Stack>}
                </Center>
            </Container>
        </>
    )
}