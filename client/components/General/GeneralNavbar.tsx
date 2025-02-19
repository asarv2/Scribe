/**
 * components/General/GeneralNavbar.tsx
 * 
 * This is the navbar for the general layout.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */
import { useState, useMemo } from 'react';
import {
    IconHome,
    IconBook,
    IconUser,
    IconLogout,
    IconLayoutDashboard,
} from '@tabler/icons-react';
import { ScrollArea, Avatar, Skeleton, Group, UnstyledButton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import classes from './GeneralNavbar.module.css';
import { getClasses } from '@/utils/queries/get-classes';
import { NavbarLinksGroup } from './NavbarLinksGroup';
import { getUser } from '@/utils/queries/get-user';
import { getProfile } from '@/utils/queries/get-profile';
import { Profile } from '@/types';
import { getAvatarUrl } from '@/utils/services/images';

export function GeneralNavbar() {
    const supabase = useSupabaseBrowser();

    const {data: user, isLoading: loadingUser} = useQuery({
        queryKey: ['user'],
        queryFn: () => getUser(supabase)
    })
    
    const {data: profile, isLoading: loadingProfile} = useQuery({
        queryKey: ['profile'],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })


    const {data: classesData, isLoading: loadingClasses} = useQuery({
        queryKey: ['classes'],
        queryFn: () => getClasses(supabase),
    })

    const getFilteredClasses = () => {
        if (!profile || !classesData) return [];
        return profile.admin ? classesData : classesData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const avatarUrl = profile ? getAvatarUrl(profile.id) : '';

    const accountNavItem = useMemo(() => ({
        label: profile?.first_name + ' ' + profile?.last_name || 'Account',
        icon: () => <Avatar src={avatarUrl} size="sm" radius="xl" />,
        link: '/account'
    }), [profile, avatarUrl]);

    // Generate navigation data structure
    const generateNavData = () => {
        const classLinks = getFilteredClasses()?.map((classItem) => ({
            label: classItem.class_code || 'Unnamed Class',
            link: `/classes/c/${classItem.id}`
        })) || [];

        return [
            { label: 'Dashboard', icon: IconLayoutDashboard, link: '/classes' },
            {
                label: 'Classes',
                icon: IconBook,
                initiallyOpened: true,
                links: classLinks,
            },
            accountNavItem
        ];
    };

    const links = generateNavData().map((item) => (
        <NavbarLinksGroup {...item} key={item.label} />
    ));

    // Add skeleton components
    function NavItemSkeleton() {
        return (
            <UnstyledButton className={classes.link}>
                <Group>
                    <Skeleton height={25} width={25} radius="sm" className={classes.linkIcon} />
                    <Skeleton height={16} width={150} radius="sm" />
                </Group>
            </UnstyledButton>
        );
    }

    function ClassesGroupSkeleton() {
        return (
            <div>
                <UnstyledButton className={classes.link}>
                    <Group>
                        <Skeleton height={25} width={25} radius="sm" className={classes.linkIcon} />
                        <Skeleton height={16} width={150} radius="sm" />
                    </Group>
                </UnstyledButton>
                <div style={{ paddingLeft: 48 }}>
                    {[...Array(3)].map((_, index) => (
                        <UnstyledButton key={index} className={classes.link}>
                            <Skeleton height={16} width={120} radius="sm" />
                        </UnstyledButton>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <nav className={classes.navbar}>
            <ScrollArea className={classes.links}>
                <div className={classes.linksInner}>
                    {(loadingUser || loadingProfile || loadingClasses) ? (
                        <>
                            <NavItemSkeleton /> {/* Dashboard */}
                            <ClassesGroupSkeleton /> {/* Classes group */}
                            <UnstyledButton className={classes.link}>
                                <Group>
                                    <Skeleton height={32} width={32} radius="xl" /> {/* Avatar */}
                                    <Skeleton height={16} width={150} radius="sm" />
                                </Group>
                            </UnstyledButton>
                        </>
                    ) : (
                        links
                    )}
                </div>
            </ScrollArea>
        </nav>
    );
}