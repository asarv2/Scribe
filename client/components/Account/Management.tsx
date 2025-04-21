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
    Tooltip
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconCopy, IconPlus, IconTrash, IconCheck } from "@tabler/icons-react";
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

    const [editableClasses, setEditableClasses] = useState<Record<string, {
        title: string;
        class_code: string;
        course_description: string;
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

    // Initialize prompts and features when class data is loaded
    useEffect(() => {
        if (classData) {
            const initialEditableClasses: Record<string, any> = {};
            initialEditableClasses[classId] = {
                title: classData.title || '',
                class_code: classData.class_code || '',
                course_description: classData.course_description || '',
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
        setEditableClasses(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [field]: value
            }
        }));
    };

    const renderClassInfo = (classItem: Class, joinCode: Code | undefined | null, hasChanges: boolean) => {
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
                                    variant="subtle"
                                    color="green"
                                    loading={generateLoading}
                                    disabled={generateLoading}
                                >
                                    <IconPlus size={18} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>}
                </Group>

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


    // check if editableClasses has changed
    const hasChanges = Object.keys(editableClasses).some(key => editableClasses[key].title !== classData.title || editableClasses[key].class_code !== classData.class_code || editableClasses[key].course_description !== classData.course_description);

    return renderClassInfo(classData, code, hasChanges);
}
