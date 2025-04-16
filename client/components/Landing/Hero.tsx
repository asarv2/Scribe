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
                overflow: "hidden",
                minHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start"
            }}
        >
            <div className={styles.gradientBackground}></div>
            <div className={styles.noiseOverlay}></div>
            
            <Container size="lg" className={styles.heroContent}>
                <Stack gap="xl" align="center" style={{ textAlign: "center", maxWidth: "900px", margin: "0 auto" }}>
                    <Title order={1} className={styles.heroTitle}>
                        The AI Teaching Assistant
                    </Title>
                    {/* <Text size="xl" c="dimmed" className={styles.heroText}>
                        Scribe is an AI-TA meant for both <span className={styles.studentHighlight}>students</span> and <span className={styles.professorHighlight}>professors</span>. Instantly access a 24/7 office hour chatbox, study prep generation, detailed analytics, and more.
                    </Text> */}
                    <Text size="xl" c="dimmed" className={styles.heroText}>
                        An AI-TA with 24/7 availability, smart study tools, and powerful analytics, Scribe helps you learn like never before.
                    </Text>
                    <Group mt="md" justify="center" className={styles.ctaButtonContainer}>
                        {user && profile ? (
                            <>
                                {profile?.professor || profile?.admin ? (
                                    <Link href={`/class/${firstClass?.id}`}>
                                        <Button size="lg" radius="md" className={styles.ctaButton}>
                                            Get Started
                                        </Button>
                                    </Link>
                                ) : (
                                    <Link href={`/class/${firstClass?.id}/chat/new`}>
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
                
                <Box className={styles.videoWrapper}>
                    <Box className={styles.videoContainer}>
                        <Box className={styles.videoItem}>
                            <video 
                                className={styles.videoElement}
                                autoPlay 
                                loop 
                                muted 
                                playsInline
                            >
                                <source src="/videos/scribe-student-demo.webm" type="video/webm" />
                                Your browser does not support the video tag.
                            </video>
                            <div className={`${styles.videoLabel} ${styles.studentLabel}`}>Student</div>
                        </Box>
                        <Box className={styles.videoItemIndigo}>
                            <video 
                                className={styles.videoElement}
                                autoPlay 
                                loop 
                                muted 
                                playsInline
                            >
                                <source src="/videos/scribe-professor-demo.webm" type="video/webm" />
                                Your browser does not support the video tag.
                            </video>
                            <div className={`${styles.videoLabel} ${styles.professorLabel}`}>Professor</div>
                        </Box>
                    </Box>
                </Box>
            </Container>
            <div className={styles.gradientOverlay}></div>
        </Box>
    );
}