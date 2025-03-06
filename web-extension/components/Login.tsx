/**
 * Login.tsx
 * This will be used for the professor/admin to login and view courses
 * @AshokSaravanan222
 * 03/05/2025
 */
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button, Stack, Text, Input, PasswordInput, Switch } from "@mantine/core"
import type { User } from "~node_modules/@supabase/supabase-js/dist/module";
import { sendToBackground } from "@plasmohq/messaging";
export default function Login() {
    const queryClient = useQueryClient()
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

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

            const {success, error, user} = await sendToBackground<{ email: string, password: string }, { success: boolean, error: string, user: User | null }>({
                name: "login",
                body: { email, password }
            })

            if (!success || !user) {
                throw new Error(error)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["classes"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["lectures"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["textbooks"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["homeworks"]
                })
                
                
            }

        } catch (e: any) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Stack>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Text size="xl">Professor Login</Text>
            </div>

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
        </Stack>
    )
}