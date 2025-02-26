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

interface ClassLayoutProps {
    children: ReactNode;
    classId: string | null
}

export function ClassLayout({ children, classId }: ClassLayoutProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <ClassMenuProvider classId={classId}>
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
                    }
                })}
            >
                <AppShell.Header>
                    <ClassHeader classId={classId} />
                </AppShell.Header>

                <AppShell.Navbar>
                    <ClassNavbar
                        classId={classId}
                        basePath={`/classes/c/${classId}`}
                        isExpanded={isExpanded}
                        onExpandedChange={setIsExpanded}
                    />
                </AppShell.Navbar>

                <AppShell.Main>
                    {children}
                </AppShell.Main>
            </AppShell>
        </ClassMenuProvider>
    );
}

