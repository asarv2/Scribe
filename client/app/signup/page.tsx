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
    Tabs
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

export default function ProfessorSignup() {
    const supabase = useSupabaseBrowser();
    const router = useRouter();
    const [activeStep, setActiveStep] = useState(0);
    const [microsoftButtonLoading, setMicrosoftButtonLoading] = useState(false);
    const queryClient = useQueryClient();

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

    // Determine active step based on user state
    useEffect(() => {
        if (!loadingProfile && profile) {
            if (profile.professor) {
                // Professor is logged in
                if (profile.classes && profile.classes.length > 0) {
                    setActiveStep(2); // Has classes, move to configure settings
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
        setMicrosoftButtonLoading(false);
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
                                                    color: 'white',
                                                    '&:hover': {
                                                        backgroundColor: '#201F1F'
                                                    }
                                                }
                                            }}
                                        >
                                            Login with Microsoft
                                        </Button>
                                    </Stack>
                                )}
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
                                                        1. Install our Brightspace extension from the Chrome Web Store
                                                    </Text>
                                                    <Button
                                                        component="a"
                                                        href="https://chromewebstore.google.com/detail/bckhgcbgegchbplocbfopipkdoohfaeb?utm_source=item-share-cb"
                                                        target="_blank"
                                                        variant="outline"
                                                        mb="md"
                                                    >
                                                        Get Scribe Extension
                                                    </Button>
                                                    <Text size="sm">
                                                        2. Open Brightspace and use the extension to add your classes
                                                    </Text>
                                                    <Text size="sm" c="dimmed" mt="md">
                                                        Once you've added classes, refresh this page to continue
                                                    </Text>
                                                    <Button onClick={() => window.location.reload()} mt="sm">
                                                        Refresh Page
                                                    </Button>
                                                </Stack>
                                            </Tabs.Panel>

                                            <Tabs.Panel value="manual" pt="md">
                                                <Management />
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
                                        <Management />
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
                                        <Text size="sm">
                                            Your content is being processed. You can view the progress in your account dashboard.
                                        </Text>

                                        {/* Here you would show progress indicators for each class */}
                                        {!loadingClasses && classes && classes
                                            .filter(classItem => profile?.classes?.includes(classItem.id))
                                            .map((classItem) => (
                                                <Card key={classItem.id} withBorder p="md" mb="sm">
                                                    <Group justify="space-between">
                                                        <Text fw={500}>{classItem.class_code}</Text>
                                                        <Text size="sm" c="dimmed">Processing...</Text>
                                                    </Group>
                                                    {/* Add progress bars or status indicators here */}
                                                </Card>
                                            ))}
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