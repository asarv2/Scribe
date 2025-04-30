/**
 * ReportViewer.tsx
 * Used to view report document
 * 04/29/2025
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Report, Summary } from '../../types';
import { Card, Text, Menu, ActionIcon, Box, Group, Loader, Button, Center, Tooltip, SimpleGrid, Modal } from '@mantine/core';
import { IconDownload, IconFileText, IconFileTypography, IconRefresh, IconFile, IconChevronLeft, IconChevronRight, IconMaximize } from '@tabler/icons-react';
import Latex from '../Latex';
import { getFigureUrl, getReportDownloadUrl, getSummaryDownloadUrl } from '../../utils/services/images';
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
import { injectFigures } from '@/utils/chat/figure-helpers';

interface ReportViewerProps {
    classId: string;
    chatId: string;
    reports: Report[];
    viewerMode: ViewerMode;
    fileDocuments: Document[],
    handleEnhancedDocumentClick: (fileId: string, documentId?: string) => void;
}

const ReportViewer: React.FC<ReportViewerProps> = ({ classId, chatId, reports, viewerMode, handleEnhancedDocumentClick, fileDocuments }) => {
    const supabase = useSupabaseBrowser();
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // Filter out summaries with error status
    const validReports = useMemo(() => {
        return reports.filter(r => r.generation_status !== 'error');
    }, [reports]);

    // Initialize currentIndex to first valid summary if needed
    useEffect(() => {
        if (validReports.length > 0 && currentIndex >= validReports.length) {
            setCurrentIndex(0);
        }
    }, [validReports, currentIndex]);

    // Get current summary
    const report = validReports[currentIndex] || {};

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

    // Handle navigation between summaries
    const handlePrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex < validReports.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, validReports.length]);

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
            // Swiped left, go to next summary
            handleNext();
        } else if (diff < -threshold) {
            // Swiped right, go to previous summary
            handlePrevious();
        }

        setTouchStartX(null);
    };

    const handleDownload = (format: 'pdf' | 'latex' | 'text', downloadAll: boolean = false) => {
        // If downloadAll is true, we need to modify the API call to get all summaries
        const downloadUrl = downloadAll
            ? getReportDownloadUrl(chatId, validReports.map(r => r.id), format)
            : getReportDownloadUrl(chatId, [report.id], format);

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
                let filename = downloadAll
                    ? `all-reports-${chatId}.${format === 'latex' ? 'tex' : format}`
                    : `${report.title || `report-${currentIndex + 1}`}.${format === 'latex' ? 'tex' : format}`;

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

    const renderContent = () => {
        switch (report.generation_status) {
            case 'idle':
            case 'generating':
                return null; // We'll handle loading states outside the card content
            case 'complete':
                return (
                    <>
                        <Box style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', zIndex: 10 }}>
                            <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(injectFigures(report.content, (id) => getFigureUrl(classId, id)), fileDocuments ?? [])}</Latex>
                        </Box>
                    </>
                );
            default:
                return null;
        }
    };

    // Check if we have any summaries with error status
    const hasErrorReports = useMemo(() => {
        return reports.some(r => r.generation_status === 'error');
    }, [reports]);

    // Render loading state or content based on generation status
    const renderReportContent = () => {
        if (validReports.length === 0) {
            return null; // We'll handle this case outside the card
        }
        
        if (report.generation_status === 'idle') {
            return (
                <Center style={{ height: '200px' }}>
                    <PulseText text={`Waiting to generate report ${currentIndex + 1} of ${validReports.length}...`} />
                </Center>
            );
        } else if (report.generation_status === 'generating') {
            return (
                <Center style={{ height: '200px' }}>
                    <PulseText text={`Generating report ${currentIndex + 1} of ${validReports.length}...`} />
                </Center>
            );
        } else {
            return renderContent();
        }
    };

    // If no valid summaries, show appropriate message
    if (validReports.length === 0) {
        return (
            <Card withBorder p="md" w={"100%"}>
                <Center style={{ height: '200px' }}>
                    {hasErrorReports ? (
                        <PulseText text="Retrying report generation..." />
                    ) : (
                        <PulseText text="Generating report(s)..." />
                    )}
                </Center>
            </Card>
        );
    }

    return (
        <Card
            withBorder
            p="md"
            w={"100%"}
            ref={cardRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Always show header with title and download button */}
            <Group justify="space-between" mb="md">
                <Group>
                    {validReports.length > 1 ? (
                        <Group>
                            <ActionIcon
                                disabled={currentIndex === 0}
                                onClick={handlePrevious}
                                variant="subtle"
                            >
                                <IconChevronLeft size={20} />
                            </ActionIcon>

                            <Text size="sm">Report {currentIndex + 1} of {validReports.length}</Text>

                            <ActionIcon
                                disabled={currentIndex === validReports.length - 1}
                                onClick={handleNext}
                                variant="subtle"
                            >
                                <IconChevronRight size={20} />
                            </ActionIcon>
                        </Group>
                    ) : null}
                    <Text size="sm" c="dimmed">{report.title}</Text>
                    {report.generation_status === 'generating' && (
                        <Text size="sm" c="blue" fw={500}>Generating...</Text>
                    )}
                    {report.generation_status === 'idle' && (
                        <Text size="sm" c="dimmed" fw={500}>Waiting...</Text>
                    )}
                </Group>
                
                {/* Only show download options for completed summaries */}
                {report.generation_status === 'complete' && (
                    (profile?.admin || profile?.professor) ? (
                        <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                                <Tooltip label={downloadLoading ? 'Downloading...' : 'Download Summary'}>
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
                                <Menu.Label>Download as</Menu.Label>
                                {validReports.length > 1 ? (
                                    <>
                                        <Menu.Item
                                            leftSection={<IconFile size={14} />}
                                            onClick={() => handleDownload('pdf', false)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'Current Report (PDF)'}
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFileTypography size={14} />}
                                            onClick={() => handleDownload('latex', false)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'Current Report (LaTeX)'}
                                        </Menu.Item>
                                        <Menu.Divider />
                                        <Menu.Item
                                            leftSection={<IconFile size={14} />}
                                            onClick={() => handleDownload('pdf', true)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'All Reports (PDF)'}
                                        </Menu.Item>
                                        <Menu.Item
                                            leftSection={<IconFileTypography size={14} />}
                                            onClick={() => handleDownload('latex', true)}
                                            disabled={downloadLoading}
                                        >
                                            {downloadLoading ? 'Downloading...' : 'All Reports (LaTeX)'}
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
                    ) : (
                        <Tooltip label={downloadLoading ? 'Downloading...' : 'Download PDF'}>
                            <ActionIcon
                                variant="subtle"
                                size="md"
                                onClick={() => handleDownload('pdf')}
                                disabled={downloadLoading}
                                loading={downloadLoading}
                            >
                                <IconDownload size={18} />
                            </ActionIcon>
                        </Tooltip>
                    )
                )}
            </Group>

            {renderReportContent()}
        </Card>
    );
};

export default ReportViewer;
