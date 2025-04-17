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
import { Box, Container, Image } from "@mantine/core";
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
    const firstClassId = firstClass?.id;
    const firstClassSuffix = (profile?.professor || profile?.admin) ? firstClassId : `${firstClassId}/chat/new`;

    return (
        <Box
            className={styles.container}
            style={{
                padding: isMobile ? "60px 20px" : "100px 40px",
            }}
        >
            <div className={styles.gradientBackground}></div>
            <div className={styles.topFade}></div>
            <div className={styles.bottomFade}></div>

            <Container size="lg">
                <div className={styles.ctaContent}>
                    <div className={styles.leftSection}>
                        <h2 className={styles.title}>Learn with Scribe Now</h2>
                        {user && profile ? (
                            <Link href={`/class/${firstClassSuffix}`}>
                                <Button size="lg" radius="md" className={styles.ctaButton}>
                                    Get Started
                                </Button>
                            </Link>
                        ) : (
                            <Link href="/login">
                                <Button size="lg" radius="md" className={styles.ctaButton}>
                                    Get Started
                                </Button>
                            </Link>
                        )}
                    </div>
                    <div className={styles.rightSection}>
                        <Image
                            src="/icon.png"
                            alt="Scribe Logo"
                            className={styles.logo}
                        />
                    </div>
                </div>
            </Container>
        </Box>
    );
}