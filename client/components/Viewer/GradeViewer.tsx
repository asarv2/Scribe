/**
 * GradeViewer.tsx
 * Used to view grade document
 * 04/22/2025
 */

import React, { useState } from 'react';
import { Document, Grade, Summary } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center, Tooltip, SimpleGrid, Divider } from '@mantine/core';
import { IconDownload, IconFileText, IconFileTypography, IconRefresh, IconFile } from '@tabler/icons-react';
import Latex from '../Latex';
import { notifications } from '@mantine/notifications';
import { ViewerMode } from '../../types';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';
import { getProfile } from '@/utils/queries/get-profile';
import { getUser } from '@/utils/queries/get-user';
import { useQuery } from '@tanstack/react-query';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import FigureViewer from './FigureViewer';
import { getFigures } from '@/utils/queries/get-figures';
import PulseText from '../Chat/Canvas/PulseText';
import { getGradeDownloadUrl } from '@/utils/services/images';

interface GradeViewerProps {
    classId: string;
    chatId: string;
    grade: Grade;
    viewerMode: ViewerMode;
    fileDocuments: Document[],
    handleEnhancedDocumentClick: (fileId: string, documentId?: string) => void;
}

const GradeViewer: React.FC<GradeViewerProps> = ({ classId, chatId, grade, viewerMode, handleEnhancedDocumentClick, fileDocuments }) => {

    const supabase = useSupabaseBrowser();
    const [downloadLoading, setDownloadLoading] = useState(false);

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
        queryKey: ["gradeFigures", chatId, grade.id],
        queryFn: () => getFigures(supabase, [grade.message].filter(Boolean) as string[]),
        enabled: !!grade.message
    });

    const [loading, setLoading] = useState(false);

    const handleDownload = (format: 'pdf' | 'latex' | 'text') => {
        const downloadUrl = getGradeDownloadUrl(chatId, grade.id, format);
        
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
            let filename = `${grade.title}.${format === 'latex' ? 'tex' : format}`;
            
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
                message: 'Failed to download the summary',
                color: 'red',
            });
        })
        .finally(() => {
            setDownloadLoading(false);
        });
    }

    const renderFigure = (figureId: string) => {
        const figure = figures?.find(f => f.id === figureId);
        if (!figure) return null;
        return (
            <FigureViewer
                key={figureId}
                figures={[figure]}
                chatId={chatId}
                classId={classId}
                viewerMode={viewerMode}
                handleEnhancedDocumentClick={handleEnhancedDocumentClick}
                fileDocuments={fileDocuments ?? []}
                full={true}
            />
        );
    }

    const renderContent = () => {
        switch (grade.generation_status) {
            case 'idle':
                return (
                    <Center style={{ height: '100%' }}>
                        <PulseText text="Waiting to generate summary..." />
                    </Center>
                );
            case 'generating':
                return (
                    <Center style={{ height: '100%' }}>
                        <PulseText text="Generating summary..." />
                    </Center>
                );
            case 'complete':
                return (
                    <Card withBorder p="md" w={"100%"}>
                        <Group justify="space-between">
                            <Text c="dimmed">{grade.title}</Text>
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
                                </Menu.Dropdown>
                            </Menu> : <Tooltip label={downloadLoading ? 'Downloading...' : 'Download PDF'}>
                                <ActionIcon
                                    variant="subtle"
                                    size="md"
                                    onClick={() => handleDownload('pdf')}
                                    disabled={downloadLoading}
                                    loading={downloadLoading}
                                >
                                    <IconDownload size={18} />
                                </ActionIcon>
                            </Tooltip>}
                        </Group>

                        <Box style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {grade.results && grade.feedback && grade.results.map((result, index) => (
                                <Box key={index} mb="md">
                                    <Text fw={600} mb={5}>Result:</Text>
                                    <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>
                                        {splitTextByDocuments(result, fileDocuments ?? [])}
                                    </Latex>
                                    
                                    <Text fw={600} mt={10} mb={5}>Feedback:</Text>
                                    <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>
                                        {splitTextByDocuments(grade.feedback[index], fileDocuments ?? [])}
                                    </Latex>
                                    
                                    {index < grade.results.length - 1 && <Divider my="sm" />}
                                </Box>
                            ))}
                        </Box>
                        
                        {grade.figures && grade.figures.length > 0 && (
                            <Box mt="md">
                                <Text fw={700}>Figures:</Text>
                                <SimpleGrid cols={3}>
                                    {grade.figures.map((figureId) => (
                                        renderFigure(figureId)
                                    ))}
                                </SimpleGrid>
                            </Box>
                        )}
                    </Card>
                );
        }
    };

    return (grade.generation_status === 'idle' || grade.generation_status === 'generating' || grade.generation_status === 'complete' || grade.generation_status === 'error') && ( 
            renderContent()
    );
};

export default GradeViewer;
