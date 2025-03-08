"use client";

import { Tooltip, UnstyledButton, Stack, rem, Box } from '@mantine/core';
import { IconHome2, IconHistory, IconMessage } from '@tabler/icons-react';
import { useRouter, usePathname } from 'next/navigation';
import classes from './SideNavbar.module.css';

interface NavbarLinkProps {
  icon: React.FC<any>;
  label: string;
  active?: boolean;
  onClick?(): void;
}

function NavbarLink({ icon: Icon, label, active, onClick }: NavbarLinkProps) {
  return (
    <UnstyledButton onClick={onClick} className={classes.link} data-active={active || undefined}>
      <Icon style={{ width: rem(20), height: rem(20) }} stroke={1.5} />
      <span>{label}</span>
    </UnstyledButton>
  );
}

// Empty SideNavbar component that doesn't render anything
export function SideNavbar() {
  // Return null to render nothing
  return null;
}
