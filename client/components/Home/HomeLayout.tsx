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
            styles={{
                root: {
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: '100vh',
                },
                main: {
                    flex: 1,
                    paddingTop: 60,
                    paddingLeft: 0,
                    paddingRight: 0,
                    width: '100%'
                }
            }}
        >
            <AppShell.Header>
                <HomeHeader />
            </AppShell.Header>

            <AppShell.Main>
                {children}
            </AppShell.Main>

            <HomeFooter />
        </AppShell>
    );
}

