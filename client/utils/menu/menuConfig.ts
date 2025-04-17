/**
 * utils/menu/menuConfig.ts
 * This file contains the routes for the menus, to be used in the ClassMenuProvider
 * @AshokSaravanan222
 * 02/20/2025
 */

import { IconHome, IconBook, IconFileDescription, IconSettings, IconClipboard, IconMessage, IconHistory, IconPresentation, IconBinaryTree } from '@tabler/icons-react';

export const menuConfig = {
  home: {
    label: 'Home',
    icon: IconHome,
    link: '/',
  },
  content: {
    label: 'Content',
    icon: IconBook,
    link: '/content',
  },
  chat: {
    label: 'Chat',
    icon: IconMessage,
    link: '/chat/new',
  },
  // learning: {
  //   label: 'Learning',
  //   icon: IconBinaryTree,
  //   link: '/learning',
  // },
  // grader: {
  //   label: 'Grader',
  //   icon: IconClipboard,
  //   link: '/grader',
  // },
  settings: {
    label: 'Settings',
    icon: IconSettings,
    link: '/settings',
  }
} as MenuConfig;

export interface MenuLink {
  link: string;
  label: string;
}

export interface MenuItem {
  label: string;
  icon: React.ComponentType;
  link?: string;
  links?: MenuLink[];
}

export interface MenuConfig {
  [key: string]: MenuItem;
}

export type MenuSection = keyof typeof menuConfig;