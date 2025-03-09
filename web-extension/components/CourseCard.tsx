/**
 * CourseCard.tsx
 * 
 * This component is used to display a course card on the dashboard.
 * It is used to display the course name, the course code, and the course description.
 * It is also used to display the course status and the course progress.
 * 
 * @AshokSaravanan222
 * 03.06.2025
 * 
 */

import { sendToBackground } from "@plasmohq/messaging"
import {
    Stack, Card, Text, Button, Group, Progress, Tooltip,
    RingProgress, Center, SimpleGrid,
    NavLink
} from '@mantine/core'
import type { Class, Profile, Lecture, Textbook, Homework } from "~types"
import { useEffect, useState } from "react"
import type { Course } from "~contents/dashboardDetector"
import type { CourseHomepage } from "~contents/homepageDetector"
import { Storage } from "@plasmohq/storage"
import { Icons } from "~components/Icons"
import { TimeInput } from '@mantine/dates'
import { useQuery } from "~node_modules/@tanstack/react-query/build/legacy/useQuery"

export default function CourseCard({
    course,
    profile,
    isLoading,
    courseId,
    lectures = [],
    textbooks = [],
    homeworks = []
}: {
    course: Class,
    profile: Profile,
    isLoading?: boolean,
    courseId?: string,
    lectures?: Lecture[],
    textbooks?: Textbook[],
    homeworks?: Homework[]
}) {
    const [downloadStatus, setDownloadStatus] = useState<string>("");
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const storage = new Storage();
    const [scheduledTime, setScheduledTime] = useState<string>("08:00");
    const [isScheduling, setIsScheduling] = useState<boolean>(false);

    // Get the title from the appropriate property
    const fullTitle = course.title || 'Unknown Course';

    // Get class code directly if available
    const classCode = course.class_code;

    // Parse class code from title if not directly available
    let displayCode = classCode;
    if (!displayCode) {
        // Match patterns like "Spring 2025 STAT/MA 41600-003 LEC"
        const codeMatch = fullTitle.match(/(?:Spring|Fall|Summer)\s+\d{4}\s+([A-Z]+(?:\/[A-Z]+)?\s+\d{3,5})/i);
        if (codeMatch) {
            // Format the code (e.g., "STAT/MA 41600" -> "STAT/MA 416")
            displayCode = codeMatch[1].replace(/(\d{3})\d{2}/, '$1');
        } else {
            // Fallback to just showing the first 20 chars of the title
            displayCode = fullTitle.length > 20 ? fullTitle.substring(0, 20) + '...' : fullTitle;
        }
    }

    // Get updated_at timestamp if available
    const updatedAt = course.updated_at;
    let formattedDate = '';

    if (updatedAt) {
        // Format the date (e.g., "Jan 15, 2025")
        const date = new Date(updatedAt);
        formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        });
    }

    // Check for course-specific download status
    useEffect(() => {
        if (!courseId) return;

        const checkStatus = async () => {
            const currentStatus = await storage.get(`downloadStatus_${courseId}`);
            const currentProgress = await storage.get(`uploadProgress_${courseId}`);

            if (currentStatus) setDownloadStatus(currentStatus);
            if (currentProgress !== undefined) setUploadProgress(Number(currentProgress));
        };

        const intervalId = setInterval(checkStatus, 500);
        return () => clearInterval(intervalId);
    }, [courseId]);

    // Determine status color and icon
    let statusColor = "blue";
    let statusIcon = null;

    if (downloadStatus.includes("complete") || downloadStatus.includes("✅")) {
        statusColor = "green";
        statusIcon = "✅";
    } else if (downloadStatus.includes("error") || downloadStatus.includes("❌")) {
        statusColor = "red";
        statusIcon = "❌";
    }

    const isUploading = downloadStatus.includes("Uploading to server");
    const hasStatus = downloadStatus && downloadStatus.trim() !== '';

    // Calculate parse status percentages
    const calculateParseStatus = (items: any[]) => {
        if (!items || items.length === 0) return { percent: 0, count: 0, total: 0 };

        const completedCount = items.filter(item =>
            item.parse_status === 'complete' || item.parse_status === 'completed'
        ).length;

        return {
            percent: Math.round((completedCount / items.length) * 100),
            count: completedCount,
            total: items.length
        };
    };

    const lectureStatus = calculateParseStatus(lectures);
    const textbookStatus = calculateParseStatus(textbooks);
    const homeworkStatus = calculateParseStatus(homeworks);

    // Determine if we should show the status indicators
    const hasContentItems = lectures.length > 0 || textbooks.length > 0 || homeworks.length > 0;

    // Function to schedule downloads
    const handleScheduleDownload = async () => {
        setIsScheduling(true);
        try {
            await sendToBackground({
                name: "download-course",
                body: {
                    courseId: courseId,
                    courseDescriptor: course.brightspace_course_descriptor,
                    profileId: profile.id,
                    classId: course.id,
                    scheduledTime
                }
            });
        } catch (error) {
            console.error("Error scheduling download:", error);
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <Card shadow="sm" p="md" withBorder>
            <Stack gap="xs">
                <Group justify="space-between" align="center">
                    <div>
                        <Text fw={500}>{displayCode}</Text>
                        {updatedAt && !hasStatus ? (
                            <Text size="xs" c="dimmed">Last updated: {formattedDate}</Text>
                        ) : hasStatus ? (
                            <Group gap="xs" align="center">
                                {statusIcon && <Text size="xs">{statusIcon}</Text>}
                                <Text size="xs" c={statusColor}>
                                    {downloadStatus}
                                </Text>
                            </Group>
                        ) : (
                            <Text size="xs" c="dimmed">Ready to download</Text>
                        )}
                    </div>
                    <Tooltip label="View on Scribe">
                        <Button
                            variant="subtle"
                            size="xs"
                            color="blue"
                            p={4}
                            onClick={() => {
                                window.open(`https://scribe-lec.vercel.app/classes/c/${course.id}`, '_blank');
                            }}
                        >
                            <Icons.Eye />
                        </Button>
                    </Tooltip>
                </Group>

                {isUploading && uploadProgress !== null && (
                    <Progress
                        value={uploadProgress}
                        size="xs"
                        color={statusColor}
                        striped
                        animated
                    />
                )}

                {hasContentItems && !isUploading && (
                    <SimpleGrid cols={3} spacing="xs" mt="xs">
                        {lectures.length > 0 && (
                            <Tooltip label={`Lectures: ${lectureStatus.count}/${lectureStatus.total} parsed`}>
                                <div>
                                    <RingProgress
                                        size={80}
                                        thickness={4}
                                        roundCaps
                                        sections={[{ value: lectureStatus.percent, color: 'blue' }]}
                                        label={
                                            <Center>
                                                <Text size="xs" fw={700}>
                                                    {lectureStatus.percent}%
                                                </Text>
                                            </Center>
                                        }
                                    />
                                    <Text size="xs" ta="center" mt={2}>Lectures</Text>
                                </div>
                            </Tooltip>
                        )}

                        {textbooks.length > 0 && (
                            <Tooltip label={`Textbooks: ${textbookStatus.count}/${textbookStatus.total} parsed`}>
                                <div>
                                    <RingProgress
                                        size={80}
                                        thickness={4}
                                        roundCaps
                                        sections={[{ value: textbookStatus.percent, color: 'green' }]}
                                        label={
                                            <Center>
                                                <Text size="xs" fw={700}>
                                                    {textbookStatus.percent}%
                                                </Text>
                                            </Center>
                                        }
                                    />
                                    <Text size="xs" ta="center" mt={2}>Textbooks</Text>
                                </div>
                            </Tooltip>
                        )}

                        {homeworks.length > 0 && (
                            <Tooltip label={`Homeworks: ${homeworkStatus.count}/${homeworkStatus.total} parsed`}>
                                <div>
                                    <RingProgress
                                        size={80}
                                        thickness={4}
                                        roundCaps
                                        sections={[{ value: homeworkStatus.percent, color: 'orange' }]}
                                        label={
                                            <Center>
                                                <Text size="xs" fw={700}>
                                                    {homeworkStatus.percent}%
                                                </Text>
                                            </Center>
                                        }
                                    />
                                    <Text size="xs" ta="center" mt={2}>HW</Text>
                                </div>
                            </Tooltip>
                        )}
                    </SimpleGrid>
                )}

                {/* Time picker and schedule button */}
                <Group mt="md">
                    <TimeInput
                        label="Schedule daily download"
                        value={scheduledTime}
                        onChange={(event) => setScheduledTime(event.target.value)}
                        withSeconds={false}
                    />
                    <Button
                        onClick={handleScheduleDownload}
                        loading={isScheduling}
                        variant="light"
                        leftSection={<Icons.Clock />}
                    >
                        Schedule
                    </Button>
                </Group>

                {/* Download now button */}
                <Button
                    onClick={handleScheduleDownload}
                    loading={isLoading}
                    leftSection={<Icons.Download />}
                    variant="filled"
                    color="blue"
                    fullWidth
                    mt="md"
                >
                    Download Now
                </Button>
            </Stack>
        </Card>
    )
}

