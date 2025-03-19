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
import { createClass, updateClassPrivacy, updateClassPrompts } from "@/utils/services/class";

export default function Management() {
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

            setClassPrompts(initialPrompts);
            setClassFeatures(initialFeatures);
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

    const handlePrivacyUpdate = async (classId: string, privacyStatus: boolean) => {
        try {
            const { success, error } = await updateClassPrivacy(classId, privacyStatus);
            if (!success) {
                throw new Error(error);
            }
            queryClient.invalidateQueries({ queryKey: ["classes"] });
            notifications.show({
                title: 'Success',
                message: 'Class privacy updated successfully',
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
                classFeatures[classId].homeworkEnabled
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
        if (!newClassName || !newClassCode) {
            notifications.show({
                title: 'Error',
                message: 'Class name and code are required',
                color: 'red'
            });
            return;
        }

        setCreateLoading(true);
        try {
            const { success, error } = await createClass(
                newClassName,
                newClassCode,
                newClassDescription,
                newClassTime
            );

            if (!success) {
                throw new Error(error);
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            notifications.show({
                title: 'Success',
                message: 'Class created successfully',
                color: 'green'
            });

            // Reset form
            setNewClassName("");
            setNewClassCode("");
            setNewClassDescription("");
            setNewClassTime("");
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
                <Accordion variant="separated">

                    {/* Existing Classes */}
                    {classes && classes
                        .filter(classItem => (profile?.classes?.includes(classItem.id) || profile?.admin))
                        .map((classItem) => {
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
                                            <Text fw={500}>{classItem.title} ({classItem.class_code})</Text>
                                            {hasChanges && (
                                                <Text size="xs" c="blue" fw={500}>Unsaved changes</Text>
                                            )}
                                        </Group>
                                    </Accordion.Control>
                                    <Accordion.Panel>
                                        <Stack gap="xl">
                                            {/* Class Details Section */}
                                            <Stack gap="md">
                                                <Group grow>
                                                    <TextInput
                                                        label="Class Name"
                                                        value={classItem.title || ''}
                                                        readOnly
                                                    />
                                                    <TextInput
                                                        label="Class Code"
                                                        value={classItem.class_code || ''}
                                                        readOnly
                                                    />
                                                </Group>
                                                <Textarea
                                                    label="Description"
                                                    value={classItem.course_description || ''}
                                                    readOnly
                                                    minRows={2}
                                                />
                                                <TextInput
                                                    label="Download Time"
                                                    value={classItem.download_time || ''}
                                                    readOnly
                                                />
                                            </Stack>

                                            {/* Private Mode Section */}
                                            <Stack gap="md">
                                                <Text fw={500} size="sm">Private Mode</Text>
                                                <Text size="xs" c="dimmed">
                                                    When private mode is enabled, all lecture content will be processed using our own models
                                                    instead of external services, ensuring complete data privacy.
                                                </Text>
                                                <Switch
                                                    checked={classItem.privacy}
                                                    onChange={(event) => handlePrivacyUpdate(classItem.id, event.currentTarget.checked)}
                                                    label="Enable private mode"
                                                    labelPosition="right"
                                                />
                                            </Stack>

                                            {/* Features Section */}
                                            <Stack gap="md">
                                                <Text fw={500} size="sm">Enabled Features</Text>
                                                <Text size="xs" c="dimmed">
                                                    Enable or disable specific features for this class.
                                                </Text>
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
                                                <Text fw={500} size="sm">Custom Prompts</Text>
                                                <Text size="xs" c="dimmed">
                                                    Customize the AI prompts for different content types in this class.
                                                </Text>

                                                {/* Only show prompts for enabled features */}
                                                {classFeatures[classItem.id]?.lectureEnabled && (
                                                    <Textarea
                                                        label="Lecture Prompt"
                                                        placeholder="Enter custom prompt for lecture content"
                                                        minRows={3}
                                                        value={classPrompts[classItem.id]?.lecture || ''}
                                                        onChange={(event) => handlePromptChange(classItem.id, 'lecture', event.currentTarget.value)}
                                                    />
                                                )}

                                                {classFeatures[classItem.id]?.textbookEnabled && (
                                                    <Textarea
                                                        label="Textbook Prompt"
                                                        placeholder="Enter custom prompt for textbook content"
                                                        minRows={3}
                                                        value={classPrompts[classItem.id]?.textbook || ''}
                                                        onChange={(event) => handlePromptChange(classItem.id, 'textbook', event.currentTarget.value)}
                                                    />
                                                )}

                                                {classFeatures[classItem.id]?.homeworkEnabled && (
                                                    <Textarea
                                                        label="Homework Prompt"
                                                        placeholder="Enter custom prompt for homework content"
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
                                    </Accordion.Panel>
                                </Accordion.Item>
                            );
                        })}


                    {/* Add New Class Accordion Item */}
                    <Accordion.Item value="new-class">
                        <Accordion.Control>
                            <Group justify="space-between">
                                <Text fw={500}>
                                    <IconPlus size={16} style={{ marginRight: 8, display: 'inline-block' }} />
                                    Add New Class
                                </Text>
                            </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                            <Stack gap="xl">
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
                                        minRows={3}
                                    />
                                    <TextInput
                                        label="Download Time"
                                        placeholder="MWF 10:00-11:30 AM"
                                        value={newClassTime}
                                        onChange={(e) => setNewClassTime(e.currentTarget.value)}
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
                        </Accordion.Panel>
                    </Accordion.Item>
                </Accordion>
            )}
        </Stack>
    );
}
