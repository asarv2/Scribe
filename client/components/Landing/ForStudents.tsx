/**
 * ForStudents.tsx
 * Used to show the benefits of using the platform for students.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Avatar } from "@mantine/core";
import { Card, Center } from "@mantine/core";
import { Grid, Text, Title } from "@mantine/core";
import { Container } from "@mantine/core";
import { Box } from "@mantine/core";
import { IconChartBar, IconDeviceLaptop, IconEye } from "@tabler/icons-react";
import styles from './ForStudents.module.css';
import { useMediaQuery } from "@mantine/hooks";

export default function ForStudents() {
    const isMobile = useMediaQuery("(max-width: 768px)");
    return (
        <Box style={{
            padding: isMobile ? "40px 20px" : "80px 40px",
            position: "relative",
            overflow: "hidden"
        }} className={styles.container}>
            <Container size="lg">
                <Title order={2} ta="center" mb={20}>For Students</Title>
                <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto">
                    Get personalized learning support that helps you master course material and excel in your classes.
                </Text>

                <Grid gutter={40}>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Center mb="md">
                                <Avatar size="xl" radius="xl" color="blue" className={styles.avatar}>
                                    <IconEye size={32} />
                                </Avatar>
                            </Center>
                            <Title order={3} ta="center" mb="md">Ready Content</Title>
                            <Text ta="center">
                                Access AI assistance that's already trained on your specific course materials, textbooks, and teacher's content.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Center mb="md">
                                <Avatar size="xl" radius="xl" color="blue" className={styles.avatar}>
                                    <IconChartBar size={32} />
                                </Avatar>
                            </Center>
                            <Title order={3} ta="center" mb="md">Interactive Visualizations</Title>
                            <Text ta="center">
                                Understand complex concepts through dynamic visualizations, graphs, and interactive models that bring learning to life.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Center mb="md">
                                <Avatar size="xl" radius="xl" color="blue" className={styles.avatar}>
                                    <IconDeviceLaptop size={32} />
                                </Avatar>
                            </Center>
                            <Title order={3} ta="center" mb="md">Immersive Mode</Title>
                            <Text ta="center">
                                Dive deep into focused learning sessions with distraction-free immersive mode that adapts to your learning style.
                            </Text>
                        </Card>
                    </Grid.Col>
                </Grid>
            </Container>
        </Box>
    );
}