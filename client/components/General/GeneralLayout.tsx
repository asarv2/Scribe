/**
 * components/GeneralLayout.tsx
 * 
 * This is the general layout for the app.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */
import { AppShell, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { ReactNode } from "react";
import { GeneralNavbar } from "./GeneralNavbar";
import { GeneralHeader } from "./GeneralHeader";

interface GeneralLayoutProps {
    children: ReactNode;
}

export function GeneralLayout({ children }: GeneralLayoutProps) {
    const [mobileOpened, { toggle: toggleMobile }] = useDisclosure(true);
    const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: { base: 300, expanded: 300 },
                breakpoint: 'sm',
            }}
            padding="md"
        >
            <AppShell.Header>
                <GeneralHeader
                    mobileOpened={mobileOpened}
                    desktopOpened={desktopOpened}
                    toggleMobile={toggleMobile}
                    toggleDesktop={toggleDesktop}
                />
            </AppShell.Header>

            <AppShell.Navbar>
                <GeneralNavbar />
            </AppShell.Navbar>

            <AppShell.Main>
                {children}
            </AppShell.Main>
        </AppShell>
    );
}

