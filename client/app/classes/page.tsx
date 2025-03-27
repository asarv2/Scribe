/**
 * app/classes/page.tsx
 * 
 * This page is the main page for the classes.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */
"use client";

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
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { Homework } from "@/types";
import { Textbook } from "@/types";
import { Lecture } from "@/types";

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

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures"],
        queryFn: () => getLectures(supabase, classes!.map(c => c.id) ?? []),
        enabled: !!classes
    });

    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks"],
        queryFn: () => getTextbooks(supabase, classes!.map(c => c.id) ?? []),
        enabled: !!classes
    });

    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks"],
        queryFn: () => getHomeworks(supabase, classes!.map(c => c.id) ?? []),
        enabled: !!classes
    });

    const calculateParseStatus = (items: Lecture[] | Textbook[] | Homework[]) => {
        if (!items || items.length === 0) return { percent: 0, count: 0, total: 0 };

        const completedCount = items.filter(item =>
            item.parse_status === 'complete'
        ).length;

        return {
            percent: Math.round((completedCount / items.length) * 100),
            count: completedCount,
            total: items.length
        };
    };

    const getFilteredClasses = () => {
        if (!profile || !classes) return [];
        return profile.admin ? classes : classes?.filter(classItem => profile.classes?.includes(classItem.id));
    }

    if (profile) {
        const filteredClasses = getFilteredClasses();
        if (filteredClasses.length > 0) {
            if (profile.professor || profile.admin) {
                if (profile.admin) {
                    return redirect(`/classes/c/${filteredClasses[0].id}`);
                } else {
                    const classItem = filteredClasses[0];
                    const filteredLectures = lectures?.filter(l => l.class === classItem.id) || [];
                    const filteredTextbooks = textbooks?.filter(t => t.class === classItem.id) || [];
                    const filteredHomeworks = homeworks?.filter(h => h.class === classItem.id) || [];

                    const lecturesComplete = !classItem.lecture_enabled ||
                        (filteredLectures.length > 0 && calculateParseStatus(filteredLectures).percent === 100);

                    const textbooksComplete = !classItem.textbook_enabled ||
                        (filteredTextbooks.length > 0 && calculateParseStatus(filteredTextbooks).percent === 100);

                    const homeworksComplete = !classItem.homework_enabled ||
                        (filteredHomeworks.length > 0 && calculateParseStatus(filteredHomeworks).percent === 100);

                    if (lecturesComplete && textbooksComplete && homeworksComplete) {
                        return redirect(`/classes/c/${filteredClasses[0].id}`);
                    } else {
                        return redirect(`/signup`);
                    }
                }
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