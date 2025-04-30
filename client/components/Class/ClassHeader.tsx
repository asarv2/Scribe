/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { ActionIcon, Button, Container, Group, Tooltip, useComputedColorScheme, Menu, Center, Text, Modal, TextInput, Textarea, Stack, Badge, Box, Collapse } from '@mantine/core';
import classes from "./ClassHeader.module.css"
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { IconBook, IconChevronDown, IconEdit, IconMenu2, IconMessageCircle, IconMoon, IconSun } from '@tabler/icons-react';
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
import { Profile as BaseProfile } from '@/types';
import { Class } from '@/types';

// Extended Profile type to make created_at optional
type Profile = Omit<BaseProfile, 'created_at'> & { created_at?: string };
import cx from 'clsx';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import FeedbackModal from '../FeedbackModal';
import Management from '../Account/Management';
import { createClass } from '@/utils/services/class';
import { updateProfile } from '@/utils/services/profile';
import { checkCode } from '@/utils/services/code';
import { useStudentMode } from '../StudentModeContext';
import { menuConfig } from '@/utils/menu/menuConfig'; // Import menuConfig
import { ClassNavbarLinksGroup } from './ClassNavbarLinksGroup'; // Import ClassNavbarLinksGroup

interface ClassHeaderProps {
    classId: string;
    basePath: string; // Add basePath prop
    showClasses: boolean;
    // Remove onMobileMenuToggle
}

export function ClassHeader({ classId, basePath, showClasses }: ClassHeaderProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [isOpen, { open, close }] = useDisclosure(false);
    const [classCode, setClassCode] = useState('');
    const [newClassName, setNewClassName] = useState("");
    const [newClassCode, setNewClassCode] = useState("");
    const [newClassDescription, setNewClassDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const { studentMode } = useStudentMode();
    const [navMenuOpened, setNavMenuOpened] = useState(false); // State for nav menu

    const router = useRouter();
    const isMobile = useMediaQuery('(max-width: 768px)'); // Keep isMobile

    const { data: user, isLoading: userLoading } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classData, isLoading: classDataLoading } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    })

    // --- Navigation Data Generation (from ClassNavbar) ---
    const generateNavData = () => {
        return Object.entries(menuConfig).map(([key, item]) => ({
            ...item,
            icon: item.icon as React.FC<any>,
            link: item.link ?
                // Special handling for home link to make sure it ends with '/'
                (item.link === '/' ? `${basePath}/` : `${basePath}${item.link}`)
                : undefined,
            isLink: !!item.link,
            links: item.links?.map(link => ({
                ...link,
                link: `${basePath}${link.link}`
            }))
        }));
    };

    const navLinks = generateNavData().map((item) => (
        <ClassNavbarLinksGroup
            {...item}
            key={item.label}
            isExpanded={true} // Always expanded within the dropdown
            isLoading={userLoading || profileLoading}
        />
    ));
    // --- End Navigation Data Generation ---


    const getFilteredClasses = (profile: Profile | undefined, classData: Class[] | undefined) => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
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

    const renderClassSelector = () => {
        const hasNoClasses = getFilteredClasses(profile, classData).length === 0;
        return showClasses && !userLoading && !profileLoading && !classDataLoading && (
            <Group pt={4}>
                {hasNoClasses ? <Button
                    onClick={open}
                >
                    {profile && ((profile.professor || profile.admin) && !studentMode) ? "Add Class" : "Join Class"}
                </Button> : <Menu trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
                    <Menu.Target>
                        <Button variant="subtle" className={classes.classSelector}>
                            <Center>
                                <Group gap={4}>
                                    <IconBook size={14} stroke={1.5} />
                                    <Text size="sm" fw={500}>
                                        {classData?.find(c => c.id === classId)?.class_code || 'Select Class'}
                                    </Text>
                                </Group>
                            </Center>
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {getFilteredClasses(profile, classData).map((classItem) => (
                            <Menu.Item
                                key={classItem.id}
                                component={Link}
                                href={profile && ((profile.professor || profile.admin) && !studentMode)
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
                            {profile && ((profile.professor || profile.admin) && !studentMode) ? "Add Class" : "Join Class"}
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>}

                <Modal
                    opened={isOpen}
                    onClose={close}
                    title={profile && ((profile.professor || profile.admin) && !studentMode) ? "Add New Class" : "Join New Class"}
                    size="lg"
                    centered
                >
                    <Stack gap="md">
                        {profile && ((profile.professor || profile.admin) && !studentMode) ? (
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
                            {profile && ((profile.professor || profile.admin) && !studentMode) ? (
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
        <Group h="100%" px="md" w="100%" justify="space-between" pos="relative" className={classes.headerRoot}>
            {/* Left Group: Navigation Menu + Class Selector */}
            <Group gap="xs" style={{ zIndex: 2 }}>
                {profile && ((profile.professor || profile.admin) && !studentMode) && classId && (
                    <Menu
                        shadow="md"
                        width={200}
                        opened={navMenuOpened}
                        onChange={setNavMenuOpened}
                        position="bottom-start"
                        offset={8}
                        trigger="hover"
                        transitionProps={{ exitDuration: 0 }}
                    >
                        <Menu.Target>
                            <ActionIcon
                                variant="subtle"
                                aria-label="Navigation Menu"
                            >
                                <IconMenu2 size={24} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {navLinks}
                        </Menu.Dropdown>
                    </Menu>
                )}

                {/* Student Mode Badge */}
                {profile && ((profile.professor || profile.admin) && studentMode) &&
                    <Tooltip label="To disable, click 'Exit Student Mode' under the profile menu">
                        <Badge style={{ pointerEvents: 'auto', marginLeft: '10px', marginTop: '2px' }}>Student Mode</Badge>
                    </Tooltip>
                }

                {/* Class Selector - Moved here to left side */}
                <Tooltip label="New chat">
                    <ActionIcon
                        variant="subtle"
                        aria-label="Start a new chat"
                        onClick={() => router.push(`/class/${classId}/chat/new`)}
                    >
                        <IconEdit size={24} />
                    </ActionIcon>
                </Tooltip>

            </Group>

            {/* Center: Logo only */}
            <Center style={{
                position: 'absolute',
                left: 0,
                right: 0,
                margin: 'auto',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
            }}>
                {/* Logo - Centered */}
                {renderClassSelector()}
                {/* <Link href="/" style={{ pointerEvents: 'auto', display: 'inline-block' }}>
                    <Image
                        src={"/images/logo-light.png"}
                        priority
                        alt="Logo"
                        width={75}
                        height={25}
                        style={{ marginTop: '4px' }}
                        className={classes['logo-light']}
                    />
                    <Image
                        src={"/images/logo-dark.png"}
                        priority
                        alt="Logo"
                        width={75}
                        height={25}
                        style={{ marginTop: '4px' }}
                        className={classes['logo-dark']}
                    />
                </Link> */}
            </Center>

            {/* Right Group: Feedback, Account Menu */}
            <Group style={{ zIndex: 2 }} gap="xs">
                <FeedbackModal />
                <AccountMenu profile={profile} classId={classId} />
            </Group>
        </Group>
    );
}

// Keep NAVBAR_CONSTANTS if they are used elsewhere, otherwise remove
export const NAVBAR_CONSTANTS = {
    COLLAPSED_WIDTH: 70,
    EXPANDED_WIDTH: 250,
    TRANSITION_DURATION: '0.2s',
    Z_INDEX: 1000,  // High enough to overlay content
} as const;