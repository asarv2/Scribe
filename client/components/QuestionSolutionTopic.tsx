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
                            {topicQuestions && topicQuestions.length > 0 ? topicQuestions.map(
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
                            {topicQuestions && topicQuestions.length > 0 ? topicQuestions.map(
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