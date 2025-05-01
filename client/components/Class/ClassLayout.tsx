"use client";

/**
 * Layout component for the app
 * @AshokSaravanan222
 * 17.02.2025
 */

import { AppShell, Burger, Group, Skeleton } from '@mantine/core';
import { ReactNode, useState, useEffect } from "react";
import { ClassHeader } from "./ClassHeader";
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
import { useStudentMode } from "../StudentModeContext";
import { useMantineColorScheme } from "@mantine/core";
import { ForcedClassModal } from "./ForcedClassModal";

interface ClassLayoutProps {
    children: ReactNode;
    classId: string | null;
    showHeader?: boolean;
    showClasses?: boolean;
    showNavbar?: boolean; // Keep prop for potential future use, but don't use it for rendering navbar
}

export function ClassLayout({ children, classId, showHeader = true, showClasses = true, showNavbar = true }: ClassLayoutProps) {
    const supabase = useSupabaseBrowser();
    const { studentMode } = useStudentMode();
    const { colorScheme } = useMantineColorScheme();

    const getFilteredClasses = (profile: Profile | undefined, classData: Class[] | undefined) => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    });

    const { data: classData, isLoading: classDataLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    // Calculate basePath here
    const basePath = classId ? `/class/${classId}` : '/';

    // Determine if user has no classes
    const userHasNoClasses = 
        !profileLoading && 
        !classDataLoading && 
        profile && 
        classData && 
        getFilteredClasses(profile, classData).length === 0;

    return (
        <DndProvider backend={HTML5Backend}>
            {/* Force the class join modal if user has no classes */}
            <ForcedClassModal 
                isOpen={userHasNoClasses}
                profile={profile}
                studentMode={studentMode}
            />
            
            <AppShell
                header={{ height: showHeader ? 60 : 0 }}
                navbar={{
                    width: 0,
                    breakpoint: 'sm',
                }}
                padding="md"
                styles={(theme) => ({
                    navbar: {
                        border: 'none'
                    },
                })}
            >
                {showHeader && (
                    <AppShell.Header withBorder={false}>
                        <ClassHeader
                            classId={classId ?? getFilteredClasses(profile, classData)?.[0]?.id}
                            basePath={basePath}
                            showClasses={showClasses}
                        />
                    </AppShell.Header>
                )}

                <AppShell.Main>
                    {children}
                </AppShell.Main>
            </AppShell>
        </DndProvider>
    );
}