/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { ActionIcon, Button, Container, Group, Tooltip, useComputedColorScheme, Menu, Center, Text, Modal, TextInput, Textarea, Stack } from '@mantine/core';
import classes from "./ClassHeader.module.css"
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconChevronDown, IconMenu2, IconMessageCircle, IconMoon, IconSun } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getUser } from '@/utils/queries/get-user';
import { getProfile } from '@/utils/queries/get-profile';
import { getClasses } from '@/utils/queries/get-classes';
import { Menu as MantineMenu, useMantineColorScheme, Avatar } from '@mantine/core';
import { getAvatarUrl } from '@/utils/services/images';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { logout } from '@/utils/services/auth';
import { AccountMenu } from '../AccountMenu';
import { Profile } from '@/types';
import { Class } from '@/types';
import cx from 'clsx';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import FeedbackModal from '../FeedbackModal';
import Management from '../Account/Management';
import { createClass } from '@/utils/services/class';
import { updateProfile } from '@/utils/services/profile';
import { checkCode } from '@/utils/services/code';
interface ClassHeaderProps {
    classId: string
    showClasses: boolean
    onMobileMenuToggle?: () => void
}

export function ClassHeader({ classId, showClasses, onMobileMenuToggle }: ClassHeaderProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const { setColorScheme } = useMantineColorScheme();
    const computedColorScheme = useComputedColorScheme(undefined, { getInitialValueInEffect: true });
    const [isOpen, { open, close }] = useDisclosure(false);
    const [classCode, setClassCode] = useState('');
    const [newClassName, setNewClassName] = useState("");
    const [newClassCode, setNewClassCode] = useState("");
    const [newClassDescription, setNewClassDescription] = useState("");
    const [loading, setLoading] = useState(false);

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

    const getFilteredClasses = (profile: Profile | undefined, classData: Class[] | undefined) => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const toggleColorScheme = () => {
        setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
    };

    const handleAddClass = async () => {

        if (!profile) {
            throw new Error("Profile not found");
        }

        if (!newClassName || !newClassCode) {
            throw new Error("Class name and code are required");
        }

        setLoading(true);
        try {
            const classId = await createClass(
                newClassName,
                newClassCode,
                newClassDescription
            );

            if (!classId) {
                throw new Error("Failed to create class");
            } else {
                // add class to profile if not admin
                if (!profile.admin) {
                    const { success: profileSuccess, error: profileError } = await updateProfile(profile.id, {
                        classes: Array.from(new Set([...profile.classes, classId]))
                    });

                    if (!profileSuccess) {
                        throw new Error(profileError);
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            notifications.show({
                title: 'Success',
                message: 'Class created successfully',
                color: 'green'
            });

            // push to class page
            router.push(`/class/${classId}`);

            // Reset form
            setNewClassName("");
            setNewClassCode("");
            setNewClassDescription("");

        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setLoading(false);
            close();
        }
    };

    const handleJoinClass = async () => {
        if (!profile) {
            throw new Error("Profile not found");
        }

        if (!classCode) {
            throw new Error("Class code is required");
        }

        setLoading(true);
        try {
            const { success, error, code } = await checkCode(classCode);

            if (!success || !code) {
                throw new Error(error);
            } else {
                // add class to profile if not admin
                if (!profile.admin) {
                    const { success: profileSuccess, error: profileError } = await updateProfile(profile.id, {
                        classes: Array.from(new Set([...profile.classes, code.class]))
                    });

                    if (!profileSuccess) {
                        throw new Error(profileError);
                    }
                }
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            notifications.show({
                title: 'Success',
                message: 'Class joined successfully',
                color: 'green'
            });

            // push to class page
            router.push(`/class/${code.class}/chat/new`);

            // Reset form
            setClassCode("");

        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setLoading(false);
            close();
        }
    };

    const isMobile = useMediaQuery('(max-width: 768px)');

    const renderClassSelector = () => {
        const hasNoClasses = getFilteredClasses(profile, classData).length === 0;
        return showClasses && (
            <Group pt={4}>
                {hasNoClasses ? <Button
                    variant="light"
                    onClick={open}
                >
                    {profile?.professor || profile?.admin ? "Add Class" : "Join Class"}
                </Button> : <Menu trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
                    <Menu.Target>
                        <Button variant="subtle" className={classes.classSelector}>
                            <Center>
                                <Group gap={2}>
                                    <Text size="sm" fw={500}>
                                        {classData?.find(c => c.id === classId)?.class_code || 'Select Class'}
                                    </Text>
                                    <IconChevronDown size={14} stroke={1.5} />
                                </Group>
                            </Center>
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {getFilteredClasses(profile, classData).map((classItem) => (
                            <Menu.Item
                                key={classItem.id}
                                component={Link}
                                href={profile?.professor || profile?.admin
                                    ? `/class/${classItem.id}`
                                    : `/class/${classItem.id}/chat/new`}
                            >
                                {classItem.class_code}
                            </Menu.Item>
                        ))}
                        <Menu.Divider />
                        <Menu.Item
                            onClick={open}
                        >
                            {profile?.professor || profile?.admin ? "Add Class" : "Join Class"}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>}

                <Modal
                    opened={isOpen}
                    onClose={close}
                    title={profile?.professor || profile?.admin ? "Add New Class" : "Join Class"}
                    size="lg"
                >
                    <Stack gap="md">
                        {profile?.professor || profile?.admin ? (
                            <Stack gap="md">
                                <Group grow>
                                    <TextInput
                                        label="Class Name"
                                        placeholder="Introduction to Computer Science"
                                        value={newClassName}
                                        onChange={(e) => setNewClassName(e.currentTarget.value)}
                                        required
                                    />
                                    <TextInput
                                        label="Class Code"
                                        placeholder="CS101"
                                        value={newClassCode}
                                        onChange={(e) => setNewClassCode(e.currentTarget.value)}
                                        required
                                    />
                                </Group>
                                <Textarea
                                    label="Description"
                                    placeholder="A brief description of the class"
                                    value={newClassDescription}
                                    onChange={(e) => setNewClassDescription(e.currentTarget.value)}
                                    autosize
                                    minRows={3}
                                />
                            </Stack>
                        ) : (
                            <TextInput
                                label="Class Code"
                                placeholder="XXXXX-XXXXX"
                                value={classCode}
                                onChange={(event) => {
                                    let value = event.currentTarget.value.toUpperCase();

                                    // Remove any non-alphanumeric characters except hyphen
                                    value = value.replace(/[^A-Z0-9-]/g, '');

                                    // Auto-insert hyphen after 5 characters if not present
                                    if (value.length > 5 && value.charAt(5) !== '-') {
                                        value = value.slice(0, 5) + '-' + value.slice(5);
                                    }

                                    // Limit to 11 characters (5 + hyphen + 5)
                                    if (value.length > 11) {
                                        value = value.slice(0, 11);
                                    }

                                    setClassCode(value);
                                }}
                            />
                        )}
                        <Group justify="flex-end">
                            {profile?.professor || profile?.admin ? (
                                <Button onClick={handleAddClass} loading={loading}>Add</Button>
                            ) : (
                                <Button onClick={handleJoinClass} loading={loading}>Join</Button>
                            )}
                        </Group>
                    </Stack>
                </Modal>
            </Group>
        )
    }

    return (
        <Group h="100%" px="md" w="100%" justify="space-between">
            <Group gap="xs">
                {profile && (profile.professor || profile.admin) && isMobile && (
                    <Group pt={4}>
                        <Tooltip label="Open Menu">
                            <ActionIcon
                                onClick={onMobileMenuToggle}
                                variant="subtle"
                                aria-label="Open Menu"
                            >
                                <IconMenu2 size={24} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                )}
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
                {!isMobile && renderClassSelector()}
            </Group>

            {isMobile && renderClassSelector()}

            <Group>
                <Tooltip label={computedColorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                    <ActionIcon
                        variant="subtle"
                        onClick={toggleColorScheme}
                        aria-label="Toggle color scheme"
                    >
                        <IconSun className={cx(classes.icon, classes.light)} size={24} />
                        <IconMoon className={cx(classes.icon, classes.dark)} size={24} />
                    </ActionIcon>
                </Tooltip>
                <FeedbackModal />
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