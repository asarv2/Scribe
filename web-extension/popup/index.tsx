import { sendToBackground } from "@plasmohq/messaging"
import {
    Stack, Card, Text, Container, Loader, Center, Button, Group, Badge,
    Tabs, Divider, Alert, Box, Title,
    useMantineColorScheme
} from '@mantine/core'
import { useQuery } from "@tanstack/react-query"
import { Providers } from "~providers"
import type { Class } from "~types"
import { useEffect, useState } from "react"
import type { Course } from "~contents/dashboardDetector"
import type { CourseHomepage } from "~contents/homepageDetector"
import type { PdfLink } from "~contents/linkExtractor"
import { Storage } from "@plasmohq/storage"
import { uploadMultiplePdfs } from "~contents/fileUploader"

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
    ),
    IconX: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
        </svg>
    )
}

// Simplified DownloadStatus component
function DownloadStatus({ onClose }: { onClose: () => void }) {
    const [status, setStatus] = useState<string>("");
    const storage = new Storage();

    useEffect(() => {
        const checkStatus = async () => {
            const currentStatus = await storage.get('downloadStatus');
            if (currentStatus) setStatus(currentStatus);
        };

        const intervalId = setInterval(checkStatus, 1000);
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

    return (
        <Alert 
            color={color} 
            variant="light"
            icon={icon}
            mt="md"
            withCloseButton
            onClose={() => {
                storage.set('downloadStatus', '');
                onClose();
            }}
        >
            {status}
        </Alert>
    );
}

// Update the CourseCard component
function CourseCard({
    course,
    onScan,
    onUpload,
    onDownload,
    isLoading,
    isUploading,
    isDownloading,
    pdfLinksCount = 0
}: {
    course: Course | CourseHomepage,
    onScan: () => void,
    onUpload: () => void,
    onDownload: () => void,
    isLoading?: boolean,
    isUploading?: boolean,
    isDownloading?: boolean,
    pdfLinksCount?: number
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
                    onClick={onScan}
                    loading={isLoading}
                >
                    Scan Content
                </Button>
                {pdfLinksCount > 0 && (
                    <Button
                        size="xs"
                        onClick={onUpload}
                        loading={isUploading}
                        color="green"
                    >
                        Upload Content
                    </Button>
                )}
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

// Add this component for the clear button
function ClearButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            variant="subtle"
            color="gray"
            size="xs"
            onClick={onClick}
            leftSection={<Icons.IconX />}
            style={{ position: 'absolute', right: 8, top: 8 }}
        >
            Clear Results
        </Button>
    );
}

function IndexPopupContent() {
    // State for page type and URL
    const [pageType, setPageType] = useState<PageType>(PageType.UNKNOWN)
    const [currentUrl, setCurrentUrl] = useState<string>("")
    const [courseId, setCourseId] = useState<string | null>(null)

    // State for different detectors
    const [detectedCourses, setDetectedCourses] = useState<Course[]>([])
    const [homepageInfo, setHomepageInfo] = useState<CourseHomepage | null>(null)
    const [detectedPdfLinks, setDetectedPdfLinks] = useState<PdfLink[]>([])

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

    // State for scan progress
    const [scanProgress, setScanProgress] = useState<{
        isScanning: boolean;
        currentFile?: string;
        pdfLinks: PdfLink[];
    }>({
        isScanning: false,
        pdfLinks: []
    });

    // Add new state for tracking multiple scans
    const [scanningSessions, setScanningSessions] = useState<Record<string, boolean>>({});

    // Add new state for tracking uploads
    const [uploadingSessions, setUploadingSessions] = useState<Record<string, boolean>>({});

    // Add state for upload progress
    const [uploadProgress, setUploadProgress] = useState<{
        current: number;
        total: number;
        results: { title: string; success: boolean }[];
    }>({ current: 0, total: 0, results: [] });

    // Add new state for tracking downloads
    const [downloadingSessions, setDownloadingSessions] = useState<Record<string, boolean>>({});

    // Add this state
    const [downloadStatus, setDownloadStatus] = useState<string>("");

    // Add global download status
    const [globalDownloadStatus, setGlobalDownloadStatus] = useState<string>("");
    const storage = new Storage();

    useEffect(() => {
        // Set up global status listener
        const checkStatus = async () => {
            const currentStatus = await storage.get('downloadStatus');
            if (currentStatus) setGlobalDownloadStatus(currentStatus);
        };

        // Poll for status updates every second
        const intervalId = setInterval(checkStatus, 1000);

        // Cleanup
        return () => clearInterval(intervalId);
    }, []);

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

    // Modify the scan function to handle individual course scans
    const scanCourse = async (courseId: string, courseDescriptor: string) => {
        try {
            setScanningSessions(prev => ({ ...prev, [courseId]: true }));

            const response = await sendToBackground<
                { courseId: string; courseDescriptor: string },
                { success: boolean; pdfLinks?: PdfLink[]; error?: string }
            >({
                name: "scan-content",
                body: { courseId, courseDescriptor }
            });

            if (!response.success) {
                throw new Error(response.error || "Failed to scan content page");
            }

            setScanProgress(prev => ({
                isScanning: false,
                pdfLinks: [...prev.pdfLinks, ...(response.pdfLinks || [])]
            }));

        } catch (err) {
            console.error("Error scanning content page:", err);
            setError(err.message || "Error scanning content page");
        } finally {
            setScanningSessions(prev => ({ ...prev, [courseId]: false }));
        }
    };

    // Add function to scan all courses
    const scanAllCourses = async () => {
        setError(null);
        setScanProgress(prev => ({ ...prev, isScanning: true, pdfLinks: [] }));

        try {
            const coursesToScan = pageType === PageType.DASHBOARD
                ? detectedCourses
                : (homepageInfo ? [homepageInfo] : []);

            for (const course of coursesToScan) {
                if (course.courseId && course.courseDescriptor) {
                    await scanCourse(course.courseId, course.courseDescriptor);
                }
            }
        } catch (err) {
            console.error("Error scanning all courses:", err);
            setError("Error scanning all courses");
        } finally {
            setScanProgress(prev => ({ ...prev, isScanning: false }));
        }
    };

    // Listen for scan updates
    useEffect(() => {
        const updateScanProgress = async () => {
            const results = await storage.get('currentScanResults') || [];
            setScanProgress(prev => ({
                ...prev,
                pdfLinks: results as PdfLink[]
            }));
        };

        const interval = setInterval(updateScanProgress, 1000);
        return () => clearInterval(interval);
    }, []);

    // Update the upload function
    const uploadCourseContent = async (courseId: string) => {
        try {
            setUploadingSessions(prev => ({ ...prev, [courseId]: true }));
            setUploadProgress({ current: 0, total: scanProgress.pdfLinks.length, results: [] });

            const result = await uploadMultiplePdfs(
                scanProgress.pdfLinks,
                courseId,
                (current, total, title, status) => {
                    setUploadProgress(prev => ({
                        current,
                        total,
                        results: [...prev.results, { title, success: status === 'success' }]
                    }));
                }
            );

            if (!result.success) {
                throw new Error("Failed to upload PDFs");
            }

        } catch (err) {
            console.error("Error uploading content:", err);
            setError(err.message || "Error uploading content");
        } finally {
            setUploadingSessions(prev => ({ ...prev, [courseId]: false }));
        }
    };

    // Add this effect to listen for status updates
    useEffect(() => {
        const checkDownloadStatus = async () => {
            const status = await storage.get('downloadStatus');
            if (status) {
                setDownloadStatus(status as string);
            }
        };

        const interval = setInterval(checkDownloadStatus, 500);
        return () => clearInterval(interval);
    }, []);

    // Update the download function
    const downloadCourseContent = async (courseId: string) => {
        try {
            setDownloadingSessions(prev => ({ ...prev, [courseId]: true }));
            setDownloadStatus("Initiating download...");

            const response = await sendToBackground<
                { courseId: string },
                { success: boolean; downloads?: any[]; error?: string }
            >({
                name: "download-course",
                body: { courseId }
            });

            console.log("Download response:", response);

            if (!response.success) {
                throw new Error(response.error || "Download failed");
            }

        } catch (err) {
            console.error("Error downloading content:", err);
            setError(err.message || "Error downloading content");
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

    // Listen for scan progress updates
    useEffect(() => {
        const handleMessage = (message) => {
            if (message.type === "SCAN_PROGRESS_UPDATE") {
                // Update your state with the new links
                setDetectedPdfLinks(message.payload.links);
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

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
                            <>
                                <Button
                                    size="sm"
                                    onClick={scanAllCourses}
                                    loading={scanProgress.isScanning}
                                >
                                    Scan All Courses
                                </Button>
                                <Stack gap="md">
                                    {detectedCourses.map((course) => (
                                        <CourseCard
                                            key={course.courseId}
                                            course={course}
                                            onScan={() => scanCourse(course.courseId, course.courseDescriptor)}
                                            onUpload={() => uploadCourseContent(course.courseId)}
                                            onDownload={() => downloadCourseContent(course.courseId)}
                                            isLoading={scanningSessions[course.courseId]}
                                            isUploading={uploadingSessions[course.courseId]}
                                            isDownloading={downloadingSessions[course.courseId]}
                                            pdfLinksCount={scanProgress.pdfLinks.length}
                                        />
                                    ))}
                                </Stack>
                            </>
                        ) : (
                            <Text size="sm" c="dimmed">No courses detected on this dashboard</Text>
                        )}

                        {/* Show scan results if any */}
                        {scanProgress.pdfLinks.length > 0 && (
                            <Card shadow="sm" p="md" withBorder style={{ position: 'relative' }}>
                                <ClearButton
                                    onClick={() => {
                                        setScanProgress(prev => ({ ...prev, pdfLinks: [] }));
                                        storage.set('currentScanResults', []); // Clear storage as well
                                    }}
                                />
                                <Text fw={600} mb="sm">Found PDFs ({scanProgress.pdfLinks.length})</Text>
                                <Stack gap="xs" style={{ maxHeight: "200px", overflow: "auto" }}>
                                    {scanProgress.pdfLinks.map((link, index) => (
                                        <Group key={index} justify="space-between" p="xs">
                                            <Text size="sm" style={{ flex: 1 }}>{link.title}</Text>
                                            <Badge size="sm">{link.fileName}</Badge>
                                        </Group>
                                    ))}
                                </Stack>
                            </Card>
                        )}

                        <Button size="sm" onClick={refreshData} loading={isLoading}>
                            Refresh Courses
                        </Button>

                        <DownloadStatus onClose={() => setGlobalDownloadStatus("")} />
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
                                onScan={() => scanCourse(homepageInfo.courseId, homepageInfo.courseDescriptor)}
                                onUpload={() => uploadCourseContent(homepageInfo.courseId)}
                                onDownload={() => downloadCourseContent(homepageInfo.courseId)}
                                isLoading={scanningSessions[homepageInfo.courseId]}
                                isUploading={uploadingSessions[homepageInfo.courseId]}
                                isDownloading={downloadingSessions[homepageInfo.courseId]}
                                pdfLinksCount={scanProgress.pdfLinks.length}
                            />
                        ) : (
                            <Text size="sm" c="dimmed">No course homepage information detected</Text>
                        )}

                        {scanProgress.pdfLinks.length > 0 && (
                            <Card shadow="sm" p="md" withBorder style={{ position: 'relative' }}>
                                <ClearButton
                                    onClick={() => {
                                        setScanProgress(prev => ({ ...prev, pdfLinks: [] }));
                                        storage.set('currentScanResults', []); // Clear storage as well
                                    }}
                                />
                                <Text fw={600} mb="sm">Found PDFs ({scanProgress.pdfLinks.length})</Text>
                                <Stack gap="xs" style={{ maxHeight: "200px", overflow: "auto" }}>
                                    {scanProgress.pdfLinks.map((link, index) => (
                                        <Group key={index} justify="space-between" p="xs">
                                            <Text size="sm" style={{ flex: 1 }}>{link.title}</Text>
                                            <Badge size="sm">{link.fileName}</Badge>
                                        </Group>
                                    ))}
                                </Stack>
                            </Card>
                        )}

                        <Button size="sm" onClick={refreshData} loading={isLoading}>
                            Refresh Homepage Info
                        </Button>

                        <DownloadStatus onClose={() => setGlobalDownloadStatus("")} />
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

    // Add this component to show upload progress
    const UploadProgress = () => {
        if (uploadProgress.current === 0) return null;

        return (
            <Card shadow="sm" p="md" withBorder>
                <Text fw={600} mb="sm">Upload Progress ({uploadProgress.current}/{uploadProgress.total})</Text>
                <Stack gap="xs" style={{ maxHeight: "200px", overflow: "auto" }}>
                    {uploadProgress.results.map((result, index) => (
                        <Group key={index} justify="space-between" p="xs">
                            <Text size="sm" style={{ flex: 1 }}>{result.title}</Text>
                            <Badge color={result.success ? "green" : "red"}>
                                {result.success ? "Success" : "Failed"}
                            </Badge>
                        </Group>
                    ))}
                </Stack>
            </Card>
        );
    };

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

                {/* Show global download status */}
                {globalDownloadStatus && (
                    <Alert 
                        color={globalDownloadStatus.includes("Error") ? "red" : 
                              globalDownloadStatus.includes("complete") ? "green" : "blue"}
                        variant="light"
                        withCloseButton
                        onClose={() => storage.set('downloadStatus', '')}
                    >
                        {globalDownloadStatus}
                    </Alert>
                )}

                {/* Remove Tabs and directly show current page content */}
                {renderPageContent()}

                {/* URL display at bottom */}
                <Box mt="auto">
                    <Divider my="xs" />
                    <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                        {currentUrl}
                    </Text>
                </Box>

                <UploadProgress />
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