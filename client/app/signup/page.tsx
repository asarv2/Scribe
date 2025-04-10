/**
 * app/signup/page.tsx
 * Will be where the professor signs up
 * @AshokSaravanan222
 * 11-15-2024
 */

"use client"

import { useState, useEffect, useCallback } from "react";
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
import { Class, Homework, Lecture, Profile, Textbook, TypedSupabaseClient } from "@/types";
import Link from "next/link";
import MicrosoftLoginButton from "@/components/Buttons/MicrosoftLoginButton";
import { ClassLayout } from "@/components/Class/ClassLayout";
import UploadLectureButton from "@/components/Buttons/UploadLectureButton";
import UploadTextbookButton from "@/components/Buttons/UploadTextbookButton";
import UploadHomeworkButton from "@/components/Buttons/UploadHomeworkButton";
import Content from "@/components/Content/Content";
import DeleteClassModal from "@/components/Delete/DeleteClassModal";

export default function ProfessorSignup() {
    const supabase = useSupabaseBrowser();
    const router = useRouter();
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

    const getClass = useCallback((classes: Class[] | undefined, profile: Profile | undefined) => {
        if (!classes || classes.length === 0) return null;
        return classes.filter(c => profile?.admin || profile?.classes.includes(c.id))[0];
    }, [classes, profile]);

    const classData = getClass(classes, profile);

    // Lectures data
    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classData?.id],
        queryFn: () => getLectures(supabase, [classData?.id!], false),
        enabled: !!classData?.id
    });

    // Textbooks data
    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classData?.id],
        queryFn: () => getTextbooks(supabase, [classData?.id!]),
        enabled: !!classData?.id
    });

    // Homework data
    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classData?.id],
        queryFn: () => getHomeworks(supabase, [classData?.id!]),
        enabled: !!classData?.id
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
            item.parse_status === 'uploading' || item.parse_status === 'parsing' || item.parse_status === 'complete'
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

    // Add realtime subscriptions for profiles
    useEffect(() => {
        if (!user) return;

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
                        queryKey: ["profile", user.id]
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

        const channel = supabase
            .channel('realtime-classes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'classes'
                },
                (payload) => {
                    console.log('Class change detected:', payload);

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
    }, [queryClient, user, supabase, classData]);


    // Add realtime subscriptions for lectures
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;

        const channel = supabase
            .channel('realtime-lectures')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'lectures',
                    filter: `class=eq.${classId}`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["lectures", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, supabase, queryClient]);

    // Add realtime subscriptions for lecture documents
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;
        if (!lectures || lectures.length === 0) return;

        const channel = supabase
            .channel('realtime-lecture-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `lecture=in.(${lectures.map(lecture => lecture.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["lectureDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, supabase, lectures, queryClient]);

    // Add realtime subscriptions for textbooks
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;
        if (!textbooks || textbooks.length === 0) return;

        const channel = supabase
            .channel('realtime-textbooks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'textbooks',
                    filter: `class=eq.${classId}`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["textbooks", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, supabase, queryClient]);

    // Add realtime subscriptions for textbook documents
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;
        if (!textbooks || textbooks.length === 0) return;

        const channel = supabase
            .channel('realtime-textbook-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `textbook=in.(${textbooks.map(textbook => textbook.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["textbookDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, supabase, textbooks, queryClient]);

    // Add realtime subscriptions for homeworks
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homeworks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'homeworks',
                    filter: `class=eq.${classId}`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["homeworks", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, supabase, queryClient]);

    // Add realtime subscriptions for exercises
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homework-exercises')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'exercises',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["exercises", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, homeworks, supabase, queryClient]);

    // Add realtime subscriptions for homework documents
    useEffect(() => {
        if (!classData) return;
        const classId = classData.id;
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homework-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["homeworkDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classData, homeworks, supabase, queryClient]);

    const getActiveStep = (profile: Profile | undefined, classItem: Class | null, lectures: Lecture[] | undefined, textbooks: Textbook[] | undefined, homeworks: Homework[] | undefined) => {
        if (profile && profile.admin) return 4;

        if (classItem) {
            const filteredLectures = lectures?.filter(l => l.class === classItem.id) || [];
            const filteredTextbooks = textbooks?.filter(t => t.class === classItem.id) || [];
            const filteredHomeworks = homeworks?.filter(h => h.class === classItem.id) || [];

            const lecturesReady = !classItem.lecture_enabled ||
                (filteredLectures.length > 0 && calculateUploadStatus(filteredLectures).percent === 100);
            const lecturesComplete = !classItem.lecture_enabled ||
                (filteredLectures.length > 0 && calculateParseStatus(filteredLectures).percent === 100);

            const textbooksReady = !classItem.textbook_enabled ||
                (filteredTextbooks.length > 0 && calculateUploadStatus(filteredTextbooks).percent === 100);
            const textbooksComplete = !classItem.textbook_enabled ||
                (filteredTextbooks.length > 0 && calculateParseStatus(filteredTextbooks).percent === 100);

            const homeworksReady = !classItem.homework_enabled ||
                (filteredHomeworks.length > 0 && calculateUploadStatus(filteredHomeworks).percent === 100);
            const homeworksComplete = !classItem.homework_enabled ||
                (filteredHomeworks.length > 0 && calculateParseStatus(filteredHomeworks).percent === 100);

            if (lecturesComplete && textbooksComplete && homeworksComplete) return 4;
            if (lecturesReady || textbooksReady || homeworksReady) return 3;
            if (classItem.saved) return 2;
        }

        if (profile && classData && classData.id) return 1;
        return 0;
    }

    const activeStep = getActiveStep(profile, classData, lectures?.filter(l => l.class === classData?.id), textbooks?.filter(t => t.class === classData?.id), homeworks?.filter(h => h.class === classData?.id));

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
                                                                <Management classId={classData?.id ?? ""} showExistingClasses={false} showOuterAccordion={false} />
                                                            </Tabs.Panel>
                                                        </Tabs>
                                                    </Stack> : (<Stack pt="md">
                                                        {classData && classData.brightspace_course_id !== null ? (
                                                            <Group>
                                                                <IconCheck size={16} />
                                                                <Text>Added {classData.class_code} from Brightspace at {new Date(classData.created_at ?? "").toLocaleString()}</Text>
                                                                <DeleteClassModal classId={classData?.id ?? ""} />
                                                            </Group>
                                                        ) : (
                                                            <Group>
                                                                <IconCheck size={16} />
                                                                <Text>Added {classData?.class_code} manually at {new Date(classData?.created_at ?? "").toLocaleString()}</Text>
                                                                <DeleteClassModal classId={classData?.id ?? ""} />
                                                            </Group>
                                                        )
                                                        }
                                                    </Stack>
                                                    )
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
                                                            <Management classId={classData?.id ?? ""} showCreateClass={false} showOuterAccordion={false} />
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
                                    <Accordion defaultValue={(activeStep === 2 || activeStep === 3) ? "step2" : null} key={"accordion-upload-content-" + activeStep}>
                                        <Accordion.Item value="step2">
                                            <Accordion.Control disabled={activeStep < 2}>
                                                <Group>
                                                    <Text fw={500}>Upload Content</Text>
                                                    {loading ? (
                                                        <Skeleton height={20} width={100} />
                                                    ) : (
                                                        activeStep > 2 ?
                                                            <Badge color="green">Complete</Badge> :
                                                            <Text c="dimmed" size="sm">Upload content from your computer or Brightspace</Text>
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
                                                    activeStep === 2 ? <Stack mt="md">
                                                        <Tabs defaultValue="brightspace">
                                                            <Tabs.List>
                                                                <Tabs.Tab value="brightspace">Upload from Brightspace</Tabs.Tab>
                                                                <Tabs.Tab value="manual">Upload from Computer</Tabs.Tab>
                                                            </Tabs.List>

                                                            <Tabs.Panel value="brightspace" pt="md">
                                                                <Stack gap="md">
                                                                    <Text size="md">
                                                                        1. Click the 'Download Now' button to upload your content to Scribe
                                                                    </Text>
                                                                    <Stack gap="0">
                                                                        <Text size="md">
                                                                            2. To keep the content refreshed, you can switch the 'Daily Download' button to download your content at a specific time every day.
                                                                        </Text>
                                                                        <Text size="xs" c="dimmed">
                                                                            *This option will keep you logged into Brightspace at all times, which may be a security risk.*
                                                                        </Text>
                                                                    </Stack>
                                                                </Stack>
                                                            </Tabs.Panel>

                                                            <Tabs.Panel value="manual" pt="md">
                                                                <Group>
                                                                    {classData?.lecture_enabled && (calculateUploadStatus(lectures?.filter(l => l.class === classData?.id) || []).percent === 100 ? <Button leftSection={<IconCheck size={16} />} disabled>Lectures Uploaded</Button> : <UploadLectureButton classId={classData?.id ?? ""} lectureNumber={lectures?.length ? lectures.length + 1 : 1}/>)}
                                                                    {classData?.textbook_enabled && (calculateUploadStatus(textbooks?.filter(t => t.class === classData?.id) || []).percent === 100 ? <Button leftSection={<IconCheck size={16} />} disabled>Textbooks Uploaded</Button> : <UploadTextbookButton classId={classData?.id ?? ""} textbookNumber={textbooks?.length ? textbooks.length + 1 : 1} />)}
                                                                    {classData?.homework_enabled && (calculateUploadStatus(homeworks?.filter(h => h.class === classData?.id) || []).percent === 100 ? <Button leftSection={<IconCheck size={16} />} disabled>Homeworks Uploaded</Button> : <UploadHomeworkButton classId={classData?.id ?? ""} homeworkNumber={homeworks?.length ? homeworks.length + 1 : 1} />)}
                                                                </Group>
                                                            </Tabs.Panel>
                                                        </Tabs>
                                                    </Stack> : <Content classId={classData?.id ?? ""} showDeleteButton={true} navigateHomeAfterDelete={false} />

                                                )}

                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Accordion>
                                }
                                __active={activeStep >= 2}
                            />

                            <Timeline.Item
                                bullet={<IconUpload size={16} />}
                                title={
                                    <Accordion defaultValue={(activeStep === 3 || activeStep === 4) ? "step3" : null} key={"accordion-parse-content-" + activeStep}>
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

                                                                return (
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
                            {activeStep === 4 && (
                                <Text c="dimmed" ta="center" mt="xl">
                                    All content has been processed! Click <Link href={`/classes/c/${classData?.id}`} target="_blank">here</Link> to view your dashboard.
                                </Text>
                            )}
                        </Timeline>
                    </Stack>
                </Paper>
            </Container>
        </ClassLayout>
    );
} 