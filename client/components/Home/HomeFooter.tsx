import { Anchor, Container, Group } from '@mantine/core';
import Image from "next/image";
import classes from './HomeFooter.module.css';
import Link from "next/link";

export function HomeFooter() {
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
        </Group>

      </Container>
    </div>
  );
}