/**
 * QuestionViewer.tsx
 * Used to view question document
 * 03/20/2025
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Exercise, Question, ViewerMode } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center, Stack, Radio, RadioGroup, Switch, Pagination, Tooltip, Modal } from '@mantine/core';
import { IconDownload, IconFileTypography, IconRefresh, IconFile, IconChevronLeft, IconChevronRight, IconEye, IconMaximize, IconEyeOff } from '@tabler/icons-react';
import Latex from '../Latex';
import { notifications } from '@mantine/notifications';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { getQuestionDownloadUrl } from '@/utils/services/images';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';


interface QuestionViewerProps {
    classId: string;
    chatId: string;
    questions: Question[];
    viewerMode: ViewerMode;
    fileDocuments: Document[];
    handleEnhancedDocumentClick: (contextType: 'files', contextId: string, documentId?: string) => void;
}

const QuestionViewer: React.FC<QuestionViewerProps> = ({ classId, chatId, questions, viewerMode, fileDocuments, handleEnhancedDocumentClick }) => {
    const [loading, setLoading] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalShowSolution, setModalShowSolution] = useState(false);
    const supabase = useSupabaseBrowser();
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const modalContentRef = useRef<HTMLDivElement>(null);

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

    const isStudent = profile && !profile.professor && !profile.admin;

    // Get current question
    const question = questions[currentIndex] || {};

    // Handle navigation between questions
    const handlePrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, questions.length]);

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
        const newQuestionIds = questions.map(q => q.id);
        const questionIdsChanged = JSON.stringify(questionIdsRef.current) !== JSON.stringify(newQuestionIds);

        if (questionIdsChanged) {
            setCurrentIndex(0);
            // Update the ref with new question IDs
            questionIdsRef.current = newQuestionIds;
        }
    }, [questions]);

    const handleRetry = async (question: Question) => {
        try {
            setLoading(true);
            if (!question.message) {
                notifications.show({
                    title: 'Error generating question',
                    message: 'Question has no message ID',
                    color: 'red',
                });
                return;
            }

            const formData = new FormData();
            formData.append("message_id", question.message);
            formData.append("question_id", question.id);
            formData.append("class_id", classId);

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/questions`, {
                method: 'POST',
                body: formData
            });

            notifications.show({
                title: 'Question generation started',
                message: 'Questions are being generated',
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
                            label={<Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                option,
                                fileDocuments ?? []
                            )}</Latex>}
                            mb="sm"
                            readOnly
                            styles={{
                                body: { alignItems: 'flex-start' },
                                inner: { alignSelf: 'flex-start', marginTop: '4px' },
                            }}
                        />
                    ))}
                </RadioGroup>

                {showSolution && question.answers && question.answers.length > 0 && (
                    <Box mt="lg" p="md" bg="rgba(0,0,0,0.03)" style={{ borderRadius: '8px' }}>
                        <Text fw={700} mb="xs">Correct Answer:</Text>
                        <Text>{question.answers.map((ans, i) => String.fromCharCode(65 + parseInt(ans))).join(', ')}</Text>
                    </Box>
                )}

                {showSolution && question.explanations && question.explanations.length > 0 && (
                    <Box mt="lg" p="md" bg="rgba(0,0,0,0.03)" style={{ borderRadius: '8px' }}>
                        <Text fw={700} mb="xs">Explanation:</Text>
                        <Stack>
                            {question.explanations.map((explanation, index) => (
                                <Latex key={index} handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                    explanation,
                                    fileDocuments ?? []
                                )}</Latex>
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
                    <Box mt="lg" p="md" bg="rgba(0,0,0,0.03)" style={{ borderRadius: '8px' }}>
                        <Text fw={700} mb="xs">Solution:</Text>
                        <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                            question.solution,
                            fileDocuments ?? []
                        )}</Latex>
                    </Box>
                )}
            </Box>
        );
    };

    const renderContent = () => {
        switch (question.generation_status) {
            case 'idle':
                return (
                    <Center style={{ height: '100%' }}>
                        <Text>Waiting to generate question... {currentIndex + 1} of {questions.length}</Text>
                    </Center>
                );
            case 'generating':
                return (
                    <Center style={{ height: '100%' }}>
                        <Loader />
                        <Text ml="md">Generating question {currentIndex + 1} of {questions.length}...</Text>
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
                            onClick={() => handleRetry(question)}
                            loading={loading}
                        >
                            Retry
                        </Button>
                    </Center>
                );
            case 'complete':
                return (
                    <>
                        <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                            question.problem,
                            fileDocuments ?? []
                        )}</Latex>
                        {question.frq ? renderFRQ() : renderMultipleChoice()}
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

    // Reset modal solution state when modal is closed
    useEffect(() => {
        if (!modalOpen) {
            setModalShowSolution(false);
        } else {
            // Sync with main view's solution state when opening
            setModalShowSolution(showSolution);
        }
    }, [modalOpen, showSolution]);

    return (question.generation_status === 'idle' || question.generation_status === 'generating' || question.generation_status === 'error' || question.generation_status === 'complete') && (
        <>
            <Card
                withBorder
                p="md"
                w={"100%"}
                ref={cardRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                <Group justify="space-between" mb="md">
                    {questions.length > 1 ? (
                        <Group>
                            <ActionIcon
                                disabled={currentIndex === 0}
                                onClick={handlePrevious}
                                variant="subtle"
                            >
                                <IconChevronLeft size={20} />
                            </ActionIcon>

                            <Text size="sm">Question {currentIndex + 1} of {questions.length}</Text>

                            <ActionIcon
                                disabled={currentIndex === questions.length - 1}
                                onClick={handleNext}
                                variant="subtle"
                            >
                                <IconChevronRight size={20} />
                            </ActionIcon>
                        </Group>
                    ) : <div />}
                    <Group gap="xs">
                        <Tooltip label={showSolution ? "Hide Solution" : "View Solution"}>
                            <ActionIcon variant="subtle" size="md" onClick={() => setShowSolution(!showSolution)}>
                                {showSolution ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                            </ActionIcon>
                        </Tooltip>
                        {(profile?.admin || profile?.professor) ? <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                                <Tooltip label="Download Questions">
                                    <ActionIcon
                                        variant="subtle"
                                        size="md"
                                    >
                                        <IconDownload size={18} />
                                    </ActionIcon>
                                </Tooltip>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Item
                                    leftSection={<IconFile size={14} />}
                                    component="a"
                                    href={getQuestionDownloadUrl(chatId, questions.map(q => q.id), 'pdf')}
                                    download
                                >
                                    PDF Document
                                </Menu.Item>
                                <Menu.Item
                                    leftSection={<IconFileTypography size={14} />}
                                    component="a"
                                    href={getQuestionDownloadUrl(chatId, questions.map(q => q.id), 'latex')}
                                    download
                                >
                                    LaTeX Source
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu> :
                            <Tooltip label="Download PDF">
                                <ActionIcon
                                    component="a"
                                    variant="subtle"
                                    size="md"
                                    href={getQuestionDownloadUrl(chatId, questions.map(q => q.id), 'pdf')}
                                    download
                                >
                                    <IconDownload size={18} />
                                </ActionIcon>
                            </Tooltip>
                        }
                        <Tooltip label="Maximize">
                            <ActionIcon variant="subtle" size="md" onClick={() => setModalOpen(true)}>
                                <IconMaximize size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {!modalOpen && renderContent()}

                {questions.length > 3 && (
                    <Pagination
                        total={questions.length}
                        value={currentIndex + 1}
                        onChange={(page) => setCurrentIndex(page - 1)}
                        mt="md"
                        size="sm"
                    />
                )}
            </Card>

            <Modal
                opened={modalOpen}
                onClose={() => setModalOpen(false)}
                title={`Question ${currentIndex + 1} of ${questions.length}`}
                size="lg"
                overlayProps={{
                    backgroundOpacity: 0.55,
                    blur: 3,
                }}
            >
                <Box 
                    p="md" 
                    ref={modalContentRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    {question.generation_status === 'complete' && (
                        <>
                            <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                question.problem,
                                fileDocuments ?? []
                            )}</Latex>
                            
                            {/* Use modalShowSolution instead of showSolution for the modal */}
                            {question.frq ? 
                                <Box mt="md">
                                    {modalShowSolution && (
                                        <Box mt="lg" p="md" bg="rgba(0,0,0,0.03)" style={{ borderRadius: '8px' }}>
                                            <Text fw={700} mb="xs">Solution:</Text>
                                            <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                                question.solution,
                                                fileDocuments ?? []
                                            )}</Latex>
                                        </Box>
                                    )}
                                </Box> : 
                                <Box mt="md">
                                    <RadioGroup>
                                        {question.options && question.options.map((option, index) => (
                                            <Radio
                                                key={index}
                                                value={String(index)}
                                                label={<Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                                    option,
                                                    fileDocuments ?? []
                                                )}</Latex>}
                                                mb="sm"
                                                readOnly
                                                styles={{
                                                    body: { alignItems: 'flex-start' },
                                                    inner: { alignSelf: 'flex-start', marginTop: '4px' },
                                                }}
                                            />
                                        ))}
                                    </RadioGroup>

                                    {modalShowSolution && question.answers && question.answers.length > 0 && (
                                        <Box mt="lg" p="md" bg="rgba(0,0,0,0.03)" style={{ borderRadius: '8px' }}>
                                            <Text fw={700} mb="xs">Correct Answer:</Text>
                                            <Text>{question.answers.map((ans, i) => String.fromCharCode(65 + parseInt(ans))).join(', ')}</Text>
                                        </Box>
                                    )}

                                    {modalShowSolution && question.explanations && question.explanations.length > 0 && (
                                        <Box mt="lg" p="md" bg="rgba(0,0,0,0.03)" style={{ borderRadius: '8px' }}>
                                            <Text fw={700} mb="xs">Explanation:</Text>
                                            <Stack>
                                                {question.explanations.map((explanation, index) => (
                                                    <Latex key={index} handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(
                                                        explanation,
                                                        fileDocuments ?? []
                                                    )}</Latex>
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                </Box>
                            }
                        </>
                    )}
                    
                    {/* Navigation buttons in modal */}
                    {questions.length > 1 && (
                        <Group justify="space-between" mt="xl">
                            <Button 
                                variant="subtle" 
                                leftSection={<IconChevronLeft size={16} />}
                                onClick={handlePrevious}
                                disabled={currentIndex === 0}
                            >
                                Previous
                            </Button>
                            <Button 
                                variant="subtle" 
                                rightSection={<IconChevronRight size={16} />}
                                onClick={handleNext}
                                disabled={currentIndex === questions.length - 1}
                            >
                                Next
                            </Button>
                        </Group>
                    )}
                </Box>
            </Modal>
        </>
    );
};

export default QuestionViewer;
