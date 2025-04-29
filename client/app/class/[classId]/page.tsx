/**
 * app/class/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { AppShell, Button, Burger, Container, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme, Card, Badge, Group, Paper, Skeleton, MultiSelect, Box, Flex, Menu, Checkbox } from "@mantine/core";
import { Suspense, use, useEffect, useState } from "react";
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
import { getProfiles } from "@/utils/queries/get-profiles";
import { getMessages, getMessagesById } from "@/utils/queries/get-messages";
import { AreaChart } from '@mantine/charts';
import { BarChart } from '@mantine/charts';
import { getAllChats } from "@/utils/queries/get-all-chats";
import { BubbleChart } from '@mantine/charts';
import { PieChart } from '@mantine/charts';
import { ScatterChart } from '@mantine/charts'; // Added import
import {
    IconArrowDownRight,
    IconArrowUpRight,
    IconMessage,
    IconClock,
    IconStar,
    IconHourglass,
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown, // Add this import
} from '@tabler/icons-react';

export default function Class({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const supabase = useSupabaseBrowser();

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

    // Add these const declarations before the return statement:
    const messagesPerDayData = processMessagesPerDay();

    // Process data for active students over time with different time frames
    const processActiveStudentsOverTime = (timeFrame: 'day' | 'week' | 'month') => {
        if (!chats) return [];

        const studentsByPeriod: { [key: string]: { students: Set<string>, displayKey: string } } = {};
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

        chats.forEach(chat => {
            const date = new Date(chat.created_at);
            let periodKey: string;
            let displayKey: string;

            if (timeFrame === 'day') {
                periodKey = date.toISOString().split('T')[0];
                displayKey = periodKey; // Keep YYYY-MM-DD format for days
            } else if (timeFrame === 'week') {
                // Get the start of the week
                const startDate = new Date(date);
                startDate.setDate(date.getDate() - date.getDay());
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);

                // Format as MM/DD-MM/DD
                const formatDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
                periodKey = startDate.toISOString().split('T')[0];
                displayKey = `${formatDate(startDate)}-${formatDate(endDate)}`;
            } else { // month
                periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                displayKey = months[date.getMonth()];
            }

            if (!studentsByPeriod[periodKey]) {
                studentsByPeriod[periodKey] = {
                    students: new Set(),
                    displayKey: displayKey
                };
            }
            studentsByPeriod[periodKey].students.add(chat.profile || 'anonymous');
        });

        return Object.entries(studentsByPeriod).map(([period, data]) => ({
            period: period,
            displayPeriod: period.split('-')[0] === new Date().getFullYear().toString() 
                ? data.displayKey 
                : `${data.displayKey} ${period.split('-')[0]}`,
            students: data.students.size
        }))
        .sort((a, b) => a.period.localeCompare(b.period))
        .map(({ displayPeriod, students }) => ({
            period: displayPeriod,
            students
        }));
    };

    // Process data for message time distribution as bubble chart with AM/PM stacking
    const processMessageTimeDistribution = () => {
        if (!messages) return { recent: [], previous: [] };

        const now = new Date();

        // Helper function to convert to 12-hour format
        const formatHour = (hour: number) => {
            const period = hour >= 12 ? 'PM' : 'AM';
            const twelveHour = hour % 12 || 12;
            return `${twelveHour}${period}`;
        };

        // Create two separate datasets for each 12-hour period
        const recentTwelveHours = Array.from({ length: 12 }, (_, i) => ({
            hour: formatHour((now.getHours() - i + 24) % 24),
            index: 1,  // Fixed y-position
            rawValue: 0,
            value: 0,
            showLabel: i % 2 === 0  // Show every third label for better spacing
        })).reverse();

        const previousTwelveHours = Array.from({ length: 12 }, (_, i) => ({
            hour: formatHour((now.getHours() - i - 12 + 24) % 24),
            index: 1,  // Fixed y-position
            rawValue: 0,
            value: 0,
            showLabel: i % 2 === 0  // Show every third label for better spacing
        })).reverse();

        // Count messages for each period
        messages.forEach(message => {
            const messageDate = new Date(message.created_at);
            const hoursDiff = Math.floor((now.getTime() - messageDate.getTime()) / (60 * 60 * 1000));

            if (hoursDiff < 12) {
                const index = 11 - hoursDiff;
                if (index >= 0) {
                    recentTwelveHours[index].rawValue++;
                    recentTwelveHours[index].value = recentTwelveHours[index].rawValue * 100; // Increased scaling factor
                }
            } else if (hoursDiff < 24) {
                const index = 11 - (hoursDiff - 12);
                if (index >= 0) {
                    previousTwelveHours[index].rawValue++;
                    previousTwelveHours[index].value = previousTwelveHours[index].rawValue * 100; // Increased scaling factor
                }
            }
        });

        return {
            recent: recentTwelveHours,
            previous: previousTwelveHours
        };
    };

    // Update the state declaration
    const messageDistribution = processMessageTimeDistribution();

    // Add these const declarations with the other data declarations
    const [studentTimeFrame, setStudentTimeFrame] = useState<'day' | 'week' | 'month'>('day');
    const activeStudentsData = processActiveStudentsOverTime(studentTimeFrame);

    // Add state for toggles
    const [timeFrame, setTimeFrame] = useState<'all' | 'recent'>('all');
    const [learningObjectiveFilter, setLearningObjectiveFilter] = useState<string>('Learning Object 1');
    const [learningObjectiveFilter2, setLearningObjectiveFilter2] = useState<string>('Learning Object 1');

    // Add state for exam filters
    const [selectedExams1, setSelectedExams1] = useState<string[]>(['Exam 1']);
    const [selectedExams2, setSelectedExams2] = useState<string[]>(['Exam 1']);
    
    // Define available exam options
    const examOptions = [
        { value: 'Exam 1', label: 'Exam 1' },
        { value: 'Exam 2', label: 'Exam 2' },
        { value: 'Exam 3', label: 'Exam 3' },
    ];

    // Check if the user is a professor or admin
    const isProfessorOrAdmin = () => {
        return profile && (profile.admin || profile.professor);
    }

    // Add these new processing functions
    const calculateMessagesToday = () => {
        if (!messages) return { value: 0, diff: 100 };
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayMessages = messages.filter(message => 
            new Date(message.created_at) >= today
        ).length;

        // Calculate percentage difference from yesterday
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayMessages = messages.filter(message => 
            new Date(message.created_at) >= yesterday && 
            new Date(message.created_at) < today
        ).length;

        const diff = yesterdayMessages ? 
            Math.round(((todayMessages - yesterdayMessages) / yesterdayMessages) * 100) : 
            100;

        return { value: todayMessages, diff };
    };

    const calculateAverageTimeSpent = () => {
        if (!messages || !chats) return { value: "0m", diff: 100 };

        const TIMEOUT_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        // Calculate time spent for each chat
        const chatTimes = chats.map(chat => {
            const chatMessages = messages
                .filter(msg => msg.chat === chat.id)
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            let totalTime = 0;
            let lastMessageTime: number | null = null;

            chatMessages.forEach(message => {
                const messageTime = new Date(message.created_at).getTime();
                
                if (lastMessageTime) {
                    const timeDiff = messageTime - lastMessageTime;
                    if (timeDiff < TIMEOUT_THRESHOLD) {
                        totalTime += timeDiff;
                    }
                }
                lastMessageTime = messageTime;
            });

            return {
                time: totalTime,
                created_at: chat.created_at
            };
        });

        // Calculate this week's average
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        
        const thisWeekChats = chatTimes.filter(chat => 
            new Date(chat.created_at) >= weekStart
        );

        const thisWeekAvg = thisWeekChats.reduce((sum, chat) => 
            sum + chat.time, 0) / (thisWeekChats.length || 1);

        // Calculate last week's average
        const lastWeekStart = new Date(weekStart.setDate(weekStart.getDate() - 7));
        const lastWeekChats = chatTimes.filter(chat => 
            new Date(chat.created_at) >= lastWeekStart && 
            new Date(chat.created_at) < weekStart
        );

        const lastWeekAvg = lastWeekChats.reduce((sum, chat) => 
            sum + chat.time, 0) / (lastWeekChats.length || 1);

        const diff = lastWeekAvg ? 
            Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100) : 
            100;

        return { 
            value: `${Math.round(thisWeekAvg / (60 * 1000))}m`, 
            diff 
        };
    };

    // Modified mock data generation to create separate color series for each exam
    const generateMockScatterData = (filter: string, seed = 1, selectedExams: string[] = ['Exam 1']) => {
        const numStudents = 30; // Example number of students
        
        // Colors for each exam
        const examColors = {
            'Exam 1': 'green.6',
            'Exam 2': 'blue.6',
            'Exam 3': 'orange.6'
        };
        
        // Create separate series for each exam
        const series = selectedExams.map(exam => {
            const points = [];
            
            // Use predictable seeded randomization
            const seededRandom = (min: number, max: number, studentId: number, examSeed: number = 0) => {
                const x = Math.sin(seed * 9999 + studentId * 333 + examSeed * 777) * 10000;
                const r = x - Math.floor(x);
                return min + r * (max - min);
            };
            
            // Get index for this exam (used for randomization)
            const examIndex = examOptions.findIndex(opt => opt.value === exam);
            
            for (let i = 0; i < numStudents; i++) {
                // Different score patterns for different exams
                const timeMultiplier = filter === 'Mean Learning Objective' ? 1.5 : 1;
                const scoreOffset = filter.includes('2') ? 1 : (filter.includes('3') ? -1 : 0);
                const examOffset = exam === 'Exam 1' ? 0 : (exam === 'Exam 2' ? 1 : -0.5);

                const scoreValue = Math.max(1, Math.min(10, Math.round(seededRandom(1, 10, i, examIndex) + scoreOffset + examOffset)));
                
                points.push({
                    x: seededRandom(5, 60 * timeMultiplier, i, examIndex), // Random time up to 60 mins
                    y: scoreValue, // Random score 1-10
                    studentName: `Student ${i + 1}`, // Add student identifier for tooltip
                    examName: exam // Add exam identifier for filtering
                });
            }
            
            return {
                name: exam,
                color: examColors[exam as keyof typeof examColors],
                data: points
            };
        });
        
        return series;
    };

    // Now we can use the modified function with exam filters
    const scatterData = generateMockScatterData(learningObjectiveFilter, 1, selectedExams1);
    const scatterData2 = generateMockScatterData(learningObjectiveFilter2, 2, selectedExams2);

    // Update the statsData to use the new calculation results
    const statsData = [
        {
            title: 'Messages Today',
            icon: IconMessage,
            ...calculateMessagesToday(),
            diffLabel: 'Compared to yesterday'
        },
        {
            title: 'Average Time Spent',
            icon: IconHourglass,
            ...calculateAverageTimeSpent(),
            diffLabel: 'Compared to last week'
        },
    ];

    // Combine all loading states
    const isLoading = !messages || !chats;

    // Add states for filter expansion
    const [outcome1FiltersExpanded, setOutcome1FiltersExpanded] = useState(false);
    const [outcome2FiltersExpanded, setOutcome2FiltersExpanded] = useState(false);

    // Toggle functions for filter expansion
    const toggleOutcome1Filters = () => setOutcome1FiltersExpanded(!outcome1FiltersExpanded);
    const toggleOutcome2Filters = () => setOutcome2FiltersExpanded(!outcome2FiltersExpanded);

    // Simplify the return statement to show only 3 charts in a row
    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                {isProfessorOrAdmin() && (
                    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} mb="xl">
                        {statsData.map((stat) => {
                            const Icon = stat.icon;
                            const DiffIcon = stat.diff ? (stat.diff > 0 ? IconArrowUpRight : IconArrowDownRight) : null;

                            return (
                                <Paper withBorder p="md" radius="md" key={stat.title}>
                                    <Group justify="space-between">
                                        <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                                            {stat.title}
                                        </Text>
                                        <Icon size={22} stroke={1.5} style={{ color: 'var(--mantine-color-gray-4)' }} />
                                    </Group>

                                    {!isLoading ? (
                                        <>
                                            <Group align="flex-end" gap="xs" mt={25}>
                                                <Text fz={24} fw={700} style={{ lineHeight: 1 }}>{stat.value}</Text>
                                                <Text c={stat.diff ? (stat.diff > 0 ? 'teal' : 'red') : 'dimmed'} fz="sm" fw={500} style={{ lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                                                    <span>{stat.diff ? `${Math.abs(stat.diff)}%` : ''}</span>
                                                    {DiffIcon && <DiffIcon size={16} stroke={1.5} />}
                                                </Text>
                                            </Group>
                                            <Text fz="xs" c="dimmed" mt={7}>
                                                {stat.diffLabel}
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <Skeleton height={28} mt={25} width="40%" />
                                            <Skeleton height={16} mt={7} width="60%" />
                                        </>
                                    )}
                                </Paper>
                            );
                        })}
                    </SimpleGrid>
                )}

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                    {/* First two cards (Active Students and Message Activity) remain unchanged */}
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Active Students</Text>
                            <Group gap="xs">
                                <Button
                                    size="xs"
                                    variant={studentTimeFrame === 'day' ? 'filled' : 'outline'}
                                    onClick={() => setStudentTimeFrame('day')}
                                    disabled={!isProfessorOrAdmin()}
                                >
                                    Daily
                                </Button>
                                <Button
                                    size="xs"
                                    variant={studentTimeFrame === 'week' ? 'filled' : 'outline'}
                                    onClick={() => setStudentTimeFrame('week')}
                                    disabled={!isProfessorOrAdmin()}
                                >
                                    Weekly
                                </Button>
                                <Button
                                    size="xs"
                                    variant={studentTimeFrame === 'month' ? 'filled' : 'outline'}
                                    onClick={() => setStudentTimeFrame('month')}
                                    disabled={!isProfessorOrAdmin()}
                                >
                                    Monthly
                                </Button>
                            </Group>
                        </Group>
                        {!isLoading ? (
                            <BarChart
                                h={300}
                                data={activeStudentsData}
                                dataKey="period"
                                series={[{ name: 'students', color: 'blue.6' }]}
                                tickLine="y"
                                gridAxis="xy"
                                withLegend
                                withTooltip
                                barProps={{ radius: 4 }}
                                yAxisProps={{
                                    tickFormatter: (value) => Math.round(value).toString()
                                }}
                            />
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>

                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Message Activity</Text>
                            <Group gap="xs">
                                <Button
                                    size="xs"
                                    variant={timeFrame === 'all' ? 'filled' : 'outline'}
                                    onClick={() => setTimeFrame('all')}
                                    disabled={!isProfessorOrAdmin()}
                                >
                                    All Time
                                </Button>
                                <Button
                                    size="xs"
                                    variant={timeFrame === 'recent' ? 'filled' : 'outline'}
                                    onClick={() => setTimeFrame('recent')}
                                    disabled={!isProfessorOrAdmin()}
                                >
                                    Last 24h
                                </Button>
                            </Group>
                        </Group>
                        {!isLoading ? (
                            timeFrame === 'all' ? (
                                <AreaChart
                                    h={300}
                                    data={messagesPerDayData}
                                    dataKey="date"
                                    series={[{ name: 'messages', color: 'violet.6' }]}
                                    curveType="monotone"
                                    tickLine="y"
                                    gridAxis="xy"
                                    withLegend
                                    withTooltip
                                    yAxisProps={{ domain: [0, 'auto'] }}
                                />
                            ) : (
                                <Stack align="center" justify="flex-end" gap="xl" h={300}>
                                    <BubbleChart
                                        h={80}  // Increased height a bit
                                        data={messageDistribution.recent}
                                        range={[16, 225]}
                                        color="violet.6"
                                        dataKey={{ x: 'hour', y: 'index', z: 'value' }}
                                        withTooltip
                                        valueFormatter={(value) => `${Math.round(value / 100)} messages`}
                                        xAxisProps={{
                                            tickFormatter: (hour) => {
                                                const dataPoint = messageDistribution.recent.find(d => d.hour === hour);
                                                return dataPoint?.showLabel ? hour : '';
                                            }
                                        }}
                                    />
                                    <BubbleChart
                                        h={80}  // Increased height a bit
                                        data={messageDistribution.previous}
                                        range={[16, 225]}
                                        color="violet.6"
                                        dataKey={{ x: 'hour', y: 'index', z: 'value' }}
                                        withTooltip
                                        valueFormatter={(value) => `${Math.round(value / 100)} messages`}
                                        xAxisProps={{
                                            tickFormatter: (hour) => {
                                                const dataPoint = messageDistribution.previous.find(d => d.hour === hour);
                                                return dataPoint?.showLabel ? hour : '';
                                            }
                                        }}
                                    />
                                </Stack>
                            )
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>

                    {/* Modified Learning Outcome 1 card */}
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md" align="center" wrap="nowrap">
                            {/* Left: Exam filter circles */}
                            <Group gap="xs" ml="md">
                                {examOptions.map((option) => (
                                    <Group key={option.value} gap="xs" style={{ cursor: isProfessorOrAdmin() ? 'pointer' : 'default' }}>
                                        <Box 
                                            onClick={() => {
                                                if (!isProfessorOrAdmin()) return;
                                                if (selectedExams1.includes(option.value)) {
                                                    // Don't allow deselecting the last exam
                                                    if (selectedExams1.length > 1) {
                                                        setSelectedExams1(selectedExams1.filter(exam => exam !== option.value));
                                                    }
                                                } else {
                                                    setSelectedExams1([...selectedExams1, option.value]);
                                                }
                                            }}
                                            style={{
                                                width: 16, 
                                                height: 16, 
                                                borderRadius: '50%',
                                                border: '2px solid',
                                                borderColor: option.value === 'Exam 1' ? 'var(--mantine-color-green-6)' : 
                                                            option.value === 'Exam 2' ? 'var(--mantine-color-blue-6)' : 
                                                            'var(--mantine-color-orange-6)',
                                                backgroundColor: selectedExams1.includes(option.value) ? 
                                                            (option.value === 'Exam 1' ? 'var(--mantine-color-green-6)' : 
                                                            option.value === 'Exam 2' ? 'var(--mantine-color-blue-6)' : 
                                                            'var(--mantine-color-orange-6)') : 'transparent',
                                                display: 'inline-block',
                                            }}
                                        />
                                        <Text size="xs">{option.label}</Text>
                                    </Group>
                                ))}
                            </Group>

                            {/* Center: Title */}
                            <Text size="lg" fw={500} style={{ textAlign: 'center' }}>Learning Outcome 1</Text>

                            {/* Right: Objective filter dropdown - updated to use chevron */}
                            <Menu position="bottom-end" withArrow>
                                <Menu.Target>
                                    <Group 
                                        gap={4} // Reduced gap to move chevron closer
                                        style={{ 
                                            cursor: isProfessorOrAdmin() ? 'pointer' : 'default',
                                            opacity: isProfessorOrAdmin() ? 1 : 0.6,
                                            transition: 'color 0.2s ease'
                                        }}
                                    >
                                        <Text size="sm" weight={500}>
                                            {learningObjectiveFilter === 'Mean Learning Objective' 
                                                ? 'Mean' 
                                                : 'Objective ' + learningObjectiveFilter.split(' ').pop()}
                                        </Text>
                                        <IconChevronDown size={16} stroke={1.5} />
                                    </Group>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    {['Learning Object 1', 'Learning Objective 2', 'Learning Objective 3', 'Mean Learning Objective'].map((filter) => (
                                        <Menu.Item 
                                            key={filter}
                                            onClick={() => setLearningObjectiveFilter(filter)}
                                            disabled={!isProfessorOrAdmin()}
                                        >
                                            {filter === 'Mean Learning Objective' ? 'Mean' : 'Objective ' + filter.split(' ').pop()}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                        </Group>

                        {!isLoading ? (
                            <ScatterChart
                                h={300}
                                data={scatterData}
                                dataKey={{ x: 'x', y: 'y' }}
                                xAxisLabel="Messages Sent"
                                yAxisLabel="Score (1-10)"
                                yAxisProps={{ domain: [0, 10] }}
                                xAxisProps={{ domain: [0, 'auto'] }}
                                withTooltip
                                tooltipProps={{
                                    content: ({ point }) => {
                                        // Access properties safely
                                        const student = point?.studentName || 'Student';
                                        const score = point?.y || '0';
                                        const exam = point?.examName || 'Exam';
                                        return `${student}: ${score} (${exam})`;
                                    }
                                }}
                                // Removed withLegend prop
                                gridAxis="xy"
                                tickLine="xy"
                            />
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>

                    {/* Learning Outcome 2 card - updated with same pattern */}
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md" align="center" wrap="nowrap">
                            {/* Left: Exam filter circles */}
                            <Group gap="xs" ml="md">
                                {examOptions.map((option) => (
                                    <Group key={option.value} gap="xs" style={{ cursor: isProfessorOrAdmin() ? 'pointer' : 'default' }}>
                                        <Box 
                                            onClick={() => {
                                                if (!isProfessorOrAdmin()) return;
                                                if (selectedExams2.includes(option.value)) {
                                                    // Don't allow deselecting the last exam
                                                    if (selectedExams2.length > 1) {
                                                        setSelectedExams2(selectedExams2.filter(exam => exam !== option.value));
                                                    }
                                                } else {
                                                    setSelectedExams2([...selectedExams2, option.value]);
                                                }
                                            }}
                                            style={{
                                                width: 16, 
                                                height: 16, 
                                                borderRadius: '50%',
                                                border: '2px solid',
                                                borderColor: option.value === 'Exam 1' ? 'var(--mantine-color-green-6)' : 
                                                            option.value === 'Exam 2' ? 'var(--mantine-color-blue-6)' : 
                                                            'var(--mantine-color-orange-6)',
                                                backgroundColor: selectedExams2.includes(option.value) ? 
                                                            (option.value === 'Exam 1' ? 'var(--mantine-color-green-6)' : 
                                                            option.value === 'Exam 2' ? 'var(--mantine-color-blue-6)' : 
                                                            'var(--mantine-color-orange-6)') : 'transparent',
                                                display: 'inline-block',
                                            }}
                                        />
                                        <Text size="xs">{option.label}</Text>
                                    </Group>
                                ))}
                            </Group>

                            {/* Center: Title */}
                            <Text size="lg" fw={500} style={{ textAlign: 'center' }}>Learning Outcome 2</Text>

                            {/* Right: Objective filter dropdown - updated to use chevron */}
                            <Menu position="bottom-end" withArrow>
                                <Menu.Target>
                                    <Group 
                                        gap={4} // Reduced gap to move chevron closer
                                        style={{ 
                                            cursor: isProfessorOrAdmin() ? 'pointer' : 'default',
                                            opacity: isProfessorOrAdmin() ? 1 : 0.6,
                                            transition: 'color 0.2s ease'
                                        }}
                                    >
                                        <Text size="sm" weight={500}>
                                            {learningObjectiveFilter2 === 'Mean Learning Objective' 
                                                ? 'Mean' 
                                                : 'Objective ' + learningObjectiveFilter2.split(' ').pop()}
                                        </Text>
                                        <IconChevronDown size={16} stroke={1.5} />
                                    </Group>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    {['Learning Object 1', 'Learning Objective 2', 'Learning Objective 3', 'Mean Learning Objective'].map((filter) => (
                                        <Menu.Item 
                                            key={filter}
                                            onClick={() => setLearningObjectiveFilter2(filter)}
                                            disabled={!isProfessorOrAdmin()}
                                        >
                                            {filter === 'Mean Learning Objective' ? 'Mean' : 'Objective ' + filter.split(' ').pop()}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                        </Group>

                        {!isLoading ? (
                            <ScatterChart
                                h={300}
                                data={scatterData2}
                                dataKey={{ x: 'x', y: 'y' }}
                                xAxisLabel="Messages Sent"
                                yAxisLabel="Score (1-10)"
                                yAxisProps={{ domain: [0, 10] }}
                                xAxisProps={{ domain: [0, 'auto'] }}
                                withTooltip
                                tooltipProps={{
                                    content: ({ point }) => {
                                        // Access properties safely
                                        const student = point?.studentName || 'Student';
                                        const score = point?.y || '0';
                                        const exam = point?.examName || 'Exam';
                                        return `${student}: ${score} (${exam})`;
                                    }
                                }}
                                // Removed withLegend prop
                                gridAxis="xy"
                                tickLine="xy"
                            />
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>
                </SimpleGrid>
            </Container>
        </ClassLayout>
    );
}