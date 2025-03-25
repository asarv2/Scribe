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
    NavLink,
    Switch, ActionIcon, Badge, Accordion, List
} from '@mantine/core'
import type { Class, Profile, Lecture, Textbook, Homework, Download } from "~types"
import { useEffect, useState } from "react"
import type { Course } from "~contents/dashboardDetector"
import type { CourseHomepage } from "~contents/homepageDetector"
import { Storage } from "@plasmohq/storage"
import { Icons } from "~components/Icons"
import { TimeInput } from '@mantine/dates'
import { useQuery } from "~node_modules/@tanstack/react-query/build/legacy/useQuery"
import { getSupabaseClient } from "~utils/supabase/supabase-client"

export default function CourseCard({
    course,
    profile,
    isLoading,
    courseId,
    downloads = [],
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
    homeworks?: Homework[],
    downloads?: Download[]
}) {
    const [downloadStatus, setDownloadStatus] = useState<string>("");
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const storage = new Storage();
    const [scheduledTime, setScheduledTime] = useState<string>("08:00");
    const [isScheduling, setIsScheduling] = useState<boolean>(false);
    const [isScheduled, setIsScheduled] = useState<boolean>(false);

    // Filter pending downloads for this class
    const pendingDownloads = downloads.filter(download => {
        const downloadTime = new Date(download.download_time).getTime();
        const now = new Date().getTime();
        return download.class === course.id &&
            download.status === 'pending' &&
            downloadTime > now;
    }).sort((a, b) => new Date(a.download_time).getTime() - new Date(b.download_time).getTime());

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

            // If upload is complete, get the status from the most recent download record
            if (currentStatus?.includes("Upload complete!")) {
                const latestDownload = downloads
                    .filter(d => d.class === course.id)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

                if (latestDownload) {
                    let displayStatus = latestDownload.status;

                    // Convert to title case
                    displayStatus = displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1).toLowerCase();

                    // Add error message if exists
                    if (latestDownload.error_message) {
                        displayStatus += `: ${latestDownload.error_message}`;
                    }

                    // Add ellipsis if not completed
                    if (!displayStatus.toLowerCase().includes('complete')) {
                        displayStatus += '...';
                    }

                    setDownloadStatus(displayStatus);

                    // If status is completed, clear storage after 2 seconds
                    if (displayStatus.toLowerCase().includes('complete')) {
                        setTimeout(async () => {
                            await storage.remove(`downloadStatus_${courseId}`);
                            await storage.remove(`uploadProgress_${courseId}`);
                            setDownloadStatus('');
                            setUploadProgress(null);
                        }, 2000);
                    }
                }
            } else if (currentStatus) {
                // Convert storage status to title case and add ellipsis
                let displayStatus = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
                if (!displayStatus.includes('...')) {
                    displayStatus += '...';
                }
                setDownloadStatus(displayStatus);
            }

            if (currentProgress !== undefined) {
                setUploadProgress(Number(currentProgress));
            }
        };

        const intervalId = setInterval(checkStatus, 500);
        return () => clearInterval(intervalId);
    }, [courseId, course.id, downloads]);

    // Check if course has scheduled downloads enabled and get the time
    useEffect(() => {
        const checkScheduleStatus = async () => {
            if (!course.id) return;

            // Get download status from database
            setIsScheduled(downloads.some(d => d.class === course.id && d.status === 'pending' && d.profile === profile.id));

            // Get scheduled time if available
            if (course.download_time) {
                const timeStr = course.download_time;
                let formattedTime = "08:00";

                // Convert from database format (could be ISO string or HH:MM) to HH:MM
                if (timeStr.includes('T')) {
                    const date = new Date(timeStr);
                    formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                } else if (timeStr.includes(':')) {
                    formattedTime = timeStr;
                }

                setScheduledTime(formattedTime);
            }
        };

        checkScheduleStatus();
    }, [course, downloads, profile]);


    // Determine status color and icon
    let statusColor = "blue";
    let statusIcon = null;

    if (downloadStatus.includes("complete") || downloadStatus.includes("✅")) {
        statusColor = "green";
        statusIcon = "✅";
    } else if (downloadStatus.includes("error") || downloadStatus.includes("❌")) {
        statusColor = "red";
        statusIcon = "❌";
    } else if (downloadStatus.includes("processing") || downloadStatus.includes("parsing")) {
        statusColor = "yellow";
        statusIcon = "⏳";
    }

    const isUploading = downloadStatus.includes("Adding content to Scribe");
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

    // Updated toggle function to immediately update database
    const toggleScheduledSwitch = async () => {
        if (!course.id) return;
        if (!profile.id) return;

        const newStatus = !isScheduled;
        setIsScheduled(newStatus);

        try {
            // Update download status in background
            const statusResult = await sendToBackground({
                name: "update-download-status",
                body: {
                    classId: course.id,
                    enabled: newStatus,
                    responseUrl: `${process.env.PLASMO_PUBLIC_API_URL}`,
                    profileId: profile.id
                }
            });

            // Only update schedule if enabling downloads and status update was successful
            if (newStatus && statusResult.success) {
                await sendToBackground({
                    name: "update-download-schedule",
                    body: {
                        courseId: courseId,
                        courseDescriptor: course.brightspace_course_descriptor,
                        profileId: profile.id,
                        classId: course.id,
                        scheduledTime
                    }
                });
            }
        } catch (error) {
            console.error("Error updating scheduled status:", error);
            // Revert the switch if there's an error
            setIsScheduled(!newStatus);
        }
    };

    // Updated time change handler to always update database
    const handleTimeChange = async (event) => {
        if (!course.id) return;

        const newTime = event.target.value;
        setScheduledTime(newTime);

        try {
            // Update the time in Supabase directly
            const client = getSupabaseClient();
            await client
                .from('classes')
                .update({
                    download_time: newTime,
                    updated_at: new Date().toISOString()
                })
                .eq('id', course.id);

            // Only update the schedule in background if downloads are enabled
            if (isScheduled) {
                await sendToBackground({
                    name: "update-download-schedule",
                    body: {
                        courseId: courseId,
                        courseDescriptor: course.brightspace_course_descriptor,
                        profileId: profile.id,
                        classId: course.id,
                        scheduledTime: newTime
                    }
                });
            }
        } catch (error) {
            console.error("Error updating scheduled time:", error);
        }
    };

    // Function to download now
    const handleDownloadNow = async () => {
        setIsScheduling(true);
        try {
            await sendToBackground({
                name: "download-course",
                body: {
                    courseId: courseId,
                    courseDescriptor: course.brightspace_course_descriptor,
                    profileId: profile.id,
                    classId: course.id,
                    immediate: true  // Add flag to indicate immediate download
                }
            });
        } catch (error) {
            console.error("Error downloading course:", error);
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
                                window.open(`https://scribe.it.com/classes/c/${course.id}`, '_blank');
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

                {/* Updated time picker section without save button */}
                {(course.download || profile.admin) && <Group mt="md" align="center">
                    <Switch
                        checked={isScheduled}
                        onChange={toggleScheduledSwitch}
                        label="Update daily"
                    />
                    <TimeInput
                        value={scheduledTime}
                        onChange={handleTimeChange}
                        withSeconds={false}
                        disabled={!profile.admin && !profile.professor}
                    />
                </Group>}

                {/* Pending downloads section */}
                {pendingDownloads.length > 0 && (
                    <Accordion variant="contained" mt="xs">
                        <Accordion.Item value="pending-downloads">
                            <Accordion.Control>
                                <Group>
                                    <Text size="sm">Pending Downloads</Text>
                                    <Badge>{pendingDownloads.length}</Badge>
                                </Group>
                            </Accordion.Control>
                            <Accordion.Panel>
                                <List size="xs" spacing="xs">
                                    {pendingDownloads.map((download) => (
                                        <List.Item key={download.id}>
                                            {new Date(download.download_time).toLocaleString()}
                                        </List.Item>
                                    ))}
                                </List>
                            </Accordion.Panel>
                        </Accordion.Item>
                    </Accordion>
                )}

                {/* Download now button */}
                {(course.download || profile.admin) && <Button
                    onClick={handleDownloadNow}
                    loading={isScheduling || isLoading}
                    leftSection={<Icons.Download />}
                    variant="filled"
                    color="blue"
                    fullWidth
                    mt="md"
                >
                    Download Now
                </Button>}
            </Stack>
        </Card>
    )
}

