/**
 * CallToAction.tsx
 * Used to show the call to action section of the landing page.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Button } from "@mantine/core";

import { getClasses } from "@/utils/queries/get-classes";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Card, Group, Stack, Text, Title } from "@mantine/core";

import { Container } from "@mantine/core";

import { Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import styles from './CallToAction.module.css';

export default function CallToAction() {
    const supabase = useSupabaseBrowser();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });

    const { data: classData } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    const getFilteredClasses = () => {
        if (!profile || !classData) return [];
        return profile.admin ? classData : classData?.filter(classItem => profile.classes?.includes(classItem.id));
    };

    const firstClass = getFilteredClasses()?.[0];

    return (
        <Box style={{
            padding: isMobile ? "40px 20px" : "80px 40px",
            position: "relative",
            overflow: "hidden"
        }} className={styles.container}>
            <Container size="lg" fluid>
                <Card shadow="lg" p={isMobile ? "xl" : 40} radius="lg" withBorder className={styles.card}>
                    <Stack align="center" gap="xl">
                        <Title order={2} ta="center" className={styles.title}>Ready to Transform Your Learning Experience?</Title>
                        <Text size="lg" ta="center" maw={600} mx="auto" className={styles.description}>
                            Join Scribe today and get the personalized academic support you need to excel in your classes.
                        </Text>
                        <Group mt="md">
                            {user && profile ? (
                                <>
                                    {profile?.professor || profile?.admin ? (
                                        <Link href={`/classes/c/${firstClass?.id}`}>
                                            <Button size="lg" radius="md" className={styles.ctaButton}>
                                                Get Started
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Link href={`/classes/c/${firstClass?.id}/chat/new`}>
                                            <Button size="lg" radius="md" className={styles.ctaButton}>
                                                Get Started
                                            </Button>
                                        </Link>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Link href="/login">
                                        <Button size="lg" radius="md" className={styles.ctaButton}>
                                            Get Started
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </Group>
                    </Stack>
                </Card>
            </Container>
        </Box>
    );
}