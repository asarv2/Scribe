/**
 * utils/menu/menuConfig.ts
 * This file contains the routes for the menus, to be used in the ClassMenuProvider
 * @AshokSaravanan222
 * 02/20/2025
 */

import { IconHome, IconBook, IconFileDescription, IconSettings, IconMessage, IconHistory, IconPresentation } from '@tabler/icons-react';

export const menuConfig = {
  home: {
    label: 'Home',
    icon: IconHome,
    link: '/',
  },
  // content: {
  //   label: 'Content',
  //   icon: IconBook,
  //   links: [
  //     { link: '/lecture', label: 'Lectures' },
  //     { link: '/textbook', label: 'Textbooks' },
  //     { link: '/homework', label: 'Homework' },
  //   ]
  // },
  lecture: {
    label: 'Lectures',
    icon: IconPresentation,
    link: '/lecture',
  },
  textbook: {
    label: 'Textbooks',
    icon: IconBook,
    link: '/textbook',
  },
  homework: {
    label: 'Homework',
    icon: IconFileDescription,
    link: '/homework',
  },
  chat: {
    label: 'Chat',
    icon: IconMessage,
    link: '/chat/new',
  },
  history: {
    label: 'History',
    icon: IconHistory,
    link: '/chat',
  },
//   settings: {
//     label: 'Settings',
//     icon: IconSettings,
//     links: [
//       { link: '/settings', label: 'General' },
//       { link: '/prompt', label: 'Prompts' },
//     ]
//   }
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