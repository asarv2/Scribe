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
    Switch
} from "@mantine/core";
import { User } from "@supabase/supabase-js";
import { IconMoon, IconSun, IconUpload, IconUser, IconX, IconCopy, IconTrash, IconRefresh } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { updateAvatar } from "@/utils/services/profile";
import { logout, updatePassword } from "@/utils/services/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { getAvatarUrl } from "@/utils/services/images";
import { getCodes } from "@/utils/queries/get-codes";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClasses } from "@/utils/queries/get-classes";
import { createCode, deleteCode } from "@/utils/services/code";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { updateClassPrivacy } from "@/utils/services/class";

export default function AccountPage() {
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
    const supabase = useSupabaseBrowser()


    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: codes, isLoading: codesLoading } = useQuery({
        queryKey: ["codes"],
        queryFn: () => getCodes(supabase)
    })

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase)
    })

    const toggleColorScheme = () => {
        setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
    };

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

    const handleGenerateCode = async (classIds: string[]) => {
        try {
            if (!user) {
                throw new Error("User not found");
            }
            const { success, error } = await createCode(user.id, classIds);
            if (!success) {
                throw new Error(error);
            }
            queryClient.invalidateQueries({ queryKey: ["codes"] });
            notifications.show({
                title: 'Success',
                message: 'Code generated successfully',
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

    const handleDeleteCode = async (codeId: string) => {
        try {
            const { success, error } = await deleteCode(codeId);
            if (!success) {
                throw new Error(error);
            }
            queryClient.invalidateQueries({ queryKey: ["codes"] });
            notifications.show({
                title: 'Success',
                message: 'Code deleted successfully',
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


    return (
        <ClassLayout classId={null}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack style={{ maxWidth: '100%', margin: '0 auto' }} gap="xl">
                    <Stack gap="xl">
                        {/* Profile Section */}
                        <div>
                            <Text size="lg" fw={500} mb="md">Personal Information</Text>
                            <Card withBorder shadow="sm" radius="md" p="xl">
                                <Group justify="flex-end" mb="md">
                                    {/* {colorScheme === 'dark' ? (
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
                            )} */}
                                </Group>
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
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: `2px solid ${colorScheme === 'dark' ? '#374151' : '#e5e7eb'}`,
                                                        }}
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
                            </Card>
                        </div>

                        {/* Account Details Section */}
                        <div>
                            <Text size="lg" fw={500} mb="md">Account Details</Text>
                            <Card withBorder shadow="sm" radius="md" p="xl">
                                <Stack>
                                    {loadingProfile ? (
                                        <>
                                            <Skeleton height={20} width="140px" />
                                            <Skeleton height={20} width="180px" />
                                        </>
                                    ) : (
                                        <>
                                            {profile?.admin && (
                                                <Text size="sm" c="blue">Administrator Account</Text>
                                            )}
                                            {profile?.professor && (
                                                <Text size="sm" c="blue">Professor Account</Text>
                                            )}
                                        </>
                                    )}
                                    {loadingUser ? (
                                        <Skeleton height={20} width="250px" />
                                    ) : (
                                        <Text size="sm">
                                            <b>Member since:</b> {user && new Date(user.created_at).toLocaleDateString()}
                                        </Text>
                                    )}
                                </Stack>
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
                                            <Text color="red" size="sm">{passwordError}</Text>
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

                        {/* Class Access Codes Section */}
                        {loadingProfile ? (
                            <div>
                                <Text size="lg" fw={500} mb="md">Class Access Codes</Text>
                                <Card withBorder shadow="sm" radius="md" p="xl">
                                    <Stack gap="md">
                                        {[1, 2, 3].map((i) => (
                                            <Stack key={i} gap="sm">
                                                <Skeleton height={20} width="180px" />
                                                <Group gap="sm">
                                                    <Skeleton height={36} width="200px" />
                                                    <Skeleton height={36} width={36} circle />
                                                    <Skeleton height={36} width={36} circle />
                                                </Group>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Card>
                            </div>
                        ) : (profile?.professor || profile?.admin) && (
                            <div>
                                <Text size="lg" fw={500} mb="md">Class Access Codes</Text>
                                <Card withBorder shadow="sm" radius="md" p="xl">
                                    <Stack gap="md">
                                        {classesLoading || codesLoading ? (
                                            <Stack gap="md">
                                                {[1, 2, 3].map((i) => (
                                                    <Stack key={i} gap="sm">
                                                        <Skeleton height={20} width="180px" />
                                                        <Group gap="sm">
                                                            <Skeleton height={36} width="200px" />
                                                            <Skeleton height={36} width={36} circle />
                                                            <Skeleton height={36} width={36} circle />
                                                        </Group>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        ) : !classes || classes.length === 0 ? (
                                            <Text c="dimmed" size="sm">No classes available.</Text>
                                        ) : (
                                            <Stack gap="md">
                                                {classes.filter(classItem => profile?.classes?.includes(classItem.id)).map((classItem) => {
                                                    const classCode = codes?.find(c => c.classes.includes(classItem.id));

                                                    return (
                                                        <Stack key={classItem.id} gap="sm">
                                                            <Text size="sm" fw={500} style={{
                                                                width: '200px', whiteSpace:
                                                                    'nowrap'
                                                            }}>
                                                                {classItem.title}
                                                            </Text>
                                                            <Group gap="sm">
                                                                <PasswordInput
                                                                    value={classCode?.code || ''}
                                                                    readOnly
                                                                    style={{ width: '200px' }}
                                                                    placeholder="Create a code"
                                                                />
                                                                {
                                                                    !classCode ? (
                                                                        <ActionIcon
                                                                            variant="light"
                                                                            color="blue"
                                                                            onClick={() => handleGenerateCode([classItem.id])}
                                                                            title="Generate Code"
                                                                        >
                                                                            <IconRefresh size={16} />
                                                                        </ActionIcon>
                                                                    ) : (
                                                                        <CopyButton value={classCode.code}>
                                                                            {({ copied, copy }) => (
                                                                                <ActionIcon
                                                                                    variant="light"
                                                                                    color={copied ? 'green' : 'blue'}
                                                                                    onClick={() => {
                                                                                        copy()
                                                                                        notifications.show({
                                                                                            title: 'Success',
                                                                                            message: 'Code copied to clipboard',
                                                                                            color: 'green'
                                                                                        })
                                                                                    }}
                                                                                >
                                                                                    <IconCopy size={16} />
                                                                                </ActionIcon>
                                                                            )}
                                                                        </CopyButton>
                                                                    )
                                                                }
                                                                {classCode && (
                                                                    <ActionIcon
                                                                        color="red"
                                                                        variant="light"
                                                                        onClick={() => handleDeleteCode(classCode.id)}
                                                                        title="Delete Code"
                                                                    >
                                                                        <IconTrash size={16} />
                                                                    </ActionIcon>
                                                                )}
                                                            </Group>
                                                        </Stack>
                                                    );
                                                })}
                                            </Stack>
                                        )}
                                    </Stack>
                                </Card>
                            </div>
                        )}

                        {/* Private Mode Settings Section */}
                        {loadingProfile ? (
                            <div>
                                <Text size="lg" fw={500} mb="md">Private Mode</Text>
                                <Card withBorder shadow="sm" radius="md" p="xl">
                                    <Stack gap="md">
                                        {[1, 2, 3].map((i) => (
                                            <Stack key={i} gap="sm">
                                                <Skeleton height={20} width="180px" />
                                                <Group gap="sm">
                                                    <Skeleton height={36} width="200px" />
                                                    <Skeleton height={36} width={36} />
                                                </Group>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Card>
                            </div>
                        ) : (profile?.professor || profile?.admin) && (
                            <div>
                                <Text size="lg" fw={500} mb="md">Private Mode Settings</Text>
                                <Card withBorder shadow="sm" radius="md">
                                    <Stack gap="md">
                                        <Text size="sm" c="dimmed">
                                            When private mode is enabled for a class, all content will be processed using our own models instead of external services, ensuring complete data privacy.
                                        </Text>
                                        {classesLoading ? (
                                            <Stack gap="md">
                                                {[1, 2, 3].map((i) => (
                                                    <Stack key={i} gap="sm">
                                                        <Skeleton height={20} width="180px" />
                                                        <Skeleton height={36} width="200px" />
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        ) : !classes || classes.length === 0 ? (
                                            <Text c="dimmed" size="sm">No classes available.</Text>
                                        ) : (
                                            <Stack gap="md">
                                                {classes.filter(classItem => profile?.classes?.includes(classItem.id)).map((classItem) => (
                                                    <Switch
                                                        key={classItem.id}
                                                        checked={classItem.privacy}
                                                        onChange={(event) => handlePrivacyUpdate(classItem.id, event.currentTarget.checked)}
                                                        label={`${classItem.title}`}
                                                        labelPosition="right"
                                                    />
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                </Card>
                            </div>
                        )}
                    </Stack>
                </Stack>
            </Container>
        </ClassLayout>
    )



}
