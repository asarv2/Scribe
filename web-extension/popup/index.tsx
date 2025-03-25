import { sendToBackground } from "@plasmohq/messaging"
import {
    Stack, Card, Text, Container, Loader, Center, Button, Group, Badge,
    Tabs, Divider, Alert, Box, Title,
    useMantineColorScheme, Progress, Tooltip
} from '@mantine/core'
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Providers } from "~providers"
import type { Class, Download, Homework, Lecture, Profile, Textbook } from "~types"
import { useEffect, useState } from "react"
import type { Course } from "~contents/dashboardDetector"
import type { CourseHomepage } from "~contents/homepageDetector"
import { Storage } from "@plasmohq/storage"
import type { User } from "~node_modules/@supabase/supabase-js/dist/module"
import Login from "~components/Login"
import Logout from "~components/Logout"
import { Icons } from "~components/Icons"
import CourseCard from "~components/CourseCard"
import { getSupabaseClient } from "~utils/supabase/supabase-client"
import NewCourseCard from "~components/NewCourseCard"

// Define page types
enum PageType {
    UNKNOWN = "UNKNOWN",
    DASHBOARD = "DASHBOARD",
    HOMEPAGE = "HOMEPAGE"
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

    const { data: user, isLoading: isLoadingUser, error: userError } = useQuery({
        queryKey: ["user"],
        queryFn: async () => {
            const response = await sendToBackground<{}, { user: User }>({
                name: "get-user"
            })
            return response.user
        }
    })

    const { data: profile, isLoading: isLoadingProfile, error: profileError } = useQuery({
        queryKey: ["profile"],
        queryFn: async () => {
            const response = await sendToBackground<{ userId: string }, { profile: Profile }>({
                name: "get-profile",
                body: { userId: user?.id }
            })
            return response.profile
        },
        enabled: !!user
    })

    const { data: downloads, isLoading: isLoadingDownloads, error: downloadsError } = useQuery({
        queryKey: ["downloads"],
        queryFn: async () => {
            const response = await sendToBackground<{}, { downloads: Download[] }>({
                name: "get-downloads"
            })
            return response.downloads
        }
    })
    

    // Query to get saved classes from database
    const { data: classes, isLoading: isLoadingSaved, error: savedError } = useQuery({
        queryKey: ["classes"],
        queryFn: async () => {
            const response = await sendToBackground<{}, { classes: Class[] }>({
                name: "get-classes"
            })
            return response.classes
        },
    })

    const { data: lectures, isLoading: isLoadingLectures, error: lecturesError } = useQuery({
        queryKey: ["lectures", courseId],
        queryFn: async () => {
            const response = await sendToBackground<{ classIds: string[] }, { lectures: Lecture[] }>({
                name: "get-lectures",
                body: { classIds: classes?.map((course) => course.id) || [] }
            })
            return response.lectures
        },
        enabled: !!classes
    })

    const { data: textbooks, isLoading: isLoadingTextbooks, error: textbooksError } = useQuery({
        queryKey: ["textbooks", courseId],
        queryFn: async () => {
            const response = await sendToBackground<{ classIds: string[] }, { textbooks: Textbook[] }>({
                name: "get-textbooks",
                body: { classIds: classes?.map((course) => course.id) || [] }
            })
            return response.textbooks
        },
        enabled: !!classes
    })

    const { data: homeworks, isLoading: isLoadingHomeworks, error: homeworksError } = useQuery({
        queryKey: ["homeworks", courseId],
        queryFn: async () => {
            const response = await sendToBackground<{ classIds: string[] }, { homeworks: Homework[] }>({
                name: "get-homeworks",
                body: { classIds: classes?.map((course) => course.id) || [] }
            })
            return response.homeworks
        },
        enabled: !!classes
    })

    const getFilteredClasses = (classes: Class[] | null, profile: Profile | null) => {
        if (!classes || !profile) return [];
        return classes.filter((course) => (profile.admin || (profile.classes.includes(course.id))))
    }


    // Add state for tracking downloads
    const [downloadingSessions, setDownloadingSessions] = useState<Record<string, boolean>>({});
    const storage = new Storage();

    const queryClient = useQueryClient();

    // Add this near the top of your component
    const [isLoggedIn, setIsLoggedIn] = useState(true);

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
                    courses: classes || []
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
            await storage.set(`downloadStatus_${courseId}`, "Initiating download...");

            if (!profile) {
                throw new Error("Profile not found");
            }

