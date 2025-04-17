/**
 * Header component for the home page
 * @AshokSaravanan222
 * 17.02.2025
 */

import { ActionIcon, Button, Group, Tooltip, useComputedColorScheme } from "@mantine/core";
import Link from "next/link";
import Image from "next/image";
import { useMantineColorScheme } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { IconMoon } from "@tabler/icons-react";
import { IconSun } from "@tabler/icons-react";
import cx from 'clsx';
import classes from "./HomeHeader.module.css";
import { getClasses } from "@/utils/queries/get-classes";
export function HomeHeader() {
    const { setColorScheme } = useMantineColorScheme();
    const computedColorScheme = useComputedColorScheme(undefined, { getInitialValueInEffect: true });
    const supabase = useSupabaseBrowser();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    });

    const { data: classData } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    const getFilteredClasses = () => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const firstClass = getFilteredClasses()?.[0];
    const firstClassId = firstClass?.id;
    const firstClassSuffix = (profile?.professor || profile?.admin) ? firstClassId : `${firstClassId}/chat/new`;


    return (
        <Group h="100%" px="md" justify="space-between" w="100%">
            <Group>
                <Link href="/">
                    <Image
                        src={"/images/logo-light.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                        style={{ marginTop: '4px' }}
                        className={classes['logo-light']}
                    />
                    <Image
                        src={"/images/logo-dark.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                        style={{ marginTop: '4px' }}
                        className={classes['logo-dark']}
                    />
                </Link>
            </Group>

            <Group>
                {/* <Tooltip label="Toggle theme">
                    <ActionIcon
                        variant="subtle"
                        onClick={toggleColorScheme}
                        aria-label="Toggle color scheme"
                    >
                        <IconSun className={cx(classes.icon, classes.light)} size={24} />
                        <IconMoon className={cx(classes.icon, classes.dark)} size={24} />
                    </ActionIcon>
                </Tooltip> */}
                {user && profile ? (
                    <Link href={`/class/${firstClassSuffix}`}>
                        <Button size="sm">
                            Get Started
                        </Button>
                    </Link>

                ) : (
                    <>
                        <Link href="/login">
                            <Button size="sm">
                                Get Started
                            </Button>
                        </Link>
                    </>
                )}
            </Group>
        </Group>
    );
}

