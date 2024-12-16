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
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Slide, SlideData, SlideQuestion } from "@/types";
import { regenerateSlideQuestions } from "@/utils/services/gemini";
import { createSlideQuestions } from "@/utils/services/questions";
import { jsPDF } from "jspdf";
import { marked } from "marked";
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';


type QuestionSolutionSliderops = {
    className: string
    questions: { question: string, solution: string }[]
    slide: Slide | undefined
    slideQuestions: SlideQuestion[] | undefined
    documents: SlideData[] | undefined
}

export default function QuestionSolutionSlide({ className, questions, slide, slideQuestions, documents }: QuestionSolutionSliderops) {
    const [regenerateLoading, setRegenerateLoading] = useState(false);
    const queryClient = useQueryClient();

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

            if (!slideQuestions || slideQuestions.length === 0) {
                throw new Error('No documents available to regenerate summary.');
            }
            if (!slide) {
                throw new Error('Slide data not available');
            }

            const textSummaries = documents?.map(d => d.content).filter(content => content !== undefined) as string[];
            const imgPaths = documents?.map(d => `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${slide.class}/${slide.id}/page_${d.page}.png`).filter(path => path !== undefined) as string[];
            console.log(textSummaries, imgPaths);

            const summary = await regenerateSlideQuestions(className, textSummaries, imgPaths, slideQuestions);
            if (!summary) {
                throw new Error('Failed to regenerate summary');
            }


            const created = await createSlideQuestions(slide.id, summary.questions);
            if (!created) {
                throw new Error('Failed to create practice questions');
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["questions", slide.id]
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
            if (!slideQuestions || slideQuestions.length === 0) {
                throw new Error('No practice questions available to download.');
            }

            const doc = new jsPDF('p', 'pt', 'a4');
            const questionContent = slideQuestions.map(q => q.question).join("<br><br>");
            const solutionContent = slideQuestions.map(q => q.question + "<br><br>" + `<span style="color: red;">${q.solution}</span>`).join("<br><br>");
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
                    doc.save(`${slide?.name || 'slide'}.pdf`);
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
            <Card withBorder h={600}>
                <Tabs variant="none" value={tabValue} onChange={setTabValue} pos="relative" style={{ overflowY: 'auto' }}>
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
                                        <h3><Latex>{`${index + 1}. ${question.question}`}</Latex></h3>
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
                                        <h3><Latex>{`${index + 1}. ${question.question}`}</Latex></h3>
                                        <Text c="red" size="lg" fw={500}><Latex>{question.solution}</Latex></Text>
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