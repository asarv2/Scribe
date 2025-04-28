/**
 * app/class/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { AppShell, Button, Burger, Container, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme, Card, Badge, Group, Paper, Skeleton, Tooltip } from "@mantine/core";
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
import {
    IconArrowDownRight,
    IconArrowUpRight,
    IconMessage,
    IconClock,
    IconStar,
    IconHourglass,
    IconPhoto,
    IconFileText,
    IconQuestionMark,
} from '@tabler/icons-react';
import { getFigures } from "@/utils/queries/get-figures";
import { getQuestions } from "@/utils/queries/get-questions";
import { getSummaries } from "@/utils/queries/get-summaries";
import { getObjectives } from "@/utils/queries/get-objectives";
import { getOutcomes } from "@/utils/queries/get-outcomes";

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

    const { data: messages, isLoading: messagesLoading } = useQuery({
        queryKey: ["messages", classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
    })

    const { data: figures, isLoading: figuresLoading } = useQuery({
        queryKey: ["figures", classId],
        queryFn: () => getFigures(supabase, classId),
        enabled: !!classId
    });

    const { data: summaries, isLoading: summariesLoading } = useQuery({
        queryKey: ["summaries", classId],
        queryFn: () => getSummaries(supabase, classId),
        enabled: !!classId
    });

    const { data: questions, isLoading: questionsLoading } = useQuery({
        queryKey: ["questions", classId],
        queryFn: () => getQuestions(supabase, classId),
        enabled: !!classId
    });

    const { data: outcomes, isLoading: outcomesLoading } = useQuery({
        queryKey: ["outcomes", classId],
        queryFn: () => getOutcomes(supabase, classId),
        enabled: !!classId
    });

    const { data: objectives, isLoading: objectivesLoading } = useQuery({
        queryKey: ["objectives", classId],
        queryFn: () => getObjectives(supabase, classId),
        enabled: !!classId
    });

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

    // Add these new processing functions
    const calculateMessagesToday = () => {
        if (!messages) return { value: 0, diff: 100, totalMessages: 0 };

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

        // Count total messages instead of total chats
        const totalMessages = messages ? messages.length : 0;

        return { value: todayMessages, diff, totalMessages };
    };

    const calculateAverageTimeSpent = () => {
        if (!messages || !chats) return { value: "0m", diff: 100, totalTimeSpent: "0h 0m" };

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

        // Calculate total time spent across all chats
        const totalTimeMs = chatTimes.reduce((sum, chat) => sum + chat.time, 0);
        const totalHours = Math.floor(totalTimeMs / (60 * 60 * 1000));
        const totalMinutes = Math.floor((totalTimeMs % (60 * 60 * 1000)) / (60 * 1000));
        const totalTimeSpent = `${totalHours}h ${totalMinutes}m`;

        return {
            value: `${Math.round(thisWeekAvg / (60 * 1000))}m`,
            diff,
            totalTimeSpent
        };
    };

    const calculateCorrectResponsePercentage = () => {
        if (!messages) return { value: "0%", diff: 0, correctCount: 0, totalCount: 0 };

        // Count messages with correct responses
        const correctMessages = messages.filter(message => message.correct === true).length;
        const totalMessages = messages.length;

        const percentage = totalMessages > 0 ? Math.round((correctMessages / totalMessages) * 100) : 0;

        // Calculate percentage difference from last week
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - 7));

        const thisWeekMessages = messages.filter(message =>
            new Date(message.created_at) >= weekStart
        );

        const thisWeekCorrect = thisWeekMessages.filter(message => message.correct === true).length;
        const thisWeekPercentage = thisWeekMessages.length > 0 ?
            (thisWeekCorrect / thisWeekMessages.length) * 100 : 0;

        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const lastWeekMessages = messages.filter(message =>
            new Date(message.created_at) >= lastWeekStart &&
            new Date(message.created_at) < weekStart
        );

        const lastWeekCorrect = lastWeekMessages.filter(message => message.correct === true).length;
        const lastWeekPercentage = lastWeekMessages.length > 0 ?
            (lastWeekCorrect / lastWeekMessages.length) * 100 : 0;

        const diff = lastWeekPercentage ?
            Math.round(thisWeekPercentage - lastWeekPercentage) :
            0;

        return {
            value: `${percentage}%`,
            diff,
            correctCount: correctMessages,
            totalCount: totalMessages
        };
    };

    const calculateGeneratedContent = () => {
        if (!figures || !summaries || !questions) return { value: 0, diff: 0 };

        const totalGenerated = figures.length + summaries.length + questions.length;

        // Calculate percentage difference from last week
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - 7));

        const thisWeekFigures = figures.filter(figure =>
            new Date(figure.created_at) >= weekStart
        ).length;

        const thisWeekSummaries = summaries.filter(summary =>
            new Date(summary.created_at) >= weekStart
        ).length;

        const thisWeekQuestions = questions.filter(question =>
            new Date(question.created_at) >= weekStart
        ).length;

        const thisWeekTotal = thisWeekFigures + thisWeekSummaries + thisWeekQuestions;

        const lastWeekStart = new Date(weekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const lastWeekFigures = figures.filter(figure =>
            new Date(figure.created_at) >= lastWeekStart &&
            new Date(figure.created_at) < weekStart
        ).length;

        const lastWeekSummaries = summaries.filter(summary =>
            new Date(summary.created_at) >= lastWeekStart &&
            new Date(summary.created_at) < weekStart
        ).length;

        const lastWeekQuestions = questions.filter(question =>
            new Date(question.created_at) >= lastWeekStart &&
            new Date(question.created_at) < weekStart
        ).length;

        const lastWeekTotal = lastWeekFigures + lastWeekSummaries + lastWeekQuestions;

        const diff = lastWeekTotal ?
            Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) :
            100;

        return {
            value: totalGenerated,
            diff,
            breakdown: {
                figures: figures.length,
                summaries: summaries.length,
                questions: questions.length
            }
        };
    };

    const normalise = (s?: string | null) =>
        (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

    /** Deterministic pastel colour based on a string */
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        const h = hash % 360;
        return `hsl(${h}, 65%, 60%)`;   // Mantine accepts raw CSS colours
    };

    // Add this new function to process objectives by outcomes
    const processObjectivesByOutcome = () => {
        if (!objectives?.length) return [];

        // optional filter
        const objs = selectedOutcome
            ? objectives.filter(o => o.outcome === selectedOutcome)
            : objectives;

        const total = objs.length || 1;          // avoid /0 later
        const byTitle = objs.reduce((acc, o) => {
            const key = normalise(o.title);
            acc[key] = (acc[key] || { raw: o.title, count: 0 });
            acc[key].count += 1;
            return acc;
        }, {} as Record<string, { raw: string; count: number }>);

        return Object.values(byTitle)
            .map(({ raw, count }) => ({
                name: raw.length > 30 ? raw.slice(0, 30) + '…' : raw,
                fullName: raw,
                value: count,
                percent: Math.round((count / total) * 100),
                color: stringToColor(raw)
            }))
            .sort((a, b) => b.value - a.value);
    };

    // Add this state for outcome selection
    const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

    // Get the outcome data for the buttons
    const outcomeOptions = outcomes?.map(outcome => ({
        id: outcome.id,
        name: outcome.title || 'Unnamed Outcome'
    })) || [];

    // Get the pie chart data
    const objectivesChartData = processObjectivesByOutcome();

    // Move this function before it's used
    const buildObjectiveMessageCounts = () => {
        if (!objectives || !messages) return new Map<string, number>();

        // Map objectiveId → Set<messageId>
        const map = new Map<string, Set<string>>();
        
        // Iterate through objectives instead of messages
        objectives.forEach(objective => {
            const messageId = objective.message;  // Get the message id from the objective
            if (!messageId) return;
            
            if (!map.has(objective.id)) map.set(objective.id, new Set());
            map.get(objective.id)!.add(messageId);
        });

        // Convert to counts
        return new Map(
            Array.from(map.entries()).map(([objId, set]) => [objId, set.size])
        );
    };

    // Initialize this before using it in processOutcomesWithTopObjectives
    const objectiveMsgCounts = buildObjectiveMessageCounts();

    // Add this new function to process outcomes and objectives for the grouped bar chart
    const processOutcomesWithTopObjectives = () => {
        if (!outcomes || !objectives) return [];

        // Pre-group objectives by outcomeId
        const byOutcome = outcomes.map(out => {
            const objs = objectives.filter(o => o.outcome === out.id);

            // Merge objectives sharing the same (normalised) title
            const merged = objs.reduce((acc, o) => {
                const key = normalise(o.title);
                const count = objectiveMsgCounts.get(o.id) ?? 0;
                if (!acc[key])
                    acc[key] = { raw: o.title ?? '', count };
                else
                    acc[key].count += count;          // sum counts across duplicates
                return acc;
            }, {} as Record<string, { raw: string; count: number }>);

            // Pick top-3
            const top = Object.values(merged)
                .sort((a, b) => b.count - a.count)
                .slice(0, 3);

            // Ensure exactly 3 slots for consistent bar order
            while (top.length < 3) top.push({ raw: '—', count: 0 });

            return {
                outcome: out.title ?? 'Unnamed',
                objective1: top[0].count,
                objective1Name: top[0].raw,
                objective2: top[1].count,
                objective2Name: top[1].raw,
                objective3: top[2].count,
                objective3Name: top[2].raw,
            };
        });

        return byOutcome;
    };

    // Get the grouped bar chart data
    const outcomesWithObjectivesData = processOutcomesWithTopObjectives();

    // Update the statsData to include the new indicators
    const statsData: {
        title: string;
        icon: React.ElementType;
        value: number | string;
        diff: number;
        diffLabel: string;
        tooltip?: string;
        breakdown?: {
            figures: number;
            summaries: number;
            questions: number;
        };
        totalMessages?: number;
        totalTimeSpent?: string;
        correctCount?: number;
        totalCount?: number;
    }[] = [
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
            {
                title: 'Correct Responses',
                icon: IconStar,
                ...calculateCorrectResponsePercentage(),
                diffLabel: 'Compared to last week'
            },
            {
                title: 'Generated Content',
                icon: IconClock,
                ...calculateGeneratedContent(),
                diffLabel: 'Compared to last week'
            },
        ]

    // Combine all loading states
    const isLoading = messagesLoading || figuresLoading || summariesLoading || questionsLoading;

    // Simplify the return statement to show only 3 charts in a row
    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} mb="xl">
                    {statsData.map((stat) => {
                        const Icon = stat.icon;
                        const DiffIcon = stat.diff ? (stat.diff > 0 ? IconArrowUpRight : IconArrowDownRight) : null;

                        return (
                            <Paper
                                withBorder
                                p="md"
                                radius="md"
                                key={stat.title}
                            >
                                <Group justify="space-between">
                                    <Text size="xs" c="dimmed" fw={700} style={{ textTransform: 'uppercase' }}>
                                        {stat.title}
                                    </Text>
                                    <Icon size={22} stroke={1.5} style={{ color: 'var(--mantine-color-gray-4)' }} />
                                </Group>

                                {!isLoading ? (
                                    <>
                                        <Group align="flex-end" gap="xs" mt={25}>
                                            {stat.title === 'Generated Content' ? (
                                                <Tooltip
                                                    label={
                                                        <Group gap="xs">
                                                            <Text component="span" fw={500}>
                                                                <IconPhoto size={12} style={{ display: 'inline', marginRight: 2 }} />
                                                                {stat.breakdown?.figures || 0} Figures
                                                            </Text>
                                                            <Text component="span" c="dimmed">·</Text>
                                                            <Text component="span" fw={500}>
                                                                <IconFileText size={12} style={{ display: 'inline', marginRight: 2 }} />
                                                                {stat.breakdown?.summaries || 0} Summaries
                                                            </Text>
                                                            <Text component="span" c="dimmed">·</Text>
                                                            <Text component="span" fw={500}>
                                                                <IconQuestionMark size={12} style={{ display: 'inline', marginRight: 2 }} />
                                                                {stat.breakdown?.questions || 0} Questions
                                                            </Text>
                                                        </Group>
                                                    }
                                                    position="bottom"
                                                    withArrow
                                                    multiline
                                                >
                                                    <Text fz={24} fw={700} style={{ lineHeight: 1, cursor: 'pointer' }}>{stat.value}</Text>
                                                </Tooltip>
                                            ) : stat.title === 'Messages Today' ? (
                                                <Tooltip
                                                    label={`Total messages: ${stat.totalMessages}`}
                                                    position="bottom"
                                                    withArrow
                                                >
                                                    <Text fz={24} fw={700} style={{ lineHeight: 1, cursor: 'pointer' }}>{stat.value}</Text>
                                                </Tooltip>
                                            ) : stat.title === 'Average Time Spent' ? (
                                                <Tooltip
                                                    label={`Total time spent: ${stat.totalTimeSpent}`}
                                                    position="bottom"
                                                    withArrow
                                                >
                                                    <Text fz={24} fw={700} style={{ lineHeight: 1, cursor: 'pointer' }}>{stat.value}</Text>
                                                </Tooltip>
                                            ) : stat.title === 'Correct Responses' ? (
                                                <Tooltip
                                                    label={`${stat.correctCount} correct out of ${stat.totalCount} total responses`}
                                                    position="bottom"
                                                    withArrow
                                                >
                                                    <Text fz={24} fw={700} style={{ lineHeight: 1, cursor: 'pointer' }}>{stat.value}</Text>
                                                </Tooltip>
                                            ) : (
                                                <Text fz={24} fw={700} style={{ lineHeight: 1 }}>{stat.value}</Text>
                                            )}
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

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Active Students</Text>
                            <Group gap="xs">
                                <Button
                                    size="xs"
                                    variant={studentTimeFrame === 'day' ? 'filled' : 'outline'}
                                    onClick={() => setStudentTimeFrame('day')}
                                >
                                    Daily
                                </Button>
                                <Button
                                    size="xs"
                                    variant={studentTimeFrame === 'week' ? 'filled' : 'outline'}
                                    onClick={() => setStudentTimeFrame('week')}
                                >
                                    Weekly
                                </Button>
                                <Button
                                    size="xs"
                                    variant={studentTimeFrame === 'month' ? 'filled' : 'outline'}
                                    onClick={() => setStudentTimeFrame('month')}
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
                                >
                                    All Time
                                </Button>
                                <Button
                                    size="xs"
                                    variant={timeFrame === 'recent' ? 'filled' : 'outline'}
                                    onClick={() => setTimeFrame('recent')}
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
                                    tooltipProps={{
                                        content: ({ label, payload }) => {
                                            if (payload && payload.length > 0) {
                                                const date = new Date(label);
                                                const formattedDate = date.toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                });
                                                return (
                                                    <div style={{
                                                        background: 'white',
                                                        padding: '8px',
                                                        border: '1px solid #ccc',
                                                        borderRadius: '4px'
                                                    }}>
                                                        <p style={{ margin: 0 }}><strong>{formattedDate}</strong></p>
                                                        <p style={{ margin: 0 }}>{payload[0].value} messages</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }
                                    }}
                                />
                            ) : (
                                <Stack align="center" justify="flex-end" gap="xl" h={300}>
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

                                </Stack>
                            )
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>

                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Learning Objectives</Text>
                            <Group gap="xs">
                                <Button
                                    size="xs"
                                    variant={selectedOutcome === null ? 'filled' : 'outline'}
                                    onClick={() => setSelectedOutcome(null)}
                                >
                                    All
                                </Button>
                                {outcomeOptions.map(outcome => (
                                    <Button
                                        key={outcome.id}
                                        size="xs"
                                        variant={selectedOutcome === outcome.id ? 'filled' : 'outline'}
                                        onClick={() => setSelectedOutcome(outcome.id)}
                                    >
                                        {outcome.name.length > 10 ? outcome.name.substring(0, 10) + '...' : outcome.name}
                                    </Button>
                                ))}
                            </Group>
                        </Group>
                        {!isLoading ? (
                            objectivesChartData.length > 0 ? (
                                <Stack align="center" justify="center">
                                    <PieChart
                                        size={225}
                                        h={300}
                                        data={objectivesChartData}
                                        withTooltip
                                        tooltipProps={{
                                            content: ({ payload }) =>
                                                payload?.length ? (
                                                    <div style={{ padding: 6 }}>
                                                        <strong>{payload[0].payload.fullName}</strong><br />
                                                        {payload[0].value} objectives – {payload[0].payload.percent} %
                                                    </div>
                                                ) : null
                                        }}
                                        pieProps={{
                                            activeIndex: 0,
                                            activeShape: { opacity: 0.8 },
                                            isAnimationActive: true,
                                            animationDuration: 1000,
                                            animationBegin: 0
                                        }}
                                        strokeWidth={0}
                                    />
                                </Stack>
                            ) : (
                                <Stack align="center" justify="center" h={300}>
                                    <Text size="lg" c="dimmed">No objectives data available</Text>
                                </Stack>
                            )
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>

                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Outcomes & Objectives</Text>
                        </Group>
                        {!isLoading ? (
                            outcomesWithObjectivesData.length > 0 ? (
                                <BarChart
                                    h={300}
                                    data={outcomesWithObjectivesData}
                                    dataKey="outcome"
                                    series={[
                                        { name: 'objective1', color: 'violet.6', label: outcomesWithObjectivesData[0]?.objective1Name || 'Top Objective' },
                                        { name: 'objective2', color: 'blue.6', label: outcomesWithObjectivesData[0]?.objective2Name || 'Second Objective' },
                                        { name: 'objective3', color: 'teal.6', label: outcomesWithObjectivesData[0]?.objective3Name || 'Third Objective' }
                                    ]}
                                    tickLine="y"
                                    gridAxis="xy"
                                    withLegend
                                    withTooltip
                                    tooltipProps={{
                                        content: ({ label, payload }) =>
                                            payload?.length ? (
                                                <div style={{ padding: 8 }}>
                                                    <strong>{label}</strong><br />
                                                    {payload.map((entry, i) => {
                                                        const nameKey = `objective${i + 1}Name`;
                                                        const objName = entry.payload[nameKey];
                                                        return (
                                                            <div key={i} style={{ color: entry.color }}>
                                                                {objName}: {entry.value} msgs
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null
                                    }}
                                    barProps={{ radius: 4 }}
                                    yAxisProps={{
                                        tickFormatter: (value) => Math.round(value).toString()
                                    }}
                                />
                            ) : (
                                <Stack align="center" justify="center" h={300}>
                                    <Text size="lg" c="dimmed">No outcomes data available</Text>
                                </Stack>
                            )
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>
                </SimpleGrid>
            </Container>
        </ClassLayout>
    );
}