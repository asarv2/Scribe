/**
 * NavbarSimple.tsx
 * Navbar for the application.
 * @AshokSaravanan222
 * 02.17.2025
 */

import { useState } from 'react';
import {
    IconHome,
    IconBook,
    IconNotebook,
    IconSettings,
    IconLogout,
    IconMessage,
    IconUser,
    IconLayoutDashboard,
    IconFileDescription,
    IconPresentation,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classes from './ClassNavbar.module.css';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { Skeleton, Group, Box, Collapse } from '@mantine/core';
import { ScrollArea } from '@mantine/core';
import { useClassMenu } from './ClassMenuContext';
import { menuConfig } from '@/utils/menu/menuConfig';
import { ClassNavbarLinksGroup } from './ClassNavbarLinksGroup';

interface ClassNavbarProps {
    basePath: string;
}

export function ClassNavbar({ basePath }: ClassNavbarProps) {
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

    const showHome = profile?.professor || profile?.admin;

    const { openSections, toggleSection } = useClassMenu();

    // console.log(openSections);

    const generateNavData = () => {
        return Object.entries(menuConfig).map(([key, item]) => {
            const baseItem = {
                label: item.label,
                icon: item.icon,
                opened: openSections[key],
                onToggle: () => toggleSection(key),
            };

            // Handle single link (Home) vs multiple links
            if ('link' in item) {
                return {
                    ...baseItem,
                    link: `${basePath}${item.link}`,
                    isLink: true,
                };
            }

            return {
                ...baseItem,
                links: item.links.map(link => ({
                    ...link,
                    link: `${basePath}${link.link}`
                }))
            };
        })
    };

    const links = generateNavData().map((item) => (
        <ClassNavbarLinksGroup {...item} key={item.label} />
    ));

    // Updated Skeleton loading state (closed by default)
    function NavGroupSkeleton() {
        return (
            <div className={classes.section}>
                <div className={classes.control}>
                    <Group justify="space-between" gap={0} style={{ width: '100%' }}>
                        <Box style={{ display: 'flex', alignItems: 'center' }}>
                            <Skeleton height={30} width={30} radius="sm" />
                            <Skeleton height={20} width={100} radius="sm" ml="md" />
                        </Box>
                        <Skeleton height={16} width={16} radius="sm" />
                    </Group>
                </div>
            </div>
        );
    }

    return (
        <nav className={classes.navbar}>
            <ScrollArea className={classes.links}>
                <div className={classes.linksInner}>
                    {(loadingUser || loadingProfile) ? (
                        <>
                            <NavGroupSkeleton />
                            <NavGroupSkeleton />
                            <NavGroupSkeleton />
                        </>
                    ) : (
                        links
                    )}
                </div>
            </ScrollArea>

            <div className={classes.footerContainer}>
                <div className={classes.footer}>
                    <Link href="/classes" className={classes.control}>
                        <IconLayoutDashboard className={classes.linkIcon} stroke={1.5} />
                        <span>Dashboard</span>
                    </Link>
                </div>
            </div>
        </nav>
    );
}