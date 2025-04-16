/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { ActionIcon, Button, Container, Group, Tooltip, useComputedColorScheme, Menu, Center, Text } from '@mantine/core';
import classes from "./ClassHeader.module.css"
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconChevronDown, IconMenu2, IconMessageCircle, IconMoon, IconSun } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getUser } from '@/utils/queries/get-user';
import { getProfile } from '@/utils/queries/get-profile';
import { getClasses } from '@/utils/queries/get-classes';
import { Menu as MantineMenu, useMantineColorScheme, Avatar } from '@mantine/core';
import { getAvatarUrl } from '@/utils/services/images';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { logout } from '@/utils/services/auth';
import { AccountMenu } from '../AccountMenu';
import { Profile } from '@/types';
import { Class } from '@/types';
import cx from 'clsx';
import { useMediaQuery } from '@mantine/hooks';
import FeedbackModal from '../FeedbackModal';
interface ClassHeaderProps {
    classId: string
    showClasses: boolean
    onMobileMenuToggle?: () => void
}

export function ClassHeader({ classId, showClasses, onMobileMenuToggle }: ClassHeaderProps) {
    const supabase = useSupabaseBrowser();
    const { setColorScheme } = useMantineColorScheme();
    const computedColorScheme = useComputedColorScheme(undefined, { getInitialValueInEffect: true });

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classData } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    })

    const getFilteredClasses = (profile: Profile | undefined, classData: Class[] | undefined) => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const toggleColorScheme = () => {
        setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
    };

    const isMobile = useMediaQuery('(max-width: 768px)');

    const renderClassSelector = () => {
        return showClasses && (
            <Group pt={4}>
                <Menu trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
                    <Menu.Target>
                        <Button variant="subtle" className={classes.classSelector}>
                            <Center>
                                <Group gap={2}>
                                    <Text size="sm" fw={500}>
                                        {classData?.find(c => c.id === classId)?.class_code || 'Select Class'}
                                    </Text>
                                    <IconChevronDown size={14} stroke={1.5} />
                                </Group>
                            </Center>
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {getFilteredClasses(profile, classData).map((classItem) => (
                            <Menu.Item
                                key={classItem.id}
                                component={Link}
                                href={profile?.professor || profile?.admin
                                    ? `/class/${classItem.id}`
                                    : `/class/${classItem.id}/chat/new`}
                            >
                                {classItem.class_code}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            </Group>
        )
    }

    return (
        <Group h="100%" px="md" w="100%" justify="space-between">
            <Group gap="xs">
                {profile && (profile.professor || profile.admin) && isMobile && (
                    <Group pt={4}>
                        <Tooltip label="Open Menu">
                            <ActionIcon
                                onClick={onMobileMenuToggle}
                                variant="subtle"
                                aria-label="Open Menu"
                            >
                                <IconMenu2 size={24} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                )}
                <Link href="/">
                    <Image
                        src={"/images/logo-light.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                        style={{ marginTop: '4px' }}
                        className={classes['logo-light']}
                    />
                    <Image
                        src={"/images/logo-dark.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                        style={{ marginTop: '4px' }}
                        className={classes['logo-dark']}
                    />
                </Link>
                {!isMobile && renderClassSelector()}
            </Group>

            {isMobile && renderClassSelector()}

            <Group>
                <Tooltip label={computedColorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                    <ActionIcon
                        variant="subtle"
                        onClick={toggleColorScheme}
                        aria-label="Toggle color scheme"
                    >
                        <IconSun className={cx(classes.icon, classes.light)} size={24} />
                        <IconMoon className={cx(classes.icon, classes.dark)} size={24} />
                    </ActionIcon>
                </Tooltip>
                <FeedbackModal />
                <AccountMenu profile={profile} />
            </Group>
        </Group>
    );
}

export const NAVBAR_CONSTANTS = {
    COLLAPSED_WIDTH: 70,
    EXPANDED_WIDTH: 250,
    TRANSITION_DURATION: '0.2s',
    Z_INDEX: 1000,  // High enough to overlay content
} as const;