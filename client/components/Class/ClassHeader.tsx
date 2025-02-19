/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { Burger, Button, Container, Group } from '@mantine/core';
import classes from "./ClassHeader.module.css"
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { IconChevronDown } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getUser } from '@/utils/queries/get-user';
import { getProfile } from '@/utils/queries/get-profile';
import { getClasses } from '@/utils/queries/get-classes';
import { Menu, useMantineColorScheme } from '@mantine/core';

interface ClassHeaderProps {
    classId: string;
    mobileOpened: boolean;
    desktopOpened: boolean;
    toggleMobile: () => void;
    toggleDesktop: () => void;
}

export function ClassHeader({ classId, mobileOpened, desktopOpened, toggleMobile, toggleDesktop }: ClassHeaderProps) {
    const supabase = useSupabaseBrowser();
    const pathname = usePathname();
    const { colorScheme } = useMantineColorScheme();

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
    })

    const getFilteredClasses = () => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    // Get current class from URL
    const currentClass = getFilteredClasses()?.find(c => c.id === classId);
    const displayText = currentClass ? currentClass.class_code : 'Select Class';

    return (
        <Group h="100%" px="md" w="100%" justify="space-between">
            <Group>
                <Burger
                    opened={mobileOpened}
                    onClick={toggleMobile}
                    hiddenFrom="sm"
                    size="sm"
                />
                <Burger
                    opened={desktopOpened}
                    onClick={toggleDesktop}
                    visibleFrom="sm"
                    size="sm"
                />
                {/* <Link href="/classes">
                    <Image
                        src={colorScheme === "dark" ? "/images/xcrybe-dark.png" : "/images/xcrybe-light.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                    />
                </Link> */}
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
                                href={`/classes/c/${classItem.id}`}
                            >
                                {classItem.class_code}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            </Group>
            <Group>
                {/* <Menu shadow="md" width={200}>
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
                                href={`/classes/c/${classItem.id}`}
                            >
                                {classItem.class_code}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu> */}
                <Link href="/feedback">
                    <Button size="sm">
                        Feedback
                    </Button>
                </Link>
            </Group>
        </Group>
    );
}