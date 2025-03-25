/**
 * SummaryViewer.tsx
 * Used to view summary document
 * 03/20/2025
 */

import React, { useState } from 'react';
import { Document, Exercise, Summary } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center } from '@mantine/core';
import { IconDownload, IconFileText, IconFileTypography, IconRefresh, IconFile } from '@tabler/icons-react';
import Latex from '../Latex';
import { getSummaryPDFUrl, getSummaryTeXUrl, getSummaryTextUrl } from '../../utils/services/images';
import { notifications } from '@mantine/notifications';
import { ViewerMode } from '../../types';
import { groupConsecutiveDocuments } from '@/utils/chat/chat-helpers';
import { filterCodeBlocks } from '@/utils/chat/chat-helpers';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';

interface SummaryViewerProps {
    classId: string;
    summary: Summary;
    viewerMode: ViewerMode;
    renderBadges: (group: {
        text: string;
        documents: Document[];
        exercises: Exercise[];
    }) => React.ReactNode;
    lectureDocuments: Document[];
    chapterDocuments: Document[];
    chapterExercises: Exercise[];
    homeworkExercises: Exercise[];
}

const SummaryViewer: React.FC<SummaryViewerProps> = ({ classId, summary, viewerMode, renderBadges, lectureDocuments, chapterDocuments, chapterExercises, homeworkExercises }) => {

    const [loading, setLoading] = useState(false);

    const handleRetry = async () => {
        try {
            setLoading(true);

            if (!summary.message) {
                throw new Error('No message id found');
            }

            const formData = new FormData();
            formData.append("message_id", summary.message);
            formData.append("class_id", classId);

            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/summaries`, {
                method: 'POST',
                body: formData
            });

            notifications.show({
                title: 'Summary generated',
                message: 'Summary generated successfully',
                color: 'green',
            });
        } catch (error) {
            console.error(error);
            notifications.show({
                title: 'Error generating summary',
                message: 'Error generating summary',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    }

    const renderContent = () => {
        switch (summary.generation_status) {
            case 'idle':
                return (
                    <Center style={{ height: '100%' }}>
                        <Text>Waiting to generate summary...</Text>
                    </Center>
                );
            case 'generating':
                return (
                    <Center style={{ height: '100%' }}>
                        <Loader />
                        <Text ml="md">Generating summary...</Text>
                    </Center>
                );
            case 'error':
                return (
                    <Center style={{ height: '100%', flexDirection: 'column' }}>
                        <Text c="red" mb="md">Error generating summary: {summary.generation_error}</Text>
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
                            <Text c="dimmed">Generated at {new Date(summary.created_at).toLocaleString()}</Text>
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
                                        href={getSummaryPDFUrl(summary.id)}
                                        download
                                    >
                                        PDF Document
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<IconFileTypography size={14} />}
                                        component="a"
                                        href={getSummaryTeXUrl(summary.id)}
                                        download
                                    >
                                        LaTeX Source
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<IconFileText size={14} />}
                                        component="a"
                                        href={getSummaryTextUrl(summary.id)}
                                        download
                                    >
                                        Plain Text
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>
                        </Group>

                        <Box>
                            {(() => {
                                const groups = groupConsecutiveDocuments(
                                    splitTextByDocuments(
                                        filterCodeBlocks(summary.body)
                                    ),
                                    lectureDocuments ?? [],
                                    chapterDocuments ?? [],
                                    chapterExercises ?? [],
                                    homeworkExercises ?? []
                                );

                                // Combine all groups into one for final badges
                                const combinedGroup = groups.reduce((acc, group) => ({
                                    text: acc.text + group.text,
                                    documents: [...(acc.documents || []), ...(group.documents || [])],
                                    exercises: [...(acc.exercises || []), ...(group.exercises || [])]
                                }), { text: '', documents: [], exercises: [] });

                                return (
                                    <>
                                        <Latex>{summary.preamble}</Latex>
                                        {groups.map((group, index) => (
                                            <Box key={index}>
                                                <Latex>{group.text}</Latex>
                                            </Box>
                                        ))}
                                        <Latex>{summary.conclusion}</Latex>
                                        <Box pt="md">
                                            {renderBadges(combinedGroup)}
                                        </Box>
                                    </>
                                );
                            })()}
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
        <Card withBorder p="md" w={viewerMode.immersive ? '100%' : 700}>
            {renderContent()}
        </Card>
    );
};

export default SummaryViewer;
