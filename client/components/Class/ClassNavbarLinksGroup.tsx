import { useState, useRef, useEffect } from 'react';
import { IconCalendarStats, IconChevronRight } from '@tabler/icons-react';
import { Box, Collapse, Flex, Group, ThemeIcon, UnstyledButton } from '@mantine/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classes from './ClassNavbarLinksGroup.module.css';

interface ClassLinksGroupProps {
  icon: React.FC<any>;
  label: string;
  link?: string;
  links?: { label: string; link: string }[];
  isExpanded: boolean;
}

export function ClassNavbarLinksGroup({
  icon: Icon,
  label,
  links,
  link,
  isExpanded
}: ClassLinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const pathname = usePathname();
  const [opened, setOpened] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  // More exact path matching
  const isActiveGroup = hasLinks 
    ? links.some(item => pathname === item.link)
    : pathname === link;

  const isActiveLink = !hasLinks && pathname === link;

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