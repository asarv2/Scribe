/**
 * app/classes/[classId]/slide/[slideId]/page.tsx
 * The page for a specific note in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import { Container, em, Flex, Grid, Group, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { getSlideDocs } from "@/utils/queries/get-slide-docs";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import NotesSummary from "@/components/NotesSummary";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";
import { getSlide } from "@/utils/queries/get-slide";
import { IconArrowLeft } from '@tabler/icons-react';
import DeleteLectureModal from "@/components/DeleteLectureModal";
import { getUser } from "@/utils/queries/get-user";
import { getQuestions } from "@/utils/queries/get-questions";
import QuestionSolutionSlide from "@/components/QuestionSolutionSlide";

export default function Slide({ params }: { params: { classId: string, slideId: string } }) {
    const [pageNumber, setPageNumber] = useState<number>(1);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const slideId = params.slideId;

    const handlePageClick = (newPageNumber: number) => {
        if (newPageNumber < 1 || (newPageNumber > (documents?.length ?? 0))) {
            return;
        }
        setPageNumber(newPageNumber);
    };


    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    
    const { data: questions } = useQuery({
        queryKey: ["questions", slideId],
        queryFn: () => getQuestions(supabase, slideId),
    });

    const { data: slide } = useQuery({
        queryKey: ["slide", slideId],
        queryFn: () => getSlide(supabase, slideId),
    });

    const { data: documents} = useQuery({
        queryKey: ["slideDocuments", slideId],
        queryFn: () => getSlideDocs(supabase, slideId),
    });

    const { data: classData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                handlePageClick(pageNumber - 1);
            } else if (event.key === 'ArrowRight') {
                handlePageClick(pageNumber + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [pageNumber, documents]);


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
                            <Text size="xl" fw={700} mb={6}>{slide?.name}</Text>
                        </Group>
                        <Group>
                            <DeleteLectureModal slideId={slideId} slideTitle={slide?.name ?? ""} user={user ?? undefined} classId={slide?.class ?? ""} />
                        </Group>
                    </Flex>
                    <Grid style={{ display: "none" }}>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <NotesSummary classId={classId} slideId={slideId} className={classData?.title ?? ""} slideName={slide?.name ?? ""} documents={documents ?? []} />
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <QuestionSolutionSlide className={classData?.title ?? ""} questions={questions ? questions.map(q => ({ question: q.question, solution: q.solution })) : []} slide={slide} slideQuestions={questions} documents={documents ?? []} />
                        </Grid.Col>
                    </Grid>
                    <Stack>
                        <Link href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classData?.class_code}/lectures/${slide?.name}/notes.pdf`} target="_blank" rel="noopener noreferrer">
                            <Text>Link to download summary</Text>
                        </Link>
                        <Link href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classData?.class_code}/lectures/${slide?.name}/questions.pdf`} target="_blank" rel="noopener noreferrer">
                            <Text>Link to download practice problems</Text>
                        </Link>
                    </Stack>
                </Stack>
            </Container>

        </>
    );


}