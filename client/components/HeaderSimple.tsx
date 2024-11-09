/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { useState } from 'react';
import { Container, Group, Burger } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MantineLogo } from '@mantinex/mantine-logo';
import classes from "./HeaderSimple.module.css"
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// const links = [
//     { link: '/home', label: 'MA261' },
// ];

const links = [
    { link: '/classes/cfe37701-9a73-4416-ba01-81e28989e64c', label: 'MA261' },
    { link: '/classes/77867dcc-0a42-45be-b2d5-0f5dc76abb83', label: '2K1' },
    { link: '/classes/ce907bb8-f51e-4933-b9a2-d042c5b05e67', label: 'MA 421' },
    { link: '/classes/15e71fef-c23e-4173-a883-f6d08834f858', label: 'MA 351' },
];

export function HeaderSimple() {
    const [opened, { toggle }] = useDisclosure(false);
    const pathname = usePathname();

    const items = links.map((link) => (
        <Link
            key={link.label}
            href={link.link}
            className={classes.link}
            data-active={pathname === link.link || undefined}
        >
            {link.label}
        </Link>
    ));

    return (
        <header className={classes.header}>
            <Container size="md" className={classes.inner}>
                <Link href="/">
                    <MantineLogo size={28}/>
                </Link>
                <Group gap={5} visibleFrom="xs">
                    {items}
                </Group>

                <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
            </Container>
        </header>
    );
}