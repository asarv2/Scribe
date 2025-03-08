/**
 * app/classes/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../../utils/supabase/supabase-browser";
import { AppShell, Button, Burger, Container, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme, Card, Badge, Group } from "@mantine/core";
import { Suspense, useEffect, useState } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser } from "@/utils/queries/get-user";
import { getClass } from "@/utils/queries/get-class";
import Image from "next/image";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { LineChart } from '@mantine/charts';
import { getChats } from "@/utils/queries/get-chats";
import { getProfile } from "@/utils/queries/get-profile";
import { getMessages, getMessagesById } from "@/utils/queries/get-messages";
import { AreaChart } from '@mantine/charts';
import { BarChart } from '@mantine/charts';
import { getFaqs } from "@/utils/queries/get-faqs";
import { getDocuments } from "@/utils/queries/get-documents";
import { getLectures, getLecturesById } from "@/utils/queries/get-lectures";
import { getChaptersById } from "@/utils/queries/get-chapters";
import { getHomeworksById } from "@/utils/queries/get-homeworks";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getChapterDocuments } from "@/utils/queries/get-chapter-docs";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";
export default function Class({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient()
    const [opened, { toggle }] = useDisclosure(false)
    const [openNodeId, setOpenNodeId] = useState<string>()
    const [openNodeLabel, setOpenNodeLabel] = useState<string>()
    const [openNodeDescription, setOpenNodeDescription] = useState<string>()
    const theme = useMantineTheme()
    const pathname = usePathname()

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const { data: classData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: chats } = useQuery({
        queryKey: ["allChats", classId],
        queryFn: () => getAllChats(supabase, classId),
    })

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: messages } = useQuery({
        queryKey: ["messages", classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
    })

    const { data: faqs, isLoading: loadingFaqs } = useQuery({
        queryKey: ["faqs", classId],
        queryFn: () => getFaqs(supabase, classId),
        enabled: !!classData
    })

    const {data: faqMessages, isLoading: loadingFaqMessages} = useQuery({
        queryKey: ["faqMessages", classId],
        queryFn: () => getMessagesById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.messages)))),
        enabled: !!faqs
    })

    const {data: faqLectures, isLoading: loadingFaqLectures} = useQuery({
        queryKey: ["faqLectures", classId],
        queryFn: () => getLecturesById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.lectures)))),
        enabled: !!faqs
    })

    const {data: faqLectureDocuments, isLoading: loadingFaqLectureDocuments} = useQuery({
        queryKey: ["faqLectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, Array.from(new Set(faqLectures?.flatMap(lecture => lecture.id)))),
        enabled: !!faqLectures
    })

    const {data: faqChapters, isLoading: loadingFaqChapters} = useQuery({
        queryKey: ["faqChapters", classId],
        queryFn: () => getChaptersById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.chapters)))),
        enabled: !!faqs
    })

    const {data: faqChapterDocuments, isLoading: loadingFaqChapterDocuments} = useQuery({
        queryKey: ["faqChapterDocuments", classId],
        queryFn: () => getChapterDocuments(supabase, Array.from(new Set(faqChapters?.flatMap(chapter => chapter.id)))),
        enabled: !!faqChapters
    })

    const {data: faqHomeworks, isLoading: loadingFaqHomeworks} = useQuery({
        queryKey: ["faqHomeworks", classId],
        queryFn: () => getHomeworksById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.homeworks)))),
        enabled: !!faqs
    })

    const {data: faqHomeworkDocuments, isLoading: loadingFaqHomeworkDocuments} = useQuery({
        queryKey: ["faqHomeworkDocuments", classId],
        queryFn: () => getHomeworkDocuments(supabase, Array.from(new Set(faqHomeworks?.flatMap(homework => homework.id)))),
        enabled: !!faqHomeworks
    })

    // Process chat data for visualization
    const processChatsData = () => {
        if (!chats) return [];
        
        // Create a map of dates to chat counts
        const chatsByDate = chats.reduce((acc: { [key: string]: number }, chat) => {
            const date = new Date(chat.created_at).toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        // Convert to array format for MantineCharts
        return Object.entries(chatsByDate).map(([date, count]) => ({
            date,
            chats: count
        })).sort((a, b) => a.date.localeCompare(b.date));
    };

    const chartData = processChatsData();

    // Process messages data for visualization
    const processMessagesData = () => {
        if (!messages) return [];
        
        const messagesByDate = messages.reduce((acc: { [key: string]: number }, message) => {
            const date = new Date(message.created_at).toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(messagesByDate).map(([date, count]) => ({
            date,
            messages: count
        })).sort((a, b) => a.date.localeCompare(b.date));
    };

    const messageChartData = processMessagesData();

    // Add these new data processing functions after the existing ones:
    const processMessagesPerDay = () => {
        if (!messages) return [];
        
        const messagesByDate = messages.reduce((acc: { [key: string]: number }, message) => {
            const date = new Date(message.created_at).toISOString().split('T')[0];
                acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(messagesByDate).map(([date, count]) => ({
            date,
            messages: count
        })).sort((a, b) => a.date.localeCompare(b.date));
    };

    const processStudentMessages = () => {
        if (!messages) return [];
        
        const messagesByStudent = messages.reduce((acc: { [key: string]: number }, message) => {
            const chat = chats?.find(chat => chat.id === message.chat);
            const studentName = chat?.profile || 'Anonymous';
                acc[studentName] = (acc[studentName] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(messagesByStudent).map(([student, count]) => ({
            student,
            messages: count
        })).sort((a, b) => b.messages - a.messages);  // Sort by question count descending
    };

    const processTimeOfDayMessages = () => {
        if (!messages) return [];
        
        const messagesByHour = messages.reduce((acc: { [key: number]: number }, message) => {
            const hour = new Date(message.created_at).getHours();
                acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});

        return Array.from({ length: 24 }, (_, hour) => ({
            hour: `${hour}:00`,
            messages: messagesByHour[hour] || 0
        }));
    };

    // Add these const declarations before the return statement:
    const messagesPerDayData = processMessagesPerDay();
    const studentMessagesData = processStudentMessages();
    const timeOfDayMessagesData = processTimeOfDayMessages();

    // Add this new processing function with the other data processing functions
    const processFaqTopics = () => {
        if (!faqs) return [];
        
        const topicCounts = faqs.reduce((acc: { [key: string]: number }, faq) => {
            acc[faq.topic] = (acc[faq.topic] || 0) + faq.count;
            return acc;
        }, {});

        return Object.entries(topicCounts)
            .map(([topic, count]) => ({
                topic,
                count
            }))
            .sort((a, b) => b.count - a.count); // Sort by count descending
    };

    // Add this const declaration with the other data declarations
    const faqTopicsData = processFaqTopics();

    // Add these new processing functions after the other processing functions
    const processFaqLecturesData = () => {
        if (!faqs || !faqLectures || !faqLectureDocuments) return [];
        
        const lectureCounts = faqs.reduce((acc: { [key: string]: number }, faq) => {
            if (faq.lectures) {
                const lecture = faqLectures.find(l => faq.lectures.includes(l.id));
                const lectureName = lecture ? `${lecture.name}` : 'Unknown Lecture';
                acc[lectureName] = (acc[lectureName] || 0) + 1;
            }
            return acc;
        }, {});

        return Object.entries(lectureCounts)
            .map(([lecture, count]) => ({
                name: lecture,
                count
            }))
            .sort((a, b) => b.count - a.count);
    };

    const processFaqChaptersData = () => {
        if (!faqs || !faqChapters) return [];
        
        const chapterCounts = faqs.reduce((acc: { [key: string]: number }, faq) => {
            if (faq.chapters) {
                const chapter = faqChapters.find(c => faq.chapters.includes(c.id));
                const chapterName = chapter ? `${chapter.title}` : 'Unknown Chapter';
                acc[chapterName] = (acc[chapterName] || 0) + 1;
            }
            return acc;
        }, {});

        return Object.entries(chapterCounts)
            .map(([chapter, count]) => ({
                name: chapter,
                count
            }))
            .sort((a, b) => b.count - a.count);
    };

    const processFaqHomeworksData = () => {
        if (!faqs || !faqHomeworks) return [];
        
        const homeworkCounts = faqs.reduce((acc: { [key: string]: number }, faq) => {
            if (faq.homeworks) {
                const homework = faqHomeworks.find(h => faq.homeworks.includes(h.id));
                const homeworkName = homework ? `${homework.title}` : 'Unknown Homework';
                acc[homeworkName] = (acc[homeworkName] || 0) + 1;
            }
            return acc;
        }, {});

        return Object.entries(homeworkCounts)
            .map(([homework, count]) => ({
                name: homework,
                count
            }))
            .sort((a, b) => b.count - a.count);
    };

    // Add these const declarations with the other data declarations
    const faqLecturesData = processFaqLecturesData();
    const faqChaptersData = processFaqChaptersData();
    const faqHomeworksData = processFaqHomeworksData();

    // Add this function to check if the user is a student
    const isStudent = () => {
        return profile && !profile.admin && !profile.professor;
    }

    return (
        <ClassLayout classId={classId}>
            <Container size="lg" py="xl">
                <Stack>
                    <Text size="xl" fw={700} ta="center" mb="xl">
                        {classData?.title}
                    </Text>

                    {isStudent() ? (
                        // Student view - only show individual usage
                        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                            <Card shadow="sm" padding="lg" radius="md" withBorder>
                                <Text size="lg" fw={500} mb="md">
                                    Your Chat Usage
                                </Text>
                                <LineChart
                                    h={400}
                                    data={chartData}
                                    dataKey="date"
                                    series={[
                                        { name: 'chats', color: 'blue.6' }
                                    ]}
                                    curveType="linear"
                                    tickLine="y"
                                    gridAxis="xy"
                                    withLegend
                                    withTooltip
                                />
                            </Card>

                            <Card shadow="sm" padding="lg" radius="md" withBorder>
                                <Text size="lg" fw={500} mb="md">Your Message Usage</Text>
                                <AreaChart
                                    h={400}
                                    data={messagesPerDayData}
                                    dataKey="date"
                                    series={[{ name: 'messages', color: 'violet.6' }]}
                                    curveType="linear"
                                    tickLine="y"
                                    gridAxis="xy"
                                    withLegend
                                    withTooltip
                                />
                            </Card>

                            <Card shadow="sm" padding="lg" radius="md" withBorder>
                                <Text size="lg" fw={500} mb="md">Your Message Frequency</Text>
                                <BarChart
                                    h={400}
                                    data={timeOfDayMessagesData}
                                    dataKey="hour"
                                    series={[{ name: 'messages', color: 'orange.6' }]}
                                    tickLine="y"
                                    withLegend
                                    withTooltip
                                />
                            </Card>
                        </SimpleGrid>
                    ) : (
                        // Admin/Professor view - show all analytics
                        <>
                            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                    <Text size="lg" fw={500} mb="md">
                                        Chat Usage
                                    </Text>
                                    <LineChart
                                        h={400}
                                        data={chartData}
                                        dataKey="date"
                                        series={[
                                            { name: 'chats', color: 'blue.6' }
                                        ]}
                                        curveType="linear"
                                        tickLine="y"
                                        gridAxis="xy"
                                        withLegend
                                        withTooltip
                                    />
                                </Card>

                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                    <Text size="lg" fw={500} mb="md">Message Usage</Text>
                                    <AreaChart
                                        h={400}
                                        data={messagesPerDayData}
                                        dataKey="date"
                                        series={[{ name: 'messages', color: 'violet.6' }]}
                                        curveType="linear"
                                        tickLine="y"
                                        gridAxis="xy"
                                        withLegend
                                        withTooltip
                                    />
                                </Card>

                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                    <Text size="lg" fw={500} mb="md">Message Frequency</Text>
                                    <BarChart
                                        h={400}
                                        data={timeOfDayMessagesData}
                                        dataKey="hour"
                                        series={[{ name: 'messages', color: 'orange.6' }]}
                                        tickLine="y"
                                        withLegend
                                        withTooltip
                                    />
                                </Card>
                            </SimpleGrid>

                            <Card shadow="sm" padding="lg" radius="md" withBorder>
                                <Text size="lg" fw={500} mb="md">FAQ Topics Distribution</Text>
                                <BarChart
                                    h={Math.max(400, faqTopicsData.length * 40)}
                                    data={faqTopicsData}
                                    dataKey="topic"
                                    series={[{ name: 'count', color: 'cyan.6' }]}
                                    tickLine="x"
                                    orientation="horizontal"
                                    withLegend
                                    withTooltip
                                />
                            </Card>

                            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                    <Text size="lg" fw={500} mb="md">Lecture Questions Distribution</Text>
                                    <BarChart
                                        h={Math.max(300, faqLecturesData.length * 40)}
                                        data={faqLecturesData}
                                        dataKey="name"
                                        series={[{ name: 'count', color: 'blue.6' }]}
                                        tickLine="x"
                                        orientation="horizontal"
                                        withTooltip
                                    />
                                </Card>

                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                    <Text size="lg" fw={500} mb="md">Chapter Questions Distribution</Text>
                                    <BarChart
                                        h={Math.max(300, faqChaptersData.length * 40)}
                                        data={faqChaptersData}
                                        dataKey="name"
                                        series={[{ name: 'count', color: 'green.6' }]}
                                        tickLine="x"
                                        orientation="horizontal"
                                        withTooltip
                                    />
                                </Card>

                                <Card shadow="sm" padding="lg" radius="md" withBorder>
                                    <Text size="lg" fw={500} mb="md">Homework Questions Distribution</Text>
                                    <BarChart
                                        h={Math.max(300, faqHomeworksData.length * 40)}
                                        data={faqHomeworksData}
                                        dataKey="name"
                                        series={[{ name: 'count', color: 'red.6' }]}
                                        tickLine="x"
                                        orientation="horizontal"
                                        withTooltip
                                    />
                                </Card>
                            </SimpleGrid>
                        </>
                    )}
                </Stack>
            </Container>
        </ClassLayout>
    );
}