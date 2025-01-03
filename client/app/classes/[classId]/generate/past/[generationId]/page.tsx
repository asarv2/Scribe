/**
 * app/classes/[classId]/generate/past/[generationId]/page.tsx
 * The page for a specific generation in a class.
 * @AshokSaravanan222
 * 11.11.2024
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
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Card, em, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import DeleteLectureModal from "@/components/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import Latex from "react-latex-next";
import DeleteGenerationModal from "@/components/DeleteGenerationModal";
import QuestionSolutionLecture from "@/components/QuestionSolutionSlide";
import NotesSummary from "@/components/NotesSummary";
import Questions from "@/components/Questions";
import { getGeneration } from "@/utils/queries/get-generation";
import { getGenerationSummary } from "@/utils/queries/get-generation-summary";
import { getGenerationProblems } from "@/utils/queries/get-generation-problems";

export default function Generation({ params }: { params: { classId: string, generationId: string} }) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const generationId = params.generationId;

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: generation, isLoading: loadingGeneration } = useQuery({
        queryKey: ["generation", generationId],
        queryFn: () => getGeneration(supabase, generationId)
    })

    const { data: generationSummary, isLoading: loadingGenerationSummary } = useQuery({
        queryKey: ["generationSummary", generationId],
        queryFn: () => getGenerationSummary(supabase, generationId)
    })

    const { data: generationProblems, isLoading: loadingGenerationProblems } = useQuery({
        queryKey: ["generationProblems", generationId],
        queryFn: () => getGenerationProblems(supabase, generationId)
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
                            <Text size="xl" fw={700} mb={6}>{generation?.name}</Text>
                        </Group>
                        <Group>
                            <DeleteGenerationModal generationId={generationId} generationTitle={generation?.name ?? ""} user={user ?? undefined} classId={classId} />
                        </Group>
                    </Flex>
                    {generation?.type === "summary" ? (
                        <Stack>
                            <Card withBorder style={{ overflowY: 'auto' }} h={600}>
                                <Flex justify="space-between">
                                    <Title order={3}>Summary</Title>
                                </Flex>
                                <Skeleton visible={loadingGenerationSummary}>
                                    <Markdown>{generationSummary?.content ?? ""}</Markdown>
                                </Skeleton>
                            </Card>
                        </Stack>
                    ) : (
                        <Stack>
                            <Questions questions={generationProblems ?? []} />
                        </Stack>
                    )}
                </Stack>
            </Container>

        </>
    );
}