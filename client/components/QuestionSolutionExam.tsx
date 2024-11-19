/**
 * QuestionSolution.tsx
 * Will show the questions and solutions in a tab format.
 * @AshokSaravanan222
 * 11-16-2024
 */

import { Card, Tabs, FloatingIndicator, Box, Text, Flex, Group, Tooltip, Skeleton } from "@mantine/core"
import { useState } from "react";
import classes from "./Demo.module.css";
import { IconReload } from "@tabler/icons-react";
import { IconDownload } from "@tabler/icons-react";
import DeleteExamModal from "./DeleteExamModal";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { PracticeQuestion } from "@/types";
import { PracticeExam } from "@/types";
import { regeneratePracticeExam } from "@/utils/services/gemini";
import { createPracticeQuestions } from "@/utils/services/questions";
import { jsPDF } from "jspdf";
import { marked } from "marked";
import Markdown from "markdown-to-jsx";
import { getSlideDocs } from "@/utils/queries/get-slide-docs";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";


type QuestionSolutionExamProps = {
    className: string
    classId: string
    questions: { question: string, solution: string }[]
    practiceExam: PracticeExam | undefined
    practiceQuestions: PracticeQuestion[] | undefined

}

export default function QuestionSolutionExam({ className, classId, questions, practiceExam, practiceQuestions }: QuestionSolutionExamProps) {
    const [regenerateLoading, setRegenerateLoading] = useState(false);
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser()

    const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
    const [tabValue, setTabValue] = useState<string | null>('1');
    const [controlsRefs, setControlsRefs] = useState<Record<string, HTMLButtonElement | null>>({});
    const setControlRef = (val: string) => (node: HTMLButtonElement) => {
        controlsRefs[val] = node;
        setControlsRefs(controlsRefs);
    };

    const handleRegenerate = async () => {
        setRegenerateLoading(true);
        try {

            if (!practiceQuestions || practiceQuestions.length === 0) {
                throw new Error('No documents available to regenerate summary.');
            }
            if (!practiceExam) {
                throw new Error('Practice exam data not available');
            }

            const textSummaries: string[][] = [];
            const imgPaths: string[][] = [];
            for (const slide of practiceExam.slides) {
                const documents = await getSlideDocs(supabase, slide);
                const slideTextSummaries = documents?.map(d => d.content).filter(content => content !== undefined) as string[];
                const slideImgPaths = documents?.map(d => `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${slide}/page_${d.page}.png`).filter(path => path !== undefined) as string[];
                textSummaries.push(slideTextSummaries);
                imgPaths.push(slideImgPaths);
            }

            const summary = await regeneratePracticeExam(className, textSummaries, imgPaths, practiceQuestions, practiceExam.num_questions);
            if (!summary) {
                throw new Error('Failed to regenerate summary');
            }

            const created = await createPracticeQuestions(practiceExam.id, summary.questions);
            if (!created) {
                throw new Error('Failed to create practice questions');
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["practiceQuestions", practiceExam.id]
                });
            }
            notifications.show({
                title: "Regenerate",
                message: "Regenerate successful",
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to regenerate",
                message: error.message,
                color: "red",
            });
        } finally {
            setRegenerateLoading(false);
        }
    }

    const handleDownload = async () => {
        try {
            if (!practiceQuestions || practiceQuestions.length === 0) {
                throw new Error('No practice questions available to download.');
            }

            const doc = new jsPDF('p', 'pt', 'a4');
            const questionContent = practiceQuestions.map(q => q.question).join("<br><br>");
            const solutionContent = practiceQuestions.map(q => q.question + "<br><br>" + `<span style="color: red;">${q.solution}</span>`).join("<br><br>");
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
            const pageHeight = doc.internal.pageSize.getHeight();

            doc.html(htmlContent, {
                x: 40,
                y: 40,
                width: pageWidth - 80, // Account for margins
                windowWidth: pageWidth,
                margin: [20, 20],
                callback: function (doc) {
                    doc.save(`${practiceExam?.name || 'practice-exam'}.pdf`);
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
        <Skeleton visible={regenerateLoading}>
            <Card withBorder>
                <Tabs variant="none" value={tabValue} onChange={setTabValue} pos="relative" h={500} style={{ overflowY: 'auto' }}>
                    <Flex justify="space-between">
                        <Tabs.List ref={setRootRef}>
                            <Tabs.Tab value="1" ref={setControlRef('1')} className={classes.tab}>
                                Practice Questions
                            </Tabs.Tab>
                            <Tabs.Tab value="2" ref={setControlRef('2')} className={classes.tab}>
                                Solutions
                            </Tabs.Tab>
                            <FloatingIndicator
                                target={tabValue ? controlsRefs[tabValue] : null}
                                parent={rootRef}
                                className={classes.indicator}
                            />
                        </Tabs.List>
                        <Group p={"sm"}>
                            <Tooltip label="Regenerate">
                                <IconReload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleRegenerate} />
                            </Tooltip>
                            <Tooltip label="Download PDF">
                                <IconDownload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleDownload} />
                            </Tooltip>
                        </Group>

                    </Flex>

                    <Tabs.Panel value="1">
                        <Flex direction="column" gap="md">
                            {questions && questions.length > 0 ? questions.map(
                                (question, index) => (
                                    <Box key={index}>
                                        <h3><Markdown>{`${index + 1}. ${question.question}`}</Markdown></h3>
                                    </Box>
                                )
                            ) : <Box p={"lg"}><Text>No questions found.</Text></Box>}
                        </Flex>
                    </Tabs.Panel>
                    <Tabs.Panel value="2">
                        <Flex direction="column" gap="md">
                            {questions && questions.length > 0 ? questions.map(
                                (question, index) => (
                                    <Box key={index}>
                                        <h3><Markdown>{`${index + 1}. ${question.question}`}</Markdown></h3>
                                        <Text c="red" size="lg" fw={500}><Markdown>{question.solution}</Markdown></Text>
                                    </Box>
                                )
                            ) : <Box p={"lg"}><Text>No solutions found.</Text></Box>}
                        </Flex>
                    </Tabs.Panel>
                </Tabs>
            </Card >
        </Skeleton>
    )

}