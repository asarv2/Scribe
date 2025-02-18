import { useState } from 'react';
import { IconCalendarStats, IconChevronRight } from '@tabler/icons-react';
import { Box, Collapse, Group, ThemeIcon, UnstyledButton } from '@mantine/core';
import Link from 'next/link';
import classes from './NavbarLinksGroup.module.css';
import { usePathname } from 'next/navigation';

interface LinksGroupProps {
  icon: React.FC<any>;
  label: string;
  link?: string;
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
}

export function NavbarLinksGroup({ icon: Icon, label, initiallyOpened, links, link }: LinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const [opened, setOpened] = useState(initiallyOpened || false);
  const pathname = usePathname();
  
  const items = (hasLinks ? links : []).map((link) => (
    <Link
      href={link.link}
      key={link.label}
      className={classes.link}
      data-active={pathname === link.link}
    >
      {link.label}
    </Link>
  ));

  if (!hasLinks && link) {
    return (
      <Link 
        href={link} 
        className={classes.control}
        data-active={pathname === link}
      >
        <Group justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
        </Group>
      </Link>
    );
  }

  return (
    <>
      <UnstyledButton onClick={() => setOpened((o) => !o)} className={classes.control}>
        <Group justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon variant="light" size={30}>
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
          {hasLinks && (
            <IconChevronRight
              className={classes.chevron}
              stroke={1.5}
              size={16}
              style={{
                transform: opened ? 'rotate(90deg)' : 'none',
                transition: 'transform 200ms ease',
              }}
            />
          )}
        </Group>
      </UnstyledButton>
      {hasLinks ? <Collapse in={opened}>{items}</Collapse> : null}
    </>
  );
}