/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { Container, Group, Burger, Divider, ScrollArea, Drawer, rem, Box, Menu } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from "./HeaderSimple.module.css"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { IconChevronDown, IconMessage, IconUser } from '@tabler/icons-react';
import { getUser } from '@/utils/queries/get-user';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import type { User } from '@supabase/supabase-js';
import { isProfessor } from '@/utils/lecture/isProfessor';
import { notifications } from '@mantine/notifications';
import { logout } from '@/utils/services/auth';
import { useState } from 'react';

const classNav = [
    { id: 'c770c9bb-4de1-44be-aacb-b4bea3efbacf', label: 'MA 421' },
    // { id: 'ef85b3e5-3a62-41a4-8db1-98e5f201779a', label: 'MA 421' },
    // { id: '15e71fef-c23e-4173-a883-f6d08834f858', label: 'MA 351' },
    // { id: '9f0fbba6-ac01-4d13-a7c8-58c08b09859f', label: 'MA 543' },
    // { id: 'e63bc478-1126-4068-ae56-a91ce1463671', label: 'CS 242' },
    // { id: 'c068ccf8-4892-45b3-8dab-04d5d3aa85ad', label: 'CS 243' },
    { id: 'ae333215-2914-4026-8aae-418f1255cdd0', label: 'ECE 20007' },
    { id: "11d5b457-6f87-4ea3-94ec-c04b2138ceb3", label: "CS 253" }
];

