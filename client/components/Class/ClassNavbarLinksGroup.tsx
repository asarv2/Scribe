import { useState } from 'react';
import { Group, Box, Collapse, Text, UnstyledButton, rem, Skeleton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import classes from './ClassNavbarLinksGroup.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface LinksGroupProps {
    icon: React.FC<any>;
    label: string;
    initiallyOpened?: boolean;
    link?: string; // Make link optional
    isLink?: boolean; // Add isLink prop
    links?: { label: string; link: string }[];
    isExpanded: boolean; // Keep isExpanded, might be used for styling or sub-link visibility
    isLoading: boolean;
}

export function ClassNavbarLinksGroup({
    icon: Icon,
    label,
    initiallyOpened,
    link,
    isLink,
    links,
    isExpanded,
    isLoading
}: LinksGroupProps) {
    const pathname = usePathname();
    const hasLinks = Array.isArray(links);
    const [opened, setOpened] = useState(initiallyOpened || false);

    // Updated active link check logic
    const isLinkActive = (linkPath: string) => {
        // Handle main class page specially for home link
        if (linkPath.endsWith('/')) {
            // If link ends with '/', it's likely the home link
            const baseClassPath = linkPath.slice(0, -1); // Remove trailing slash
            return pathname === baseClassPath || pathname === linkPath;
        }
        return pathname === linkPath;
    };

    // Determine if the main link or any sublink is active
    const isActive = (link && isLinkActive(link)) || links?.some(item => isLinkActive(item.link));

    const items = (hasLinks ? links : []).map((item) => (
        <Link href={item.link} key={item.label} passHref legacyBehavior>
            <Text<'a'>
                component="a"
                className={classes.link}
                href={item.link}
                data-active={isLinkActive(item.link) || undefined}
            >
                {item.label}
            </Text>
        </Link>
    ));

    if (isLoading) {
        return (
            <>
                <Skeleton height={30} mt="sm" width="80%" radius="sm" />
                {hasLinks && (
                    <Box ml="xl" mt="sm">
                        <Skeleton height={20} mt="xs" width="70%" radius="sm" />
                        <Skeleton height={20} mt="xs" width="70%" radius="sm" />
                    </Box>
                )}
            </>
        );
    }

    // Render as a direct link if isLink is true and link exists
    if (isLink && link) {
        return (
            <Link href={link} passHref legacyBehavior>
                <UnstyledButton
                    component="a"
                    href={link}
                    className={classes.control}
                    data-active={isActive || undefined}
                >
                    <Group justify="space-between" gap={0}>
                        <Box style={{ display: 'flex', alignItems: 'center' }}>
                            <Icon style={{ width: rem(18), height: rem(18) }} />
                            <Box ml="md">{label}</Box>
                        </Box>
                    </Group>
                </UnstyledButton>
            </Link>
        );
    }

    // Render as a collapsible group if it has sublinks
    return (
        <>
            <UnstyledButton onClick={() => setOpened((o) => !o)} className={classes.control} data-active={isActive || undefined}>
                <Group justify="space-between" gap={0}>
                    <Box style={{ display: 'flex', alignItems: 'center' }}>
                        <Icon style={{ width: rem(18), height: rem(18) }} />
                        <Box ml="md">{label}</Box>
                    </Box>
                    {hasLinks && (
                        <IconChevronRight
                            className={classes.chevron}
                            stroke={1.5}
                            style={{
                                width: rem(16),
                                height: rem(16),
                                transform: opened ? 'rotate(90deg)' : 'none',
                            }}
                        />
                    )}
                </Group>
            </UnstyledButton>
            {hasLinks ? <Collapse in={opened}>{items}</Collapse> : null}
        </>
    );
}