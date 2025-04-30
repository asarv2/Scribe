/**
 * AccountMenu.tsx
 * 
 * This is the account menu for the general layout.
 * 
 * @AshokSaravanan222
 * 26.02.2025
 */

import { Menu, ActionIcon, useMantineColorScheme, Avatar, Text, Group } from '@mantine/core';
import { IconUser, IconEdit, IconLogout, IconSun, IconMoon, IconEye, IconEyeOff, IconUserCheck } from '@tabler/icons-react'; // Changed IconSettings to IconEdit
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
        const newMode = !studentMode;
        setStudentMode(newMode);
        // Redirect based on mode change
        if (classId) {
            if (newMode) {
                // If entering student mode, go to chat page
                router.push(`/class/${classId}/chat/new`);
            } else {
                // If exiting student mode, go to base class page
                router.push(`/class/${classId}`);
            }
        }
    };

    return (
        <Menu 
            shadow="md" 
            width={200} 
            position="bottom-end"
            trigger="hover"
            openDelay={100}
            closeDelay={400}
            transitionProps={{ transition: 'fade', duration: 200 }}
        >
            <Menu.Target>
                <ActionIcon
                    variant="subtle"
                    color="blue"
                    size="lg"
                    aria-label="Account Settings"
                >
                    <IconUser size={24} />
                </ActionIcon>
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
                    leftSection={<IconUserCheck size={14} />}
                    component={Link}
                    href="/account"
                >
                    Edit Account
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