/**
 * AccountMenu.tsx
 * 
 * This is the account menu for the general layout.
 * 
 * @AshokSaravanan222
 * 26.02.2025
 */

import { Menu, Avatar, Loader, Button, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { getAvatarUrl } from '@/utils/services/images';
import { logout } from '@/utils/services/auth';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { Profile } from '@/types';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconDoorExit, IconLogout, IconLogout2, IconMoon, IconSchool, IconSchoolOff, IconSun, IconUser } from '@tabler/icons-react';
import { useStudentMode } from './StudentModeContext';

interface AccountMenuProps {
    profile: Profile | undefined;
    classId: string;
}

export function AccountMenu({ profile, classId }: AccountMenuProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const { studentMode, setStudentMode } = useStudentMode();
    const computedColorScheme = useComputedColorScheme(undefined, { getInitialValueInEffect: true });
    const { setColorScheme } = useMantineColorScheme();

    const toggleColorScheme = () => {
        setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
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

    const avatarUrl = profile ? getAvatarUrl(profile.id) : null;


    return (
        <Menu
            trigger="click-hover"
            openDelay={100}
            closeDelay={200}
            shadow="md"
            width={200}
        >
            <Menu.Target>
                <Avatar
                    src={avatarUrl}
                    size="md"
                    radius="xl"
                    style={{ cursor: 'pointer' }}
                />
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item
                    component={Link}
                    href="/account"
                    leftSection={<IconUser size={16} />}
                >
                    Account
                </Menu.Item>
                {profile && (profile.professor || profile.admin) && (
                    <Menu.Item
                        component={"button"}
                        leftSection={studentMode ? <IconSchoolOff size={16} /> : <IconSchool size={16} />}
                        onClick={() => {
                            setStudentMode(!studentMode);
                            if (!studentMode) {
                                if (window.location.pathname.includes(`/class/${classId}/chat`)) {
                                    window.location.reload();
                                } else {
                                    router.push(`/class/${classId}/chat/new`);
                                }
                            } else {
                                window.location.reload();
                            }
                        }}
                    >
                        {studentMode ? "Exit Student Mode" : "Student Mode"}
                    </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item
                    leftSection={computedColorScheme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
                    onClick={toggleColorScheme}
                >
                    {computedColorScheme === 'dark' ? 'Light' : 'Dark'}
                </Menu.Item>
                <Menu.Item
                    onClick={handleLogout}
                    leftSection={<IconLogout size={16} />}
                    color="red"
                >
                    {loading ? <Loader size="sm" /> : 'Logout'}
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    )
}