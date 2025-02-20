/**
 * utils/menu/menuConfig.ts
 * This file contains the routes for the menus, to be used in the ClassMenuProvider
 * @AshokSaravanan222
 * 02/20/2025
 */

import { IconHome, IconBook, IconFileDescription, IconSettings, IconMessage } from '@tabler/icons-react';

export const menuConfig = {
  home: {
    label: 'Home',
    icon: IconHome,
    link: '',
  },
  chat: {
    label: 'Chat',
    icon: IconMessage,
    link: '/chat/new',
  },
  content: {
    label: 'Content',
    icon: IconBook,
    links: [
      { link: '/lecture', label: 'Lectures' },
      { link: '/textbook', label: 'Textbooks' },
      { link: '/homework', label: 'Homework' },
    ]
  },
  settings: {
    label: 'Settings',
    icon: IconSettings,
    links: [
      { link: '/settings', label: 'General' },
      { link: '/prompt', label: 'Prompts' },
    ]
  }
} as const;

export type MenuSection = keyof typeof menuConfig;