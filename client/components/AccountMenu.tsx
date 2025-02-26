/**
 * AccountMenu.tsx
 * 
 * This is the account menu for the general layout.
 * 
 * @AshokSaravanan222
 * 26.02.2025
 */

import { Menu, Avatar, Loader } from '@mantine/core';
import { getAvatarUrl } from '@/utils/services/images';
import { logout } from '@/utils/services/auth';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { Profile } from '@/types';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface AccountMenuProps {
    profile: Profile | undefined;
}

export function AccountMenu({ profile }: AccountMenuProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

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

    const avatarUrl = profile ? getAvatarUrl(profile.id) : '/placeholder_image.svg';

    return (
        <Menu 
            trigger="hover" 
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
                >
                    Account
                </Menu.Item>
                <Menu.Item
                    onClick={handleLogout}
                    color="red"
                >
                    {loading ? <Loader size="sm" /> : 'Logout'}
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    )
}