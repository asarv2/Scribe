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
    useMantineTheme,
    Tooltip,
    Paper,
    Select,
    Box
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconPlus, IconTrash, IconCheck, IconX, IconFileImport } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { updateClass } from "@/utils/services/class";
import { TimeInput } from "@mantine/dates";
import { Class, Code } from "@/types";
import Link from "next/link";
import { updateProfile } from "@/utils/services/profile";
import { getClass } from "@/utils/queries/get-class";
import { createCode, deleteCode } from "@/utils/services/code";
import { getCode } from "@/utils/queries/get-code";
import { getFiles } from "@/utils/queries/get-files";

interface ManagementProps {
    classId: string;
    showCreateClass?: boolean;
    showExistingClasses?: boolean;
    showOuterAccordion?: boolean;
    showInitialClassInfo?: boolean;
}

export default function Management({ classId, showInitialClassInfo = true }: ManagementProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [saveLoading, setSaveLoading] = useState<Record<string, boolean>>({});
    const [syllabusLoading, setSyllabusLoading] = useState<boolean>(false);

    const [editableClasses, setEditableClasses] = useState<Record<string, {
        title: string;
        class_code: string;
        course_description: string;
        syllabus: string;
    }>>({});

    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [generateLoading, setGenerateLoading] = useState<boolean>(false);
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

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

    const { data: code, isLoading: loadingCode } = useQuery({
        queryKey: ["code", classId],
        queryFn: () => getCode(supabase, classId),
    });

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId),
    });

    // Initialize prompts and features when class data is loaded
    useEffect(() => {
        if (classData) {
            const initialEditableClasses: Record<string, any> = {};
            initialEditableClasses[classId] = {
                title: classData.title || '',
                class_code: classData.class_code || '',
                course_description: classData.course_description || '',
                syllabus: classData.syllabus || '',
            };

            setEditableClasses(initialEditableClasses);
        }
    }, [classData, classId]);


    const handleSavePrompts = async (classId: string) => {
        setSaveLoading(prev => ({ ...prev, [classId]: true }));
        try {

            const { success, error } = await updateClass(
                classId,
                editableClasses[classId].title,
                editableClasses[classId].class_code,
                editableClasses[classId].course_description,
                editableClasses[classId].syllabus == '' ? null : editableClasses[classId].syllabus
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

    const handleGenerateCode = async (classId: string) => {
        setGenerateLoading(true);
        try {
            if (!user) {
                throw new Error("User not found");
            }
            const { success, error } = await createCode(user.id, classId);
            if (!success) {
                throw new Error(error);
            }
            queryClient.invalidateQueries({ queryKey: ["code", classId] });
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setGenerateLoading(false);
        }
    };

    const handleDeleteCode = async (codeId: string) => {
        setDeleteLoading(true);
        try {
            const { success, error } = await deleteCode(codeId);
            if (!success) {
                throw new Error(error);
            }
            queryClient.invalidateQueries({ queryKey: ["code", classId] });
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

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code?.code || '');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    };

    const handleEditableChange = (classId: string, field: string, value: string) => {
        setEditableClasses(prev => {
            // Make sure we have an object for this class ID
            const classData = prev[classId] || {
                title: '',
                class_code: '',
                course_description: '',
                syllabus: ''
            };

            return {
                ...prev,
                [classId]: {
                    ...classData,
                    [field]: value
                }
            };
        });
    };

    const handleImportOutcomes = async () => {
        // Get the current syllabus value directly from state to avoid race conditions
        const currentSyllabus = editableClasses[classId]?.syllabus;
        if (!currentSyllabus) return;

        // Create a notification ID to update the same notification
        const notificationId = 'syllabus-import';

        try {
            setSyllabusLoading(true);

            const selectedFileId = editableClasses[classId]?.syllabus;

            // save changes
            await handleSavePrompts(classId);

            // Initial notification
            notifications.show({
                id: notificationId,
                loading: true,
                title: 'Processing Syllabus',
                message: 'Starting to process your syllabus...',
                autoClose: false,
                withCloseButton: false,
            });

            const file = files?.find(file => file.id === selectedFileId);

            if (!file) {
                throw new Error("File not found");
            }

            // Update notification - updating syllabus reference
            notifications.update({
                id: notificationId,
                loading: true,
                title: 'Processing Syllabus',
                message: 'Updating syllabus reference...',
                autoClose: false,
                withCloseButton: false,
            });

            // Update notification - parsing syllabus
            notifications.update({
                id: notificationId,
                loading: true,
                title: 'Processing Syllabus',
                message: 'Parsing syllabus content...',
                autoClose: false,
                withCloseButton: false,
            });

            const formData = new FormData();
            formData.append('class_id', classId);

            // Make sure this URL matches your server endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/syllabus`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Failed to import outcomes: ${response.status} ${response.statusText}`);
            } else {
                // Update notification - refreshing data
                notifications.update({
                    id: notificationId,
                    loading: true,
                    title: 'Processing Syllabus',
                    message: 'Refreshing class data...',
                    autoClose: false,
                    withCloseButton: false,
                });

                // invalidate outcomes query, and class and classes query
                await queryClient.invalidateQueries({ queryKey: ["outcomes", classId] });
                await queryClient.invalidateQueries({ queryKey: ["class", classId] });
                await queryClient.invalidateQueries({ queryKey: ["classes"] });

                // Final success notification
                notifications.update({
                    id: notificationId,
                    color: 'green',
                    title: 'Success',
                    message: 'Syllabus processed successfully!',
                    icon: <IconCheck size="1.1rem" />,
                    autoClose: 5000,
                    withCloseButton: true,
                });
            }
        } catch (error) {
            console.error(error);

            // Error notification
            notifications.update({
                id: notificationId,
                color: 'red',
                title: 'Error',
                message: error instanceof Error ? error.message : 'Failed to process syllabus',
                icon: <IconX size="1.1rem" />,
                autoClose: 5000,
                withCloseButton: true,
            });
        } finally {
            setSyllabusLoading(false);
        }
    }

    const renderClassInfo = (classItem: Class, joinCode: Code | undefined | null, hasChanges: boolean) => {
        return (
            <Stack>
                <Paper p="md" withBorder mt="md">
                    <Stack gap="xl">
                        {/* Class Details Section */}
                        {showInitialClassInfo && <Stack gap="md">
                            <Group>
                                <Select
                                    placeholder="Select syllabus file"
                                    data={files?.map(file => ({ value: file.id, label: file.title })) || []}
                                    value={editableClasses[classItem.id]?.syllabus}
                                    onChange={(value) => handleEditableChange(classItem.id, 'syllabus', value || '')}
                                    style={{ flexGrow: 1 }}
                                    disabled={syllabusLoading || loadingFiles}
                                    label="Syllabus"
                                />
                                {/* <Box pt={24}>
                                    <Tooltip label="Import Class & Outcomes">
                                        <ActionIcon
                                            color="blue"
                                            onClick={handleImportOutcomes}
                                            loading={syllabusLoading}
                                            disabled={!editableClasses[classItem.id]?.syllabus}
                                        >
                                            <IconFileImport size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Box> */}
                            </Group>
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

                        {/* Join Code Section */}
                        <Group gap="md" align="center">
                            <TextInput
                                label="Join Code"
                                value={joinCode?.code || ''}
                                placeholder="Click to generate code"
                                readOnly
                            />
                            {joinCode ?
                                <Group gap="xs" pt={24}>
                                    <Tooltip label={copySuccess ? "Copied!" : "Copy to clipboard"}>
                                        <ActionIcon
                                            onClick={handleCopyCode}
                                            variant="subtle"
                                            color={copySuccess ? "green" : "blue"}
                                        >
                                            {copySuccess ? <IconCheck size={18} /> : <IconCopy size={18} />}
                                        </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label="Delete Code">
                                        <ActionIcon
                                            onClick={() => handleDeleteCode(joinCode?.id || '')}
                                            variant="subtle"
                                            color="red"
                                            loading={deleteLoading}
                                            disabled={deleteLoading}
                                        >
                                            <IconTrash size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Group> :
                                <Group gap="xs" pt={24}>
                                    <Tooltip label="Generate Code">
                                        <ActionIcon
                                            onClick={() => handleGenerateCode(classItem.id)}
                                            variant="outline"
                                            color="green"
                                            loading={generateLoading}
                                            disabled={generateLoading}
                                        >
                                            <IconPlus size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Group>}
                        </Group>
                    </Stack>
                </Paper>
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

    // Check if user is professor or admin
    const canManageClasses = profile?.professor || profile?.admin;

    if (loadingProfile || loadingUser || loadingClassData) {
        return (
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack gap="xl">
                    <Skeleton height={40} width="200px" />
                    <Paper p="md" withBorder>
                        <Stack gap="xl">
                            {/* Syllabus selector skeleton */}
                            <Group>
                                <Box style={{ flexGrow: 1 }}>
                                    <Skeleton height={20} width="100px" mb={8} />
                                    <Skeleton height={36} width="100%" />
                                </Box>
                                <Box pt={24}>
                                    <Skeleton height={36} width={36} radius="sm" />
                                </Box>
                            </Group>

                            {/* Class details skeletons */}
                            <Group grow>
                                <Stack gap="xs">
                                    <Skeleton height={20} width="100px" />
                                    <Skeleton height={36} width="100%" />
                                </Stack>
                                <Stack gap="xs">
                                    <Skeleton height={20} width="100px" />
                                    <Skeleton height={36} width="100%" />
                                </Stack>
                            </Group>

                            {/* Description skeleton */}
                            <Stack gap="xs">
                                <Skeleton height={20} width="100px" />
                                <Skeleton height={36} width="100%" />
                                <Skeleton height={36} width="90%" />
                                <Skeleton height={36} width="80%" />
                            </Stack>

                            {/* Join code skeleton */}
                            <Group gap="md" align="center">
                                <Stack gap="xs" style={{ flexGrow: 1 }}>
                                    <Skeleton height={20} width="100px" />
                                    <Skeleton height={36} width="100%" />
                                </Stack>
                                <Group gap="xs" pt={24}>
                                    <Skeleton height={36} width={36} radius="sm" />
                                    <Skeleton height={36} width={36} radius="sm" />
                                </Group>
                            </Group>
                        </Stack>
                    </Paper>

                    {/* Save button skeleton */}
                    <Group justify="flex-end">
                        <Skeleton height={36} width={120} />
                    </Group>
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


    // check if editableClasses has changed
    const hasChanges = Object.keys(editableClasses).some(key => {
        const editable = editableClasses[key];
        return editable.title !== classData.title ||
            editable.class_code !== classData.class_code ||
            editable.course_description !== classData.course_description ||
            (editable.syllabus || '') !== (classData.syllabus || ''); // Handle null/undefined cases
    });

    return renderClassInfo(classData, code, hasChanges);
}
