/**
 * app/login/page.tsx
 * Will be where the professor logs in
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"
import Login from "@/components/Login/Login";
import { Suspense } from "react";
import { Center, Loader } from "@mantine/core";

export default function LoginPage() {
    return (
        <Suspense fallback={
            <Center style={{ height: '100vh' }}>
                <Loader size="lg" />
            </Center>
        }>
            <Login />
        </Suspense>
    )
}