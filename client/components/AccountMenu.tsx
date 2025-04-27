/**
 * AccountMenu.tsx
 * 
 * This is the account menu for the general layout.
 * 
 * @AshokSaravanan222
 * 26.02.2025
 */

import { Menu, ActionIcon, Tooltip, useMantineColorScheme, Avatar, Text, Group } from '@mantine/core';
import { IconUser, IconSettings, IconLogout, IconSun, IconMoon, IconEye, IconEyeOff } from '@tabler/icons-react'; // Import IconUser
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Profile } from '@/types';
import { logout } from '@/utils/services/auth';
import { getAvatarUrl } from '@/utils/services/images';
import { useStudentMode } from './StudentModeContext';
import Link from 'next/link';

interface AccountMenuProps {
    profile: Profile | undefined | null;
    classId?: string | null;
}

export function AccountMenu({ profile, classId }: AccountMenuProps) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const { studentMode, setStudentMode } = useStudentMode();

    const handleLogout = async () => {
        await logout();
        queryClient.clear(); // Clear all query cache on logout
        router.push('/login'); // Redirect to login page
    };

    const toggleStudentMode = () => {
        setStudentMode(!studentMode);
        // Optionally redirect or refresh data based on mode change
        if (classId) {
            router.push(`/class/${classId}`); // Navigate to base class page on mode switch
        }
    };

    return (
        <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
                <Tooltip label="Account Settings">
                    {/* Replace Avatar with ActionIcon */}
                    <ActionIcon
                        variant="subtle"
                        color="blue" // Set color to blue
                        size="lg" // Adjust size as needed
                        aria-label="Account Settings"
                    >
                        <IconUser size={24} />
                    </ActionIcon>
                </Tooltip>
            </Menu.Target>

            <Menu.Dropdown>
                {profile && (
                    <>
                        <Menu.Label>
                            <Text size="sm" fw={500} truncate="end">{`${profile.first_name} ${profile.last_name}` || 'User'}</Text>
                            <Text size="xs" c="dimmed" truncate="end">{profile.email || 'No email'}</Text>
                        </Menu.Label>
                        <Menu.Divider />
                    </>
                )}

                {/* Student Mode Toggle */}
                {profile && (profile.professor || profile.admin) && (
                    <Menu.Item
                        leftSection={studentMode ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                        onClick={toggleStudentMode}
                    >
                        {studentMode ? 'Exit Student Mode' : 'Enter Student Mode'}
                    </Menu.Item>
                )}

                <Menu.Item
                    leftSection={<IconSettings size={14} />}
                    component={Link}
                    href="/account"
                >
                    Account Settings
                </Menu.Item>

                {/* Theme Toggle */}
                <Menu.Item
                    leftSection={colorScheme === 'dark' ? <IconSun size={14} /> : <IconMoon size={14} />}
                    onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
                >
                    {colorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                    color="red"
                    leftSection={<IconLogout size={14} />}
                    onClick={handleLogout}
                >
                    Logout
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
}