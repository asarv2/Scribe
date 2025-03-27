/**
 * components/General/GeneralHeader.tsx
 * 
 * This is the header for the general layout.
 * 
 * @AshokSaravanan222
 * 18.02.2025
 */

import { Burger, Button, Group, Menu } from "@mantine/core";
import Link from "next/link";
import Image from "next/image";
import { useMantineColorScheme } from "@mantine/core";
import classes from "./GeneralHeader.module.css";
import { IconChevronDown } from "@tabler/icons-react";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import { getClasses } from "@/utils/queries/get-classes";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";

interface GeneralHeaderProps {
    mobileOpened: boolean;
    desktopOpened: boolean;
    toggleMobile: () => void;
    toggleDesktop: () => void;
}

export function GeneralHeader({
    mobileOpened,
    desktopOpened,
    toggleMobile,
    toggleDesktop
}: GeneralHeaderProps) {
    const supabase = useSupabaseBrowser();
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

    return (
        <Group h="100%" px="md" w="100%" justify="space-between">
            <Group>
                {/* <Burger
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
                /> */}
                <Link href="/">
                    <Image
                        src={colorScheme === "dark" ? "/images/logo-dark.png" : "/images/logo-light.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                    />
                </Link>
            </Group>
            <Group>
                {/* <Menu shadow="md" width={200}>
                    <Menu.Target>
                        <button className={classes.classSelector}>
                            Select Class <IconChevronDown size={16} color={colorScheme === "dark" ? "white" : "black"} />
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


