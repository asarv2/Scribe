/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { Container, Group, Burger, Divider, ScrollArea, Drawer, rem, Box, Menu, useMantineColorScheme, Button, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from "./HeaderSimple.module.css"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { IconChevronDown, IconMessage, IconUser } from '@tabler/icons-react';
import { getUser } from '@/utils/queries/get-user';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { notifications } from '@mantine/notifications';
import { logout } from '@/utils/services/auth';
import { useState } from 'react';
import { getProfile } from '@/utils/queries/get-profile';
import { getClasses } from '@/utils/queries/get-classes';


const classNav = [
    { id: 'c770c9bb-4de1-44be-aacb-b4bea3efbacf', label: 'MA 421' },
    { id: '9ebca7a7-5792-456a-ab55-03801ba710e5', label: 'MA 351' }, // MJ's professor
    { id: 'ae333215-2914-4026-8aae-418f1255cdd0', label: 'ECE 20007' },
    { id: "11d5b457-6f87-4ea3-94ec-c04b2138ceb3", label: "CS 253" }
];

export function HeaderSimple() {
    const supabase = useSupabaseBrowser();
    const [drawerOpened, { toggle: toggleDrawer, close: closeDrawer }] = useDisclosure(false);
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const { colorScheme } = useMantineColorScheme();

    // Get current class from URL
    const currentClassId = pathname.split('/classes/')[1]?.split('/')[0];
    const currentClass = classNav.find(c => c.id === currentClassId);
    const displayText = currentClass ? currentClass.label : 'Select Class';

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classData } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
        enabled: !!user
    })

    const getFilteredClasses = () => {
        if (!profile || !classData) return [];

        // Show all classes if user is admin
        if (profile.admin) {
            return classNav;
        }

        // Filter classes based on profile.classes
        return classNav.filter(classItem =>
            profile.classes?.includes(classItem.id)
        );
    };

    // Get the default class ID (first available class from filtered list)
    const defaultClassId = getFilteredClasses()[0]?.id || '';

    // Modify navigation links to use defaultClassId when no class is selected
    const navigationLinks = [
        {
            link: currentClassId
                ? `/classes/${currentClassId}`
                : `/classes/${defaultClassId}`,
            label: 'Home'
        },
        {
            link: currentClassId
                ? `/classes/${currentClassId}/chat`
                : `/classes/${defaultClassId}/chat`,
            label: 'Chat'
        },
    ];

    const navigationItems = (navigationLinks).map((link) => (
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
                                    src={colorScheme === "dark" ? "/images/logo-darkmode.png" : "/images/logo.png"}
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
                                            {displayText} <IconChevronDown size={16} color={colorScheme === "dark" ? "white" : "black"} />
                                        </button>
                                    </Menu.Target>

                                    <Menu.Dropdown>
                                        {profile && classData && getFilteredClasses().map((classItem) => (
                                            <Menu.Item
                                                key={classItem.id}
                                                component={Link}
                                                href={`/classes/${classItem.id}`}
                                            >
                                                {classItem.label}
                                            </Menu.Item>
                                        ))}
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
                                                <IconUser size={20} color={colorScheme === "dark" ? "white" : "black"} />
                                            </button>
                                        </Menu.Target>

                                        <Menu.Dropdown>
                                            <Menu.Item
                                                component={Link}
                                                href="/login"
                                                style={{ color: colorScheme === "dark" ? "white" : "inherit" }}
                                            >
                                                Account
                                            </Menu.Item>
                                            <Menu.Divider />
                                            <Menu.Item
                                                color="red"
                                                onClick={handleLogout}
                                                style={{ color: colorScheme === "dark" ? "white" : "inherit" }}
                                            >
                                                Logout
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>

                                    <Link href="/feedback">
                                        <button className={classes.feedbackButton}>
                                            <IconMessage size={20} color={colorScheme === "dark" ? "white" : "black"} />
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

                        <Burger
                            opened={drawerOpened}
                            onClick={toggleDrawer}
                            hiddenFrom="xs"
                            size="sm"
                            color={colorScheme === "dark" ? "white" : "black"}
                        />
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
                                    src={colorScheme === "dark" ? "/images/logo-darkmode.png" : "/images/logo.png"}
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
                                    <Box p={2}>
                                        <Link
                                            href="/feedback"
                                            className={classes.link}
                                            data-active={pathname === "/feedback" || undefined}
                                        >
                                            Feedback
                                        </Link>
                                    </Box>
                                    <Box p={2}>
                                        <Link
                                            href="/login"
                                            className={classes.link}
                                            data-active={pathname === "/login" || undefined}
                                        >
                                            Account
                                        </Link>
                                    </Box>
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