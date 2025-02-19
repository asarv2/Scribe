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
import { getMessages } from "@/utils/queries/get-messages";
import { AreaChart } from '@mantine/charts';
import { BarChart } from '@mantine/charts';

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

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: chats } = useQuery({
        queryKey: ["chats", classId, profile?.id],
        queryFn: () => getChats(supabase, classId, (profile?.admin || profile?.professor) ? null : profile!.id),
        enabled: !!profile
    })

    const { data: messages } = useQuery({
        queryKey: ["messages", classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
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

    return (
        <ClassLayout classId={classId}>
            <Container size="lg" py="xl">
                <Stack>
                    <Text size="xl" fw={700} ta="center" mb="xl">
                        {classData?.title}
                    </Text>

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

                        {/* <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Text size="lg" fw={500} mb="md">
                                Messages Over Time
                            </Text>
                            <LineChart
                                h={400}
                                data={messageChartData}
                                dataKey="date"
                                series={[
                                    { name: 'messages', color: 'teal.6' }
                                ]}
                                curveType="linear"
                                tickLine="y"
                                gridAxis="xy"
                                withLegend
                                withTooltip
                            />
                        </Card> */}

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

                        {/* <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Text size="lg" fw={500} mb="md">Questions by Student</Text>
                            <BarChart
                                h={400}
                                data={studentQuestionsData}
                                dataKey="student"
                                series={[{ name: 'questions', color: 'indigo.6' }]}
                                tickLine="y"
                                orientation="vertical"
                                withLegend
                                withTooltip
                            />
                        </Card> */}

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
                </Stack>
            </Container>
        </ClassLayout>
    );
}