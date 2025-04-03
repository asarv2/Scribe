/**
 * HomeLayout component
 * @AshokSaravanan222
 * 17.02.2025
 */

import { AppShell } from "@mantine/core";
import { ReactNode } from "react";
import { HomeHeader } from "./HomeHeader";
import { HomeFooter } from "./HomeFooter";

interface HomeLayoutProps {
    children: ReactNode;
}

export function HomeLayout({ children }: HomeLayoutProps) {
    return (
        <AppShell
            header={{ height: 60 }}
            padding={0}
        >
            <AppShell.Header style={{ position: 'sticky', top: 0, zIndex: 100 }}>
                <HomeHeader />
            </AppShell.Header>

            <AppShell.Main style={{ padding: 0, margin: 0 }}>
                {children}
            </AppShell.Main>

            <HomeFooter />
        </AppShell>
    );
}

