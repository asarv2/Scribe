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
import { getClass } from "@/utils/queries/get-class";

interface ManagementProps {
    classId: string;
    showCreateClass?: boolean;
    showExistingClasses?: boolean;
    showOuterAccordion?: boolean;
    showInitialClassInfo?: boolean;
}

export default function Management({ classId, showCreateClass = true, showExistingClasses = true, showOuterAccordion = true, showInitialClassInfo = true }: ManagementProps) {
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

    const [classChatTypes, setClassChatTypes] = useState<Record<string, {
        learn: boolean;
        homework: boolean;
        testPrep: boolean;
        present: boolean;
    }>>({});

    // States for managing class features
    const [classFeatures, setClassFeatures] = useState<Record<string, {
        lectureEnabled: boolean;
        textbookEnabled: boolean;
        homeworkEnabled: boolean;
        filesEnabled: boolean;
        videoEnabled: boolean;
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

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId),
        enabled: !!classId
    });

    // Initialize prompts and features when class data is loaded
    useEffect(() => {
        if (classData) {
            const initialPrompts: Record<string, { lecture: string; textbook: string; homework: string }> = {};
            const initialChatTypes: Record<string, { learn: boolean; homework: boolean; testPrep: boolean; present: boolean }> = {};
            const initialFeatures: Record<string, { lectureEnabled: boolean; textbookEnabled: boolean; homeworkEnabled: boolean; filesEnabled: boolean; videoEnabled: boolean }> = {};
            const initialEditableClasses: Record<string, any> = {};

            // Initialize for the single class
            initialPrompts[classId] = {
                lecture: classData.lecture_prompt || '',
                textbook: classData.textbook_prompt || '',
                homework: classData.homework_prompt || ''
            };

            initialFeatures[classId] = {
                lectureEnabled: classData.lecture_enabled || false,
                textbookEnabled: classData.textbook_enabled || false,
                homeworkEnabled: classData.homework_enabled || false,
                filesEnabled: classData.files_enabled || false,
                videoEnabled: classData.video_enabled || false
            };

            initialChatTypes[classId] = {
                learn: classData.learn_mode_enabled || false,
                homework: classData.homework_mode_enabled || false,
                testPrep: classData.test_prep_mode_enabled || false,
                present: classData.present_mode_enabled || false
            };

            initialEditableClasses[classId] = {
                title: classData.title || '',
                class_code: classData.class_code || '',
                course_description: classData.course_description || '',
                download: classData.download || false,
                download_time: classData.download_time || '',
                privateMode: classData.privacy || false
            };

            setClassPrompts(initialPrompts);
            setClassFeatures(initialFeatures);
            setClassChatTypes(initialChatTypes);
            setEditableClasses(initialEditableClasses);
        }
    }, [classData, classId]);

    const handlePromptChange = (classId: string, type: 'lecture' | 'textbook' | 'homework', value: string) => {
        setClassPrompts(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [type]: value
            }
        }));
    };

    const handleChatTypeToggle = (classId: string, type: 'learn' | 'homework' | 'testPrep' | 'present', value: boolean) => {
        setClassChatTypes(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [type]: value
            }
        }));
    };

    const handleFeatureToggle = (classId: string, feature: 'lectureEnabled' | 'textbookEnabled' | 'homeworkEnabled' | 'filesEnabled' | 'videoEnabled', value: boolean) => {
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

            const { success, error } = await updateClassPrompts(
                classId,
                classPrompts[classId].lecture,
                classPrompts[classId].textbook,
                classPrompts[classId].homework,
                classChatTypes[classId].learn,
                classChatTypes[classId].homework,
                classChatTypes[classId].testPrep,
                classChatTypes[classId].present,
                classFeatures[classId].lectureEnabled,
                classFeatures[classId].textbookEnabled,
                classFeatures[classId].homeworkEnabled,
                classFeatures[classId].filesEnabled,
                classFeatures[classId].videoEnabled,
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

                {/* Chat Types Section */}
                <Stack gap="md">
                    <Text fw={500} size="sm">Enabled Student Modes</Text>
                    <Group>
                        <Switch
                            checked={classChatTypes[classItem.id]?.learn}
                            onChange={(event) => handleChatTypeToggle(classItem.id, 'learn', event.currentTarget.checked)}
                            label="Learn"
                            labelPosition="right"
                        />
                        <Switch
                            checked={classChatTypes[classItem.id]?.homework}
                            onChange={(event) => handleChatTypeToggle(classItem.id, 'homework', event.currentTarget.checked)}
                            label="Homework"
                            labelPosition="right"
                        />
                        <Switch
                            checked={classChatTypes[classItem.id]?.testPrep}
                            onChange={(event) => handleChatTypeToggle(classItem.id, 'testPrep', event.currentTarget.checked)}
                            label="Test Prep"
                            labelPosition="right"
                        />
                        <Switch
                            checked={classChatTypes[classItem.id]?.present}
                            onChange={(event) => handleChatTypeToggle(classItem.id, 'present', event.currentTarget.checked)}
                            label="Present"
                            labelPosition="right"
                        />
                    </Group>
                </Stack>

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

                <Stack gap="md">
                    <Text fw={500} size="sm">Enabled Chat Types</Text>
                    <Group>
                        <Switch
                            checked={classFeatures[classItem.id]?.filesEnabled}
                            onChange={(event) => handleFeatureToggle(classItem.id, 'filesEnabled', event.currentTarget.checked)}
                            label="Files"
                            labelPosition="right"
                        />
                        <Switch
                            checked={classFeatures[classItem.id]?.videoEnabled}
                            onChange={(event) => handleFeatureToggle(classItem.id, 'videoEnabled', event.currentTarget.checked)}
                            label="Video"
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

    if (loadingProfile || loadingUser || loadingClassData) {
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

    if (!classData) {
        return (
            <Container fluid style={{ marginTop: "30px" }}>
                <Text>Class not found.</Text>
            </Container>
        );
    }

    const promptsChanged = classPrompts[classId] && (
        classPrompts[classId].lecture !== (classData.lecture_prompt || '') ||
        classPrompts[classId].textbook !== (classData.textbook_prompt || '') ||
        classPrompts[classId].homework !== (classData.homework_prompt || '')
    );

    const chatTypesChanged = classChatTypes[classId] && (
        classChatTypes[classId].learn !== (classData.learn_mode_enabled || false) ||
        classChatTypes[classId].homework !== (classData.homework_mode_enabled || false) ||
        classChatTypes[classId].testPrep !== (classData.test_prep_mode_enabled || false) ||
        classChatTypes[classId].present !== (classData.present_mode_enabled || false)
    );

    const featuresChanged = classFeatures[classId] && (
        classFeatures[classId].lectureEnabled !== (classData.lecture_enabled || false) ||
        classFeatures[classId].textbookEnabled !== (classData.textbook_enabled || false) ||
        classFeatures[classId].homeworkEnabled !== (classData.homework_enabled || false) ||
        classFeatures[classId].filesEnabled !== (classData.files_enabled || false) ||
        classFeatures[classId].videoEnabled !== (classData.video_enabled || false)
    );

    const hasChanges = promptsChanged || featuresChanged || chatTypesChanged;

    return renderClassInfo(classData, hasChanges);
}
