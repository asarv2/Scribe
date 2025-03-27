/**
 * HowItWorks.tsx
 * Used to show the benefits of using the platform for students.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Avatar, Box, Card, Container, Grid, Group, Text, Title } from "@mantine/core";
import Image from "next/image";
import styles from './HowItWorks.module.css';
import { useMediaQuery } from "@mantine/hooks";

export default function HowItWorks() {
    const isMobile = useMediaQuery("(max-width: 768px)");
    return (
        <Box style={{
            padding: isMobile ? "40px 20px" : "80px 40px",
            position: "relative",
            overflow: "hidden"
        }} className={styles.container}>
            <Container size="lg">
                <Title order={2} ta="center" mb={20}>How It Works</Title>
                <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto">
                    Get your course AI-ready in just a few simple steps.
                </Text>

                <Grid gutter={40}>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Group justify="space-between" mb="xl">
                                <Avatar size="xl" radius="xl" color="green" className={styles.avatar}>
                                    <Text size="xl" fw={700}>1</Text>
                                </Avatar>
                                <div className={styles.imageWrapper}>
                                    <Image
                                        src="/images/scribe1.png"
                                        alt="Microsoft Login"
                                        width={120}
                                        height={80}
                                        className={styles.stepImage}
                                    />
                                </div>
                            </Group>
                            <Title order={3} mb="md">Sign Up with Microsoft</Title>
                            <Text>
                                Create your account using your institutional Microsoft credentials for secure and seamless access to Scribe's teaching tools.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Group justify="space-between" mb="xl">
                                <Avatar size="xl" radius="xl" color="green" className={styles.avatar}>
                                    <Text size="xl" fw={700}>2</Text>
                                </Avatar>
                                <div className={styles.imageWrapper}>
                                    <Image
                                        src="/images/scribe2.png"
                                        alt="Brightspace Import"
                                        width={120}
                                        height={80}
                                        className={styles.stepImage}
                                    />
                                </div>
                            </Group>
                            <Title order={3} mb="md">Import Your Course</Title>
                            <Text>
                                Connect to Brightspace and import your course materials, syllabus, assignments, and lecture notes with just a few clicks.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Group justify="space-between" mb="xl">
                                <Avatar size="xl" radius="xl" color="green" className={styles.avatar}>
                                    <Text size="xl" fw={700}>3</Text>
                                </Avatar>
                                <div className={styles.imageWrapper}>
                                    <Image
                                        src="/images/scribe3.png"
                                        alt="AI Processing"
                                        width={120}
                                        height={80}
                                        className={styles.stepImage}
                                    />
                                </div>
                            </Group>
                            <Title order={3} mb="md">AI Processes Your Content</Title>
                            <Text>
                                Our AI analyzes and organizes your course materials, creating a knowledge base that understands your specific teaching approach and curriculum.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 6 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Group justify="space-between" mb="xl">
                                <Avatar size="xl" radius="xl" color="green" className={styles.avatar}>
                                    <Text size="xl" fw={700}>4</Text>
                                </Avatar>
                                <div className={styles.imageWrapper}>
                                    <Image
                                        src="/images/scribe4.png"
                                        alt="Customize Settings"
                                        width={120}
                                        height={80}
                                        className={styles.stepImage}
                                    />
                                </div>
                            </Group>
                            <Title order={3} mb="md">Configure & Customize</Title>
                            <Text>
                                Set instructions for how the AI should assist students, generate practice problems, and customize the learning experience to match your teaching goals.
                            </Text>
                        </Card>
                    </Grid.Col>
                </Grid>
            </Container>
        </Box>
    );
}