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
import PDFViewer from "@/components/PDFViewer";

export default function Slide({ params }: { params: { classId: string, slideId: string } }) {
    const [notesPageNumber, setNotesPageNumber] = useState<number>(0);
    const [questionsPageNumber, setQuestionsPageNumber] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const slideId = params.slideId;


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
                    {isMobile ? <Stack>
                        <PDFViewer pdfUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classData?.class_code}/lectures/${slide?.name}/notes.pdf`} pageNumber={notesPageNumber} setPageNumber={setNotesPageNumber} />
                        <PDFViewer pdfUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classData?.class_code}/lectures/${slide?.name}/questions.pdf`} pageNumber={questionsPageNumber} setPageNumber={setQuestionsPageNumber} />
                    </Stack> : <Grid>
                        <Grid.Col span={6}>
                            <PDFViewer pdfUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classData?.class_code}/lectures/${slide?.name}/notes.pdf`} pageNumber={notesPageNumber} setPageNumber={setNotesPageNumber} />
                        </Grid.Col>
                        <Grid.Col span={6}>
                            <PDFViewer pdfUrl={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/slides/${classData?.class_code}/lectures/${slide?.name}/questions.pdf`} pageNumber={questionsPageNumber} setPageNumber={setQuestionsPageNumber} />
                        </Grid.Col>
                    </Grid>}
                </Stack>
            </Container>

        </>
    );


}