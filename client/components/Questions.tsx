/**
 * Questions.tsx
 * Will show all of the questions in the generation
 * @AshokSaravanan222
 * 11-16-2024
 */

import { Question } from "@/types";
import { Box, Card, Flex, FloatingIndicator, Group, Skeleton, Stack, Tabs, Text, Title, Modal, TextInput, Button, ActionIcon, Tooltip } from "@mantine/core";
import { useState } from "react";
import classes from "./Demo.module.css";
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { IconCheck, IconX } from '@tabler/icons-react';
import Latex from "./Latex";

type QuestionsProps = {
    questions: Question[]
    onUpdateStatus: (questionId: string, approved: boolean, rejectionReason?: string) => void
}

// Helper function to process text containing LaTeX
const ProcessLatexString = ({ text }: { text: string }) => {
    // Split by LaTeX delimiters $$ for block math or $ for inline math
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('$$') && part.endsWith('$$')) {
                    // Block math
                    const math = part.slice(2, -2);
                    return <BlockMath key={index}>{math}</BlockMath>;
                } else if (part.startsWith('$') && part.endsWith('$')) {
                    // Inline math
                    const math = part.slice(1, -1);
                    return <InlineMath key={index}>{math}</InlineMath>;
                } else {
                    // Regular text
                    return <span key={index}>{part}</span>;
                }
            })}
        </>
    );
};

