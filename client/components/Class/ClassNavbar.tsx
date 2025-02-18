/**
 * NavbarSimple.tsx
 * Navbar for the application.
 * @AshokSaravanan222
 * 02.17.2025
 */

import { useState } from 'react';
import {
    IconHome,
    IconBook,
    IconNotebook,
    IconSettings,
    IconLogout,
    IconMessage,
    IconUser,
    IconLayoutDashboard,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import classes from './ClassNavbar.module.css';

const data = [
    { link: '', label: 'Home', icon: IconHome },
    { link: '/chat', label: 'Chats', icon: IconMessage },
    { link: '/lecture', label: 'Lectures', icon: IconNotebook },
    { link: '/textbook', label: 'Textbooks', icon: IconBook },
];

interface ClassNavbarProps {
    basePath: string;
}

export function ClassNavbar({ basePath }: ClassNavbarProps) {
    const pathname = usePathname();
    const [isExpanded, setIsExpanded] = useState(false);

    const links = data.map((item) => (
        <Link
            href={`${basePath}${item.link}`}
            key={item.label}
            className={classes.link}
            data-active={pathname === `${basePath}${item.link}` || undefined}
        >
            <item.icon className={classes.linkIcon} stroke={1.5} />
            <span>{item.label}</span>
        </Link>
    ));

    return (
        <nav 
            className={classes.navbar}
            data-expanded={isExpanded}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <div className={classes.navbarMain}>
                {links}
            </div>

            <div className={classes.footer}>
                <Link href="/classes" className={classes.link}>
                    <IconLayoutDashboard className={classes.linkIcon} stroke={1.5} />
                    <span>Dashboard</span>
                </Link>
                {/* <Link href="/account" className={classes.link}>
                    <IconUser className={classes.linkIcon} stroke={1.5} />
                    <span>Account</span>
                </Link>
                <Link href="/logout" className={classes.link}>
                    <IconLogout className={classes.linkIcon} stroke={1.5} />
                    <span>Logout</span>
                </Link> */}
            </div>
        </nav>
    );
}