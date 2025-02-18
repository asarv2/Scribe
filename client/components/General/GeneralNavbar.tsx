/**
 * components/General/GeneralNavbar.tsx
 * 
 * This is the navbar for the general layout.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */
import { useState } from 'react';
import {
    IconHome,
    IconBook,
    IconUser,
    IconLogout,
    IconLayoutDashboard,
} from '@tabler/icons-react';
import { ScrollArea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import classes from './GeneralNavbar.module.css';
import { getClasses } from '@/utils/queries/get-classes';
import { NavbarLinksGroup } from './NavbarLinksGroup';

export function GeneralNavbar() {
    const supabase = useSupabaseBrowser();

    const {data: classesData, isLoading: loadingClasses} = useQuery({
        queryKey: ['classes'],
        queryFn: () => getClasses(supabase)
    })

    // Generate navigation data structure
    const generateNavData = () => {
        const classLinks = classesData?.map((classItem) => ({
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
            { label: 'Account', icon: IconUser, link: '/account' },
        ];
    };

    const links = generateNavData().map((item) => (
        <NavbarLinksGroup {...item} key={item.label} />
    ));

    return (
        <nav className={classes.navbar}>
            <ScrollArea className={classes.links}>
                <div className={classes.linksInner}>{links}</div>
            </ScrollArea>
        </nav>
    );
}