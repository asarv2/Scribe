/**
 * SummaryViewer.tsx
 * Used to view summary document
 * 03/20/2025
 */

import React, { useState } from 'react';
import { Document, Exercise, Summary } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center, Tooltip, SimpleGrid } from '@mantine/core';
import { IconDownload, IconFileText, IconFileTypography, IconRefresh, IconFile } from '@tabler/icons-react';
import Latex from '../Latex';
import { getSummaryDownloadUrl } from '../../utils/services/images';
import { notifications } from '@mantine/notifications';
import { ViewerMode } from '../../types';
import { groupConsecutiveDocuments, splitTextByTags } from '@/utils/chat/chat-helpers';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import FigureViewer from './FigureViewer';
import { getFigures } from '@/utils/queries/get-figures';

interface SummaryViewerProps {
    classId: string;
    chatId: string;
    summary: Summary;
    viewerMode: ViewerMode;
    fileDocuments: Document[],
    handleEnhancedDocumentClick: (contextType: 'files', contextId: string, documentId?: string) => void;
}

const SummaryViewer: React.FC<SummaryViewerProps> = ({ classId, chatId, summary, viewerMode, handleEnhancedDocumentClick, fileDocuments }) => {

    const supabase = useSupabaseBrowser();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    });

    const { data: figures, isLoading: figuresLoading } = useQuery({
        queryKey: ["summaryFigures", summary.id],
        queryFn: () => getFigures(supabase, [summary.message].filter(Boolean) as string[]),
        enabled: !!summary.message
    });

    const [loading, setLoading] = useState(false);

    const handleRetry = async (summary: Summary) => {
        try {
            setLoading(true);

            if (!summary.message) {
                throw new Error('No message id found');
            }

            const formData = new FormData();
            formData.append("message_id", summary.message);
            formData.append("summary_id", summary.id);
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

    const renderFigure = (figureId: string) => {
        const figure = figures?.find(f => f.id === figureId);
        if (!figure) return null;
        return (
            <FigureViewer
                key={figureId}
                figure={figure}
                classId={classId}
                viewerMode={viewerMode}
                full={true}
            />
        );
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
                            onClick={() => handleRetry(summary)}
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
                            <Text c="dimmed">{summary.title}</Text>
                            {(profile?.admin || profile?.professor) ? <Menu position="bottom-end" shadow="md">
                                <Menu.Target>
                                    <Tooltip label="Download Summary">
                                        <ActionIcon
                                            variant="subtle"
                                            size="md"
                                        >
                                            <IconDownload size={18} />
                                        </ActionIcon>
                                    </Tooltip>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>Download as</Menu.Label>
                                    <Menu.Item
                                        leftSection={<IconFile size={14} />}
                                        component="a"
                                        href={getSummaryDownloadUrl(chatId, summary.id, 'pdf')}
                                        download
                                    >
                                        PDF Document
                                    </Menu.Item>
                                    <Menu.Item
                                        leftSection={<IconFileTypography size={14} />}
                                        component="a"
                                        href={getSummaryDownloadUrl(chatId, summary.id, 'latex')}
                                        download
                                    >
                                        LaTeX Source
                                    </Menu.Item>
                                    {/* <Menu.Item
                                        leftSection={<IconFileText size={14} />}
                                        component="a"
                                        href={getSummaryDownloadUrl(chatId, summary.id, 'text')}
                                        download
                                    >
                                        Plain Text
                                    </Menu.Item> */}
                                </Menu.Dropdown>
                            </Menu> : <Tooltip label="Download PDF">
                                <ActionIcon
                                    component="a"
                                    variant="subtle"
                                    size="md"
                                    href={getSummaryDownloadUrl(chatId, summary.id, 'pdf')}
                                    download
                                >
                                    <IconDownload size={18} />
                                </ActionIcon>
                            </Tooltip>}
                        </Group>

                        <Box style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(summary.preamble, fileDocuments ?? [])}</Latex>
                            <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(summary.body, fileDocuments ?? [])}</Latex>
                            <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(summary.conclusion, fileDocuments ?? [])}</Latex>
                        </Box>
                        
                        {summary.figures && summary.figures.length > 0 && (
                            <Box mt="md">
                                <Text fw={700}>Figures:</Text>
                                <SimpleGrid cols={3}>
                                    {summary.figures.map((figureId) => (
                                        renderFigure(figureId)
                                    ))}
                                </SimpleGrid>
                            </Box>
                        )}
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

    return (summary.generation_status === 'idle' || summary.generation_status === 'generating' || summary.generation_status === 'complete') && (
        <Card withBorder p="md" w={"100%"}>
            {renderContent()}
        </Card>
    );
};

export default SummaryViewer;
