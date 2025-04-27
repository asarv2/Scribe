/**
 * HeaderSimple.tsx
 * Header for the application.
 * @AshokSaravanan222
 * 09.01.2024
 */

import { ActionIcon, Button, Container, Group, Tooltip, useComputedColorScheme, Menu, Center, Text, Modal, TextInput, Textarea, Stack, Badge, Box, Collapse } from '@mantine/core'; // Added Box, Collapse
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
import { useState } from 'react'; // Keep useState
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
import { useStudentMode } from '../StudentModeContext';
import { menuConfig } from '@/utils/menu/menuConfig'; // Import menuConfig
import { ClassNavbarLinksGroup } from './ClassNavbarLinksGroup'; // Import ClassNavbarLinksGroup

interface ClassHeaderProps {
    classId: string;
    basePath: string; // Add basePath prop
    showClasses: boolean;
    // Remove onMobileMenuToggle
}

export function ClassHeader({ classId, basePath, showClasses }: ClassHeaderProps) { // Add basePath to destructuring
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
            <Group pt={0}> {/* Remove padding top */}
                {hasNoClasses ? <Button
                    onClick={open}
                    size="xs"
                >
                    {profile && ((profile.professor || profile.admin) && !studentMode) ? "Add Class" : "Join Class"}
                </Button> : <Menu trigger="hover" transitionProps={{ exitDuration: 0 }} withinPortal>
                    <Menu.Target>
                        <Button 
                            variant="subtle" 
                            className={classes.classSelector}
                            p={4} 
                            h={25} 
                        >
                            <Center>
                                <Group gap={2}>
                                    <Text 
                                        size="sm" 
                                        fw={300}
                                        style={{ 
                                            lineHeight: '16px',
                                            fontSize: '16px'
                                        }}
                                    >
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
                    {/* ...existing modal code... */}
                </Modal>
            </Group>
        )
    }

    return (
        <Group h="100%" px="md" w="100%" justify="space-between" pos="relative" className={classes.headerRoot}>
            {/* Left Group: Navigation Menu */}
            <Group gap="xs" style={{ zIndex: 2 }}>
                {/* Navigation Menu Trigger - Moved from right side */}
                {profile && ((profile.professor || profile.admin) && !studentMode) && classId && (
                    <Menu
                        shadow="md"
                        width={200}
                        opened={navMenuOpened}
                        onChange={setNavMenuOpened}
                        position="bottom-start"
                        offset={8}
                    >
                        <Menu.Target>
                            <Tooltip label="Navigation Menu">
                                <ActionIcon
                                    variant="subtle"
                                    aria-label="Navigation Menu"
                                    onClick={() => setNavMenuOpened((o) => !o)}
                                >
                                    <IconMenu2 size={24} />
                                </ActionIcon>
                            </Tooltip>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {navLinks}
                        </Menu.Dropdown>
                    </Menu>
                )}
            </Group>

            {/* Center: Logo, Divider, Class Selector, Student Mode Badge */}
            <Center style={{
                position: 'absolute',
                left: 0,
                right: 0,
                margin: 'auto',
                zIndex: 1,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center', 
                gap: '8px', // Increased from 4px to add more space
            }}>
                {/* Logo */}
                <Link href="/" style={{ pointerEvents: 'auto', display: 'inline-block' }}>
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
                </Link>
                
                {/* Divider */}
                <Box 
                    style={{ 
                        height: '20px', 
                        width: '1px', 
                        background: 'var(--mantine-color-blue-6)',
                        opacity: 0.9,
                        pointerEvents: 'none' 
                    }} 
                />
                
                {/* Class Selector - Moved here from left and right groups */}
                <Box style={{ 
                    pointerEvents: 'auto',
                    marginLeft: '-4px', // Change from 2px to -4px to move closer to divider
                    display: 'flex',
                    alignItems: 'center' // Ensure vertical centering
                }}>
                    {renderClassSelector()}
                </Box>
                
                {/* Student Mode Badge */}
                {profile && ((profile.professor || profile.admin) && studentMode) &&
                    <Tooltip label="To disable, click 'Exit Student Mode' under the profile menu">
                        <Badge style={{ pointerEvents: 'auto', marginTop: '2px' }}>Student Mode</Badge>
                    </Tooltip>
                }
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