            const response = await sendToBackground<
                { courseId: string; courseDescriptor: string, profileId: string },
                { success: boolean; downloads?: any[]; error?: string }
            >({
                name: "download-course",
                body: { courseId, courseDescriptor, profileId: profile.id }
            });

            console.log("Download response:", response);

            if (!response.success) {
                throw new Error(response.error || "Download failed");
            }

        } catch (err) {
            console.error("Error downloading content:", err);
            setError(err.message || "Error downloading content");
            await storage.set(`downloadStatus_${courseId}`, `Error: ${err.message || "Download failed"}`);
        } finally {
            setDownloadingSessions(prev => ({ ...prev, [courseId]: false }));
        }
    };

    // Function to refresh data based on current page type
    const refreshData = async () => {
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
        // clear the download status
        await storage.clear()
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

    // Add realtime subscriptions for profiles
    useEffect(() => {
        if (!user) return;

        const supabase = getSupabaseClient();

        const channel = supabase
            .channel('realtime-profiles')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'profiles'
                },
                () => {
                    // Invalidate profile query to fetch fresh data
                    queryClient.invalidateQueries({
                        queryKey: ["profile"]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    // Add realtime subscriptions for downloads
    useEffect(() => {
        if (!user) return;

        const supabase = getSupabaseClient();

        const channel = supabase
            .channel('realtime-downloads')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'downloads'
                },
                () => {
                    // Invalidate profile query to fetch fresh data
                    queryClient.invalidateQueries({
                        queryKey: ["downloads"]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    // Add realtime subscriptions for classes
    useEffect(() => {
        if (!user) return;

        const supabase = getSupabaseClient();

        const channel = supabase
            .channel('realtime-classes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'classes'
                },
                () => {
                    // Invalidate classes query to fetch fresh data
                    queryClient.invalidateQueries({
                        queryKey: ["classes"]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    // Add realtime subscriptions for course-specific data when viewing a course
    useEffect(() => {
        if (!user || !classes) return;

        const supabase = getSupabaseClient();

        // Create channels for lectures, textbooks, and homeworks
        const lecturesChannel = supabase
            .channel('realtime-lectures')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'lectures'
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["lectures", courseId]
                    });
                }
            )
            .subscribe();

        const textbooksChannel = supabase
            .channel('realtime-textbooks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'textbooks'
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["textbooks", courseId]
                    });
                }
            )
            .subscribe();

        const homeworksChannel = supabase
            .channel('realtime-homeworks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'homeworks'
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["homeworks", courseId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(lecturesChannel);
            supabase.removeChannel(textbooksChannel);
            supabase.removeChannel(homeworksChannel);
        };
    }, [user, queryClient, classes]);

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
                        {isLoading || isLoadingSaved ? (
                            <Center py="md"><Loader size="sm" /></Center>
                        ) : error ? (
                            <Alert color="red" title="Error" icon={<Icons.AlertCircle />}>
                                {error}
                            </Alert>
                        ) : (
                            <Stack>
                                {/* Detected Courses Section */}
                                {detectedCourses && detectedCourses.filter(course => {
                                    // Only show courses that haven't been added yet
                                    const courseIdNum = Number(course.courseId);
                                    return !classes?.some(savedCourse => {
                                        if (!savedCourse || !savedCourse.brightspace_course_id) return false;
                                        const savedCourseId = Number(savedCourse.brightspace_course_id);
                                        return !isNaN(savedCourseId) && !isNaN(courseIdNum) && savedCourseId === courseIdNum;
                                    });
                                }).length > 0 && (
                                    <>
                                        <Group justify="space-between" align="center">
                                            <Text fw={600}>Detected Courses</Text>
                                            <Tooltip label="Refresh Detection">
                                                <Button
                                                    variant="subtle"
                                                    size="xs"
                                                    onClick={refreshData}
                                                    loading={isLoading}
                                                    p={4}
                                                >
                                                    <Icons.Refresh />
                                                </Button>
                                            </Tooltip>
                                        </Group>

                                        <Stack gap="md">
                                            {detectedCourses.filter(course => {
                                                // Only show courses that haven't been added yet
                                                const courseIdNum = Number(course.courseId);
                                                return !classes?.some(savedCourse => {
                                                    if (!savedCourse || !savedCourse.brightspace_course_id) return false;
                                                    const savedCourseId = Number(savedCourse.brightspace_course_id);
                                                    return !isNaN(savedCourseId) && !isNaN(courseIdNum) && savedCourseId === courseIdNum;
                                                });
                                            }).map((course) => (
                                                <NewCourseCard
                                                    key={course.courseId}
                                                    course={course}
                                                    isLoading={downloadingSessions[course.courseId]}
                                                    courseId={course.courseId}
                                                    profile={profile}
                                                />
                                            ))}
                                        </Stack>
                                    </>
                                )}

                                {/* Divider between sections if both have content */}
                                {detectedCourses && detectedCourses.length > 0 && getFilteredClasses(classes, profile) && getFilteredClasses(classes, profile).length > 0 && (
                                    <Divider my="md" />
                                )}

                                {/* My Courses Section */}
                                {getFilteredClasses(classes, profile) && getFilteredClasses(classes, profile).length > 0 && (
                                    <>
                                        <Text fw={600}>My Courses</Text>
                                        <Stack gap="md">
                                            {getFilteredClasses(classes, profile).sort((a, b) => {
                                                const aCreated = new Date(a.created_at);
                                                const bCreated = new Date(b.created_at);
                                                return bCreated.getTime() - aCreated.getTime();
                                            }).map((savedCourse) => (
                                                <CourseCard
                                                    key={savedCourse.id}
                                                    course={savedCourse}
                                                    courseId={String(savedCourse.brightspace_course_id)}
                                                    lectures={lectures?.filter(lecture => {
                                                        if (!lecture || !lecture.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === lecture.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    textbooks={textbooks?.filter(textbook => {
                                                        if (!textbook || !textbook.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === textbook.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    homeworks={homeworks?.filter(homework => {
                                                        if (!homework || !homework.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === homework.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    downloads={downloads?.filter(download => {
                                                        if (!download || !download.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === download.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    profile={profile}
                                                />
                                            ))}
                                        </Stack>
                                    </>
                                )}

                                {/* Show message if no courses */}
                                {(!detectedCourses || detectedCourses.length === 0) && (!getFilteredClasses(classes, profile) || getFilteredClasses(classes, profile).length === 0) && (
                                    <Text size="sm" c="dimmed">No courses detected or saved</Text>
                                )}
                            </Stack>
                        )}
                    </Stack>
                )

            case PageType.HOMEPAGE:
                return (
                    <Stack>
                        {isLoading || isLoadingSaved ? (
                            <Center py="md"><Loader size="sm" /></Center>
                        ) : error ? (
                            <Alert color="red" title="Error" icon={<Icons.AlertCircle />}>
                                {error}
                            </Alert>
                        ) : (
                            <Stack>
                                {/* Detected Course Section */}
                                {homepageInfo && (() => {
                                    if (!homepageInfo || !homepageInfo.courseId) return null;
                                    
                                    // Parse course ID as number for comparison
                                    const courseIdNum = Number(homepageInfo.courseId);
                                    
                                    // Check if this course is already downloaded
                                    const isDownloaded = classes?.some(savedCourse => {
                                        if (!savedCourse || !savedCourse.brightspace_course_id) return false;
                                        const savedCourseId = Number(savedCourse.brightspace_course_id);
                                        return !isNaN(savedCourseId) && !isNaN(courseIdNum) && savedCourseId === courseIdNum;
                                    });
                                    
                                    // Only show in detected section if not already downloaded
                                    if (isDownloaded) return null;
                                    
                                    return (
                                        <>
                                            <Group justify="space-between" align="center">
                                                <Text fw={600}>Detected Course</Text>
                                                <Tooltip label="Refresh Detection">
                                                    <Button
                                                        variant="subtle"
                                                        size="xs"
                                                        onClick={refreshData}
                                                        loading={isLoading}
                                                        p={4}
                                                    >
                                                        <Icons.Refresh />
                                                    </Button>
                                                </Tooltip>
                                            </Group>

                                            <Stack gap="md">
                                                <NewCourseCard
                                                    course={homepageInfo}
                                                    isLoading={downloadingSessions[homepageInfo.courseId]}
                                                    courseId={homepageInfo.courseId}
                                                    profile={profile}
                                                />
                                            </Stack>
                                        </>
                                    );
                                })()}

                                {/* Divider between sections if both have content */}
                                {homepageInfo && getFilteredClasses(classes, profile) && getFilteredClasses(classes, profile).length > 0 && (
                                    <Divider my="md" />
                                )}

                                {/* My Courses Section */}
                                {getFilteredClasses(classes, profile) && getFilteredClasses(classes, profile).length > 0 && (
                                    <>
                                        <Text fw={600}>My Courses</Text>
                                        <Stack gap="md">
                                            {getFilteredClasses(classes, profile).map((savedCourse) => (
                                                <CourseCard
                                                    key={savedCourse.id}
                                                    course={savedCourse}
                                                    courseId={String(savedCourse.brightspace_course_id)}
                                                    lectures={lectures?.filter(lecture => {
                                                        if (!lecture || !lecture.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === lecture.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    textbooks={textbooks?.filter(textbook => {
                                                        if (!textbook || !textbook.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === textbook.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    homeworks={homeworks?.filter(homework => {
                                                        if (!homework || !homework.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === homework.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    downloads={downloads?.filter(download => {
                                                        if (!download || !download.class) return false;
                                                        const classData = getFilteredClasses(classes, profile)?.find(c => c.id === download.class);
                                                        return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                                    }) || []}
                                                    profile={profile}
                                                />
                                            ))}
                                        </Stack>
                                    </>
                                )}

                                {/* Show message if no courses */}
                                {!homepageInfo && (!getFilteredClasses(classes, profile) || getFilteredClasses(classes, profile).length === 0) && (
                                    <Text size="sm" c="dimmed">No course homepage information detected</Text>
                                )}
                            </Stack>
                        )}
                    </Stack>
                )

            default:
                return (
                    <Stack>
                        <Alert color="yellow" title="Unknown Page" icon={<Icons.AlertCircle />}>
                            This doesn't appear to be a supported Brightspace page.
                        </Alert>

                        <Text size="sm" mt="md">
                            Navigate to a Purdue Brightspace dashboard or course homepage to download courses.
                        </Text>

                        {/* Show saved courses even on unknown pages */}
                        {!isLoadingSaved && getFilteredClasses(classes, profile) && getFilteredClasses(classes, profile).length > 0 && (
                            <>
                                <Text fw={600} mt="md">My Courses</Text>
                                <Stack gap="md">
                                    {getFilteredClasses(classes, profile).map((savedCourse) => (
                                        <CourseCard
                                            key={savedCourse.id || `saved-${Math.random()}`}
                                            course={savedCourse}
                                            courseId={String(savedCourse.brightspace_course_id)}
                                            lectures={lectures?.filter(lecture => {
                                                if (!lecture || !lecture.class) return false;
                                                const classData = getFilteredClasses(classes, profile)?.find(c => c.id === lecture.class);
                                                return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                            }) || []}
                                            textbooks={textbooks?.filter(textbook => {
                                                if (!textbook || !textbook.class) return false;
                                                const classData = getFilteredClasses(classes, profile)?.find(c => c.id === textbook.class);
                                                return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                            }) || []}
                                            homeworks={homeworks?.filter(homework => {
                                                if (!homework || !homework.class) return false;
                                                const classData = getFilteredClasses(classes, profile)?.find(c => c.id === homework.class);
                                                return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                            }) || []}
                                            downloads={downloads?.filter(download => {
                                                if (!download || !download.class) return false;
                                                const classData = getFilteredClasses(classes, profile)?.find(c => c.id === download.class);
                                                return Number(classData?.brightspace_course_id) === Number(savedCourse.brightspace_course_id);
                                            }) || []}
                                            profile={profile}
                                        />
                                    ))}
                                </Stack>
                            </>
                        )}
                    </Stack>
                )
        }
    }

    // Add this function to render login or content
    const renderContent = () => {
        // If user is loading, show a loader
        if (isLoadingUser) {
            return (
                <Center style={{ height: "300px" }}>
                    <Loader />
                </Center>
            );
        }

        // If no user is logged in, show login screen
        if (!user) {
            return <Login />;
        }

        // Otherwise show the main content
        return (
            <Stack>
                {/* User logout component */}
                {profile && (
                    <Logout
                        name={profile.first_name + " " + profile.last_name}
                        userId={user.id}
                        logoutIcon={<Icons.Logout />}
                        onLogout={() => setIsLoggedIn(false)}
                    />
                )}

                <Divider />

                {/* Show page content */}
                {isLoggedIn ? renderPageContent() : <Login />}

                {/* URL display at bottom */}
                <Box mt="auto">
                    <Divider my="xs" />
                    <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                        {currentUrl}
                    </Text>
                </Box>
            </Stack>
        );
    };

    return (
        <Container p="md" style={{ width: "350px", minHeight: "400px" }}>
            {renderContent()}
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