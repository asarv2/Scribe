/**
 * components/Profile.tsx
 * Profile component with avatar upload and user information display.
 * @AshokSaravanan222
 * 02.12.2025
 */

import { Profile } from "@/types";
import {
    ActionIcon,
    Avatar,
    Button,
    Card,
    Group,
    Paper,
    Stack,
    Text,
    Title,
    useMantineColorScheme,
    useMantineTheme,
    PasswordInput
} from "@mantine/core";
import { User } from "@supabase/supabase-js";
import { IconMoon, IconSun, IconUpload, IconUser, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { updateAvatar } from "@/utils/services/profile";
import { logout, updatePassword } from "@/utils/services/auth";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";

type ProfileProps = {
    user: User;
    profile: Profile;
}

export function ProfilePage({
    user,
    profile,
}: ProfileProps) {
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const openRef = useRef<() => void>(null);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const queryClient = useQueryClient();
    const router = useRouter();

    const toggleColorScheme = () => {
        setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
    };

    const handleDrop = async (files: FileWithPath[]) => {
        if (!files[0]) return;

        setUploadLoading(true);
        try {
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
                    queryClient.invalidateQueries({
                        queryKey: ["user"]
                    })
                    queryClient.invalidateQueries({
                        queryKey: ["profile", user.id]
                    })
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
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
                queryClient.invalidateQueries({
                    queryKey: ["profile", user.id]
                })
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

    const getAvatarUrl = (profile: Profile) => {
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/profiles/${profile.id}.png`
    }

    return (
        <Card withBorder shadow="sm" radius="md" p="xl" style={{ maxWidth: 600, margin: '0 auto' }}>
            <Group justify="flex-end" mb="md">
                {colorScheme === 'dark' ? (
                    <ActionIcon
                        variant="light"
                        color="yellow"
                        onClick={toggleColorScheme}
                    >
                        <IconSun size={24} />
                    </ActionIcon>
                ) : (
                    <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={toggleColorScheme}
                    >
                        <IconMoon size={24} />
                    </ActionIcon>
                )}
            </Group>
            <Stack>
                <Group justify="center" style={{ width: '100%' }}>
                    <Stack align="center">
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
                                src={getAvatarUrl(profile)}
                                size={120}
                                radius={120}
                                style={{
                                    cursor: 'pointer',
                                    border: `2px solid ${colorScheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                                }}
                            >
                                <IconUser size={80} />
                            </Avatar>
                        </Dropzone>
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

                <Stack>
                    <Title order={4}>
                        {profile?.first_name} {profile?.last_name}
                    </Title>
                    <Text color="dimmed" size="sm">
                        {user.email}
                    </Text>
                </Stack>

                <Paper withBorder p="md" radius="md">
                    <Stack>
                        <Text size="sm" fw={500}>Account Details</Text>
                        <Text size="sm">
                            <b>Member since:</b> {new Date(user.created_at).toLocaleDateString()}
                        </Text>
                        {profile?.admin && (
                            <Text size="sm" color="blue">Administrator Account</Text>
                        )}
                        {profile.professor && (
                            <Text size="sm" color="blue">Professor Account</Text>
                        )}
                    </Stack>
                </Paper>

                {user.email && (
                    <Paper withBorder p="md" radius="md">
                        <Stack>
                            <Text size="sm" fw={500}>Change Password</Text>
                            <Text size="xs" color="dimmed">You will be logged out upon updating your password.</Text>
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
                                <Text color="red" size="sm">{passwordError}</Text>
                            )}
                            <Button
                                onClick={handlePasswordUpdate}
                                loading={passwordLoading}
                            >
                                Update Password
                            </Button>
                        </Stack>
                    </Paper>
                )}

                <Button
                    color="red"
                    onClick={handleLogout}
                    loading={loading}
                >
                    Logout
                </Button>
            </Stack>
        </Card>
    );
}




