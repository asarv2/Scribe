/**
 * QuestionViewer.tsx
 * Used to view question document
 * 03/20/2025
 */

import React, { useState } from 'react';
import { Question, ViewerMode } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center, Stack, Radio, RadioGroup, Switch } from '@mantine/core';
import { IconDownload, IconFileText, IconFileTypography, IconRefresh, IconFile, IconEye, IconEyeOff } from '@tabler/icons-react';
import Latex from '../Latex';
import { getQuestionPDFUrl, getQuestionTeXUrl, getQuestionTextUrl } from '../../utils/services/images';
import { notifications } from '@mantine/notifications';

interface QuestionViewerProps {
    classId: string;
    question: Question;
    viewerMode: ViewerMode;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ classId, question, viewerMode }) => {
    const [loading, setLoading] = useState(false);
    const [showSolution, setShowSolution] = useState(false);

    const handleRetry = async () => {
        try {
            setLoading(true);

            if (!question.message) {
                throw new Error('No message id found');
            }

            const formData = new FormData();
            formData.append("message_id", question.message);
            formData.append("class_id", classId);

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/questions`, {
                method: 'POST',
                body: formData
            });

            notifications.show({
                title: 'Question generated',
                message: 'Question generated successfully',
                color: 'green',
            });
        } catch (error) {
            console.error(error);
            notifications.show({
                title: 'Error generating question',
                message: 'Error generating question',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    }

    const renderMultipleChoice = () => {
        return (
            <Box mt="md">
                <RadioGroup>
                    {question.options && question.options.map((option, index) => (
                        <Radio 
                            key={index} 
                            value={String(index)} 
                            label={<Latex>{option}</Latex>} 
                            mb="xs"
                            readOnly
                        />
                    ))}
                </RadioGroup>
                
                {showSolution && question.answers && question.answers.length > 0 && (
                    <Box mt="lg">
                        <Text fw={700} mb="xs">Correct Answer:</Text>
                        <Text>{question.answers.map((ans, i) => String.fromCharCode(65 + parseInt(ans))).join(', ')}</Text>
                    </Box>
                )}
                
                {showSolution && question.explanations && question.explanations.length > 0 && (
                    <Box mt="lg">
                        <Text fw={700} mb="xs">Explanation:</Text>
                        <Stack>
                            {question.explanations.map((explanation, index) => (
                                <Latex key={index}>{explanation}</Latex>
                            ))}
                        </Stack>
                    </Box>
                )}
            </Box>
        );
    };

    const renderFRQ = () => {
        return (
            <Box mt="md">
                {showSolution && (
                    <>
                        <Text fw={700} mb="xs">Solution:</Text>
                        <Latex>{question.solution}</Latex>
                    </>
                )}
            </Box>
        );
    };

    const renderContent = () => {
        switch (question.generation_status) {
            case 'idle':
                return (
                    <Center style={{ height: '100%' }}>
                        <Text>Waiting to generate question...</Text>
                    </Center>
                );
            case 'generating':
                return (
                    <Center style={{ height: '100%' }}>
                        <Loader />
                        <Text ml="md">Generating question...</Text>
                    </Center>
                );
            case 'error':
                return (
                    <Center style={{ height: '100%', flexDirection: 'column' }}>
                        <Text c="red" mb="md">Error generating question: {question.generation_error}</Text>
                        <Button 
                            leftSection={<IconRefresh size={14} />}
                            color="red"
                            variant="outline"
                            onClick={handleRetry}
                            loading={loading}
                        >
                            Retry
                        </Button>
                    </Center>
                );
            case 'complete':
                return (
                    <>
                        <Group justify="space-between">
                            <Text c="dimmed">Generated at {new Date(question.created_at).toLocaleString()}</Text>
                            <Group>
                                <Switch
                                    checked={showSolution}
                                    onChange={(event) => setShowSolution(event.currentTarget.checked)}
                                    label={showSolution ? "Hide solution" : "Show solution"}
                                    labelPosition="left"
                                    size="sm"
                                />
                                <Menu position="bottom-end" shadow="md">
                                    <Menu.Target>
                                        <ActionIcon>
                                            <IconDownload size={18} />
                                        </ActionIcon>
                                    </Menu.Target>
                                    <Menu.Dropdown>
                                        <Menu.Label>Download as</Menu.Label>
                                        <Menu.Item 
                                            leftSection={<IconFile size={14} />}
                                            component="a"
                                            href={getQuestionPDFUrl(question.message ?? '')}
                                            download
                                        >
                                            PDF Document
                                        </Menu.Item>
                                        <Menu.Item 
                                            leftSection={<IconFileTypography size={14} />}
                                            component="a"
                                            href={getQuestionTeXUrl(question.message ?? '')}
                                            download
                                        >
                                            LaTeX Source
                                        </Menu.Item>
                                        <Menu.Item 
                                            leftSection={<IconFileText size={14} />}
                                            component="a"
                                            href={getQuestionTextUrl(question.message ?? '')}
                                            download
                                        >
                                            Plain Text
                                        </Menu.Item>
                                    </Menu.Dropdown>
                                </Menu>
                            </Group>
                        </Group>
                        
                        <Box mt="md">
                            <Text fw={700} mb="xs">Problem:</Text>
                            <Latex>{question.problem}</Latex>
                            
                            {question.frq ? renderFRQ() : renderMultipleChoice()}
                        </Box>
                    </>
                );
            default:
                return (
                    <Center style={{ height: '100%' }}>
                        <Text>Unknown status</Text>
                    </Center>
                );
        }
    };

    return (
        <Card withBorder p="md" w={viewerMode.open ? "100%" : "60%"}>
            {renderContent()}
        </Card>
    );
};

export default QuestionViewer;
