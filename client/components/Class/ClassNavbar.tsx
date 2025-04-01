/**
 * NavbarSimple.tsx
 * Navbar for the application.
 * @AshokSaravanan222
 * 02.17.2025
 */

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
import { useMediaQuery } from '@mantine/hooks';

interface ClassNavbarProps {
    classId: string;
    basePath: string;
    isExpanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
}

export function ClassNavbar({ basePath, isExpanded, onExpandedChange, classId }: ClassNavbarProps) {
    const supabase = useSupabaseBrowser();
    const isMobile = useMediaQuery('(max-width: 768px)');

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

    const { openSections, toggleSection } = useClassMenu();

    // console.log(openSections);

    const generateNavData = () => {
        return Object.entries(menuConfig).map(([key, item]) => ({
            ...item,
            icon: item.icon as React.FC<any>,  // Cast icon to correct type
            link: item.link ? `${basePath}${item.link}` : undefined,
            isLink: !!item.link,
            links: item.links?.map(link => ({
                ...link,
                link: `${basePath}${link.link}`
            }))
        }));
    };

    // const generateClassData = (currentClassId: string | null) => {
    //     const currentClass = getFilteredClasses().find(classItem => classItem.id === currentClassId);
    //     return [{
    //         label: currentClass?.class_code ?? 'Classes',
    //         icon: IconBooks,
    //         links: getFilteredClasses().map(classItem => ({
    //             label: classItem.class_code ?? 'Select Class',
    //             link: `/classes/c/${classItem.id}`,
    //             isLink: true,
    //         })).filter(link => link.label !== currentClass?.class_code),
    //         opened: openSections['Classes'],
    //         onToggle: () => toggleSection('Classes'),
    //     }];
    // };


    // const links = classId ? [...generateClassData(classId).map((item) => (
    //     <ClassNavbarLinksGroup {...item} key={item.label} isExpanded={isExpanded} />
    // )), <Divider m="sm" />, ...generateNavData().map((item) => (
    //     <ClassNavbarLinksGroup {...item} key={item.label} isExpanded={isExpanded} />
    // ))] : generateClassData(classId).map((item) => (
    //     <ClassNavbarLinksGroup {...item} key={item.label} isExpanded={isExpanded} />
    // ));

    const links = generateNavData().map((item) => (
        <ClassNavbarLinksGroup 
            {...item} 
            key={item.label} 
            isExpanded={isMobile ? true : isExpanded} 
            isLoading={loadingUser || loadingProfile}
        />
    ))

    return (
        <nav
            className={classes.navbar}
            style={{
                '--collapsed-width': isMobile ? '100%' : `${NAVBAR_CONSTANTS.COLLAPSED_WIDTH}px`,
                '--expanded-width': isMobile ? '100%' : `${NAVBAR_CONSTANTS.EXPANDED_WIDTH}px`,
                '--transition-duration': NAVBAR_CONSTANTS.TRANSITION_DURATION,
                '--z-index': NAVBAR_CONSTANTS.Z_INDEX
            } as React.CSSProperties}
            onMouseEnter={() => !isMobile && onExpandedChange(true)}
            onMouseLeave={() => !isMobile && onExpandedChange(false)}
        >
            <ScrollArea className={classes.links}>
                <div className={classes.linksInner}>
                    {links}
                </div>
            </ScrollArea>

            {/* <div className={classes.footerContainer}>
                <ClassNavbarLinksGroup
                    icon={IconUsers}
                    label="Feedback"
                    isExpanded={isExpanded}
                    link={`/feedback`}
                    isLoading={loadingUser || loadingProfile}
                />
            </div> */}
        </nav>
    );
}