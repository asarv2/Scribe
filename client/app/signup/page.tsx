/**
 * app/signup/page.tsx
 * Will be where the professor signs up
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { useState, useEffect } from "react";
import {
    Button,
    Card,
    Center,
    Container,
    Divider,
    Group,
    Paper,
    Stack,
    Switch,
    Text,
    Textarea,
    TextInput,
    Timeline,
    Title,
    Tabs,
    SimpleGrid,
    RingProgress,
    Badge,
    Tooltip,
    useMantineColorScheme
} from "@mantine/core";
import {
    IconDownload,
    IconPuzzle,
    IconSettings,
    IconPlus
} from "@tabler/icons-react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HomeLayout } from "@/components/Home/HomeLayout";
import { getClasses } from "@/utils/queries/get-classes";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import MicrosoftIcon from "@/components/Icons/MicrosoftIcon";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { updateClassPrivacy, updateClassPrompts } from "@/utils/services/class";
import { notifications } from "@mantine/notifications";
import { signInWithMicrosoft } from "@/utils/services/auth";
import Management from "@/components/Account/Management";
import { getLectures } from "@/utils/queries/get-lectures";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { Homework, Lecture, Textbook } from "@/types";
import Link from "next/link";

export default function ProfessorSignup() {
    const supabase = useSupabaseBrowser();
    const router = useRouter();
    const [activeStep, setActiveStep] = useState(0);
    const [microsoftButtonLoading, setMicrosoftButtonLoading] = useState(false);
    const queryClient = useQueryClient();
    const { colorScheme } = useMantineColorScheme();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classes, isLoading: loadingClasses } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    const {data: lectures, isLoading: loadingLectures} = useQuery({
        queryKey: ["lectures"],
        queryFn: () => getLectures(supabase, classes?.map(c => c.id) ?? []),
    });

    const {data: textbooks, isLoading: loadingTextbooks} = useQuery({
        queryKey: ["textbooks"],
        queryFn: () => getTextbooks(supabase, classes?.map(c => c.id) ?? []),
    });

    const {data: homeworks, isLoading: loadingHomeworks} = useQuery({
        queryKey: ["homeworks"],
        queryFn: () => getHomeworks(supabase, classes?.map(c => c.id) ?? []),
    });


    const calculateParseStatus = (items: Lecture[] | Textbook[] | Homework[]) => {
        if (!items || items.length === 0) return { percent: 0, count: 0, total: 0 };

        const completedCount = items.filter(item =>
            item.parse_status === 'complete'
        ).length;

        return {
            percent: Math.round((completedCount / items.length) * 100),
            count: completedCount,
            total: items.length
        };
    };

        // Add realtime subscriptions for course-specific data when viewing a course
        useEffect(() => {
            if (!user || !classes) return;
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
                            queryKey: ["lectures"]
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
                            queryKey: ["textbooks"]
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
                            queryKey: ["homeworks"]
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

    // Determine active step based on user state
    useEffect(() => {
        if (!loadingProfile && profile) {
            if (profile.professor || profile.admin) {
                // Professor is logged in
                if (profile.classes && profile.classes.length > 0) {
                    setActiveStep(1); // Has classes, move to configure settings
                } else {
                    setActiveStep(1); // Logged in but no classes
                }
            }
        }
    }, [profile, loadingProfile]);

    const handleSignInWithMicrosoft = async () => {
        setMicrosoftButtonLoading(true);
        try {
            const { success, error, url } = await signInWithMicrosoft(`${window.location.origin}/auth/callback`);
            if (success && url) {
                router.push(url);
            } else {
                throw new Error(error);
            }
        } catch (error: any) {
            notifications.show({
                title: "Error",
                message: error.message,
                color: "red",
            });
        }
    }

    // Handle moving to final step
    const handleProceedToDownload = () => {
        setActiveStep(3);
    };

    return (
        <HomeLayout>
            <Container size="lg" style={{ marginTop: "50px", marginBottom: "50px" }}>
                <Title order={1} mb="xl" ta="center">Welcome {profile?.first_name ?? "Professor"}! Let's get you started.</Title>

                <Paper shadow="md" p="xl" withBorder>
                    <Stack>
                        {/* Timeline component */}
                        <Timeline active={activeStep} bulletSize={30} lineWidth={2} mb="xl">
                            <Timeline.Item
                                bullet={<MicrosoftIcon />}
                                title="Login with Microsoft"
                                __active={activeStep >= 0}
                            >
                                <Stack>
                                    <Text c="dimmed" size="sm">
                                        Sign in with your Microsoft account to get started
                                    </Text>
                                    {activeStep === 0 && !profile?.professor && (
                                        <Stack gap="md">
                                            <Button
                                                onClick={handleSignInWithMicrosoft}
                                                loading={microsoftButtonLoading}
                                                variant="outline"
                                                leftSection={
                                                    <MicrosoftIcon />
                                                }
                                                styles={{
                                                    root: {
                                                        color: colorScheme === 'dark' ? 'white' : 'black',
                                                        '&:hover': {
                                                            backgroundColor: colorScheme === 'dark' ? '#201F1F' : 'gray.1'
                                                        }
                                                    }
                                                }}
                                            >
                                                Login with Microsoft
                                            </Button>
                                        </Stack>
                                    )}
                                </Stack>
                            </Timeline.Item>

                            <Timeline.Item
                                bullet={<IconPuzzle size={16} />}
                                title="Create Class"
                                __active={activeStep >= 1}
                            >
                                <Text c="dimmed" size="sm">
                                    Create a class or import from Brightspace
                                </Text>
                                {activeStep === 1 && (
                                    <Stack mt="md">
                                        <Tabs defaultValue="brightspace">
                                            <Tabs.List>
                                                <Tabs.Tab value="brightspace">Import from Brightspace</Tabs.Tab>
                                                <Tabs.Tab value="manual">Create Manually</Tabs.Tab>
                                            </Tabs.List>

                                            <Tabs.Panel value="brightspace" pt="md">
                                                <Stack gap="md">
                                                    <Text size="sm">
                                                        1. Install the <Link href="https://chromewebstore.google.com/detail/bckhgcbgegchbplocbfopipkdoohfaeb?utm_source=item-share-cb" target="_blank">Scribe Chrome Extension</Link>
                                                    </Text>
                                                    <Text size="sm">
                                                        2. Open Brightspace and use the extension to add your classes
                                                    </Text>
                                                </Stack>
                                            </Tabs.Panel>

                                            <Tabs.Panel value="manual" pt="md">
                                                <Management showExistingClasses={false} showOuterAccordion={false} />
                                            </Tabs.Panel>
                                        </Tabs>
                                    </Stack>
                                )}
                            </Timeline.Item>

                            <Timeline.Item
                                bullet={<IconSettings size={16} />}
                                title="Configure Settings"
                                __active={activeStep >= 2}
                            >
                                <Text c="dimmed" size="sm">
                                    Configure your class settings and AI prompts
                                </Text>
                                {activeStep === 2 && !loadingClasses && classes && classes.length > 0 && (
                                    <Stack mt="md">
                                        <Management showCreateClass={false} showOuterAccordion={false} showInitialClassInfo={false} />
                                        <Button onClick={handleProceedToDownload} mt="md">
                                            Continue to Download Content
                                        </Button>
                                    </Stack>
                                )}
                            </Timeline.Item>

                            <Timeline.Item
                                bullet={<IconDownload size={16} />}
                                title="Download Content"
                                __active={activeStep >= 3}
                            >
                                <Text c="dimmed" size="sm">
                                    Download and process your course content
                                </Text>
                                {activeStep === 3 && (
                                    <Stack mt="md">
                                        {!loadingClasses && classes && classes
                                            .filter(classItem => profile?.classes?.includes(classItem.id))
                                            .map((classItem) => {
                                                // Calculate progress for this class
                                                const lectureStatus = calculateParseStatus(
                                                    lectures?.filter(l => l.class === classItem.id) || []
                                                );
                                                const textbookStatus = calculateParseStatus(
                                                    textbooks?.filter(t => t.class === classItem.id) || []
                                                );
                                                const homeworkStatus = calculateParseStatus(
                                                    homeworks?.filter(h => h.class === classItem.id) || []
                                                );

                                                // Check if everything is complete
                                                const isComplete = (
                                                    (!classItem.lecture_enabled || lectureStatus.percent === 100) &&
                                                    (!classItem.textbook_enabled || textbookStatus.percent === 100) &&
                                                    (!classItem.homework_enabled || homeworkStatus.percent === 100)
                                                );

                                                if (isComplete) {
                                                    return (
                                                        <Card key={classItem.id} withBorder p="md" mb="sm">
                                                            <Group>
                                                                <Text fw={500}>{classItem.class_code}</Text>
                                                                <Badge color="green">All Content Processed</Badge>
                                                                <Button 
                                                                    variant="subtle" 
                                                                    size="xs"
                                                                    onClick={() => setActiveStep(2)}
                                                                    leftSection={<IconSettings size={16} />}
                                                                    ml="auto"
                                                                >
                                                                    Settings
                                                                </Button>
                                                            </Group>
                                                        </Card>
                                                    );
                                                }

                                                return (
                                                    <Card key={classItem.id} withBorder p="md" mb="sm">
                                                        <Stack>
                                                            <Group justify="space-between">
                                                                <Text fw={500}>{classItem.class_code}</Text>
                                                                <Button 
                                                                    variant="subtle" 
                                                                    size="xs"
                                                                    onClick={() => setActiveStep(2)}
                                                                    leftSection={<IconSettings size={16} />}
                                                                >
                                                                    Settings
                                                                </Button>
                                                            </Group>

                                                            {/* Progress Indicators */}
                                                            <SimpleGrid cols={3} spacing="xs">
                                                                {classItem.lecture_enabled && (
                                                                    <Tooltip label={`${lectureStatus.count}/${lectureStatus.total} lectures processed`}>
                                                                        <Stack align="center">
                                                                            <RingProgress
                                                                                size={160}
                                                                                thickness={8}
                                                                                roundCaps
                                                                                sections={[{ 
                                                                                    value: lectureStatus.percent, 
                                                                                    color: 'blue' 
                                                                                }]}
                                                                                label={
                                                                                    <Center>
                                                                                        <Text size="xs" fw={700}>{lectureStatus.percent}%</Text>
                                                                                    </Center>
                                                                                }
                                                                            />
                                                                            <Text size="xs" ta="center" mt={2}>
                                                                                Lectures
                                                                            </Text>
                                                                        </Stack>
                                                                    </Tooltip>
                                                                )}

                                                                {classItem.textbook_enabled && (
                                                                    <Tooltip label={`${textbookStatus.count}/${textbookStatus.total} textbooks processed`}>
                                                                        <Stack align="center">
                                                                            <RingProgress
                                                                                size={160}
                                                                                thickness={8}
                                                                                roundCaps
                                                                                sections={[{ 
                                                                                    value: textbookStatus.percent, 
                                                                                    color: 'green' 
                                                                                }]}
                                                                                label={
                                                                                    <Center>
                                                                                        <Text size="xs" fw={700}>{textbookStatus.percent}%</Text>
                                                                                    </Center>
                                                                                }
                                                                            />
                                                                            <Text size="xs" ta="center" mt={2}>
                                                                                Textbooks
                                                                            </Text>
                                                                        </Stack>
                                                                    </Tooltip>
                                                                )}

                                                                {classItem.homework_enabled && (
                                                                    <Tooltip label={`${homeworkStatus.count}/${homeworkStatus.total} homework processed`}>
                                                                        <Stack align="center">
                                                                            <RingProgress
                                                                                size={160}
                                                                                thickness={8}
                                                                                roundCaps
                                                                                sections={[{ 
                                                                                    value: homeworkStatus.percent, 
                                                                                    color: 'orange' 
                                                                                }]}
                                                                                label={
                                                                                    <Center>
                                                                                        <Text size="xs" fw={700}>{homeworkStatus.percent}%</Text>
                                                                                    </Center>
                                                                                }
                                                                            />
                                                                            <Text size="xs" ta="center" mt={2}>
                                                                                HW
                                                                            </Text>
                                                                        </Stack>
                                                                    </Tooltip>
                                                                )}
                                                            </SimpleGrid>
                                                        </Stack>
                                                    </Card>
                                                );
                                            })}

                                        {/* Show completion message if all classes are done */}
                                        {classes?.filter(classItem => profile?.classes?.includes(classItem.id))
                                            .every(classItem => {
                                                const lectureStatus = calculateParseStatus(
                                                    lectures?.filter(l => l.class === classItem.id) || []
                                                );
                                                const textbookStatus = calculateParseStatus(
                                                    textbooks?.filter(t => t.class === classItem.id) || []
                                                );
                                                const homeworkStatus = calculateParseStatus(
                                                    homeworks?.filter(h => h.class === classItem.id) || []
                                                );
                                                
                                                return (
                                                    (!classItem.lecture_enabled || lectureStatus.percent === 100) &&
                                                        (!classItem.textbook_enabled || textbookStatus.percent === 100) &&
                                                        (!classItem.homework_enabled || homeworkStatus.percent === 100)
                                                );
                                            }) && (
                                                <Text c="dimmed" ta="center" mt="xl">
                                                    All content has been processed! You can now access your courses on Scribe.
                                                </Text>
                                            )}

                                        <Button 
                                            variant="light" 
                                            onClick={() => setActiveStep(2)} 
                                            mt="xl"
                                            leftSection={<IconSettings size={16} />}
                                        >
                                            Back to Settings
                                        </Button>
                                    </Stack>
                                )}
                            </Timeline.Item>
                        </Timeline>
                    </Stack>
                </Paper>
            </Container>
        </HomeLayout>
    );
} 