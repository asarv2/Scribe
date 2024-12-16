/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { Container, Group, Burger, Divider, ScrollArea, Drawer, rem, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from "./HeaderSimple.module.css"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';


const links = [
    { link: '/classes/ce907bb8-f51e-4933-b9a2-d042c5b05e67', label: 'MA 421' },
    { link: '/login', label: 'Professor' },
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
        </>
    );
}