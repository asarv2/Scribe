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
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classes from './ClassNavbar.module.css';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { Skeleton } from '@mantine/core';

const data = [
    { link: '', label: 'Home', icon: IconHome },
    { link: '/chat', label: 'Chats', icon: IconMessage },
    { link: '/lecture', label: 'Lectures', icon: IconNotebook },
    { link: '/textbook', label: 'Textbooks', icon: IconBook },
    // { link: '/homework', label: 'Homework', icon: IconNotebook },
];

interface ClassNavbarProps {
    basePath: string;
}

export function ClassNavbar({ basePath }: ClassNavbarProps) {
    const pathname = usePathname();
    const [isExpanded, setIsExpanded] = useState(false);
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

    // Filter links based on showHome
    const filteredData = showHome ? data : data.filter(item => item.label !== 'Home');

    // Skeleton component for a single nav link
    function NavItemSkeleton() {
        return (
            <div className={classes.link}>
                <Skeleton height={25} width={25} radius="sm" className={classes.linkIcon} />
                <Skeleton height={16} width={80} radius="sm" />
            </div>
        );
    }

    const links = (loadingUser || loadingProfile) 
        ? Array(4).fill(0).map((_, index) => <NavItemSkeleton key={index} />)
        : filteredData.map((item) => (
            <Link
                href={`${basePath}${item.link}`}
                key={item.label}
                className={classes.link}
                data-active={pathname === `${basePath}${item.link}` || undefined}
            >
                <item.icon className={classes.linkIcon} stroke={1.5} />
                <span>{item.label}</span>
            </Link>
        ));

    return (
        <nav 
            className={classes.navbar}
            data-expanded={isExpanded}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <div className={classes.navbarMain}>
                {links}
            </div>

            <div className={classes.footer}>
                {(loadingUser || loadingProfile) ? (
                    <NavItemSkeleton />
                ) : (
                    <Link href="/classes" className={classes.link}>
                        <IconLayoutDashboard className={classes.linkIcon} stroke={1.5} />
                        <span>Dashboard</span>
                    </Link>
                )}
            </div>
        </nav>
    );
}