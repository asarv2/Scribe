/**
 * Hero.tsx
 * Used to show the hero section of the landing page.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Button } from "@mantine/core";
import { Group, Text, Title } from "@mantine/core";
import { Box, Grid, Stack } from "@mantine/core";
import { Container, Image } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClasses } from "@/utils/queries/get-classes";
import { useMediaQuery } from "@mantine/hooks";
import styles from './Hero.module.css';

export default function Hero() {
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
        <Box
            className={styles.heroContainer}
            style={{
                padding: isMobile ? "40px 20px" : "80px 40px",
                position: "relative",
                overflow: "hidden"
            }}
        >
            <Container size="lg" fluid>
                <Grid gutter={40} align="center">
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Stack gap="xl">
                            <Title order={1} size={isMobile ? 32 : 48} className={styles.heroTitle}>
                                Your AI-Powered Learning Assistant
                            </Title>
                            <Text size="xl" c="dimmed" className={styles.heroText}>
                                Scribe helps students succeed by providing personalized learning support using your teacher's content.
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
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Box
                            className={styles.imageContainer}
                            style={{
                                borderRadius: "12px",
                                overflow: "hidden",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.1)"
                            }}
                        >
                            <Image
                                src="/images/scribehome.png"
                                alt="Students using Scribe AI"
                                height={350}
                                fallbackSrc="https://placehold.co/600x350?text=Scribe+AI+Learning+Assistant"
                                className={styles.heroImage}
                            />
                        </Box>
                    </Grid.Col>
                </Grid>
            </Container>
        </Box>
    );
}