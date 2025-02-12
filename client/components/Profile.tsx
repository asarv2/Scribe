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
    useMantineTheme
} from "@mantine/core";
import { User } from "@supabase/supabase-js";
import { IconMoon, IconSun, IconUpload, IconUser, IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Dropzone, FileWithPath } from '@mantine/dropzone';
import { updateAvatar } from "@/utils/services/profile";
type ProfileProps = {
    user: User;
    profile: Profile;
    handleLogout: () => void;
    loading: boolean;
}

export function ProfilePage({
    user,
    profile,
    handleLogout,
    loading,
}: ProfileProps) {
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const openRef = useRef<() => void>(null);
    const [uploadLoading, setUploadLoading] = useState(false);

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

    const getAvatarUrl = (profile: Profile) => {
        return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profiles/${profile.id}.png`
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




