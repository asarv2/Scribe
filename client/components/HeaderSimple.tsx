/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { useState } from 'react';
import { Container, Group, Burger, Divider, ScrollArea, Drawer, rem, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from "./HeaderSimple.module.css"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

// const links = [
//     { link: '/home', label: 'MA261' },
// ];

const links = [
    // { link: '/classes/cfe37701-9a73-4416-ba01-81e28989e64c/lecture/3ae57d24-8426-44c3-816b-f23e3ae04d0b', label: 'MA 261' },
    { link: '/classes/ce907bb8-f51e-4933-b9a2-d042c5b05e67', label: 'MA 421' },
    { link: '/classes/cfe37701-9a73-4416-ba01-81e28989e64c', label: 'MA 261' },
    { link: '/login', label: 'Professor' },
    // { link: '/classes/593fee30-d135-4972-8beb-6c6243619e88/textbook/e8944344-2248-472d-9a8c-56a85c76bcba', label: 'MA 341' },
    // { link: '/classes/77867dcc-0a42-45be-b2d5-0f5dc76abb83', label: '2K1' },
    // { link: '/classes/15e71fef-c23e-4173-a883-f6d08834f858', label: 'MA 351' },
];

export function HeaderSimple() {
    const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
    const pathname = usePathname();

    const items = links.map((link) => (
        <Box p={2} key={link.label}>
            <Link
                key={link.label}
                href={link.link}
                className={classes.link}
                data-active={pathname.includes(link.link) || undefined}
            >
                {link.label}
            </Link>
        </Box>
    ));

    return (
        <>
            <header className={classes.header}>
                <Container size="md" className={classes.inner}>
                    <Link href="/">
                        <Image
                            src="/images/logo.png"
                            alt="Logo"
                            width={100}
                            height={20}
                        />
                    </Link>
                    <Group gap={5} visibleFrom="xs">
                        {items}
                    </Group>

                    <Burger opened={drawerOpened} onClick={toggleDrawer} hiddenFrom="xs" size="sm" />
                </Container>
            </header>

            <Drawer.Root
                opened={drawerOpened}
                onClose={closeDrawer}
                size="50%"
                padding="md"
                hiddenFrom="sm"
                zIndex={1000000}
            >
                <Drawer.Overlay />
                <Drawer.Content>
                    <Drawer.Header>
                        <Drawer.Title>
                            <Link href="/" passHref>
                                <Image
                                    src="/images/logo.png"
                                    alt="Logo"
                                    width={100}
                                    height={20}
                                />
                            </Link>
                        </Drawer.Title>
                        <Drawer.CloseButton />
                    </Drawer.Header>
                    <Drawer.Body>
                        <ScrollArea h={`calc(100vh - ${rem(80)})`} mx="-md" p={4}>
                            <Divider my="sm" />
                            {items}
                        </ScrollArea>
                    </Drawer.Body>
                </Drawer.Content>
            </Drawer.Root >

            {/* <Drawer
                opened={drawerOpened}
                onClose={closeDrawer}
                size="lg"
                padding="md"
                hiddenFrom="sm"
                zIndex={1000000}
            >
                <Drawer.Header>
                    <Drawer.Title>Drawer title</Drawer.Title>
                    <Drawer.CloseButton />
                </Drawer.Header>

                <ScrollArea h={`calc(100vh - ${rem(80)})`} mx="-md">
                    <Divider my="sm" />

                    {items}

                </ScrollArea>
            </Drawer> */}
        </>
    );
}