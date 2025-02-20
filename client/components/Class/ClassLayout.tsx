/**
 * Layout component for the app
 * @AshokSaravanan222
 * 17.02.2025
 */

import { AppShell, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ReactNode } from "react";
import { ClassNavbar } from "./ClassNavbar";
import { ClassHeader } from "./ClassHeader";
import { ClassMenuProvider } from "./ClassMenuContext";

interface ClassLayoutProps {
    children: ReactNode;
    classId: string;
}

export function ClassLayout({ children, classId }: ClassLayoutProps) {
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(true);
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

    return (
        <ClassMenuProvider classId={classId}>
            <AppShell
                header={{ height: 60 }}
                navbar={{
                    width: { base: 300, expanded: 300 },
                    breakpoint: 'sm',
                    collapsed: {
                        desktop: !desktopOpened,
                        mobile: !mobileOpened,
                    }
                }}
                padding="md"
            >
                <AppShell.Header>
                    <ClassHeader
                        classId={classId}
                        mobileOpened={mobileOpened}
                        desktopOpened={desktopOpened}
                        toggleMobile={toggleMobile}
                        toggleDesktop={toggleDesktop}
                    />
                </AppShell.Header>

                <AppShell.Navbar>
                    <ClassNavbar basePath={`/classes/c/${classId}`} />
                </AppShell.Navbar>

                <AppShell.Main>
                    {children}
                </AppShell.Main>
            </AppShell>
        </ClassMenuProvider>
    );
}

