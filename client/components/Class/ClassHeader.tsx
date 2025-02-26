/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { Button, Container, Group } from '@mantine/core';
import classes from "./ClassHeader.module.css"
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconChevronDown } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getUser } from '@/utils/queries/get-user';
import { getProfile } from '@/utils/queries/get-profile';
import { getClasses } from '@/utils/queries/get-classes';
import { Menu, useMantineColorScheme, Avatar } from '@mantine/core';
import { getAvatarUrl } from '@/utils/services/images';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { logout } from '@/utils/services/auth';
import { AccountMenu } from '../AccountMenu';
interface ClassHeaderProps {
    classId: string | null
}

export function ClassHeader({ classId }: ClassHeaderProps) {
    const [loading, setLoading] = useState(false);
    const supabase = useSupabaseBrowser();
    const pathname = usePathname();
    const { colorScheme } = useMantineColorScheme();
    const queryClient = useQueryClient();
    const router = useRouter();

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
            <Link href="/">
                    <Image
                        src={colorScheme === "dark" ? "/images/logo-darkmode.png" : "/images/logo.png"}
                        priority
                        alt="Logo"
                        width={90}
                        height={20}
                        style={{ marginTop: '4px' }}
                    />
                </Link>
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
            </Group>
            <Group>
                <AccountMenu profile={profile} />
            </Group>
        </Group>
    );
}

export const NAVBAR_CONSTANTS = {
    COLLAPSED_WIDTH: 70,
    EXPANDED_WIDTH: 250,
    TRANSITION_DURATION: '0.2s',
    Z_INDEX: 1000,  // High enough to overlay content
} as const;