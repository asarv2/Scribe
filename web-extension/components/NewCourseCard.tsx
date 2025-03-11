import { sendToBackground } from "@plasmohq/messaging"
import { Storage } from "@plasmohq/storage"
import { Card, Text, Button, Group, Tooltip } from '@mantine/core'
import { useState, useEffect } from "react"
import { Icons } from "~/components/Icons"
import type { Class, Profile } from "~types"
import type { CourseHomepage } from "~contents/homepageDetector"
import type { Course } from "~contents/dashboardDetector"

export default function NewCourseCard({
    course,
    profile,
    isLoading,
    courseId
}: {
    course: Course | CourseHomepage,
    profile: Profile,
    isLoading?: boolean,
    courseId?: string
}) {
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [createStatus, setCreateStatus] = useState<string>("");
    const storage = new Storage();

    // Get the title from the appropriate property
    const fullTitle = course.name;

    // Parse class code from title if not directly available
    let displayCode = "";
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

    // Check for course-specific create status
    useEffect(() => {
        if (!courseId) return;

        const checkStatus = async () => {
            const currentStatus = await storage.get(`createStatus_${courseId}`);
            if (currentStatus) setCreateStatus(currentStatus);
        };

        const intervalId = setInterval(checkStatus, 500);
        return () => clearInterval(intervalId);
    }, [courseId]);

    // Determine status color and icon
    let statusColor = "blue";
    let statusIcon = null;

    if (createStatus.includes("created") || createStatus.includes("✅")) {
        statusColor = "green";
        statusIcon = "✅";
    } else if (createStatus.includes("error") || createStatus.includes("❌")) {
        statusColor = "red";
        statusIcon = "❌";
    }

    const hasStatus = createStatus && createStatus.trim() !== '';

    // Function to create a course
    const handleCreateCourse = async () => {
        setIsCreating(true);
        try {
            await sendToBackground({
                name: "create-course",
                body: { 
                    courseId: courseId, 
                    courseDescriptor: course.courseDescriptor, 
                    profileId: profile.id
                }
            });
        } catch (error) {
            console.error("Error creating course:", error);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Card shadow="sm" p="md" withBorder>
            <Group justify="space-between" align="center">
                <div>
                    <Text fw={500}>{displayCode}</Text>
                    {hasStatus ? (
                        <Group gap="xs" align="center">
                            {statusIcon && <Text size="xs">{statusIcon}</Text>}
                            <Text size="xs" c={statusColor}>
                                {createStatus}
                            </Text>
                        </Group>
                    ) : (
                        <Text size="xs" c="dimmed">Detected on Brightspace</Text>
                    )}
                </div>
                {/* <Tooltip label="Add Course">
                    <Button
                        variant="subtle"
                        size="xs"
                        onClick={handleCreateCourse}
                        loading={isCreating}
                        color="green"
                        p={4}
                    >
                        <Icons.Plus />
                    </Button>
                </Tooltip> */}
            </Group>

            <Button
                onClick={handleCreateCourse}
                loading={isCreating}
                leftSection={<Icons.Plus />}
                variant="filled"
                color="green"
                fullWidth
                mt="md"
            >
                Add Course
            </Button>
        </Card>
    )
}