/**
 * app/classes/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { Button, Center, Container, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme, Card, Badge, Group } from "@mantine/core";
import { Suspense, useEffect, useState } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { HeaderSimple } from "../../../components/HeaderSimple";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser } from "@/utils/queries/get-user";
import { getMap } from "@/utils/queries/get-map";
import Latex from "@/components/Latex";
import { updateTopicPosition } from "@/utils/services/topics";
import { getClass } from "@/utils/queries/get-class";
import Image from "next/image";


export default function Class({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient()
    const [opened, { open, close }] = useDisclosure(false)
    const [openNodeId, setOpenNodeId] = useState<string>()
    const [openNodeLabel, setOpenNodeLabel] = useState<string>()
    const [openNodeDescription, setOpenNodeDescription] = useState<string>()
    const theme = useMantineTheme()
    const pathname = usePathname()

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const { data: classData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: map, isLoading: loadingMap } = useQuery({
        queryKey: ["map", classId],
        queryFn: () => getMap(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    return (
        <>
            <HeaderSimple />
            <Container size="lg" py="xl">
                <Stack>
                    <Text size="xl" fw={700} ta="center" mb="xl">
                        {classData?.title}
                    </Text>

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Card.Section>
                                <Image
                                    src="/images/lecture.jpeg"
                                    height={160}
                                    width={600}
                                    alt="Lectures"
                                    style={{
                                        objectFit: 'cover',
                                        width: '100%'
                                    }}
                                />
                            </Card.Section>

                            <Group justify="space-between" mt="md" mb="xs">
                                <Text fw={500}>Lectures</Text>
                            </Group>

                            <Text size="sm" c="dimmed" mb="md">
                                Access all lecture materials, slides, and recordings for this course
                            </Text>

                            <Button component={Link} href={`${pathname}/lecture`} color="blue" fullWidth radius="md">
                                View Lectures
                            </Button>
                        </Card>

                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Card.Section>
                                <Image
                                    src="/images/textbook.webp"
                                    height={160}
                                    width={600}
                                    alt="Textbooks"
                                    style={{
                                        objectFit: 'cover',
                                        width: '100%'
                                    }}
                                />
                            </Card.Section>

                            <Group justify="space-between" mt="md" mb="xs">
                                <Text fw={500}>Textbooks</Text>
                            </Group>

                            <Text size="sm" c="dimmed" mb="md">
                                Browse and access course textbooks and reading materials
                            </Text>

                            <Button component={Link} href={`${pathname}/textbook`} color="blue" fullWidth radius="md">
                                View Textbooks
                            </Button>
                        </Card>

                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Card.Section>
                                <Image
                                    src="/images/homework.jpg"
                                    height={160}
                                    width={600}
                                    alt="Homework"
                                    style={{
                                        objectFit: 'cover',
                                        width: '100%'
                                    }}
                                />
                            </Card.Section>

                            <Group justify="space-between" mt="md" mb="xs">
                                <Text fw={500}>Homework</Text>
                                <Badge color="yellow">Coming Soon</Badge>
                            </Group>

                            <Text size="sm" c="dimmed" mb="md">
                                Assignments and homework management features
                            </Text>

                            <Button color="gray" fullWidth radius="md" disabled>
                                Coming Soon
                            </Button>
                            {/* <Button component={Link} href={`${pathname}/homework`} color="blue" fullWidth radius="md">
                                View Homework
                            </Button> */}
                        </Card>
                    </SimpleGrid>
                </Stack>
            </Container>
        </>
    );
}