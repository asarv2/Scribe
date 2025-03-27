/**
 * app/classes/page.tsx
 * 
 * This page is the main page for the classes.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */
"use client";

import { GeneralLayout } from "@/components/General/GeneralLayout";
import { Container, Stack, Text, SimpleGrid, Card, Group, Button, Skeleton, Loader, Center } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { getUser } from "@/utils/queries/get-user";
import Image from "next/image";
import Link from "next/link";
import { getProfile } from "@/utils/queries/get-profile";
import { getCourseImageUrl } from "@/utils/services/images";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { redirect } from "next/navigation";
import { HomeLayout } from "@/components/Home/HomeLayout";

export default function ClassesPage() {
    const supabase = useSupabaseBrowser();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classes, isLoading: loadingClasses } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    const getFilteredClasses = () => {
        if (!profile || !classes) return [];
        return profile.admin ? classes : classes?.filter(classItem => profile.classes?.includes(classItem.id));
    }

    if (profile) {
        const filteredClasses = getFilteredClasses();
        if (filteredClasses.length > 0) {
            if (profile.professor || profile.admin) {
                return redirect(`/classes/c/${filteredClasses[0].id}`);
            } else {
                return redirect(`/classes/c/${filteredClasses[0].id}/chat/new`);
            }
        } else {
            if (profile.professor || profile.admin) {
                return redirect("/signup");
            } else {
                return redirect("/");
            }
        }
    } else {
        return (
            <HomeLayout>
                <Container fluid>
                    <Center>
                        <Stack h="100vh" justify="center" align="center">
                            <Loader />
                        </Stack>
                    </Center>
                </Container>
            </HomeLayout>
        )
    }
}