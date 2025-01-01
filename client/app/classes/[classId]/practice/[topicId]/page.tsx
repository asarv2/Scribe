/**
 * app/classes/[classId]/practice/[topicId]/page.tsx
 * This page is for the practice exam. It will show the questions and the user can take the exam.
 * @AshokSaravanan222
 * 11/16/2024
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import { Container, Text, Tooltip } from "@mantine/core";
import { Stack, Flex, Group } from "@mantine/core";
import Link from "next/link";
import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import { getUser } from "@/utils/queries/get-user";
import { getClass } from "@/utils/queries/get-class";
import { getTopicQuestions } from "@/utils/queries/get-questions";
import QuestionSolutionSlide from "@/components/QuestionSolutionSlide";
import QuestionSolutionTopic from "@/components/QuestionSolutionTopic";
import { getTopic } from "@/utils/queries/get-topic";
import jsPDF from "jspdf";
import { marked } from "marked";
import { notifications } from "@mantine/notifications";
import Latex from "react-latex-next";
import { useEffect } from "react";

export default function PracticeTopicPage({ params }: { params: { topicId: string, classId: string } }) {

    const supabase = useSupabaseBrowser();

    const { data: topic } = useQuery({
        queryKey: ["topic", params.topicId],
        queryFn: () => getTopic(supabase, params.topicId),
    });

    const { data: questions } = useQuery({
        queryKey: ["topicQuestions", params.topicId],
        queryFn: () => getTopicQuestions(supabase, topic!.id),
        enabled: !!topic,
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
                    doc.save(`${topic?.title || 'topic'}.pdf`);
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

    useEffect(() => {
        console.log(questions);
    }, [questions]);


    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${params.classId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}><Latex>{topic?.title || ""} Practice</Latex></Text>
                        </Group>
                        <Group p={"sm"}>
                            <Tooltip label="Download PDF">
                                <IconDownload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleDownload} />
                            </Tooltip>
                        </Group>
                    </Flex>
                    <QuestionSolutionTopic topic={topic} topicQuestions={questions} />
                </Stack>
            </Container>

        </>
    );


}
