/**
 * Header component for the home page
 * @AshokSaravanan222
 * 17.02.2025
 */

import { Button, Group } from "@mantine/core";
import Link from "next/link";
import Image from "next/image";
import { useMantineColorScheme } from "@mantine/core";
import classes from "../Class/ClassHeader.module.css";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { AccountMenu } from "../AccountMenu";
import { getProfile } from "@/utils/queries/get-profile";
import { getClasses } from "@/utils/queries/get-classes";

export function HomeHeader() {
    const { colorScheme } = useMantineColorScheme();
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
    })

    const getFilteredClasses = () => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const firstClass = getFilteredClasses()?.[0];

    return (
        <Group h="100%" px="md" justify="center" w="100%" align="center">
            <Group>
                <Link href="/">
                    <Image
                        src={colorScheme === "dark" ? "/images/logo-darkmode.png" : "/images/logo.png"}
                        priority
                        alt="Logo"
                        width={120}
                        height={30}
                        style={{ marginTop: '4px' }}
                    />
                </Link>
            </Group>
        </Group>
    );
}


