import { ActionIcon, Anchor, Container, Group, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import Image from "next/image";
import classes from './HomeFooter.module.css';
import Link from "next/link";
import { IconMoon } from '@tabler/icons-react';
import { IconSun } from '@tabler/icons-react';
import cx from 'clsx';

export function HomeFooter() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme(undefined, { getInitialValueInEffect: true });

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className={classes.footer}>
      <Container className={classes.inner}>
        <Link href="/">
          <Image
            src={"/images/logo-light.png"}
            priority
            alt="Logo"
            width={90}
            height={20}
            className={classes['logo-light']}
          />
          <Image
            src={"/images/logo-dark.png"}
            priority
            alt="Logo"
            width={90}
            height={20}
            className={classes['logo-dark']}
          />
        </Link>
        <Group className={classes.links}>
          <Anchor
            component={Link}
            href="/contact"
            c="dimmed"
            size="sm"
          >
            Contact
          </Anchor>
          <Anchor
            component={Link}
            href="/privacy"
            c="dimmed"
            size="sm"
          >
            Privacy
          </Anchor>
          <Anchor
            component={Link}
            href="/terms"
            c="dimmed"
            size="sm"
          >
            Terms
          </Anchor>
          <Tooltip label={computedColorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
            <ActionIcon
              variant="subtle"
              onClick={toggleColorScheme}
              aria-label="Toggle color scheme"
            >
              <IconSun className={cx(classes.icon, classes.light)} size={24} />
              <IconMoon className={cx(classes.icon, classes.dark)} size={24} />
            </ActionIcon>
          </Tooltip>
        </Group>

      </Container>
    </div>
  );
}