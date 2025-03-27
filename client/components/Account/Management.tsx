/**
 * Management.tsx
 * This is the page that allows the user to manage their classes
 * @AshokSaravanan222
 * 11-15-2024
 */

import {
    ActionIcon,
    Accordion,
    Button,
    Card,
    Container,
    Flex,
    Group,
    Modal,
    Skeleton,
    Stack,
    Switch,
    Text,
    TextInput,
    Textarea,
    Title,
    useMantineTheme
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { createClass, updateClassPrivacy, updateClassPrompts, deleteClass } from "@/utils/services/class";
import { TimeInput } from "@mantine/dates";
import { Class } from "@/types";
import Link from "next/link";
import { updateProfile } from "@/utils/services/profile";

interface ManagementProps {
    showCreateClass?: boolean;
    showExistingClasses?: boolean;
    showOuterAccordion?: boolean;
    showInitialClassInfo?: boolean;
}

export default function Management({ showCreateClass = true, showExistingClasses = true, showOuterAccordion = true, showInitialClassInfo = true }: ManagementProps) {
    const theme = useMantineTheme();
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);

    // Form states for creating a new class
    const [newClassName, setNewClassName] = useState("");
    const [newClassCode, setNewClassCode] = useState("");
    const [newClassDescription, setNewClassDescription] = useState("");
    const [newClassTime, setNewClassTime] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    // States for managing class prompts
    const [classPrompts, setClassPrompts] = useState<Record<string, {
        lecture: string;
        textbook: string;
        homework: string;
    }>>({});

    // States for managing class features
    const [classFeatures, setClassFeatures] = useState<Record<string, {
        lectureEnabled: boolean;
        textbookEnabled: boolean;
        homeworkEnabled: boolean;
    }>>({});

    const [saveLoading, setSaveLoading] = useState<Record<string, boolean>>({});

    const [editableClasses, setEditableClasses] = useState<Record<string, {
        title: string;
        class_code: string;
        course_description: string;
        download: boolean;
        download_time: string;
        privateMode: boolean;
    }>>({});

    const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    });

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    });

    // Initialize prompts and features when classes data is loaded
    useEffect(() => {
        if (classes) {
            const initialPrompts: Record<string, { lecture: string; textbook: string; homework: string }> = {};
            const initialFeatures: Record<string, { lectureEnabled: boolean; textbookEnabled: boolean; homeworkEnabled: boolean }> = {};

            classes.forEach(classItem => {
                initialPrompts[classItem.id] = {
                    lecture: classItem.lecture_prompt || '',
                    textbook: classItem.textbook_prompt || '',
                    homework: classItem.homework_prompt || ''
                };

                initialFeatures[classItem.id] = {
                    lectureEnabled: classItem.lecture_enabled || false,
                    textbookEnabled: classItem.textbook_enabled || false,
                    homeworkEnabled: classItem.homework_enabled || false
                };
            });

            const initialEditableClasses: Record<string, any> = {};
            classes.forEach(classItem => {
                initialEditableClasses[classItem.id] = {
                    title: classItem.title || '',
                    class_code: classItem.class_code || '',
                    course_description: classItem.course_description || '',
                    download: classItem.download || false,
                    download_time: classItem.download_time || '',
                    privateMode: classItem.privacy || false
                };
            });

            setClassPrompts(initialPrompts);
            setClassFeatures(initialFeatures);
            setEditableClasses(initialEditableClasses);
        }
    }, [classes]);

    const handlePromptChange = (classId: string, type: 'lecture' | 'textbook' | 'homework', value: string) => {
        setClassPrompts(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [type]: value
            }
        }));
    };

    const handleFeatureToggle = (classId: string, feature: 'lectureEnabled' | 'textbookEnabled' | 'homeworkEnabled', value: boolean) => {
        setClassFeatures(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [feature]: value
            }
        }));
    };

    const handleSavePrompts = async (classId: string) => {
        setSaveLoading(prev => ({ ...prev, [classId]: true }));
        try {
            const classToUpdate = classes?.find(c => c.id === classId);
            if (!classToUpdate) return;

            const { success, error } = await updateClassPrompts(
                classId,
                classPrompts[classId].lecture,
                classPrompts[classId].textbook,
                classPrompts[classId].homework,
                classFeatures[classId].lectureEnabled,
                classFeatures[classId].textbookEnabled,
                classFeatures[classId].homeworkEnabled,
                editableClasses[classId].title,
                editableClasses[classId].class_code,
                editableClasses[classId].course_description,
                editableClasses[classId].download,
                editableClasses[classId].download_time,
                editableClasses[classId].privateMode
            );

            if (!success) {
                throw new Error(error);
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            queryClient.invalidateQueries({ queryKey: ["class", classId] });
            notifications.show({
                title: 'Success',
                message: 'Class settings updated successfully',
                color: 'green'
            });
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setSaveLoading(prev => ({ ...prev, [classId]: false }));
        }
    };

    const handleCreateClass = async () => {

        if (!profile) {
            throw new Error("Profile not found");
        }

        if (!newClassName || !newClassCode) {
            throw new Error("Class name and code are required");
        }

        setCreateLoading(true);
        try {
            const classId = await createClass(
                newClassName,
                newClassCode,
                newClassDescription
            );

            if (!classId) {
                throw new Error("Failed to create class");
            } else {
                // add class to profile if not admin
                if (!profile.admin) {
                    const { success: profileSuccess, error: profileError } = await updateProfile(profile.id, {
                        classes: Array.from(new Set([...profile.classes, classId]))
                    });

                    if (!profileSuccess) {
                        throw new Error(profileError);
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            notifications.show({
                title: 'Success',
                message: 'Class created successfully',
                color: 'green'
            });

            // Reset form
            setNewClassName("");
            setNewClassCode("");
            setNewClassDescription("");
            close();
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setCreateLoading(false);
        }
    };

    const handleEditableChange = (classId: string, field: string, value: string) => {
        setEditableClasses(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [field]: value
            }
        }));
    };

    const handleDownloadToggle = (classId: string, value: boolean) => {
        setEditableClasses(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                download: value,
                download_time: value ? prev[classId].download_time : ''
            }
        }));
    };

    const handlePrivateModeToggle = (classId: string, value: boolean) => {
        setEditableClasses(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                privateMode: value
            }
        }));
    };

    const handleDeleteClass = async (classId: string) => {
        setDeleteLoading(true);
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
            setDeleteModalOpen(null);
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setDeleteLoading(false);
        }
    };

    const renderClassInfo = (classItem: Class, hasChanges: boolean) => {
        return (
            <Stack gap="xl">
                {/* Class Details Section */}
                {showInitialClassInfo && <Stack gap="md">
                    <Group grow>
                        <TextInput
                            label="Class Name"
                            value={editableClasses[classItem.id]?.title}
                            onChange={(e) => handleEditableChange(classItem.id, 'title', e.currentTarget.value)}
                        />
                        <TextInput
                            label="Class Code"
                            value={editableClasses[classItem.id]?.class_code}
                            onChange={(e) => handleEditableChange(classItem.id, 'class_code', e.currentTarget.value)}
                        />
                    </Group>
                    <Textarea
                        label="Description"
                        value={editableClasses[classItem.id]?.course_description}
                        onChange={(e) => handleEditableChange(classItem.id, 'course_description', e.currentTarget.value)}
                        autosize
                        minRows={3}
                    />

                </Stack>}

                {/* Privacy Mode Section */}
                {/* <Stack gap="xs">
                    <Switch
                        checked={editableClasses[classItem.id]?.privateMode}
                        onChange={(e) => handlePrivateModeToggle(classItem.id, e.currentTarget.checked)}
                        label="Private mode"
                        labelPosition="right"
                    />
                    <Text size="xs" c="dimmed">
                        When private mode is enabled, all lecture content will be processed using our own models
                        instead of external services, ensuring complete data privacy.
                    </Text>
                </Stack> */}

                {/* <Stack gap="xs">
                    <Switch
                        checked={editableClasses[classItem.id]?.download}
                        onChange={(e) => handleDownloadToggle(classItem.id, e.currentTarget.checked)}
                        label="Download with Chrome Extension"
                        labelPosition="right"
                    />
                    <Text size="xs" c="dimmed">
                        When enabled, you and your students will be able to download content from Brightspace using the <Link href="https://chromewebstore.google.com/detail/bckhgcbgegchbplocbfopipkdoohfaeb?utm_source=item-share-cb" target="_blank">Scribe Chrome Extension</Link>.
                    </Text>
                </Stack> */}

                {/* Features Section */}
                <Stack gap="md">
                    <Text fw={500} size="sm">Enabled Content Types</Text>
                    <Group>
                        <Switch
                            checked={classFeatures[classItem.id]?.lectureEnabled}
                            onChange={(event) => handleFeatureToggle(classItem.id, 'lectureEnabled', event.currentTarget.checked)}
                            label="Lecture"
                            labelPosition="right"
                        />
                        <Switch
                            checked={classFeatures[classItem.id]?.textbookEnabled}
                            onChange={(event) => handleFeatureToggle(classItem.id, 'textbookEnabled', event.currentTarget.checked)}
                            label="Textbook"
                            labelPosition="right"
                        />
                        <Switch
                            checked={classFeatures[classItem.id]?.homeworkEnabled}
                            onChange={(event) => handleFeatureToggle(classItem.id, 'homeworkEnabled', event.currentTarget.checked)}
                            label="Homework"
                            labelPosition="right"
                        />
                    </Group>
                </Stack>

                {/* Custom Prompts Section */}
                <Stack gap="md">
                    {/* Only show prompts for enabled features */}
                    {classFeatures[classItem.id]?.lectureEnabled && (
                        <Textarea
                            label="Lecture Prompt"
                            placeholder="Enter custom prompt for lecture content"
                            autosize
                            minRows={3}
                            value={classPrompts[classItem.id]?.lecture || ''}
                            onChange={(event) => handlePromptChange(classItem.id, 'lecture', event.currentTarget.value)}
                        />
                    )}

                    {classFeatures[classItem.id]?.textbookEnabled && (
                        <Textarea
                            label="Textbook Prompt"
                            placeholder="Enter custom prompt for textbook content"
                            autosize
                            minRows={3}
                            value={classPrompts[classItem.id]?.textbook || ''}
                            onChange={(event) => handlePromptChange(classItem.id, 'textbook', event.currentTarget.value)}
                        />
                    )}

                    {classFeatures[classItem.id]?.homeworkEnabled && (
                        <Textarea
                            label="Homework Prompt"
                            placeholder="Enter custom prompt for homework content"
                            autosize
                            minRows={3}
                            value={classPrompts[classItem.id]?.homework || ''}
                            onChange={(event) => handlePromptChange(classItem.id, 'homework', event.currentTarget.value)}
                        />
                    )}
                </Stack>
                <Group justify="flex-end">
                    <Button
                        onClick={() => handleSavePrompts(classItem.id)}
                        variant={hasChanges ? "filled" : "light"}
                        loading={saveLoading[classItem.id]}
                    >
                        Save Changes
                    </Button>
                </Group>
            </Stack>
        );
    };

    const renderCreateClass = () => {
        return (
            <Stack>
                <Stack gap="md">
                    <Group grow>
                        <TextInput
                            label="Class Name"
                            placeholder="Introduction to Computer Science"
                            value={newClassName}
                            onChange={(e) => setNewClassName(e.currentTarget.value)}
                            required
                        />
                        <TextInput
                            label="Class Code"
                            placeholder="CS101"
                            value={newClassCode}
                            onChange={(e) => setNewClassCode(e.currentTarget.value)}
                            required
                        />
                    </Group>
                    <Textarea
                        label="Description"
                        placeholder="A brief description of the class"
                        value={newClassDescription}
                        onChange={(e) => setNewClassDescription(e.currentTarget.value)}
                        autosize
                        minRows={3}
                    />
                </Stack>
                <Group justify="flex-end">
                    <Button
                        onClick={handleCreateClass}
                        loading={createLoading}
                    >
                        Create Class
                    </Button>
                </Group>
            </Stack>
        )
    }

    // Check if user is professor or admin
    const canManageClasses = profile?.professor || profile?.admin;

    if (loadingProfile || loadingUser) {
        return (
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack gap="xl">
                    <Skeleton height={40} width="200px" />
                    <Skeleton height={200} />
                </Stack>
            </Container>
        );
    }

    if (!canManageClasses) {
        return (
            <Container fluid style={{ marginTop: "30px" }}>
                <Text>You do not have permission to manage classes.</Text>
            </Container>
        );
    }

    return (
        <Stack gap="xl">
            {classesLoading ? (
                <Stack gap="md">
                    <Skeleton height={60} />
                    <Skeleton height={60} />
                    <Skeleton height={60} />
                </Stack>
            ) : (
                <>
                    {showOuterAccordion ? <Accordion
                        variant="separated"
                        defaultValue={classes
                            ?.filter(classItem => (profile?.classes?.includes(classItem.id) || profile?.admin))?.[0]?.id
                        }
                        chevronPosition="left"
                    >
                        {/* Existing Classes */}
                        {showExistingClasses && classes && classes
                            .filter(classItem => (profile?.classes?.includes(classItem.id) || profile?.admin))
                            .map((classItem: Class) => {
                                const promptsChanged = classPrompts[classItem.id] && (
                                    classPrompts[classItem.id].lecture !== (classItem.lecture_prompt || '') ||
                                    classPrompts[classItem.id].textbook !== (classItem.textbook_prompt || '') ||
                                    classPrompts[classItem.id].homework !== (classItem.homework_prompt || '')
                                );

                                const featuresChanged = classFeatures[classItem.id] && (
                                    classFeatures[classItem.id].lectureEnabled !== (classItem.lecture_enabled || false) ||
                                    classFeatures[classItem.id].textbookEnabled !== (classItem.textbook_enabled || false) ||
                                    classFeatures[classItem.id].homeworkEnabled !== (classItem.homework_enabled || false)
                                );

                                const hasChanges = promptsChanged || featuresChanged;

                                return (
                                    <Accordion.Item key={classItem.id} value={classItem.id}>
                                        <Accordion.Control>
                                            <Group justify="space-between">
                                                <Text fw={500}>{classItem.class_code}</Text>
                                                <Group gap="xs">
                                                    {hasChanges && (
                                                        <Text size="xs" c="blue" fw={500}>Unsaved changes</Text>
                                                    )}
                                                    <ActionIcon
                                                        color="red"
                                                        variant="subtle"
                                                        size="md"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteModalOpen(classItem.id);
                                                        }}
                                                    >
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Group>
                                            </Group>
                                        </Accordion.Control>
                                        <Accordion.Panel>
                                            {renderClassInfo(classItem, hasChanges)}
                                        </Accordion.Panel>
                                    </Accordion.Item>
                                );
                            })}


                        {/* Add New Class Accordion Item */}
                        {showCreateClass && (
                            <Accordion.Item value="new-class">
                                <Accordion.Control>
                                    <Group justify="space-between">
                                        <Group gap="xs">
                                            <ActionIcon
                                                variant="light"
                                                color="blue"
                                                size="sm"
                                                radius="xl"
                                            >
                                                <IconPlus size={16} />
                                            </ActionIcon>
                                            <Text fw={500} c="blue">Add New Class</Text>
                                        </Group>
                                    </Group>
                                </Accordion.Control>
                                <Accordion.Panel>
                                    {renderCreateClass()}
                                </Accordion.Panel>
                            </Accordion.Item>
                        )}
                    </Accordion> : <>
                        {showExistingClasses && classes && classes
                            .filter(classItem => (profile?.classes?.includes(classItem.id) || profile?.admin))
                            .map((classItem: Class) => {
                                const promptsChanged = classPrompts[classItem.id] && (
                                    classPrompts[classItem.id].lecture !== (classItem.lecture_prompt || '') ||
                                    classPrompts[classItem.id].textbook !== (classItem.textbook_prompt || '') ||
                                    classPrompts[classItem.id].homework !== (classItem.homework_prompt || '')
                                );

                                const featuresChanged = classFeatures[classItem.id] && (
                                    classFeatures[classItem.id].lectureEnabled !== (classItem.lecture_enabled || false) ||
                                    classFeatures[classItem.id].textbookEnabled !== (classItem.textbook_enabled || false) ||
                                    classFeatures[classItem.id].homeworkEnabled !== (classItem.homework_enabled || false)
                                );

                                const hasChanges = promptsChanged || featuresChanged;

                                return (
                                    <Stack key={classItem.id}>
                                        {renderClassInfo(classItem, hasChanges)}
                                    </Stack>
                                )
                            })}
                        {showCreateClass && renderCreateClass()}
                    </>}
                </>
            )}
            <Modal
                opened={!!deleteModalOpen}
                onClose={() => setDeleteModalOpen(null)}
                title="Delete Class"
                size="sm"
            >
                <Stack>
                    <Text size="sm">
                        Are you sure you want to delete this class? This action cannot be undone.
                    </Text>
                    <Group justify="flex-end">
                        <Button
                            variant="subtle"
                            onClick={() => setDeleteModalOpen(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            loading={deleteLoading}
                            onClick={() => deleteModalOpen && handleDeleteClass(deleteModalOpen)}
                        >
                            Delete
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    );
}
