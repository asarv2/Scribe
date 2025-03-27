/**
 * app/classes/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../../utils/supabase/supabase-browser";
import { AppShell, Button, Burger, Container, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme, Card, Badge, Group, Paper, Skeleton } from "@mantine/core";
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
import { getMessageEvals } from "@/utils/queries/get-message-evals";
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
import { BubbleChart } from '@mantine/charts';
import { PieChart } from '@mantine/charts';
import {
    IconArrowDownRight,
    IconArrowUpRight,
    IconMessage,
    IconClock,
    IconStar,
    IconHourglass,
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

    const {data: profiles, isLoading: loadingProfiles} = useQuery({
        queryKey: ["profiles", classId],
        queryFn: () => getProfiles(supabase),
        enabled: !!classData
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

    const { data: messageEvals, isLoading: loadingMessageEvals } = useQuery({
        queryKey: ["messageEvals", classId],
        queryFn: () => getMessageEvals(supabase, messages ? messages.map(message => message.id) : []),
        enabled: !!messages
    })

    const { data: faqLectures, isLoading: loadingFaqLectures } = useQuery({
        queryKey: ["faqLectures", classId],
        queryFn: () => getLecturesById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.lectures)))),
        enabled: !!faqs
    })

    const { data: faqChapters, isLoading: loadingFaqChapters } = useQuery({
        queryKey: ["faqChapters", classId],
        queryFn: () => getChaptersById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.chapters)))),
        enabled: !!faqs
    })


    const { data: faqHomeworks, isLoading: loadingFaqHomeworks } = useQuery({
        queryKey: ["faqHomeworks", classId],
        queryFn: () => getHomeworksById(supabase, Array.from(new Set(faqs?.flatMap(faq => faq.homeworks)))),
        enabled: !!faqs
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
            const studentId = chat?.profile;
            const student = profiles?.find(student => student.id === studentId);
            const studentName = student ? (student.first_name + ' ' + student.last_name) : 'Anonymous';
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

        // filter topics that do not have 'lecture', 'chapter' or 'homework' in the topic

        const filteredTopics = Object.fromEntries(
            Object.entries(topicCounts).filter(([topic]) => 
                !topic.toLowerCase().includes('lecture') && 
                !topic.toLowerCase().includes('chapter') && 
                !topic.toLowerCase().includes('homework')
            )
        );

        return Object.entries(filteredTopics)
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
        if (!faqs || !faqLectures) return [];

        const lectureCounts = faqs.reduce((acc: { [key: string]: number }, faq) => {
            if (faq.lectures) {
                const lecture = faqLectures.find(l => faq.lectures.includes(l.id));
                if (lecture) {
                    const lectureName = `${lecture.name}`;
                    acc[lectureName] = (acc[lectureName] || 0) + 1;
                }
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
                if (chapter) {
                    const chapterName = `${chapter.title}`;
                    acc[chapterName] = (acc[chapterName] || 0) + 1;
                }
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
                if (homework) {
                    const homeworkName = `${homework.title}`;
                    acc[homeworkName] = (acc[homeworkName] || 0) + 1;
                }
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
    const [resourceType, setResourceType] = useState<'general' | 'homework' | 'lecture' | 'textbook'>('general');
    const [timeFrame, setTimeFrame] = useState<'all' | 'recent'>('all');

    // Process messages data for the last 24 hours
    const processRecentMessagesData = () => {
        if (!messages) return [];

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const recentMessages = messages.filter(message =>
            new Date(message.created_at) >= oneDayAgo
        );

        const messagesByHour = Array.from({ length: 24 }, (_, i) => {
            const hour = (now.getHours() - i + 24) % 24;
            return {
                hour: `${hour}:00`,
                messages: 0
            };
        }).reverse();

        recentMessages.forEach(message => {
            const messageDate = new Date(message.created_at);
            const hoursDiff = Math.floor((now.getTime() - messageDate.getTime()) / (60 * 60 * 1000));
            if (hoursDiff < 24) {
                const index = 23 - hoursDiff;
                if (index >= 0) messagesByHour[index].messages++;
            }
        });

        return messagesByHour;
    };

    // Get the appropriate data based on the selected resource type
    const getResourceData = () => {
        // Define a set of distinct colors for better visualization
        const colors = ['blue.6', 'green.6', 'violet.6', 'orange.6', 'cyan.6', 'red.6', 'yellow.6', 'indigo.6'];

        switch (resourceType) {
            case 'general':
                return faqTopicsData.slice(0, 5).map((item, index) => ({
                    name: item.topic,
                    value: item.count,
                    color: colors[index % colors.length]
                }));
            case 'homework':
                return faqHomeworksData.slice(0, 5).map((item, index) => ({
                    name: item.name,
                    value: item.count,
                    color: colors[index % colors.length]
                }));
            case 'lecture':
                return faqLecturesData.slice(0, 5).map((item, index) => ({
                    name: item.name,
                    value: item.count,
                    color: colors[index % colors.length]
                }));
            case 'textbook':
                return faqChaptersData.slice(0, 5).map((item, index) => ({
                    name: item.name,
                    value: item.count,
                    color: colors[index % colors.length]
                }));
            default:
                return faqTopicsData.slice(0, 5).map((item, index) => ({
                    name: item.topic,
                    value: item.count,
                    color: colors[index % colors.length]
                }));
        }
    };

    const recentMessagesData = processRecentMessagesData();

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

    const calculateAverageLatency = () => {
        if (!messageEvals) return { value: "0s", diff: 100 };

        // Get this week's latencies
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - 7));
        
        const thisWeekEvals = messageEvals.filter(evalItem => 
            new Date(evalItem.created_at) >= weekStart
        );

        const thisWeekAvg = thisWeekEvals.reduce((sum, evalItem) => 
            sum + evalItem.latency, 0) / (thisWeekEvals.length || 1);

        // Get last week's latencies for comparison
        const lastWeekStart = new Date(weekStart.setDate(weekStart.getDate() - 7));
        const lastWeekEvals = messageEvals.filter(evalItem => 
            new Date(evalItem.created_at) >= lastWeekStart && 
            new Date(evalItem.created_at) < weekStart
        );

        const lastWeekAvg = lastWeekEvals.reduce((sum, evalItem) => 
            sum + evalItem.latency, 0) / (lastWeekEvals.length || 1);

        const diff = lastWeekAvg ? 
            Math.round(((lastWeekAvg - thisWeekAvg) / lastWeekAvg) * 100) : 
            100;

        return { 
            value: `${(thisWeekAvg / 1000).toFixed(1)}s`, 
            diff 
        };
    };


    const calculateAverageRating = () => {
        if (!chats) return { value: "0", diff: 0 };

        // Get this month's ratings
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const thisMonthChats = chats.filter(chat =>
            new Date(chat.created_at) >= monthStart && chat.rating
        );

        const thisMonthAvg = thisMonthChats.reduce((sum, chat) =>
            sum + (chat.rating || 0), 0) / (thisMonthChats.length || 1);

        // Get last month's ratings for comparison
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthChats = chats.filter(chat =>
            new Date(chat.created_at) >= lastMonthStart &&
            new Date(chat.created_at) < monthStart &&
            chat.rating
        );

        const lastMonthAvg = lastMonthChats.reduce((sum, chat) =>
            sum + (chat.rating || 0), 0) / (lastMonthChats.length || 1);

        const diff = lastMonthAvg ?
            Math.round(((thisMonthAvg - lastMonthAvg) / lastMonthAvg) * 100) :
            0;

        return {
            value: thisMonthAvg.toFixed(1),
            diff
        };
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

    // Update the statsData to use the new calculation results
    const statsData = [
        {
            title: 'Messages Today',
            icon: IconMessage,
            ...calculateMessagesToday(),
            diffLabel: 'Compared to yesterday'
        },
        {
            title: 'Average Latency',
            icon: IconClock,
            ...calculateAverageLatency(),
            diffLabel: 'Faster than last week'
        },
        {
            title: 'Chat Rating',
            icon: IconStar,
            ...calculateAverageRating(),
            diffLabel: 'Compared to last month'
        },
        {
            title: 'Average Time Spent',
            icon: IconHourglass,
            ...calculateAverageTimeSpent(),
            diffLabel: 'Compared to last week'
        },
    ];

    // Combine all loading states
    const isLoading = loadingMessageEvals || loadingFaqs || !messages || !chats || !messageEvals;

    // Add this helper function to check if data exists for each type
    const hasDataForType = (type: 'general' | 'homework' | 'lecture' | 'textbook') => {
        switch (type) {
            case 'general':
                return faqTopicsData.length > 0;
            case 'homework':
                return faqHomeworksData.length > 0;
            case 'lecture':
                return faqLecturesData.length > 0;
            case 'textbook':
                return faqChaptersData.length > 0;
            default:
                return false;
        }
    };

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

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
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

                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Common Questions</Text>
                            <Group gap="xs">
                                {/* Only show buttons if there's any data at all */}
                                {(faqTopicsData.length > 0 || faqHomeworksData.length > 0 || 
                                  faqLecturesData.length > 0 || faqChaptersData.length > 0) ? (
                                    <>
                                        {hasDataForType('general') && (
                                            <Button
                                                size="xs"
                                                variant={resourceType === 'general' ? 'filled' : 'outline'}
                                                onClick={() => setResourceType('general')}
                                                disabled={!isProfessorOrAdmin()}
                                            >
                                                General
                                            </Button>
                                        )}
                                        {hasDataForType('homework') && (
                                            <Button
                                                size="xs"
                                                variant={resourceType === 'homework' ? 'filled' : 'outline'}
                                                onClick={() => setResourceType('homework')}
                                                disabled={!isProfessorOrAdmin()}
                                            >
                                                Homework
                                            </Button>
                                        )}
                                        {hasDataForType('lecture') && (
                                            <Button
                                                size="xs"
                                                variant={resourceType === 'lecture' ? 'filled' : 'outline'}
                                                onClick={() => setResourceType('lecture')}
                                                disabled={!isProfessorOrAdmin()}
                                            >
                                                Lecture
                                            </Button>
                                        )}
                                        {hasDataForType('textbook') && (
                                            <Button
                                                size="xs"
                                                variant={resourceType === 'textbook' ? 'filled' : 'outline'}
                                                onClick={() => setResourceType('textbook')}
                                                disabled={!isProfessorOrAdmin()}
                                            >
                                                Chapters
                                            </Button>
                                        )}
                                    </>
                                ) : !isLoading && (
                                    <Text size="sm" c="dimmed">No question data available</Text>
                                )}
                            </Group>
                        </Group>
                        {!isLoading ? (
                            getResourceData().length > 0 ? (
                                <Stack>
                                    <PieChart
                                        size={225}
                                        h={300}
                                        w={300}
                                        data={getResourceData()}
                                        withTooltip
                                        tooltipProps={{ 
                                            position: { x: 300, y: 50 },
                                            active: true,
                                            defaultIndex: 0,
                                            // wrapperStyle: { userSelect: 'text', pointerEvents: 'auto' },
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
                                    <Text size="lg" c="dimmed">No data available</Text>
                                </Stack>
                            )
                        ) : (
                            <Skeleton height={300} radius="md" />
                        )}
                    </Card>

                    {/* Add a fourth card here if needed */}
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Group justify="space-between" mb="md">
                            <Text size="lg" fw={500}>Student Engagement</Text>
                        </Group>
                        {!isLoading ? (
                            <BarChart
                                h={300}
                                data={studentMessagesData.slice(0, 10)}
                                dataKey="student"
                                series={[{ name: 'messages', color: 'green.6' }]}
                                tickLine="y"
                                gridAxis="xy"
                                withLegend
                                withTooltip
                                barProps={{ radius: 4 }}
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