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
    useMantineColorScheme,
    ActionIcon,
    Accordion,
    Modal,
    Skeleton
} from "@mantine/core";
import {
    IconDownload,
    IconPuzzle,
    IconSettings,
    IconPlus,
    IconExternalLink,
    IconCheck,
    IconTrash,
    IconUpload
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
import { deleteClass, updateClassPrivacy, updateClassPrompts } from "@/utils/services/class";
import { notifications } from "@mantine/notifications";
import { signInWithMicrosoft } from "@/utils/services/auth";
import Management from "@/components/Account/Management";
import { getLectures } from "@/utils/queries/get-lectures";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { Class, Homework, Lecture, Profile, Textbook } from "@/types";
import Link from "next/link";
import MicrosoftLoginButton from "@/components/Buttons/MicrosoftLoginButton";
import { ClassLayout } from "@/components/Class/ClassLayout";
import UploadLectureButton from "@/components/Buttons/UploadLectureButton";
import UploadTextbookButton from "@/components/Buttons/UploadTextbookButton";
import UploadHomeworkButton from "@/components/Buttons/UploadHomeworkButton";

export default function ProfessorSignup() {
    const supabase = useSupabaseBrowser();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [deleteClassModalId, setDeleteClassModalId] = useState<string | null>(null);

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

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures"],
        queryFn: () => getLectures(supabase, classes?.map(c => c.id) ?? []),
    });

    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks"],
        queryFn: () => getTextbooks(supabase, classes?.map(c => c.id) ?? []),
    });

    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks"],
        queryFn: () => getHomeworks(supabase, classes?.map(c => c.id) ?? []),
    });


    const handleDeleteClass = async (classId: string) => {
        // Your delete class logic here
        try {
            const { success, error } = await deleteClass(classId);
            if (!success) {
                throw new Error(error);
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            notifications.show({
                title: 'Success',
                message: 'Class deleted successfully',
                color: 'green'
            });
            setDeleteClassModalId(null);
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        }
    };

    const calculateUploadStatus = (items: Lecture[] | Textbook[] | Homework[]) => {
        if (!items || items.length === 0) return { percent: 0, count: 0, total: 0 };

        const completedCount = items.filter(item =>
            item.parse_status === 'idle'
        ).length;

        return {
            percent: Math.round((completedCount / items.length) * 100),
            count: completedCount,
            total: items.length
        };
    }


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

    // Add realtime subscriptions for classes
    useEffect(() => {
        if (!user) return;

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

    const filteredClasses = profile && classes ? classes.filter(c => profile.admin || profile.classes.includes(c.id)) : undefined;

    const getActiveStep = (profile: Profile | undefined, classes: Class[] | undefined, lectures: Lecture[] | undefined, textbooks: Textbook[] | undefined, homeworks: Homework[] | undefined) => {
        if (profile && profile.admin) return 3;
        if (lectures && calculateUploadStatus(lectures).percent === 100 && textbooks && calculateUploadStatus(textbooks).percent === 100 && homeworks && calculateUploadStatus(homeworks).percent === 100) return 3;
        if (classes && classes[0] && classes[0]?.saved) return 2;
        if (profile && classes && classes.length > 0) return 1;
        return 0;
    }

    const activeStep = getActiveStep(profile, filteredClasses, lectures, textbooks, homeworks);

    const loading = loadingUser || loadingProfile || loadingClasses || loadingLectures || loadingTextbooks || loadingHomeworks;

    return (
        <ClassLayout classId={null} showClasses={false}>
            <Container size="lg" style={{ marginTop: "50px", marginBottom: "50px" }}>
                <Title order={1} mb="xl" ta="center">
                    {loading ? (
                        <Skeleton height={36} width="60%" mx="auto" />
                    ) : (
                        `Welcome ${profile?.first_name ?? "Professor"}! Let's get you started.`
                    )}
                </Title>

                <Paper shadow="md" p="xl" withBorder>
                    <Stack>
                        {/* Timeline component */}
                        <Timeline active={activeStep} bulletSize={30} lineWidth={2} mb="xl">
                            <Timeline.Item
                                bullet={<IconPuzzle size={16} />}
                                title={
                                    <Accordion defaultValue={activeStep === 0 ? "step0" : null} key={"accordion-create-class-" + activeStep}>
                                        <Accordion.Item value="step0">
                                            <Accordion.Control>
                                                <Group>
                                                    <Text fw={500}>Create Class</Text>
                                                    {loading ? (
                                                        <Skeleton height={20} width={100} />
                                                    ) : (
                                                        activeStep > 0 ?
                                                            <Badge color="green">Complete</Badge> :
                                                            <Text c="dimmed" size="sm">Create a class to continue</Text>
                                                    )}
                                                </Group>
                                            </Accordion.Control>
                                            <Accordion.Panel>
                                                {loading ? (
                                                    <Stack mt="md">
                                                        <Skeleton height={40} width="100%" />
                                                        <Skeleton height={100} width="100%" />
                                                        <Skeleton height={40} width="70%" />
                                                    </Stack>
                                                ) : (
                                                    activeStep === 0 ? <Stack mt="md">
                                                        <Tabs defaultValue="brightspace">
                                                            <Tabs.List>
                                                                <Tabs.Tab value="brightspace">Import from Brightspace</Tabs.Tab>
                                                                <Tabs.Tab value="manual">Create Manually</Tabs.Tab>
                                                            </Tabs.List>

                                                            <Tabs.Panel value="brightspace" pt="md">
                                                                <Stack gap="md">
                                                                    <Text size="md">
                                                                        1. Install the <Link href="https://chromewebstore.google.com/detail/bckhgcbgegchbplocbfopipkdoohfaeb?utm_source=item-share-cb" target="_blank">Scribe Chrome Extension</Link>
                                                                    </Text>
                                                                    <Text size="md">
                                                                        2. Login with your Microsoft account and go to homepage of <Link href="https://purdue.brightspace.com/d2l/home/6824" target="_blank">Brightspace</Link>
                                                                    </Text>
                                                                    <Text size="md">
                                                                        3. Once your course is detected, press 'Add Course'
                                                                    </Text>
                                                                </Stack>
                                                            </Tabs.Panel>

                                                            <Tabs.Panel value="manual" pt="md">
                                                                <Management showExistingClasses={false} showOuterAccordion={false} />
                                                            </Tabs.Panel>
                                                        </Tabs>
                                                    </Stack> : (<Stack pt="md">
                                                        {filteredClasses && filteredClasses.length > 0 && (
                                                            filteredClasses[0].brightspace_course_id !== null ? (
                                                                <Group>
                                                                    <IconCheck size={16} />
                                                                    <Text>Added {filteredClasses[0].class_code} from Brightspace at {new Date(filteredClasses[0].created_at ?? "").toLocaleString()}</Text>
                                                                    <Tooltip label="Remove Course">
                                                                        <ActionIcon
                                                                            variant="subtle"
                                                                            size="md"
                                                                            color="red"
                                                                            onClick={() => {
                                                                                setDeleteClassModalId(filteredClasses[0].id);
                                                                            }}
                                                                        >
                                                                            <IconTrash size={16} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                </Group>
                                                            ) : (
                                                                <Group>
                                                                    <IconCheck size={16} />
                                                                    <Text>Added {filteredClasses[0].class_code} manually at {new Date(filteredClasses[0].created_at ?? "").toLocaleString()}</Text>
                                                                    <Tooltip label="Remove Course">
                                                                        <ActionIcon
                                                                            variant="subtle"
                                                                            size="md"
                                                                            color="red"
                                                                            onClick={() => {
                                                                                setDeleteClassModalId(filteredClasses[0].id);
                                                                            }}
                                                                        >
                                                                            <IconTrash size={16} />
                                                                        </ActionIcon>
                                                                    </Tooltip>
                                                                </Group>
                                                            )
                                                        )}
                                                    </Stack>)
                                                )}
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Accordion>
                                }
                                __active={activeStep >= 0}
                            />

                            <Timeline.Item
                                bullet={<IconSettings size={16} />}
                                title={
                                    <Accordion defaultValue={activeStep === 1 ? "step1" : null} key={"accordion-configure-settings-" + activeStep}>
                                        <Accordion.Item value="step1">
                                            <Accordion.Control disabled={activeStep < 1}>
                                                <Group>
                                                    <Text fw={500}>Configure Settings</Text>
                                                    {loading ? (
                                                        <Skeleton height={20} width={100} />
                                                    ) : (
                                                        activeStep > 1 ?
                                                            <Badge color="green">Complete</Badge> :
                                                            <Text c="dimmed" size="sm">Configure settings for your class</Text>
                                                    )}
                                                </Group>
                                            </Accordion.Control>
                                            <Accordion.Panel>
                                                {loading ? (
                                                    <Stack mt="md">
                                                        <Skeleton height={40} width="100%" />
                                                        <Skeleton height={120} width="100%" />
                                                        <Skeleton height={40} width="80%" />
                                                    </Stack>
                                                ) : (
                                                    !loading && classes && classes.length > 0 && (
                                                        <Stack mt="md">
                                                            <Management showCreateClass={false} showOuterAccordion={false} />
                                                        </Stack>
                                                    )
                                                )}
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Accordion>
                                }
                                __active={activeStep >= 1}
                            />

                            <Timeline.Item
                                bullet={<IconUpload size={16} />}
                                title={
                                    <Accordion defaultValue={activeStep === 2 ? "step2" : null} key={"accordion-upload-content-" + activeStep}>
                                        <Accordion.Item value="step2">
                                            <Accordion.Control disabled={activeStep < 2}>
                                                <Group>
                                                    <Text fw={500}>Upload Content</Text>
                                                    {loading ? (
                                                        <Skeleton height={20} width={100} />
                                                    ) : (
                                                        activeStep > 2 ?
                                                            <Badge color="green">Complete</Badge> :
                                                            <Text c="dimmed" size="sm">Upload content from Brightspace, Kaltura MediaSpace, personal website, or your computer</Text>
                                                    )}
                                                </Group>
                                            </Accordion.Control>
                                            <Accordion.Panel>
                                                <Stack mt="md">
                                                    <UploadLectureButton classId={classes?.[0]?.id ?? ""} initalStatus={"idle"} />
                                                    <UploadTextbookButton classId={classes?.[0]?.id ?? ""} initalStatus={"idle"} />
                                                    <UploadHomeworkButton classId={classes?.[0]?.id ?? ""} initalStatus={"idle"} />
                                                </Stack>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Accordion>
                                }
                                __active={activeStep >= 2}
                            />

                            <Timeline.Item
                                bullet={<IconUpload size={16} />}
                                title={
                                    <Accordion defaultValue={activeStep === 3 ? "step3" : null} key={"accordion-parse-content-" + activeStep}>
                                        <Accordion.Item value="step3">
                                            <Accordion.Control disabled={activeStep < 3}>
                                                <Group>
                                                    <Text fw={500}>Parse Content</Text>
                                                    {loading ? (
                                                        <Skeleton height={20} width={100} />
                                                    ) : (
                                                        activeStep > 3 ?
                                                            <Badge color="green">Complete</Badge> :
                                                            <Text c="dimmed" size="sm">Parse content for your class</Text>
                                                    )}
                                                </Group>
                                            </Accordion.Control>
                                            <Accordion.Panel>
                                                <Stack mt="md">
                                                    {loading ? (
                                                        <Card withBorder p="md" mb="sm">
                                                            <Stack>
                                                                <Group justify="space-between">
                                                                    <Skeleton height={24} width={120} />
                                                                    <Skeleton height={24} width={24} circle />
                                                                </Group>
                                                                <SimpleGrid cols={3} spacing="xs">
                                                                    {[1, 2, 3].map((i) => (
                                                                        <Stack key={"skeleton-download-content-" + i} align="center">
                                                                            <Skeleton height={160} width={160} circle />
                                                                            <Skeleton height={16} width={80} mt={2} />
                                                                        </Stack>
                                                                    ))}
                                                                </SimpleGrid>
                                                            </Stack>
                                                        </Card>
                                                    ) : (
                                                        !loading && classes && classes
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

                                                                return (
                                                                    <>
                                                                        <Card key={classItem.id} withBorder p="md" mb="sm">
                                                                            <Stack>
                                                                                <Group justify="space-between">
                                                                                    <Text fw={500}>{classItem.class_code}</Text>
                                                                                    <Tooltip label="View Content">
                                                                                        <ActionIcon
                                                                                            variant="subtle"
                                                                                            size="md"
                                                                                        >
                                                                                            <Link href={`/classes/c/${classItem.id}/content`} style={{ textDecoration: 'none', color: 'inherit' }} target="_blank">
                                                                                                <IconExternalLink size={18} />
                                                                                            </Link>
                                                                                        </ActionIcon>
                                                                                    </Tooltip>
                                                                                </Group>

                                                                                {/* Progress Indicators */}
                                                                                <SimpleGrid cols={3} spacing="xs">
                                                                                    {classItem.lecture_enabled && (
                                                                                        <Stack align="center">
                                                                                            <Tooltip label={`${lectureStatus.count}/${lectureStatus.total} lectures processed`}>
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
                                                                                            </Tooltip>
                                                                                            <Text size="md" ta="center" fw={700}>
                                                                                                Lectures
                                                                                            </Text>
                                                                                        </Stack>

                                                                                    )}

                                                                                    {classItem.textbook_enabled && (

                                                                                        <Stack align="center">
                                                                                            <Tooltip label={`${textbookStatus.count}/${textbookStatus.total} textbooks processed`}>
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
                                                                                            </Tooltip>
                                                                                            <Text size="md" fw={700} ta="center" mt={2}>
                                                                                                Textbooks
                                                                                            </Text>
                                                                                        </Stack>
                                                                                    )}

                                                                                    {classItem.homework_enabled && (

                                                                                        <Stack align="center">
                                                                                            <Tooltip label={`${homeworkStatus.count}/${homeworkStatus.total} homework processed`}>
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
                                                                                            </Tooltip>
                                                                                            <Text size="md" fw={700} ta="center" mt={2}>
                                                                                                Homework
                                                                                            </Text>
                                                                                        </Stack>
                                                                                    )}
                                                                                </SimpleGrid>
                                                                            </Stack>
                                                                        </Card>
                                                                        {isComplete && (
                                                                            <Text c="dimmed" ta="center" mt="xl">
                                                                                All content has been processed! Click <Link href={`/classes/c/${classItem.id}`} target="_blank">here</Link> to view your dashboard.
                                                                            </Text>
                                                                        )}
                                                                    </>
                                                                );
                                                            })
                                                    )}
                                                </Stack>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Accordion>
                                }
                                __active={activeStep >= 3}
                            />
                        </Timeline>
                        <Modal opened={!!deleteClassModalId} onClose={() => setDeleteClassModalId(null)} title="Delete Class">
                            <Stack>
                                <Text>Are you sure you want to delete {filteredClasses?.find(c => c.id === deleteClassModalId)?.class_code}?</Text>
                                <Button onClick={() => handleDeleteClass(deleteClassModalId!)} color="red">Delete</Button>
                            </Stack>
                        </Modal>
                    </Stack>
                </Paper>
            </Container>
        </ClassLayout>
    );
} 