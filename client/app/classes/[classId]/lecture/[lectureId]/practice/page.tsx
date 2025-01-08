/**
 * app/classes/[classId]/lecture/[lectureId]/practice/page.tsx
 * The page for a specific lecture in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import { Button, Container, em, Flex, Grid, Group, Stack, Text, Tooltip } from "@mantine/core";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import NotesSummary from "@/components/NotesSummary";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconDownload, IconRefresh } from '@tabler/icons-react';
import { getLectureQuestions } from "@/utils/queries/get-questions";
import QuestionSolutionSlide from "@/components/QuestionSolutionSlide";
import { getLecture } from "@/utils/queries/get-lecture";
import jsPDF from "jspdf";
import { marked } from "marked";
import { notifications } from "@mantine/notifications";

export default function LecturePractice({ params }: { params: { classId: string, lectureId: string } }) {

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const lectureId = params.lectureId;
    const router = useRouter();


    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    
    const { data: questions } = useQuery({
        queryKey: ["lectureQuestions", lectureId],
        queryFn: () => getLectureQuestions(supabase, lectureId),
    });
    
    const { data: lecture } = useQuery({
        queryKey: ["lecture", lectureId],
        queryFn: () => getLecture(supabase, lectureId),
    });

    const handleDownload = async () => {
        try {
            if (!questions || questions.length === 0) {
                throw new Error('No practice questions available to download.');
            }

            const doc = new jsPDF('p', 'pt', 'a4');
            const questionContent = questions.map(q => q.question).join("<br><br>");
            const solutionContent = questions.map(q => q.question + "<br><br>" + `<span style="color: red;">${q.solution}</span>`).join("<br><br>");
            const content = `QUESTIONS<br><br>${questionContent}<br><br><br><br><br><br>SOLUTIONS<br><br>${solutionContent}`;

            // Convert Markdown to HTML
            const htmlContent = `
            <style>
              body {
                width: 100%;
                max-width: 100%;
                margin: 0;
                padding: 0;
                font-family: Helvetica, Arial, sans-serif;
                font-size: 12pt;
                line-height: 1.2;
              }
            </style>
            ${marked(content)}
          `;

            // Adjust page width
            const pageWidth = doc.internal.pageSize.getWidth();

            doc.html(htmlContent, {
                x: 40,
                y: 40,
                width: pageWidth - 80, // Account for margins
                windowWidth: pageWidth,
                margin: [20, 20],
                callback: function (doc) {
                    doc.save(`${lecture?.name || 'lecture'}.pdf`);
                },
            });

            notifications.show({
                title: 'Download',
                message: 'Download successful',
                color: 'blue',
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: 'Failed to download',
                message: error.message,
                color: 'red',
            });
        }
    }


    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} onClick={() => router.back()} />
                            <Text size="xl" fw={700} mb={6}>Lecture {lecture?.note_number} Practice ({lecture?.name})</Text>
                        </Group>
                        <Group p={"sm"}>
                            <Tooltip label="Download PDF">
                                <IconDownload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleDownload} />
                            </Tooltip>
                        </Group>
                    </Flex>
                    <QuestionSolutionSlide lecture={lecture} lectureQuestions={questions} />
                </Stack>
            </Container>

        </>
    );


}