/**
 * utils/menu/menuConfig.ts
 * This file contains the routes for the menus, to be used in the ClassMenuProvider
 * @AshokSaravanan222
 * 02/20/2025
 */

import { IconHome, IconBook, IconFileDescription, IconSettings, IconMessage, IconHistory } from '@tabler/icons-react';

export const menuConfig = {
  home: {
    label: 'Home',
    icon: IconHome,
    link: '',
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
  chat: {
    label: 'Chat',
    icon: IconMessage,
    link: '/chat/new',
  },
  // history: {
  //   label: 'History',
  //   icon: IconHistory,
  //   link: '/chat',
  // },
//   settings: {
//     label: 'Settings',
//     icon: IconSettings,
//     links: [
//       { link: '/settings', label: 'General' },
//       { link: '/prompt', label: 'Prompts' },
//     ]
//   }
} as const;

export type MenuSection = keyof typeof menuConfig;