export default function Questions({ questions, onUpdateStatus }: QuestionsProps) {
    const [rootRef, setRootRef] = useState<HTMLDivElement | null>(null);
    const [tabValue, setTabValue] = useState<string | null>('1');
    const [controlsRefs, setControlsRefs] = useState<Record<string, HTMLButtonElement | null>>({});
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    console.log("Questions", questions);

    const setControlRef = (val: string) => (node: HTMLButtonElement) => {
        controlsRefs[val] = node;
        setControlsRefs(controlsRefs);
    };

    const getMultipartQuestions = (questions: Question[]): Record<string, Question[]> => {
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

        return orderedQuestions
    }

    const handleApprove = (questionId: string) => {
        onUpdateStatus(questionId, true);
    };

    const handleReject = (questionId: string) => {
        setSelectedQuestion(questionId);
        setModalOpen(true);
    };

    const handleSubmitRejection = () => {
        if (selectedQuestion) {
            onUpdateStatus(selectedQuestion, false, rejectionReason);
            setModalOpen(false);
            setRejectionReason('');
            setSelectedQuestion(null);
        }
    };

    const QuestionActions = ({ question }: { question: Question }) => {
        if (question.approved === true) {
            return <Flex gap="xs" p="xs"><IconCheck size={20} color="green" /></Flex>;
        } else if (question.approved === false) {
            return <Flex gap="xs" p="xs"><Tooltip label={question.reason}><IconX size={20} color="red" /></Tooltip></Flex>;
        } else {
            return (
                <Flex gap="xs" p="xs">
                    <ActionIcon
                        variant="subtle"
                        color="green"
                        onClick={() => handleApprove(question.id)}
                    >
                        <IconCheck size={20} />
                    </ActionIcon>
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleReject(question.id)}
                    >
                        <IconX size={20} />
                    </ActionIcon>
                </Flex>
            );
        }
    };

    return (
        <>
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
                            {questions && questions.length > 0 ? getAllQuestionsInOrder(questions).map(
                                (item, index) => {
                                    if (Array.isArray(item)) {
                                        return (
                                            <Box key={index} className="multipart-question">
                                                <h3 className="question-number"><Latex>{`${index + 1}.`}</Latex></h3>
                                                {item.map((question, subIndex) => (
                                                    <Box 
                                                        key={`${index}-${subIndex}`} 
                                                        className="question-container"
                                                    >
                                                        <Flex justify="space-between" align="center">
                                                            <h3 className="question-text">
                                                                <Latex>{`${String.fromCharCode(97 + subIndex)}) ${question.question}`}</Latex>
                                                            </h3>
                                                            <QuestionActions question={question} />
                                                        </Flex>
                                                        <Box className="options-container">
                                                            {question.option_a && <h4><Latex>{`A. ${question.option_a}`}</Latex></h4>}
                                                            {question.option_b && <h4><Latex>{`B. ${question.option_b}`}</Latex></h4>}
                                                            {question.option_c && <h4><Latex>{`C. ${question.option_c}`}</Latex></h4>}
                                                            {question.option_d && <h4><Latex>{`D. ${question.option_d}`}</Latex></h4>}
                                                            {question.option_e && <h4><Latex>{`E. ${question.option_e}`}</Latex></h4>}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    } else {
                                        return (
                                            <Box key={index} className="single-question">
                                                <Flex justify="space-between" align="center">
                                                    <h3><Latex>{`${index + 1}. ${item.question}`}</Latex></h3>
                                                    <QuestionActions question={item} />
                                                </Flex>
                                                <Box style={{ paddingLeft: "3rem", marginTop: "-1rem" }}>
                                                    {item.option_a && <h4><Latex>{`A. ${item.option_a || ""}`}</Latex></h4>}
                                                    {item.option_b && <h4><Latex>{`B. ${item.option_b || ""}`}</Latex></h4>}
                                                    {item.option_c && <h4><Latex>{`C. ${item.option_c || ""}`}</Latex></h4>}
                                                    {item.option_d && <h4><Latex>{`D. ${item.option_d || ""}`}</Latex></h4>}
                                                    {item.option_e && <h4><Latex>{`E. ${item.option_e || ""}`}</Latex></h4>}
                                                </Box>
                                            </Box>
                                        );
                                    }
                                }
                            ) : <Box p={"lg"}><Text>No questions found.</Text></Box>}
                        </Flex>
                    </Tabs.Panel>
                    <Tabs.Panel value="2">
                        <Flex direction="column" gap="md">
                            {questions && questions.length > 0 ? getAllQuestionsInOrder(questions).map(
                                (item, index) => {
                                    if (Array.isArray(item)) {
                                        // Handle multipart question solutions
                                        return (
                                            <Box key={index}>
                                                <h3><Latex>{`${index + 1}.`}</Latex></h3>
                                                {item.map((question: Question, subIndex: number) => (
                                                    <Box key={`${index}-${subIndex}`} style={{ paddingLeft: "3rem", marginTop: "-1rem" }}>
                                                        <Flex justify="space-between" align="center">
                                                            <h3><Latex>{`${String.fromCharCode(97 + subIndex)}) ${question.question}`}</Latex></h3>
                                                            <QuestionActions question={item[0]} />
                                                        </Flex>
                                                        <Box style={{ paddingLeft: "3rem", marginTop: "-1rem" }}>
                                                            {question.explanation_a && <h4 style={{ color: question.solution === "A" ? "red" : "black" }}><Latex>{`A. ${question.explanation_a || ""}`}</Latex></h4>}
                                                            {question.explanation_b && <h4 style={{ color: question.solution === "B" ? "red" : "black" }}><Latex>{`B. ${question.explanation_b || ""}`}</Latex></h4>}
                                                            {question.explanation_c && <h4 style={{ color: question.solution === "C" ? "red" : "black" }}><Latex>{`C. ${question.explanation_c || ""}`}</Latex></h4>}
                                                            {question.explanation_d && <h4 style={{ color: question.solution === "D" ? "red" : "black" }}><Latex>{`D. ${question.explanation_d || ""}`}</Latex></h4>}
                                                            {question.explanation_e && <h4 style={{ color: question.solution === "E" ? "red" : "black" }}><Latex>{`E. ${question.explanation_e || ""}`}</Latex></h4>}
                                                            {question.solution !== "A" && question.solution !== "B" && question.solution !== "C" && question.solution !== "D" && question.solution !== "E" && (
                                                                <h4 style={{ color: "red" }}>
                                                                    <Latex>{`${question.solution}`}</Latex>
                                                                </h4>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    } else {
                                        // Handle single question solutions
                                        return (
                                            <Box key={index}>
                                                <Flex justify="space-between" align="center">
                                                    <h3><Latex>{`${index + 1}. ${item.question}`}</Latex></h3>
                                                    <QuestionActions question={item} />
                                                </Flex>
                                                <Box style={{ paddingLeft: "3rem", marginTop: "-1rem" }}>
                                                    {item.explanation_a && <h4 style={{ color: item.solution === "A" ? "red" : "black" }}><Latex>{`A. ${item.explanation_a || ""}`}</Latex></h4>}
                                                    {item.explanation_b && <h4 style={{ color: item.solution === "B" ? "red" : "black" }}><Latex>{`B. ${item.explanation_b || ""}`}</Latex></h4>}
                                                    {item.explanation_c && <h4 style={{ color: item.solution === "C" ? "red" : "black" }}><Latex>{`C. ${item.explanation_c || ""}`}</Latex></h4>}
                                                    {item.explanation_d && <h4 style={{ color: item.solution === "D" ? "red" : "black" }}><Latex>{`D. ${item.explanation_d || ""}`}</Latex></h4>}
                                                    {item.explanation_e && <h4 style={{ color: item.solution === "E" ? "red" : "black" }}><Latex>{`E. ${item.explanation_e || ""}`}</Latex></h4>}
                                                    {item.solution !== "A" && item.solution !== "B" && item.solution !== "C" && item.solution !== "D" && item.solution !== "E" && (
                                                        <h4 style={{ color: "red" }}>
                                                            <Latex>{`${item.solution}`}</Latex>
                                                        </h4>
                                                    )}
                                                </Box>
                                            </Box>
                                        );
                                    }
                                }
                            ) : <Box p={"lg"}><Text>No solutions found.</Text></Box>}
                        </Flex>
                    </Tabs.Panel>
                </Tabs>
            </Card>

            <Modal
                opened={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setRejectionReason('');
                    setSelectedQuestion(null);
                }}
                title="Provide Rejection Reason"
            >
                <Stack>
                    <TextInput
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.currentTarget.value)}
                        placeholder="Enter reason for rejection"
                        required
                    />
                    <Button onClick={handleSubmitRejection}>Submit</Button>
                </Stack>
            </Modal>
        </>
    )
}