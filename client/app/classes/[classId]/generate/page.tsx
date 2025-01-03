/**
 * app/classes/[classId]/generate/page.tsx
 * This page is for showing the past generations of the class. It will show all the past generations of the class, and the option to generate new generations.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconUpload } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, em, Group, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";

import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import { getGenerations } from "@/utils/queries/get-generations";
export default function GeneratePage({ params }: { params: { classId: string} }) {
    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const router = useRouter();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: generations, isLoading: loadingGenerations } = useQuery({
        queryKey: ["generations", classId],
        queryFn: () => getGenerations(supabase, classId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>Generations</Text>
                        </Group>
                        <Group>
                            <Link href={`/classes/${classId}/generate/new`}>
                                <Button>Generate New</Button>
                            </Link>
                        </Group>
                    </Flex>

                    <Stack>
                        {generations && generations.length > 0 ? generations.map((generation) => (
                            <Link 
                                href={`/classes/${classId}/generate/past/${generation.id}`} 
                                key={generation.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card withBorder>
                                    <Group align="flex-start">
                                        <MantineImage
                                            src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classData?.class_code}/lectures/${generation?.name}/images/1.png`}
                                            alt={`First page of ${generation.name}`}
                                            width={200}
                                            height={150}
                                            fit="contain"
                                            fallbackSrc="/placeholder-image.png" // You might want to add a placeholder image
                                        />
                                        <Stack gap="xs">
                                            <Text size="lg" fw={500}>{generation.name}</Text>
                                            <Text size="sm" c="dimmed">
                                                Generated {new Date(generation.created_at ?? "").toLocaleDateString()}
                                            </Text>
                                        </Stack>
                                    </Group>
                                </Card>
                            </Link>
                        )) : (
                            <Text size="xl" fw={500}>No generations found.</Text>
                        )}
                    </Stack>
                </Stack>
            </Container>

        </>
    );
}