/**
 * QuestionSolutionTopic.tsx
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
import { Topic, Question } from "@/types";
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';


type QuestionSolutionTopicProps = {
    topic: Topic | undefined
    topicQuestions: Question[] | undefined
}

export default function QuestionSolutionTopic({ topic, topicQuestions }: QuestionSolutionTopicProps) {
    const [regenerateLoading, setRegenerateLoading] = useState(false);
    const queryClient = useQueryClient();

    const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
    const [tabValue, setTabValue] = useState<string | null>('1');
    const [controlsRefs, setControlsRefs] = useState<Record<string, HTMLButtonElement | null>>({});
    const setControlRef = (val: string) => (node: HTMLButtonElement) => {
        controlsRefs[val] = node;
        setControlsRefs(controlsRefs);
    };

    const getMultipartQuestions = (questions: Question[]) => {
        const allMultipartQuestions = questions.filter(question => question.multipart !== null);
        return allMultipartQuestions.reduce((groups, question) => {
            const multipartId = question.multipart;
            if (!multipartId) {
                return groups;
            }
            if (!groups[multipartId]) {
                groups[multipartId] = [];
            }
            groups[multipartId].push(question);
            return groups;
        }, {} as Record<string, Question[]>);
    }

    const getSinglePartQuestions = (questions: Question[]) => {
        return questions.filter(question => question.multipart === null);
    }

    const getAllQuestionsInOrder = (questions: Question[]): (Question | Question[])[] => {
        const multipartGroups = getMultipartQuestions(questions);
        const singleQuestions = getSinglePartQuestions(questions);
        
        // Create an array of all questions with multipart questions grouped together
        const orderedQuestions = questions.reduce((acc: (Question | Question[])[], question) => {
            if (question.multipart === null) {
                // Single questions go directly into the array
                acc.push(question);
            } else if (!acc.includes(multipartGroups[question.multipart])) {
                // Add multipart group only if we haven't seen it before
                acc.push(multipartGroups[question.multipart]);
            }
            return acc;
        }, []);

        return orderedQuestions;
    }

    return (
        <Skeleton visible={regenerateLoading}>
            <Card withBorder>
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
                    </Flex>

                    <Tabs.Panel value="1">
                        <Flex direction="column" gap="md">
                            {topicQuestions && topicQuestions.length > 0 ? getAllQuestionsInOrder(topicQuestions).map(
                                (item, index) => {
                                    if (Array.isArray(item)) {
                                        return (
                                            <Box key={index}>
                                                <h3><Latex>{`${index + 1}.`}</Latex></h3>
                                                {item.map((question, subIndex) => (
                                                    <Box key={`${index}-${subIndex}`}>
                                                        <h3><Latex>{`${String.fromCharCode(97 + subIndex)}. ${question.question}`}</Latex></h3>
                                                        <h4><Latex>{`A. ${question.option_a || ""}`}</Latex></h4>
                                                        <h4><Latex>{`B. ${question.option_b || ""}`}</Latex></h4>
                                                        <h4><Latex>{`C. ${question.option_c || ""}`}</Latex></h4>
                                                        <h4><Latex>{`D. ${question.option_d || ""}`}</Latex></h4>
                                                        <h4><Latex>{`E. ${question.option_e || ""}`}</Latex></h4>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    } else {
                                        return (
                                            <Box key={index}>
                                                <h3><Latex>{`${index + 1}. ${item.question}`}</Latex></h3>
                                                <h4><Latex>{`A. ${item.option_a || ""}`}</Latex></h4>
                                                <h4><Latex>{`B. ${item.option_b || ""}`}</Latex></h4>
                                                <h4><Latex>{`C. ${item.option_c || ""}`}</Latex></h4>
                                                <h4><Latex>{`D. ${item.option_d || ""}`}</Latex></h4>
                                                <h4><Latex>{`E. ${item.option_e || ""}`}</Latex></h4>
                                            </Box>
                                        );
                                    }
                                }
                            ) : <Box p={"lg"}><Text>No questions found.</Text></Box>}
                        </Flex>
                    </Tabs.Panel>
                    <Tabs.Panel value="2">
                        <Flex direction="column" gap="md">
                            {topicQuestions && topicQuestions.length > 0 ? getAllQuestionsInOrder(topicQuestions).map(
                                (item, index) => {
                                    if (Array.isArray(item)) {
                                        return (
                                            <Box key={index}>
                                                <h3><Latex>{`${index + 1}.`}</Latex></h3>
                                                {item.map((question, subIndex) => (
                                                    <Box key={`${index}-${subIndex}`}>
                                                        <h3><Latex>{`${String.fromCharCode(97 + subIndex)}. ${question.question}`}</Latex></h3>
                                                        <h4 style={{ color: question.solution === "A" ? "red" : "black" }}><Latex>{`A. ${question.explanation_a || ""}`}</Latex></h4>
                                                        <h4 style={{ color: question.solution === "B" ? "red" : "black" }}><Latex>{`B. ${question.explanation_b || ""}`}</Latex></h4>
                                                        <h4 style={{ color: question.solution === "C" ? "red" : "black" }}><Latex>{`C. ${question.explanation_c || ""}`}</Latex></h4>
                                                        <h4 style={{ color: question.solution === "D" ? "red" : "black" }}><Latex>{`D. ${question.explanation_d || ""}`}</Latex></h4>
                                                        <h4 style={{ color: question.solution === "E" ? "red" : "black" }}><Latex>{`E. ${question.explanation_e || ""}`}</Latex></h4>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    } else {
                                        return (
                                            <Box key={index}>
                                                <h3><Latex>{`${index + 1}. ${item.question}`}</Latex></h3>
                                                <h4 style={{ color: item.solution === "A" ? "red" : "black" }}><Latex>{`A. ${item.explanation_a || ""}`}</Latex></h4>
                                                <h4 style={{ color: item.solution === "B" ? "red" : "black" }}><Latex>{`B. ${item.explanation_b || ""}`}</Latex></h4>
                                                <h4 style={{ color: item.solution === "C" ? "red" : "black" }}><Latex>{`C. ${item.explanation_c || ""}`}</Latex></h4>
                                                <h4 style={{ color: item.solution === "D" ? "red" : "black" }}><Latex>{`D. ${item.explanation_d || ""}`}</Latex></h4>
                                                <h4 style={{ color: item.solution === "E" ? "red" : "black" }}><Latex>{`E. ${item.explanation_e || ""}`}</Latex></h4>
                                            </Box>
                                        );
                                    }
                                }
                            ) : <Box p={"lg"}><Text>No solutions found.</Text></Box>}
                        </Flex>
                    </Tabs.Panel>
                </Tabs>
            </Card >
        </Skeleton>
    )

}