import { sendToBackground } from "@plasmohq/messaging"
import {
    Stack, Card, Text, Container, Loader, Center, Button, Group, Badge,
    Tabs, Divider, Alert, Box, Title,
    useMantineColorScheme, Progress
} from '@mantine/core'
import { useQuery } from "@tanstack/react-query"
import { Providers } from "~providers"
import type { Class } from "~types"
import { useEffect, useState } from "react"
import type { Course } from "~contents/dashboardDetector"
import type { CourseHomepage } from "~contents/homepageDetector"
import { Storage } from "@plasmohq/storage"

// Define page types
enum PageType {
    UNKNOWN = "UNKNOWN",
    DASHBOARD = "DASHBOARD",
    HOMEPAGE = "HOMEPAGE"
}

// Add these SVG icons at the top of the file
const Icons = {
    Dashboard: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
    ),
    Home: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12H3l9-9 9 9h-2" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
    ),
    AlertCircle: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    )
}

// Simplified DownloadStatus component
function DownloadStatus() {
    const [status, setStatus] = useState<string>("");
    const [progress, setProgress] = useState<number | null>(null);
    const storage = new Storage();

    useEffect(() => {
        const checkStatus = async () => {
            const currentStatus = await storage.get('downloadStatus');
            const currentProgress = await storage.get('uploadProgress');
            
            if (currentStatus) setStatus(currentStatus);
            if (currentProgress !== undefined) setProgress(Number(currentProgress));
        };

        const intervalId = setInterval(checkStatus, 500);
        return () => clearInterval(intervalId);
    }, []);

    if (!status) return null;

    let color = "blue";
    let icon = null;

    if (status.includes("complete") || status.includes("✅")) {
        color = "green";
        icon = "✅";
    } else if (status.includes("Error")) {
        color = "red";
        icon = "❌";
    }

    const isUploading = status.includes("Uploading to server");

    return (
        <Alert 
            color={color} 
            variant="light"
            icon={icon}
            mt="md"
            withCloseButton
            onClose={async () => {
                await storage.set('downloadStatus', '');
                await storage.set('uploadProgress', null);
                setStatus('');
                setProgress(null);
            }}
        >
            <Text>{status}</Text>
            
            {isUploading && progress !== null && (
                <Progress 
                    value={progress} 
                    mt="xs" 
                    size="sm" 
                    color={color}
                    striped
                    animated
                />
            )}
        </Alert>
    );
}

// Simplified CourseCard component
function CourseCard({
    course,
    onDownload,
    isDownloading
}: {
    course: Course | CourseHomepage,
    onDownload: () => void,
    isDownloading?: boolean
}) {
    return (
        <Card shadow="sm" p="md" withBorder>
            <Text fw={600} size="lg">{course.name}</Text>
            <Text size="sm">Course ID: {course.courseId}</Text>
            {course.courseDescriptor && (
                <Text size="sm">Course Descriptor: {course.courseDescriptor}</Text>
            )}
            <Group mt="md">
                <Button
                    size="xs"
                    onClick={onDownload}
                    loading={isDownloading}
                    color="blue"
                >
                    Download Course
                </Button>
            </Group>
        </Card>
    )
}

