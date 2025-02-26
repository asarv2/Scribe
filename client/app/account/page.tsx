/**
 * app/account/page.tsx
 * This page is used to manage the user's account. It allows the user to change their password and logout.
 * @AshokSaravanan222
 * 02-14-2025
 */
"use client";
import { ProfilePage } from "@/components/Profile";
import { getProfile } from "@/utils/queries/get-profile";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/get-user";
import { logout } from "@/utils/services/auth";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Container, Center, Stack, Text } from "@mantine/core";
import { ClassLayout } from "@/components/Class/ClassLayout";

export default function AccountPage() {
    const supabase = useSupabaseBrowser();


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
        <ClassLayout classId={null}>
            <Container fluid style={{ marginTop: "30px" }}>
                {user && profile ? <ProfilePage user={user} profile={profile} /> :
                    <Center>
                        <Stack>
                            <Text size="xl">Account</Text>
                        </Stack>
                    </Center>
                }
            </Container>
        </ClassLayout>
    )



}
