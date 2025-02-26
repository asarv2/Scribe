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
    IconChevronDown,
    IconBooks,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classes from './ClassNavbar.module.css';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { Skeleton, Group, Box, Collapse, Flex, Menu, useMantineColorScheme, Divider } from '@mantine/core';
import { ScrollArea } from '@mantine/core';
import { useClassMenu } from './ClassMenuContext';
import { menuConfig } from '@/utils/menu/menuConfig';
import { ClassNavbarLinksGroup } from './ClassNavbarLinksGroup';
import { NAVBAR_CONSTANTS } from './ClassHeader';
import { getClasses } from '@/utils/queries/get-classes';

interface ClassNavbarProps {
    classId: string | null;
    basePath: string;
    isExpanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
}

export function ClassNavbar({ basePath, isExpanded, onExpandedChange, classId }: ClassNavbarProps) {
    const supabase = useSupabaseBrowser();
    const { colorScheme } = useMantineColorScheme();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ['user'],
        queryFn: () => getUser(supabase)
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ['profile'],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classData } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    })

    const getFilteredClasses = () => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const showHome = profile?.professor || profile?.admin;

    const { openSections, toggleSection } = useClassMenu();

    // console.log(openSections);

    const generateNavData = () => {
        return Object.entries(menuConfig).map(([key, item]) => {
            const baseItem = {
                label: item.label,
                icon: item.icon,
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

    const generateClassData = (currentClassId: string | null) => {
        const currentClass = getFilteredClasses().find(classItem => classItem.id === currentClassId);
        return [{
            label: currentClass?.class_code ?? 'Classes',
            icon: IconBooks,
            links: getFilteredClasses().map(classItem => ({
                label: classItem.class_code ?? 'Select Class',
                link: `/classes/c/${classItem.id}`,
                isLink: true,
            })).filter(link => link.label !== currentClass?.class_code),
            opened: openSections['Classes'],
            onToggle: () => toggleSection('Classes'),
        }];
    };


    const links = classId ? [...generateClassData(classId).map((item) => (
        <ClassNavbarLinksGroup {...item} key={item.label} isExpanded={isExpanded} />
    )), <Divider m="sm" />, ...generateNavData().map((item) => (
        <ClassNavbarLinksGroup {...item} key={item.label} isExpanded={isExpanded} />
    ))] : generateClassData(classId).map((item) => (
        <ClassNavbarLinksGroup {...item} key={item.label} isExpanded={isExpanded} />
    ));

    // Updated Skeleton loading state (closed by default)
    function NavGroupSkeleton() {
        return (
            <div className={classes.section}>
                <div className={classes.control}>
                    <Flex justify="space-between" gap={0} style={{ width: '100%' }}>
                        <Box style={{ display: 'flex', alignItems: 'center' }}>
                            <Skeleton height={30} width={30} radius="sm" />
                            <Skeleton height={20} width={100} radius="sm" ml="md" />
                        </Box>
                        <Skeleton height={16} width={16} radius="sm" />
                    </Flex>
                </div>
            </div>
        );
    }

    return (
        <nav
            className={classes.navbar}
            style={{
                '--collapsed-width': `${NAVBAR_CONSTANTS.COLLAPSED_WIDTH}px`,
                '--expanded-width': `${NAVBAR_CONSTANTS.EXPANDED_WIDTH}px`,
                '--transition-duration': NAVBAR_CONSTANTS.TRANSITION_DURATION,
                '--z-index': NAVBAR_CONSTANTS.Z_INDEX
            } as React.CSSProperties}
            onMouseEnter={() => onExpandedChange(true)}
            onMouseLeave={() => onExpandedChange(false)}
        >
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
                {/* <Link href="/classes" className={classes.control}>
                        <IconLayoutDashboard className={classes.linkIcon} stroke={1.5} />
                        <span>Dashboard</span>
                    </Link> */}
                <ClassNavbarLinksGroup
                    icon={IconLayoutDashboard}
                    label="Dashboard"
                    isExpanded={isExpanded}
                    link={`/classes`}
                />
                <ClassNavbarLinksGroup
                    icon={IconMessage}
                    label="Feedback"
                    isExpanded={isExpanded}
                    link={`/feedback`}
                />
            </div>
        </nav>
    );
}