function IndexPopupContent() {
    // State for page type and URL
    const [pageType, setPageType] = useState<PageType>(PageType.UNKNOWN)
    const [currentUrl, setCurrentUrl] = useState<string>("")
    const [courseId, setCourseId] = useState<string | null>(null)

    // State for different detectors
    const [detectedCourses, setDetectedCourses] = useState<Course[]>([])
    const [homepageInfo, setHomepageInfo] = useState<CourseHomepage | null>(null)

    // Loading and error states
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const colorScheme = useMantineColorScheme()

    // Query to get saved classes from database
    const { data: savedClasses, isLoading: isLoadingSaved, error: savedError } = useQuery({
        queryKey: ["classes"],
        queryFn: async () => {
            const response = await sendToBackground<{}, { classes: Class[] }>({
                name: "get-classes"
            })
            return response.classes
        }
    })

    // Add state for tracking downloads
    const [downloadingSessions, setDownloadingSessions] = useState<Record<string, boolean>>({});
    const storage = new Storage();

    // Function to get the active tab
    const getActiveTab = async () => {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
            return tabs[0]
        } catch (err) {
            console.error("Error getting active tab:", err)
            setError("Could not access active tab")
            return null
        }
    }

    // Function to determine page type from URL
    const determinePageType = (url: string): { type: PageType; id: string | null } => {
        if (!url) return { type: PageType.UNKNOWN, id: null }

        // Homepage pattern (7 digit ID)
        const homepageMatch = url.match(/https:\/\/purdue\.brightspace\.com\/d2l\/home\/(\d{7})/)
        if (homepageMatch) {
            return { type: PageType.HOMEPAGE, id: homepageMatch[1] }
        }

        // Dashboard pattern (4-6 digit ID)
        const dashboardMatch = url.match(/https:\/\/purdue\.brightspace\.com\/d2l\/home\/(\d{4})/)
        if (dashboardMatch) {
            return { type: PageType.DASHBOARD, id: dashboardMatch[1] }
        }

        return { type: PageType.UNKNOWN, id: null }
    }

    // Function to detect courses on dashboard
    const detectCoursesOnDashboard = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const tab = await getActiveTab()
            if (!tab || !tab.id) {
                setError("No active tab found")
                setIsLoading(false)
                return
            }

            // Send message to content script
            chrome.tabs.sendMessage(
                tab.id,
                { action: "getCourses" },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error:", chrome.runtime.lastError.message)
                        setError("Content script not available on this page")
                    } else if (response && response.courses) {
                        setDetectedCourses(response.courses)
                    } else {
                        setError("No courses found or invalid response")
                    }
                    setIsLoading(false)
                }
            )
        } catch (err) {
            console.error("Error detecting courses:", err)
            setError("Error communicating with page")
            setIsLoading(false)
        }
    }

    // Function to detect homepage info
    const detectHomepageInfo = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const tab = await getActiveTab()
            if (!tab || !tab.id) {
                setError("No active tab found")
                setIsLoading(false)
                return
            }

            // Send message to homepage detector content script
            chrome.tabs.sendMessage(
                tab.id,
                {
                    action: "getCourseHomepage",
                    courses: savedClasses || []
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error:", chrome.runtime.lastError.message)
                        setError("Homepage detector not available on this page")
                    } else if (response && response.success && response.homepage) {
                        setHomepageInfo(response.homepage)
                    } else {
                        setError(response?.error || "Failed to get homepage information")
                    }
                    setIsLoading(false)
                }
            )
        } catch (err) {
            console.error("Error detecting homepage:", err)
            setError("Error communicating with page")
            setIsLoading(false)
        }
    }

    // Update the download function
    const downloadCourseContent = async (courseId: string, courseDescriptor: string) => {
        try {
            setDownloadingSessions(prev => ({ ...prev, [courseId]: true }));
            await storage.set('downloadStatus', "Initiating download...");

            const response = await sendToBackground<
                { courseId: string; courseDescriptor: string },
                { success: boolean; downloads?: any[]; error?: string }
            >({
                name: "download-course",
                body: { courseId, courseDescriptor }
            });

            console.log("Download response:", response);

            if (!response.success) {
                throw new Error(response.error || "Download failed");
            }

        } catch (err) {
            console.error("Error downloading content:", err);
            setError(err.message || "Error downloading content");
            await storage.set('downloadStatus', `Error: ${err.message || "Download failed"}`);
        } finally {
            setDownloadingSessions(prev => ({ ...prev, [courseId]: false }));
        }
    };

    // Function to refresh data based on current page type
    const refreshData = () => {
        switch (pageType) {
            case PageType.DASHBOARD:
                detectCoursesOnDashboard()
                break
            case PageType.HOMEPAGE:
                detectHomepageInfo()
                break
            default:
                // Nothing to refresh for unknown pages
                break
        }
    }

    // Initialize on popup open
    useEffect(() => {
        const initializePopup = async () => {
            setIsLoading(true)

            try {
                const tab = await getActiveTab()
                if (!tab || !tab.url) {
                    setError("No active tab or URL found")
                    setIsLoading(false)
                    return
                }

                setCurrentUrl(tab.url)

                // Determine page type from URL
                const { type, id } = determinePageType(tab.url)
                setPageType(type)
                setCourseId(id)

                // Load appropriate data based on page type
                switch (type) {
                    case PageType.DASHBOARD:
                        detectCoursesOnDashboard()
                        break
                    case PageType.HOMEPAGE:
                        detectHomepageInfo()
                        break
                    default:
                        setIsLoading(false)
                        break
                }
            } catch (err) {
                console.error("Error initializing popup:", err)
                setError("Error initializing popup")
                setIsLoading(false)
            }
        }

        initializePopup()
    }, [])

    // Render page type icon
    const renderPageTypeIcon = () => {
        switch (pageType) {
            case PageType.DASHBOARD:
                return <Icons.Dashboard />
            case PageType.HOMEPAGE:
                return <Icons.Home />
            default:
                return <Icons.AlertCircle />
        }
    }

    // Render content based on page type
    const renderPageContent = () => {
        switch (pageType) {
            case PageType.DASHBOARD:
                return (
                    <Stack>
                        <Group>
                            <Icons.Dashboard />
                            <Text fw={600}>Dashboard</Text>
                        </Group>

                        {isLoading ? (
                            <Center py="md"><Loader size="sm" /></Center>
                        ) : error ? (
                            <Alert color="red" title="Error" icon={<Icons.AlertCircle />}>
                                {error}
                            </Alert>
                        ) : detectedCourses.length > 0 ? (
                            <Stack gap="md">
                                {detectedCourses.map((course) => (
                                    <CourseCard
                                        key={course.courseId}
                                        course={course}
                                        onDownload={() => downloadCourseContent(course.courseId, course.courseDescriptor)}
                                        isDownloading={downloadingSessions[course.courseId]}
                                    />
                                ))}
                            </Stack>
                        ) : (
                            <Text size="sm" c="dimmed">No courses detected on this dashboard</Text>
                        )}

                        <Button size="sm" onClick={refreshData} loading={isLoading}>
                            Refresh Courses
                        </Button>

                        <DownloadStatus />
                    </Stack>
                )

            case PageType.HOMEPAGE:
                return (
                    <Stack>
                        <Group>
                            <Icons.Home />
                            <Text fw={600}>Course Homepage</Text>
                        </Group>

                        {isLoading ? (
                            <Center py="md"><Loader size="sm" /></Center>
                        ) : error ? (
                            <Alert color="red" title="Error" icon={<Icons.AlertCircle />}>
                                {error}
                            </Alert>
                        ) : homepageInfo ? (
                            <CourseCard
                                course={homepageInfo}
                                onDownload={() => downloadCourseContent(homepageInfo.courseId, homepageInfo.courseDescriptor)}
                                isDownloading={downloadingSessions[homepageInfo.courseId]}
                            />
                        ) : (
                            <Text size="sm" c="dimmed">No course homepage information detected</Text>
                        )}

                        <Button size="sm" onClick={refreshData} loading={isLoading}>
                            Refresh Homepage Info
                        </Button>

                        <DownloadStatus />
                    </Stack>
                )

            default:
                return (
                    <Stack>
                        <Alert color="yellow" title="Unknown Page" icon={<Icons.AlertCircle />}>
                            This doesn't appear to be a supported Brightspace page.
                        </Alert>
                        <Text size="sm">
                            Navigate to a Purdue Brightspace dashboard or course homepage to use this extension.
                        </Text>
                    </Stack>
                )
        }
    }

    return (
        <Container p="md" style={{ width: "350px", minHeight: "400px" }}>
            <Stack>
                {/* Header with page type indicator */}
                <Group justify="space-between" mb="xs">
                    <Title order={4}>D2L Companion</Title>
                    <Badge
                        leftSection={renderPageTypeIcon()}
                        color={pageType === PageType.UNKNOWN ? "gray" : "blue"}
                    >
                        {pageType}
                    </Badge>
                </Group>

                <Divider />

                {/* Show page content */}
                {renderPageContent()}

                {/* URL display at bottom */}
                <Box mt="auto">
                    <Divider my="xs" />
                    <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                        {currentUrl}
                    </Text>
                </Box>
            </Stack>
        </Container>
    );
}

function IndexPopup() {
    return (
        <Providers>
            <IndexPopupContent />
        </Providers>
    )
}

export default IndexPopup