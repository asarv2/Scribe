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
import DeleteGenerationModal from "@/components/DeleteGenerationModal";
import QuestionSolutionLecture from "@/components/QuestionSolutionSlide";
import NotesSummary from "@/components/NotesSummary";
import Questions from "@/components/Questions";
import { getGeneration } from "@/utils/queries/get-generation";
import { getGenerationProblems } from "@/utils/queries/get-generation-problems";
import { getGenerationSummaries } from "@/utils/queries/get-generation-summaries";
import DownloadGenerationModal from "@/components/DownloadGenerationModal";
import { Question } from "@/types";
import { updateQuestionStatus } from "@/utils/services/questions";
import Latex from "@/components/Latex";

export default function Generation({ params }: { params: { classId: string, generationId: string } }) {
    const queryClient = useQueryClient();
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

    const { data: generationSummaries, isLoading: loadingGenerationSummaries } = useQuery({
        queryKey: ["generationSummaries", generationId],
        queryFn: () => getGenerationSummaries(supabase, generation ? [generation] : []),
        enabled: !!generation
    })

    const { data: generationProblems, isLoading: loadingGenerationProblems } = useQuery({
        queryKey: ["generationProblems", generationId],
        queryFn: () => getGenerationProblems(supabase, generation ? [generation] : []),
        enabled: !!generation
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const onUpdateStatus = async (questionId: string, approved: boolean, rejectionReason?: string) => {
        try {
            const { success, error } = await updateQuestionStatus(questionId, approved, rejectionReason);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ["generationProblems"] });
                notifications.show({
                    title: "Question status updated",
                    message: "The question status has been updated successfully",
                    color: "green",
                });
            } else {
                throw new Error(error);
            }
        } catch (error: any) {
            notifications.show({
                title: "Error updating question status",
                message: error?.message ?? "An error occurred while updating the question status",
                color: "red",
            });
        }
    }

    const getGenerationLatex = () => {
        if (generation?.type === "summary") {
            return generationSummaries?.[0]?.content ?? "";
        } else {
            if (!generationProblems?.length) return "";

            // Helper function to format a single question
            const formatQuestion = (question: Question, index: number, subIndex?: string) => {
                const questionNumber = subIndex
                    ? `${index + 1}${subIndex}`
                    : `${index + 1}`;

                if (question.mcq) {
                    return `${questionNumber}. ${question.question}\n` +
                        `A. ${question.option_a || ""}\n` +
                        `B. ${question.option_b || ""}\n` +
                        `C. ${question.option_c || ""}\n` +
                        `D. ${question.option_d || ""}\n` +
                        `E. ${question.option_e || ""}\n\n`;
                } else {
                    return `${questionNumber}. ${question.question}\n`
                }
            };

            // Helper function to format a single solution
            const formatSolution = (question: Question, index: number, subIndex?: string) => {
                const questionNumber = subIndex
                    ? `${index + 1}${subIndex}`
                    : `${index + 1}`;

                if (question.mcq) {
                    return `${questionNumber}. ${question.question}\n` +
                        `A. ${question.option_a || ""} ${question.solution === "A" ? "(CORRECT)" : ""}\n` +
                        `B. ${question.option_b || ""} ${question.solution === "B" ? "(CORRECT)" : ""}\n` +
                        `C. ${question.option_c || ""} ${question.solution === "C" ? "(CORRECT)" : ""}\n` +
                        `D. ${question.option_d || ""} ${question.solution === "D" ? "(CORRECT)" : ""}\n` +
                        `E. ${question.option_e || ""} ${question.solution === "E" ? "(CORRECT)" : ""}\n\n`;
                } else {
                    return `${questionNumber}. ${question.question}\n` + `ANSWER: ${question.solution}`
                }
            };

            // Group questions by multipart
            const multipartGroups: Record<string, Question[]> = {};
            const singleQuestions = generationProblems.filter(q => {
                if (q.multipart) {
                    if (!multipartGroups[q.multipart]) {
                        multipartGroups[q.multipart] = [];
                    }
                    multipartGroups[q.multipart].push(q);
                    return false;
                }
                return true;
            });

            // Build the questions section
            let questionsSection = "QUESTIONS\n";
            let currentIndex = 0;

            generationProblems.forEach(question => {
                if (question.multipart === null) {
                    // Single question
                    questionsSection += formatQuestion(question, currentIndex);
                    currentIndex++;
                } else if (multipartGroups[question.multipart]?.[0] === question) {
                    // First question of a multipart group
                    questionsSection += `${currentIndex + 1}.\n`;
                    multipartGroups[question.multipart].forEach((q, subIndex) => {
                        questionsSection += formatQuestion(q, currentIndex, `) ${String.fromCharCode(97 + subIndex)}`);
                    });
                    currentIndex++;
                }
            });

            // Build the solutions section
            let solutionsSection = "\nSOLUTIONS\n";
            currentIndex = 0;

            generationProblems.forEach(question => {
                if (question.multipart === null) {
                    // Single question
                    solutionsSection += formatSolution(question, currentIndex);
                    currentIndex++;
                } else if (multipartGroups[question.multipart]?.[0] === question) {
                    // First question of a multipart group
                    solutionsSection += `${currentIndex + 1}.\n`;
                    multipartGroups[question.multipart].forEach((q, subIndex) => {
                        solutionsSection += formatSolution(q, currentIndex, `) ${String.fromCharCode(97 + subIndex)}`);
                    });
                    currentIndex++;
                }
            });

            return questionsSection + solutionsSection;
        }
    }

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>{generation?.name}</Text>
                        </Group>
                        <Group>
                            <DownloadGenerationModal generationId={generationId} generationTitle={`${generation?.name ?? ""} - ${generation?.type === "summary" ? "Summary" : "Questions"}`} user={user ?? undefined} classId={classId} generationLatex={getGenerationLatex()} />
                            <DeleteGenerationModal generationId={generationId} generationTitle={generation?.name ?? ""} user={user ?? undefined} classId={classId} />
                        </Group>
                    </Flex>
                    {generation?.type === "summary" ? (
                        <Stack>
                            <Card withBorder style={{ overflowY: 'auto' }} h={600}>
                                <Flex justify="space-between">
                                    <Title order={3}>Summary</Title>
                                </Flex>
                                <Skeleton visible={loadingGenerationSummaries}>
                                    <Latex>{generationSummaries?.[0]?.content ?? ""}</Latex>
                                </Skeleton>
                            </Card>
                        </Stack>
                    ) : (
                        <Stack>
                            <Questions
                                questions={generationProblems ?? []}
                                onUpdateStatus={onUpdateStatus}
                            />
                        </Stack>
                    )}
                </Stack>
            </Container>

        </>
    );
}