"use client";

/**
 * Layout component for the app
 * @AshokSaravanan222
 * 17.02.2025
 */

import { AppShell, Group } from "@mantine/core";
import { ReactNode, useState } from "react";
import { ClassNavbar } from "./ClassNavbar";
import { ClassHeader } from "./ClassHeader";
import { ClassMenuProvider } from "./ClassMenuContext";
import { NAVBAR_CONSTANTS } from './ClassHeader';
import { getClasses } from "@/utils/queries/get-classes";
import { useQuery } from "@tanstack/react-query";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Profile, Class } from "@/types";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useMediaQuery } from "@mantine/hooks";


interface ClassLayoutProps {
    children: ReactNode;
    classId: string | null;
    showHeader?: boolean;
    showClasses?: boolean;
    showNavbar?: boolean;
}

export function ClassLayout({ children, classId, showHeader = true, showClasses = true, showNavbar = true }: ClassLayoutProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const supabase = useSupabaseBrowser();

    const isMobile = useMediaQuery('(max-width: 768px)');

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    });

    const { data: classData } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    })

    const getFilteredClasses = (profile: Profile | undefined, classData: Class[] | undefined) => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    // Toggle function for mobile menu
    const toggleMobileNav = () => {
        setMobileNavOpen(prev => !prev);
    };

    return (
        <ClassMenuProvider classId={classId}>
            <DndProvider backend={HTML5Backend}>
                <AppShell
                    header={{ height: showHeader ? 60 : 0 }}
                    navbar={{
                        width: profile && (profile.professor || profile.admin) && showNavbar ? {
                            base: NAVBAR_CONSTANTS.COLLAPSED_WIDTH,
                            expanded: NAVBAR_CONSTANTS.EXPANDED_WIDTH
                        } : 0,
                        breakpoint: 'sm',
                        collapsed: { mobile: !mobileNavOpen },
                    }}
                    padding="md"
                    styles={(theme) => ({
                        navbar: {
                            border: 'none'
                        },
                    })}
                >
                    {showHeader && (
                        <AppShell.Header>
                            <ClassHeader 
                                classId={classId ?? getFilteredClasses(profile, classData)?.[0]?.id} 
                                showClasses={showClasses}
                                onMobileMenuToggle={toggleMobileNav}
                            />
                        </AppShell.Header>
                    )}

                    {profile && (profile.professor || profile.admin) && (classId !== null) && (showNavbar) && (
                        <AppShell.Navbar>
                            <ClassNavbar
                                classId={classId}
                                basePath={`/class/${classId}`}
                                isExpanded={isExpanded}
                                onExpandedChange={setIsExpanded}
                            />
                        </AppShell.Navbar>
                    )}

                    <AppShell.Main>
                        {children}
                    </AppShell.Main>
                </AppShell>
            </DndProvider>
        </ClassMenuProvider>
    );
}

