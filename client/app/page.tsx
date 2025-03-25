/**
 * app/page.tsx
 * The root page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { Box, Button, Container, Stack, Text, Group, Avatar, useMantineColorScheme, Flex, Title, Paper, Card, Image, Grid, Center, Divider, Select, Textarea, ActionIcon } from "@mantine/core";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClasses } from "@/utils/queries/get-classes";
import { useMediaQuery } from "@mantine/hooks";
import { HomeLayout } from "@/components/Home/HomeLayout";
import { IconSchool, IconGraph, IconFileText, IconQuestionMark, IconBrain, IconNotebook, IconWriting, IconRocket, IconUsers, IconDeviceLaptop, IconSend, IconLock, IconPuzzle, IconBrandGoogleDrive, IconEye, IconChartBar, IconSettings } from '@tabler/icons-react';
import { signInWithMicrosoft } from "@/utils/services/auth";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Landing() {
  const supabase = useSupabaseBrowser();
  const { colorScheme } = useMantineColorScheme();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();

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
    <HomeLayout>
      {/* Hero Section with Image */}
      <Box
        style={{
          padding: isMobile ? "40px 20px" : "80px 40px",
          background: colorScheme === "dark" ? "linear-gradient(45deg, #1A1B1E, #25262b)" : "linear-gradient(45deg, #f8f9fa, #e9ecef)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <Container size="lg">
          <Grid gutter={40} align="center">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="xl">
                <Title order={1} size={isMobile ? 32 : 48}>
                  Your AI-Powered Learning Assistant
                </Title>
                <Text size="xl" c="dimmed">
                  Scribe helps students succeed by providing personalized learning support using your teacher's content.
                </Text>
                <Group mt="md">
                {user && profile ? (
                    // <AccountMenu profile={profile} />
                    <>
                        {profile?.professor || profile?.admin ? (
                            <Link href={`/classes/c/${firstClass?.id}`}>
                                <Button size="lg" radius="md">
                                    Get Started
                                </Button>
                            </Link>
                        ) : (
                            <Link href={`/classes/c/${firstClass?.id}/chat/new`}>
                                <Button size="lg" radius="md">
                                    Get Started
                                </Button>
                            </Link>
                        )}
                    </>

                ) : (
                    <>
                        <Link href="/login">
                            <Button size="lg" radius="md">
                                Get Started
                            </Button>
                        </Link>
                        {/* <Link href="/signup" className={classes.link}>
                            Sign Up
                        </Link> */}
                    </>
                )}
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Box
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
                />
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* Benefits for Students Section */}
      <Box py={60}>
        <Container size="lg">
          <Title order={2} ta="center" mb={20}>For Students</Title>
          <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto">
            Get personalized learning support that helps you master course material and excel in your classes.
          </Text>

          <Grid gutter={40}>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Center mb="md">
                  <Avatar size="xl" radius="xl" color="blue">
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
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Center mb="md">
                  <Avatar size="xl" radius="xl" color="blue">
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
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Center mb="md">
                  <Avatar size="xl" radius="xl" color="blue">
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

      {/* Benefits for Teachers Section */}
      <Box py={60} bg={colorScheme === "dark" ? "#1A1B1E" : "#f8f9fa"}>
        <Container size="lg">
          <Title order={2} ta="center" mb={20}>For Teachers</Title>
          <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto">
            Empower your teaching with AI tools that align with your curriculum and teaching style.
          </Text>

          <Grid gutter={40}>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Center mb="md">
                  <Avatar size="xl" radius="xl" color="indigo">
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
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Center mb="md">
                  <Avatar size="xl" radius="xl" color="indigo">
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
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Center mb="md">
                  <Avatar size="xl" radius="xl" color="indigo">
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

      {/* How It Works Section */}
      <Box py={60} bg={colorScheme === "dark" ? "#1A1B1E" : "#f8f9fa"}>
        <Container size="lg">
          <Title order={2} ta="center" mb={20}>How It Works</Title>
          <Text ta="center" size="lg" c="dimmed" mb={50} maw={800} mx="auto">
            Get your course AI-ready in just a few simple steps.
          </Text>

          <Grid gutter={40}>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Group justify="space-between" mb="xl">
                  <Avatar size="xl" radius="xl" color="green">
                    <Text size="xl" fw={700}>1</Text>
                  </Avatar>
                  <Image
                    src="/images/scribe1.png"
                    alt="Microsoft Login"
                    width={120}
                    height={80}
                    fit="contain"
                    fallbackSrc="https://placehold.co/120x80?text=Microsoft+Login"
                  />
                </Group>
                <Title order={3} mb="md">Sign Up with Microsoft</Title>
                <Text>
                  Create your account using your institutional Microsoft credentials for secure and seamless access to Scribe's teaching tools.
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Group justify="space-between" mb="xl">
                  <Avatar size="xl" radius="xl" color="green">
                    <Text size="xl" fw={700}>2</Text>
                  </Avatar>
                  <Image
                    src="/images/scribe2.png"
                    alt="Brightspace Import"
                    width={120}
                    height={80}
                    fit="contain"
                    fallbackSrc="https://placehold.co/120x80?text=Brightspace+Import"
                  />
                </Group>
                <Title order={3} mb="md">Import Your Course</Title>
                <Text>
                  Connect to Brightspace and import your course materials, syllabus, assignments, and lecture notes with just a few clicks.
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Group justify="space-between" mb="xl">
                  <Avatar size="xl" radius="xl" color="green">
                    <Text size="xl" fw={700}>3</Text>
                  </Avatar>
                  <Image
                    src="/images/scribe3.png"
                    alt="AI Processing"
                    width={120}
                    height={80}
                    fit="contain"
                    fallbackSrc="https://placehold.co/120x80?text=AI+Processing"
                  />
                </Group>
                <Title order={3} mb="md">AI Processes Your Content</Title>
                <Text>
                  Our AI analyzes and organizes your course materials, creating a knowledge base that understands your specific teaching approach and curriculum.
                </Text>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card shadow="sm" p="xl" radius="md" withBorder h="100%">
                <Group justify="space-between" mb="xl">
                  <Avatar size="xl" radius="xl" color="green">
                    <Text size="xl" fw={700}>4</Text>
                  </Avatar>
                  <Image
                    src="/images/scribe4.png"
                    alt="Customize Settings"
                    width={120}
                    height={80}
                    fit="contain"
                    fallbackSrc="https://placehold.co/120x80?text=Customize+Settings"
                  />
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

      {/* CTA Section */}
      <Box
        py={80}
        style={{
          background: colorScheme === "dark" ? "linear-gradient(45deg, #1A1B1E, #25262b)" : "linear-gradient(45deg, #f8f9fa, #e9ecef)",
        }}
      >
        <Container size="md">
          <Card shadow="lg" p={isMobile ? "xl" : 40} radius="lg" withBorder>
            <Stack align="center" gap="xl">
              <Title order={2} ta="center">Ready to Transform Your Learning Experience?</Title>
              <Text size="lg" ta="center" maw={600} mx="auto">
                Join Scribe today and get the personalized academic support you need to excel in your classes.
              </Text>
              <Group mt="md">
              {user && profile ? (
                    // <AccountMenu profile={profile} />
                    <>
                        {profile?.professor || profile?.admin ? (
                            <Link href={`/classes/c/${firstClass?.id}`}>
                                <Button size="lg" radius="md">
                                    Get Started
                                </Button>
                            </Link>
                        ) : (
                            <Link href={`/classes/c/${firstClass?.id}/chat/new`}>
                                <Button size="lg" radius="md">
                                    Get Started
                                </Button>
                            </Link>
                        )}
                    </>

                ) : (
                    <>
                        <Link href="/login">
                            <Button size="lg" radius="md">
                                Get Started
                            </Button>
                        </Link>
                        {/* <Link href="/signup" className={classes.link}>
                            Sign Up
                        </Link> */}
                    </>
                )}
              </Group>
            </Stack>
          </Card>
        </Container>
      </Box>
    </HomeLayout>
  );
}
