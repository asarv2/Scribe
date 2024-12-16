/**
 * app/classes/[classId]/practice-exam/[examId]/page.tsx
 * This page is for the practice exam. It will show the questions and the user can take the exam.
 * @AshokSaravanan222
 * 11/16/2024
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Text } from "@mantine/core";
import { getPracticeExam } from "@/utils/queries/get-practice-exam";
import { getPracticeQuestions } from "@/utils/queries/get-practice-questions";
import { Stack, Flex, Group } from "@mantine/core";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { getUser } from "@/utils/queries/get-user";
import DeleteExamModal from "@/components/DeleteExamModal";
import QuestionSolutionExam from "@/components/QuestionSolutionExam";
import { getClass } from "@/utils/queries/get-class";

export default function PracticeExamPage({ params }: { params: { examId: string, classId: string } }) {

    const supabase = useSupabaseBrowser();

    const { data: practiceExam } = useQuery({
        queryKey: ["practiceExam", params.examId],
        queryFn: () => getPracticeExam(supabase, params.examId),
    });

    const { data: classData } = useQuery({
        queryKey: ["class", params. classId],
        queryFn: () => getClass(supabase, params.classId)
    })

    const { data: practiceQuestions } = useQuery({
        queryKey: ["practiceQuestions", params.examId],
        queryFn: () => getPracticeQuestions(supabase, params.examId),
    });

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });


    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${practiceExam?.class}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>
                                {practiceExam?.name}
                            </Text>
                        </Group>
                        <Group>
                            <DeleteExamModal
                                exam={practiceExam}
                                user={user ?? undefined}
                                classId={practiceExam?.class ?? ""}
                            />
                        </Group>
                    </Flex>
                        <QuestionSolutionExam
                            classId={params.classId}
                            className={classData?.title ?? ""}
                            questions={
                            practiceQuestions
                                ? practiceQuestions.map((q) => ({ question: q.question, solution: q.solution }))
                                : []        
                            }
                            practiceExam={practiceExam}
                            practiceQuestions={practiceQuestions}
                        />
                </Stack>
            </Container>
        </>
    );
}
