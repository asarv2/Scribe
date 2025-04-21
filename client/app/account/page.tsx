/**
 * app/account/page.tsx
 * This page is used to manage the user's account. It allows the user to change their password and logout.
 * @AshokSaravanan222
 * 02-14-2025
 */
"use client";
import { Profile } from "@/types";
import {
    ActionIcon,
    Avatar,
    Button,
    Card,
    Group,
    Stack,
    Text,
    Title,
    useMantineColorScheme,
    useMantineTheme,
    PasswordInput,
    Select,
    CopyButton,
    Menu,
    Flex,
    Skeleton,
    Container,
    Switch,
    Tabs,
    Textarea,
    Modal,
    Box,
    Badge,
    Tooltip
} from "@mantine/core";
import { User } from "@supabase/supabase-js";
import { IconMoon, IconSun, IconUpload, IconUser, IconX, IconCopy, IconTrash, IconRefresh, IconDotsVertical } from "@tabler/icons-react";
import { useRef, useState, useEffect } from "react";
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { updateAvatar } from "@/utils/services/profile";
import { deleteAccount, logout, updatePassword } from "@/utils/services/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { getAvatarUrl } from "@/utils/services/images";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { createCode, deleteCode } from "@/utils/services/code";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { updateClassPrivacy } from "@/utils/services/class";
import Management from "@/components/Account/Management";
import avatarStyles from '@/components/Account/Avatar.module.css';

