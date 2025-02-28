import { useState, useRef, useEffect } from 'react';
import { IconCalendarStats, IconChevronRight } from '@tabler/icons-react';
import { Box, Collapse, Flex, Group, ThemeIcon, UnstyledButton, Skeleton } from '@mantine/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classes from './ClassNavbarLinksGroup.module.css';
import { MenuLink } from '@/utils/menu/menuConfig';
interface ClassLinksGroupProps {
  icon: React.FC<any>;
  label: string;
  link?: string;
  links?: MenuLink[];
  isExpanded: boolean;
  isLoading?: boolean;
}

export function ClassNavbarLinksGroup({
  icon: Icon,
  label,
  links,
  link,
  isExpanded,
  isLoading
}: ClassLinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  // Normalize paths by removing trailing slashes
  const normalizedPathname = pathname?.replace(/\/$/, '');
  const normalizedLink = link?.replace(/\/$/, '');

  // More exact path matching with normalized paths
  const isActiveGroup = hasLinks 
    ? links.some(item => normalizedPathname === item.link?.replace(/\/$/, ''))
    : normalizedPathname === normalizedLink;

  // For home/index routes, also check if we're at the root of the class
  const isActiveLink = !hasLinks && (
    normalizedPathname === normalizedLink || 
    (label === 'Home' && normalizedPathname === normalizedLink?.replace(/\/+$/, ''))
  );

  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Only open after a short delay and if the menu isn't already expanded
    hoverTimeoutRef.current = setTimeout(() => {
      if (!opened) {
        setOpened(true);
      }
    }, 100); // 100ms delay before opening
  };

  const handleClick = () => {
    // Clear any pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setOpened(!opened);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isExpanded) {
      // Add a small delay before closing to allow for smoother transitions
      setTimeout(() => {
        setOpened(false);
      }, 150); // 150ms delay before closing
    }
  }, [isExpanded]);

  const items = (hasLinks ? links : []).map((link) => (
    <Link
      href={link.link}
      key={link.label}
      className={classes.link}
      data-active={pathname === link.link} // Exact match instead of startsWith
      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
    >
      {link.label}
    </Link>
  ));

  if (isLoading) {
    return (
      <div className={classes.control}>
        <Flex justify="space-between" gap={0} style={{ width: '100%' }}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <Skeleton height={36} width={36} radius="md" />
            {isExpanded && (
              <Skeleton height={20} width={100} radius="sm" ml="md" />
            )}
          </Box>
          {isExpanded && hasLinks && (
            <Skeleton height={16} width={16} radius="sm" />
          )}
        </Flex>
        {isExpanded && hasLinks && opened && (
          <Box ml={50} mt="xs">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} height={24} width="80%" radius="sm" mb="xs" />
            ))}
          </Box>
        )}
      </div>
    );
  }

  if (!hasLinks && link) {
    return (
      <Link
        href={link}
        className={classes.control}
        data-active={isActiveLink}
      >
        <Group justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={36} className={isActiveLink ? classes.activeIcon : ''}>
              <Icon size={20} />
            </ThemeIcon>
            {isExpanded && <Box ml="md" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>}
          </Box>
        </Group>
      </Link>
    );
  }

  return (
    <div 
      onMouseEnter={handleMouseEnter}
    >
      <UnstyledButton 
        className={classes.control}
        onClick={handleClick}
        data-active={isActiveGroup}
      >
        <Flex justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={36} className={isActiveGroup ? classes.activeIcon : ''}>
              <Icon size={20} />
            </ThemeIcon>
            {isExpanded && <Box ml="md" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>}
          </Box>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            {hasLinks && isExpanded && (
              <IconChevronRight
                className={classes.chevron}
                stroke={1.5}
                size={16}
                style={{
                  transform: opened ? 'rotate(90deg)' : 'none',
                  transition: 'transform 300ms ease',
                }}
              />
            )}
          </Box>
        </Flex>
      </UnstyledButton>
      {hasLinks && isExpanded ? (
        <Collapse in={opened} transitionDuration={300} transitionTimingFunction="ease">
          {items}
        </Collapse>
      ) : null}
    </div>
  );
}