/**
 * Login.tsx
 * This will be used for the professor/admin to login and view courses
 * @AshokSaravanan222
 * 03/05/2025
 */
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Button, Stack, Text, Input, PasswordInput, Switch, Divider } from "@mantine/core"
import type { User } from "~node_modules/@supabase/supabase-js/dist/module";
import { sendToBackground } from "@plasmohq/messaging";
import { Icons } from "./Icons";
export default function Login() {
    const queryClient = useQueryClient()
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [microsoftButtonLoading, setMicrosoftButtonLoading] = useState(false);

    const handleSignInWithMicrosoft = async () => {
        setMicrosoftButtonLoading(true);
        try {
            const response = await sendToBackground<
                {},
                { success: boolean; error: string; session: any | null }
            >({
                name: "microsoft-login",
                body: {}
            });
            
            if (response.success && response.session) {
                console.log("Microsoft login successful:", response.session);
                // Update your app state with the session
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["classes"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["lectures"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["textbooks"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["homeworks"]
                });
            } else {
                throw new Error(response.error || "Microsoft login failed");
            }
        } catch (error) {
            console.error("Microsoft login error:", error);
        } finally {
            setMicrosoftButtonLoading(false);
        }
    }
    

    const handleLogin = async () => {
        setLoading(true);
        try {
            // Professor login logic
            if (!email || !password) {
                throw new Error("Please enter email and password");
            }

            // if (!email.endsWith("@purdue.edu")) {
            //     throw new Error("Please enter a valid Purdue email");
            // }

            console.log("Sending login request...");
            const response = await sendToBackground<
                { email: string; password: string },
                { success: boolean; error: string; user: User | null }
            >({
                name: "login",
                body: { email, password }
            });

            console.log("Login response received:", response.success);

            if (!response.success || !response.user) {
                throw new Error(response.error || "Login failed");
            } else {
                console.log("Login successful, invalidating queries");
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["profile"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["classes"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["lectures"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["textbooks"]
                });
                queryClient.invalidateQueries({
                    queryKey: ["homeworks"]
                });
            }
        } catch (e: any) {
            console.error("Login error:", e);
            // Add error notification here
        } finally {
            setLoading(false);
        }
    }

    return (
        <Stack>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Text size="xl">Login</Text>
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
            <Divider />
            <Button
                onClick={handleSignInWithMicrosoft}
                loading={microsoftButtonLoading}
                variant="outline"
                leftSection={
                    <Icons.Microsoft />
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
    )
}