export function HeaderSimple() {
    const supabase = useSupabaseBrowser();
    const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    // Get current class from URL
    const currentClassId = pathname.split('/classes/')[1]?.split('/')[0];
    const currentClass = classNav.find(c => c.id === currentClassId);
    const displayText = currentClass ? currentClass.label : 'Select Class';

    // Modify navigation links to be dynamic based on current class
    const navigationLinks = [
        // {
        //     link: currentClassId
        //         ? `/classes/${currentClassId}`
        //         : '/classes/ef85b3e5-3a62-41a4-8db1-98e5f201779a', // default class
        //     label: 'Topics'
        // },
        // {
        //     link: currentClassId
        //         ? `/classes/${currentClassId}/lecture`
        //         : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/lecture',
        //     label: 'Lectures'
        // },
        // {
        //     link: currentClassId
        //         ? `/classes/${currentClassId}/textbook`
        //         : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/textbook',
        //     label: 'Textbooks'
        // },
        {
            link: currentClassId
                ? `/classes/${currentClassId}`
                : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf',
            label: 'Home'
        },
        {
            link: currentClassId
                ? `/classes/${currentClassId}/generate`
                : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/generate',
            label: 'Generate'
        },
        {
            link: currentClassId
                ? `/classes/${currentClassId}/chat`
                : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/chat',
            label: 'Chat'
        },
    ];

    // const MA421NavigationLinks = [
    //     {
    //         link: currentClassId
    //             ? `/classes/${currentClassId}/lecture`
    //             : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/lecture',
    //         label: 'Lectures'
    //     },
    //     {
    //         link: currentClassId
    //             ? `/classes/${currentClassId}/textbook`
    //             : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/textbook',
    //         label: 'Textbooks'
    //     },
    //     {
    //         link: currentClassId
    //             ? `/classes/${currentClassId}/generate/problems`
    //             : '/classes/c770c9bb-4de1-44be-aacb-b4bea3efbacf/generate/problems',
    //         label: 'Problems'
    //     },
    // ]

    // const ECE20007NavigationLinks = [
    //     {
    //         link: currentClassId
    //             ? `/classes/${currentClassId}/lecture`
    //             : '/classes/11d5b457-6f87-4ea3-94ec-c04b2138ceb3/lecture',
    //         label: 'Lectures'
    //     },
    //     {
    //         link: currentClassId
    //             ? `/classes/${currentClassId}/chat`
    //             : '/classes/11d5b457-6f87-4ea3-94ec-c04b2138ceb3/chat',
    //         label: 'Chat'
    //     },
    // ]

    const classNavigationLinks = {
        // "ef85b3e5-3a62-41a4-8db1-98e5f201779a": MA421NavigationLinks,
        // "ae333215-2914-4026-8aae-418f1255cdd0": ECE20007NavigationLinks
    } as { [key: string]: { link: string; label: string; }[] }

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })


    const navigationItems = (user && classNavigationLinks[currentClassId] ? classNavigationLinks[currentClassId] : navigationLinks).map((link) => (
        <Box p={2} key={link.label}>
            <Link
                href={link.link}
                className={classes.link}
                data-active={pathname === link.link || undefined}
            >
                {link.label}
            </Link>
        </Box>
    ));

    const handleLogout = async () => {
        setLoading(true)
        try {
            // Logout logic here
            const { success, error } = await logout()
            if (!success) {
                throw new Error(error)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["user"]
                })
            }

            notifications.show({
                title: 'Success',
                message: 'Logged out',
                color: 'green',
            });

        } catch (e: any) {
            console.error(e)
            notifications.show({
                title: 'Error',
                message: e.message,
                color: 'red',
            });
        } finally {
            setLoading(false)
        }
    }


    return (
        <>
            <header className={classes.header}>
                <Container size="md" className={classes.inner}>
                    <Group justify="space-between" style={{ width: '100%' }}>
                        <Group align="center">
                            <Link href="/">
                                <Image
                                    src="/images/logo.png"
                                    priority
                                    alt="Logo"
                                    width={100}
                                    height={20}
                                    style={{ marginTop: 4 }}
                                />
                            </Link>

                            {user && (
                                <Menu shadow="md" width={200}>
                                    <Menu.Target>
                                        <button className={classes.classSelector}>
                                            {displayText} <IconChevronDown size={16} />
                                        </button>
                                    </Menu.Target>

                                    <Menu.Dropdown>
                                        {classNav.map((classItem) => {
                                            if (isProfessor(user, classItem.id)) {
                                                return (
                                                    <Menu.Item
                                                        key={classItem.id}
                                                        component={Link}
                                                        href={`/classes/${classItem.id}`}
                                                    >
                                                        {classItem.label}
                                                    </Menu.Item>
                                                )
                                            }
                                        })}
                                    </Menu.Dropdown>
                                </Menu>
                            )}
                        </Group>

                        {user && (
                            <Group gap={5} visibleFrom="xs">
                                {navigationItems}
                            </Group>
                        )}

                        <Group gap={5} visibleFrom="xs">
                            {user ? (
                                <>
                                    <Menu shadow="md" width={200}>
                                        <Menu.Target>
                                            <button className={classes.profileButton}>
                                                <IconUser size={20} />
                                            </button>
                                        </Menu.Target>

                                        <Menu.Dropdown>
                                            <Menu.Label>{user.email}</Menu.Label>
                                            <Menu.Divider />
                                            {/* <Menu.Item
                                                color="blue"
                                                component={Link}
                                                href="/login"
                                            >
                                                Account
                                            </Menu.Item> */}
                                            <Menu.Item
                                                color="red"
                                                onClick={handleLogout}
                                            >
                                                Logout
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>

                                    <Link href="/feedback">
                                        <button className={classes.feedbackButton}>
                                            <IconMessage size={20} />
                                        </button>
                                    </Link>
                                </>
                            ) : (
                                <Box p={2}>
                                    <Link
                                        href="/login"
                                        className={classes.link}
                                        data-active={pathname.includes('/login') || undefined}
                                    >
                                        Login
                                    </Link>
                                </Box>
                            )}
                        </Group>

                        <Burger opened={drawerOpened} onClick={toggleDrawer} hiddenFrom="xs" size="sm" />
                    </Group>
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
                                    priority
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
                            {user ? (
                                <>
                                    {navigationItems}
                                    <Divider my="sm" />
                                    {/* <Box p={2}>
                                        <Link
                                            href="/login"
                                            className={classes.link}
                                            data-active={pathname === "/login" || undefined}
                                        >
                                            Account
                                        </Link>
                                    </Box> */}
                                </>
                            ) : (
                                <>
                                    <Box p={2}>
                                        <Link
                                            href="/login"
                                            className={classes.link}
                                            data-active={pathname === "/login" || undefined}
                                        >
                                            Login
                                        </Link>
                                    </Box>
                                </>
                            )}
                        </ScrollArea>
                    </Drawer.Body>
                </Drawer.Content>
            </Drawer.Root >
        </>
    );
}