export default function AccountPage() {
    const openRef = useRef<() => void>(null);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const queryClient = useQueryClient();
    const router = useRouter();
    const supabase = useSupabaseBrowser()

    // Replace the single state variables with a state object keyed by class ID
    const [classPrompts, setClassPrompts] = useState<Record<string, {
        lecture: string;
        textbook: string;
        homework: string;
    }>>({});
    const [saveLoading, setSaveLoading] = useState<Record<string, boolean>>({});
    const [deleteModalOpened, setDeleteModalOpened] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handlePromptChange = (classId: string, type: 'lecture' | 'textbook' | 'homework', value: string) => {
        setClassPrompts(prev => ({
            ...prev,
            [classId]: {
                ...prev[classId],
                [type]: value
            }
        }));
    };

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    })

    const handleDrop = async (files: FileWithPath[]) => {
        if (!files[0]) return;

        setUploadLoading(true);
        try {
            if (!user) {
                throw new Error("User not found");
            }
            const formData = new FormData();
            formData.append("file", files[0]);
            const { success, error } = await updateAvatar(formData, user.id)
            if (!success) {
                throw new Error(error)
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
        } finally {
            setUploadLoading(false);
        }
    };

    const handlePasswordUpdate = async () => {
        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters long');
            return;
        }

        setPasswordLoading(true);
        setPasswordError('');

        try {
            if (!user) {
                throw new Error("User not found");
            }
            const { success, error } = await logout()
            if (!success) {
                throw new Error(error)
            } else {
                const { success, error } = await updatePassword(user.id, newPassword);
                if (!success) {
                    setPasswordError(error);
                } else {
                    notifications.show({
                        title: 'Password updated',
                        message: 'Password updated successfully',
                        color: 'green'
                    })
                    queryClient.clear();
                    router.push("/login")
                }
            }
        } catch (error) {
            setPasswordError('Failed to update password');
        } finally {
            setPasswordLoading(false);
            // Clear fields on success
            if (!passwordError) {
                setNewPassword('');
                setConfirmPassword('');
            }
        }
    };

    const handleLogout = async () => {
        setLoading(true)
        try {
            const { success, error } = await logout()
            if (!success) {
                throw new Error(error)
            } else {
                notifications.show({
                    title: 'Success',
                    message: 'Logged out',
                    color: 'green'
                })
                queryClient.clear();
                router.push("/login")
            }
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            })
        } finally {
            setLoading(false);
        }
    }

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
    }

    const handleDeleteAccount = async () => {
        setDeleteLoading(true);
        try {
            const { success, error } = await deleteAccount(user!.id);
            if (!success) {
                throw new Error(error);
            }
            notifications.show({
                title: 'Success',
                message: 'Your account has been successfully deleted',
                color: 'green'
            });
            queryClient.clear();
            router.push("/login");
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setDeleteLoading(false);
            setDeleteModalOpened(false);
        }
    };

    // Initialize prompts when classes data is loaded
    useEffect(() => {
        if (classes) {
            const initialPrompts: Record<string, { lecture: string; textbook: string; homework: string }> = {};
            classes.forEach(classItem => {
                initialPrompts[classItem.id] = {
                    lecture: classItem.lecture_prompt || '',
                    textbook: classItem.textbook_prompt || '',
                    homework: classItem.homework_prompt || ''
                };
            });
            setClassPrompts(initialPrompts);
        }
    }, [classes]);

    return (
        <ClassLayout classId={null} showClasses={false}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack style={{ maxWidth: '100%', margin: '0 auto' }} gap="xl">
                    <Stack gap="xl">
                        {/* Profile Section */}
                        <div>
                            <Text size="lg" fw={500} mb="md">Personal Information</Text>
                            <Card withBorder shadow="sm" radius="md" p="xl">
                                <Stack gap="xl">
                                    <Group justify="center" style={{ width: '100%' }}>
                                        <Stack align="center" gap="md">
                                            {uploadLoading ? (
                                                <Skeleton height={120} circle />
                                            ) : (
                                                <Dropzone
                                                    openRef={openRef}
                                                    onDrop={handleDrop}
                                                    accept={['image/jpeg', 'image/png']}
                                                    maxSize={5 * 1024 * 1024} // 5MB
                                                    multiple={false}
                                                    loading={uploadLoading}
                                                    style={{
                                                        border: 'none',
                                                        background: 'none',
                                                        padding: 0
                                                    }}
                                                >
                                                    <Avatar
                                                        src={profile ? getAvatarUrl(profile.id) : "/placeholder_image.svg"}
                                                        size={120}
                                                        radius={120}
                                                        className={`${avatarStyles.avatarContainer} ${avatarStyles.avatarBorder}`}
                                                    >
                                                        <IconUser size={80} />
                                                    </Avatar>
                                                </Dropzone>
                                            )}
                                            <Button
                                                variant="subtle"
                                                leftSection={<IconUpload size={16} />}
                                                onClick={() => openRef.current?.()}
                                                loading={uploadLoading}
                                            >
                                                Update Photo
                                            </Button>
                                        </Stack>
                                    </Group>

                                    <Stack gap="md">

                                        {loadingProfile ? (
                                            <Skeleton height={28} width="200px" />
                                        ) : (
                                            <Title order={4}>
                                                {profile?.first_name} {profile?.last_name}
                                            </Title>
                                        )}
                                        {loadingProfile ? (
                                            <Skeleton height={20} width="150px" />
                                        ) : (
                                            <Text c="dimmed" size="sm">
                                                {profile?.email}
                                            </Text>
                                        )}
                                    </Stack>
                                </Stack>
                                <Box style={{ position: 'absolute', top: 0, right: 0 }} p="md">
                                    <Tooltip label="Delete Account">
                                        <ActionIcon
                                            variant="subtle"
                                            color="red"
                                            onClick={() => setDeleteModalOpened(true)}
                                    >
                                            <IconTrash size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Box>
                                <Box style={{ position: 'absolute', top: 0, left: 0 }} p="md">
                                    {loadingProfile ? (
                                        <>
                                            <Skeleton height={20} width="140px" />
                                        </>
                                    ) : (
                                        <>
                                            {profile?.admin && (
                                                <Badge color="indigo">Administrator</Badge>
                                            )}
                                            {profile?.professor && (
                                                <Badge color="cyan">Professor</Badge>
                                            )}
                                            {!profile?.admin && !profile?.professor && (
                                                <Badge color="blue">Student</Badge>
                                            )}
                                        </>
                                    )}
                                </Box>
                            </Card>
                        </div>

                        {/* Password Section */}
                        {loadingUser ? (
                            <div>
                                <Text size="lg" fw={500} mb="md">Security Settings</Text>
                                <Card withBorder shadow="sm" radius="md" p="xl">
                                    <Stack gap="md">
                                        <Skeleton height={16} width="300px" />
                                        <Skeleton height={36} />
                                        <Skeleton height={36} />
                                        <Skeleton height={36} width="120px" />
                                    </Stack>
                                </Card>
                            </div>
                        ) : user?.email && (
                            <div>
                                <Text size="lg" fw={500} mb="md">Security Settings</Text>
                                <Card withBorder shadow="sm" radius="md" p="xl">
                                    <Stack gap="md">
                                        <Text size="xs" c="dimmed">You will be logged out upon updating your password.</Text>
                                        <PasswordInput
                                            label="New Password"
                                            value={newPassword}
                                            onChange={(event) => setNewPassword(event.currentTarget.value)}
                                            required
                                        />
                                        <PasswordInput
                                            label="Confirm New Password"
                                            value={confirmPassword}
                                            onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                                            required
                                        />
                                        {passwordError && (
                                            <Text c="red" size="sm">{passwordError}</Text>
                                        )}
                                        <Button
                                            onClick={handlePasswordUpdate}
                                            loading={passwordLoading}
                                        >
                                            Update Password
                                        </Button>
                                    </Stack>
                                </Card>
                            </div>
                        )}

                    </Stack>
                </Stack>
            </Container>

            <Modal
                opened={deleteModalOpened}
                onClose={() => setDeleteModalOpened(false)}
                title="Delete Account"
                centered
            >
                <Stack>
                    <Text>Are you sure you want to delete your account? This action cannot be undone.</Text>
                    <Group justify="flex-end" mt="md">
                        <Button
                            variant="light"
                            onClick={() => setDeleteModalOpened(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            onClick={handleDeleteAccount}
                            loading={deleteLoading}
                        >
                            Delete Account
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </ClassLayout>
    )
}
