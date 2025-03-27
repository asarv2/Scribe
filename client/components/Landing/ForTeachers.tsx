/**
 * ForTeachers.tsx
 * Used to show the benefits of using the platform for teachers.
 * @AshokSaravanan
 * 03/26/2025
 */

import { Avatar } from "@mantine/core";
import { Card, Center } from "@mantine/core";
import { Grid, Text, Title } from "@mantine/core";
import { Container } from "@mantine/core";
import { Box } from "@mantine/core";
import { IconLock, IconPuzzle, IconSettings } from "@tabler/icons-react";
import styles from './ForTeachers.module.css';
import { useMediaQuery } from "@mantine/hooks";

export default function ForTeachers() {
    const isMobile = useMediaQuery("(max-width: 768px)");
    return (
        <Box style={{
            padding: isMobile ? "40px 20px" : "80px 40px",
            position: "relative",
            overflow: "hidden"
        }} className={styles.container}>
            <Container size="lg">
                <Title order={2} ta="center" mb={20}>For Teachers</Title>
                <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto">
                    Empower your teaching with AI tools that align with your curriculum and teaching style.
                </Text>

                <Grid gutter={40}>
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Center mb="md">
                                <Avatar size="xl" radius="xl" color="indigo" className={styles.avatar}>
                                    <IconSettings size={32} />
                                </Avatar>
                            </Center>
                            <Title order={3} ta="center" mb="md">Control AI Outputs</Title>
                            <Text ta="center">
                                Customize what Scribe can and cannot help with, ensuring AI assistance aligns with your teaching goals and academic integrity policies.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Center mb="md">
                                <Avatar size="xl" radius="xl" color="indigo" className={styles.avatar}>
                                    <IconPuzzle size={32} />
                                </Avatar>
                            </Center>
                            <Title order={3} ta="center" mb="md">Generate Practice Problems</Title>
                            <Text ta="center">
                                Create unlimited practice problems with solutions that match your teaching style and curriculum requirements.
                            </Text>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Card shadow="sm" p="xl" radius="md" withBorder h="100%" className={styles.card}>
                            <Center mb="md">
                                <Avatar size="xl" radius="xl" color="indigo" className={styles.avatar}>
                                    <IconLock size={32} />
                                </Avatar>
                            </Center>
                            <Title order={3} ta="center" mb="md">Private Mode</Title>
                            <Text ta="center">
                                You can choose to keep your course content private, and we will use our own AI models to parse your content.
                            </Text>
                        </Card>
                    </Grid.Col>
                </Grid>
            </Container>
        </Box>
    );
}