/**
 * QuestionViewer.tsx
 * Used to view question document
 * 03/20/2025
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Question, ViewerMode } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center, Stack, Radio, RadioGroup, Switch, Pagination, Tooltip, Modal, Textarea } from '@mantine/core';
import { IconDownload, IconFileTypography, IconRefresh, IconFile, IconChevronLeft, IconChevronRight, IconEye, IconMaximize, IconEyeOff } from '@tabler/icons-react';
import Latex from '../Latex';
import { notifications } from '@mantine/notifications';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getQuestionDownloadUrl } from '@/utils/services/images';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';
import FigureViewer from './FigureViewer';
import { getFigures } from '@/utils/queries/get-figures';
import PulseText from '../Chat/Canvas/PulseText';


interface QuestionViewerProps {
    classId: string;
    chatId: string;
    questions: Question[];
    viewerMode: ViewerMode;
    fileDocuments: Document[];
    handleEnhancedDocumentClick: (fileId: string, documentId?: string) => void;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ classId, chatId, questions, viewerMode, fileDocuments, handleEnhancedDocumentClick }) => {
    const [loading, setLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const supabase = useSupabaseBrowser();
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
    const [frqAnswers, setFrqAnswers] = useState<Record<string, string>>({});
    const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
    const [downloadLoading, setDownloadLoading] = useState(false);


    // Store the question IDs in a ref to detect when the actual questions change
    const questionIdsRef = useRef<string[]>(questions.map(q => q.id));

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });

    const { data: figures } = useQuery({
        queryKey: ["figures", classId],
        queryFn: () => getFigures(supabase, classId),
        enabled: !!classId
    });

    const isStudent = profile && !profile.professor && !profile.admin;

    // Filter out questions with error status
    const validQuestions = useMemo(() => {
        return questions.filter(q => q.generation_status !== 'error');
    }, [questions]);

    // Check if we have any questions with error status
    const hasErrorQuestions = useMemo(() => {
        return questions.some(q => q.generation_status === 'error');
    }, [questions]);

    // Initialize currentIndex to first valid question if needed
    useEffect(() => {
        if (validQuestions.length > 0 && currentIndex >= validQuestions.length) {
            setCurrentIndex(0);
        }
    }, [validQuestions, currentIndex]);

    // Get current question
    const question = validQuestions[currentIndex] || {};

    // Handle navigation between questions
    const handlePrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < validQuestions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, validQuestions.length]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                handlePrevious();
            } else if (e.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handlePrevious, handleNext]);

    // Touch swipe navigation
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX === null) return;

        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;

        // Swipe threshold (adjust as needed)
        const threshold = 50;

        if (diff > threshold) {
            // Swiped left, go to next question
            handleNext();
        } else if (diff < -threshold) {
            // Swiped right, go to previous question
            handlePrevious();
        }

        setTouchStartX(null);
    };

    useEffect(() => {
        // Only reset the current index if the question IDs have changed
        const newQuestionIds = validQuestions.map(q => q.id);
        const questionIdsChanged = JSON.stringify(questionIdsRef.current) !== JSON.stringify(newQuestionIds);

        if (questionIdsChanged) {
            setCurrentIndex(0);
            // Update the ref with new question IDs
            questionIdsRef.current = newQuestionIds;
        }
    }, [validQuestions]);

    // Handle answer selection for multiple choice
    const handleAnswerSelect = (questionId: string, value: string) => {
        setSelectedAnswers(prev => {
            return { ...prev, [questionId]: [value] };
        });
    };

    // Handle FRQ answer input
    const handleFrqAnswerChange = (questionId: string, value: string) => {
        setFrqAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleDownload = (format: 'pdf' | 'latex', downloadAll: boolean = true) => {
        // If downloadAll is false, only download the current question
        const questionIds = downloadAll ? validQuestions.map(q => q.id) : [question.id];
        const useZip = downloadAll && validQuestions.length > 1;
        const downloadUrl = getQuestionDownloadUrl(chatId, questionIds, format, useZip);

        setDownloadLoading(true);

        // Fetch the file with the ngrok-skip-browser-warning header
        fetch(downloadUrl, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        })
            .then(response => {
                // Get filename from Content-Disposition header if available
                const contentDisposition = response.headers.get('Content-Disposition');
                console.log('Content-Disposition:', contentDisposition);
                let filename = useZip
                    ? `questions-${chatId}.zip`
                    : downloadAll
                        ? `questions-${chatId}.${format === 'latex' ? 'tex' : format}`
                        : `question-${currentIndex + 1}-${chatId}.${format === 'latex' ? 'tex' : format}`;

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                    if (filenameMatch && filenameMatch[1]) {
                        filename = filenameMatch[1].replace(/['"]/g, '');
                    }
                }

                return response.blob().then(blob => ({ blob, filename }));
            })
            .then(({ blob, filename }) => {
                // Create a URL for the blob
                const url = window.URL.createObjectURL(blob);

                // Create a hidden anchor element
                const link = document.createElement('a');
                link.style.display = 'none';
                link.href = url;
                link.download = filename;

                // Append to the document, click it, and remove it
                document.body.appendChild(link);
                link.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);

                notifications.show({
                    title: 'Download complete',
                    message: `${format.toUpperCase()} file has been downloaded`,
                    color: 'green',
                });
            })
            .catch(error => {
                console.error('Download failed:', error);
                notifications.show({
                    title: 'Download failed',
                    message: 'Failed to download the questions',
                    color: 'red',
                });
            })
            .finally(() => {
                setDownloadLoading(false);
            });
    };

    const renderFigure = (figureId: string) => {
        const figure = figures?.find(f => f.id === figureId);
        if (!figure) return null;
        return (
            <FigureViewer
                key={figureId}
                figures={[figure]}
                classId={classId}
                chatId={chatId}
                viewerMode={viewerMode}
                handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                fileDocuments={fileDocuments ?? []}
                showDownloadMenu={false}
            />
        );
    }

    const renderQuestion = () => {
        return (
            <>
                {/* Display figures in modal if they exist */}
                {question.figures && question.figures.length > 0 && (
                    <Box mb="md">
                        <Group justify="flex-start" pl="sm">
                            {question.figures.map((figureId) => (
                                renderFigure(figureId)
                            ))}
                        </Group>
                    </Box>
                )}
                <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                    question.problem,
                    fileDocuments ?? []
                )}</Latex>

                {question.frq ?
                    <Box mt="md">
                        <Box mb="md">
                            <Textarea
                                value={frqAnswers[question.id] || ''}
                                onChange={(e) => handleFrqAnswerChange(question.id, e.target.value)}
                                style={{
                                    width: '100%',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                }}
                                minRows={4}
                                size="md"
                                autosize
                                placeholder="Enter your answer here..."
                            />
                        </Box>

                        {checkedAnswers[question.id] && (
                            <Box mt="lg" p="md" bg="rgba(0,200,0,0.1)" style={{ borderRadius: '8px' }}>
                                <Text size="sm" mt="xs" ml="2rem" c={"green.7"}>
                                    <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                        question.solution,
                                        fileDocuments ?? []
                                    )}</Latex>
                                </Text>
                            </Box>
                        )}

                    </Box> :
                    <Box mt="md">
                        <RadioGroup
                            value={selectedAnswers[question.id]?.[0] || ''}
                            onChange={(value) => handleAnswerSelect(question.id, value)}
                        >
                            {question.options && question.options.map((option, index) => {
                                // Check if correct by comparing the option text
                                let isCorrectAnswer = question.answers?.includes(option);
                                
                                // Also check if correct by index (for answers like "A", "B", "C", "D" or "1", "2", "3", "4")
                                if (!isCorrectAnswer && question.answers) {
                                    // Convert index to letter (0 -> "A", 1 -> "B", etc.)
                                    const letterAnswer = String.fromCharCode(65 + index);
                                    // Convert index to number (0 -> "1", 1 -> "2", etc.)
                                    const numberAnswer = String(index + 1);
                                    
                                    // Check if the answer matches the letter or number corresponding to this index
                                    isCorrectAnswer = question.answers.includes(letterAnswer) || 
                                                      question.answers.includes(numberAnswer);
                                }
                                
                                const showFeedback = checkedAnswers[question.id];
                                const isSelected = selectedAnswers[question.id]?.[0] === String(index);

                                // Determine the style for the option based on whether it's checked and correct
                                let optionStyle = {};
                                if (showFeedback && isSelected) {
                                    if (isCorrectAnswer) {
                                        optionStyle = { backgroundColor: 'rgba(0,200,0,0.1)', padding: '8px', borderRadius: '4px' };
                                    } else {
                                        optionStyle = { backgroundColor: 'rgba(255,0,0,0.1)', padding: '8px', borderRadius: '4px' };
                                    }
                                }

                                return (
                                    <Box key={index} mb="sm" style={optionStyle}>
                                        <Radio
                                            value={String(index)}
                                            label={<Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                                option,
                                                fileDocuments ?? []
                                            )}</Latex>}
                                            styles={{
                                                body: { alignItems: 'flex-start' },
                                                inner: { alignSelf: 'flex-start', marginTop: '4px' },
                                            }}
                                        />

                                        {showFeedback && isSelected && (
                                            <Text size="sm" mt="xs" ml="2rem" c={isCorrectAnswer ? "green.7" : "red.7"}>
                                                <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                                    question.explanations?.[index],
                                                    fileDocuments ?? []
                                                )}</Latex>
                                            </Text>
                                        )}


                                    </Box>
                                );
                            })}
                        </RadioGroup>


                    </Box>
                }
            </>
        )
    }

    const renderContent = () => {
        switch (question.generation_status) {
            case 'idle':
                return (
                    <Center style={{ height: '100%' }}>
                        <PulseText text={`Waiting to generate question ${currentIndex + 1} of ${validQuestions.length}...`} />
                    </Center>
                );
            case 'generating':
                return (
                    <Center style={{ height: '100%' }}>
                        <PulseText text={`Generating question ${currentIndex + 1} of ${validQuestions.length}...`} />
                    </Center>
                );
            case 'complete':
                return renderQuestion();
            default:
                return null;
        }
    };

    // If no valid questions, show appropriate message
    if (validQuestions.length === 0) {
        return (
            <Card withBorder p="md" w={"100%"}>
                <Center style={{ height: '200px' }}>
                    {hasErrorQuestions ? (
                        <PulseText text="Retrying question generation..." />
                    ) : (
                        <PulseText text="Generating question(s)..." />
                    )}
                </Center>
            </Card>
        );
    }

    return (
        <>
            <Card
                withBorder
                p="md"
                w="100%"
                ref={cardRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <Group justify="space-between" mb="md">
                    <Group>
                        {validQuestions.length > 1 ? (
                            <Group>
                                <ActionIcon
                                    disabled={currentIndex === 0}
                                    onClick={handlePrevious}
                                    variant="subtle"
                                >
                                    <IconChevronLeft size={20} />
                                </ActionIcon>

                                <Text size="sm">Question {currentIndex + 1} of {validQuestions.length}</Text>

                                <ActionIcon
                                    disabled={currentIndex === validQuestions.length - 1}
                                    onClick={handleNext}
                                    variant="subtle"
                                >
                                    <IconChevronRight size={20} />
                                </ActionIcon>
                            </Group>
                        ) : null}
                        <Text size="sm" c="dimmed">{question.title}</Text>
                        {question.generation_status === 'generating' && (
                            <Text size="sm" c="blue" fw={500}>Generating...</Text>
                        )}
                        {question.generation_status === 'idle' && (
                            <Text size="sm" c="dimmed" fw={500}>Waiting...</Text>
                        )}
                    </Group>
                    <Group gap="xs">
                        <Tooltip label={checkedAnswers[question.id] ? "Hide Answer" : "Show Answer"}>
                            <ActionIcon
                                variant="subtle"
                                size="md"
                                onClick={() => setCheckedAnswers(prev => ({ ...prev, [question.id]: !prev[question.id] }))}
                                disabled={
                                    !checkedAnswers[question.id] && (
                                        (question.frq && !frqAnswers[question.id]) ||
                                        (!question.frq && !selectedAnswers[question.id])
                                    )
                                }
                            >
                                {checkedAnswers[question.id] ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                            </ActionIcon>
                        </Tooltip>
                        <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                                <Tooltip label={downloadLoading ? "Downloading..." : "Download Questions"}>
                                    <ActionIcon
                                        variant="subtle"
                                        size="md"
                                        loading={downloadLoading}
                                    >
                                        <IconDownload size={18} />
                                    </ActionIcon>
                                </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                                {validQuestions.length > 1 ? (
                                    <>
                                        <Menu.Label>Download Options</Menu.Label>
                                        <Menu.Item
                                            leftSection={<IconFile size={14} />}
                                            onClick={() => handleDownload('pdf', false)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'Current Question (PDF)'}
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFileTypography size={14} />}
                                            onClick={() => handleDownload('latex', false)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'Current Question (LaTeX)'}
                                        </Menu.Item>
                                        <Menu.Divider />
                                        <Menu.Item
                                            leftSection={<IconFile size={14} />}
                                            onClick={() => handleDownload('pdf', true)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'All Questions (PDF)'}
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFileTypography size={14} />}
                                            onClick={() => handleDownload('latex', true)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'All Questions (LaTeX)'}
                                        </Menu.Item>
                                    </>
                                ) : (
                                    <>
                                        <Menu.Item
                                            leftSection={<IconFile size={14} />}
                                            onClick={() => handleDownload('pdf')}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'PDF Document'}
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFileTypography size={14} />}
                                            onClick={() => handleDownload('latex')}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'LaTeX Source'}
                                        </Menu.Item>
                                    </>
                                )}
                            </Menu.Dropdown>
                        </Menu>
                    </Group>
                </Group>

                {renderContent()}

                {validQuestions.length > 3 && (
                    <Pagination
                        total={validQuestions.length}
                        value={currentIndex + 1}
                        onChange={(page) => setCurrentIndex(page - 1)}
                        mt="md"
                        size="sm"
                    />
                )}
            </Card>
        </>
    );
};

export default QuestionViewer;
