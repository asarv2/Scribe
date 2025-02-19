import { Anchor, Container, Group } from '@mantine/core';
import Image from "next/image";
import { useMantineColorScheme } from "@mantine/core";
import classes from './HomeFooter.module.css';
import Link from "next/link";

export function HomeFooter() {
  const { colorScheme } = useMantineColorScheme();

  return (
    <div className={classes.footer}>
      <Container className={classes.inner}>
        <Link href="/">
          <Image
            src={colorScheme === "dark" ? "/images/logo-darkmode.png" : "/images/logo.png"}
            priority
            alt="Logo"
            width={90}
            height={20}
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
        </Group>
      </Container>
    </div>
  );
}