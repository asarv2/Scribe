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

interface ClassLayoutProps {
    children: ReactNode;
    classId: string | null;
}

export function ClassLayout({ children, classId }: ClassLayoutProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const supabase = useSupabaseBrowser();

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

    return (
        <ClassMenuProvider classId={classId}>
            <DndProvider backend={HTML5Backend}>
                <AppShell
                    header={{ height: 60 }}
                    navbar={{
                        width: {
                            base: NAVBAR_CONSTANTS.COLLAPSED_WIDTH,
                            expanded: NAVBAR_CONSTANTS.EXPANDED_WIDTH
                        },
                        breakpoint: 'sm',
                    }}
                    padding="md"
                    styles={(theme) => ({
                        navbar: {
                            border: 'none'
                        },
                    })}
                >
                    <AppShell.Header>
                        <ClassHeader classId={classId ?? getFilteredClasses(profile, classData)?.[0]?.id} />
                    </AppShell.Header>

                    <AppShell.Navbar>
                        <ClassNavbar
                            classId={classId ?? getFilteredClasses(profile, classData)?.[0]?.id}
                            basePath={`/classes/c/${classId ?? getFilteredClasses(profile, classData)?.[0]?.id}`}
                            isExpanded={isExpanded}
                            onExpandedChange={setIsExpanded}
                        />
                    </AppShell.Navbar>

                    <AppShell.Main>
                        {children}
                    </AppShell.Main>
                </AppShell>
            </DndProvider>
        </ClassMenuProvider>
    );
}

