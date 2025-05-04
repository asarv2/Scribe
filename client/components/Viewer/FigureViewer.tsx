/**
 * FigureViewer.tsx
 * This component is used to display a figure in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getFigureUrl, getFigureDownloadUrl } from "@/utils/services/images";
import { Card, Text, ActionIcon, Box, Group, Loader, Button, Center, Skeleton, Modal, Tooltip, Menu } from '@mantine/core';
import { IconDownload, IconRefresh, IconFile, IconFileTypography, IconFileTypePdf, IconChevronLeft, IconChevronRight, IconMaximize } from '@tabler/icons-react';
import Image from "next/image";
import { notifications } from '@mantine/notifications';
import { Document, Figure, ViewerMode } from '../../types';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';
import Latex from '../Latex';
import styles from './FigureViewer.module.css';
import PulseText from '../Chat/Canvas/PulseText';

interface FigureViewerProps {
  figures: Figure[];
  chatId: string;
  classId: string;
  viewerMode: ViewerMode;
  fileDocuments: Document[],
  handleEnhancedDocumentClick: (fileId: string, documentId?: string) => void;
  showDownloadMenu?: boolean;
}

export default function FigureViewer({
  figures,
  chatId,
  classId,
  viewerMode,
  handleEnhancedDocumentClick,
  fileDocuments,
  showDownloadMenu = true
}: FigureViewerProps) {
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'pdf' | 'latex' | null>(null);
  const [svgFailed, setSvgFailed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Get valid figures (without errors)
  const validFigures = useMemo(() => {
    return figures.filter(f => f.generation_status !== 'error');
  }, [figures]);

  // Check if we have any figures with error status
  const hasErrorFigures = useMemo(() => {
    return figures.some(f => f.generation_status === 'error');
  }, [figures]);

  // Initialize currentIndex to first valid figure if needed
  useEffect(() => {
    if (validFigures.length > 0 && currentIndex >= validFigures.length) {
      setCurrentIndex(0);
    }
  }, [validFigures, currentIndex]);

  // Get current figure from valid figures
  const figure = validFigures[currentIndex] || {};

  // Handle navigation between figures
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < validFigures.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, validFigures.length]);

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
      // Swiped left, go to next figure
      handleNext();
    } else if (diff < -threshold) {
      // Swiped right, go to previous figure
      handlePrevious();
    }

    setTouchStartX(null);
  };

  const handleDownload = (
    format: 'png' | 'pdf' | 'latex',
    downloadAll = false
  ) => {
    setDownloadFormat(format);
    setDownloadLoading(true);
  
    const ids = downloadAll
        ? validFigures.map(f => f.id)
        : [validFigures[currentIndex].id];
  
    // decide zip flag - use zip for multiple figures when downloading all
    const zip = downloadAll && validFigures.length > 1;
  
    const downloadUrl = getFigureDownloadUrl(chatId, ids, format, zip);
    console.log(`Downloading from URL: ${downloadUrl}`);
    console.log(`Format: ${format}, Download All: ${downloadAll}, Figure IDs: ${ids.join(', ')}`);

    fetch(downloadUrl, {
        headers: {
            'ngrok-skip-browser-warning': 'true'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            // Get filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            const contentType = response.headers.get('Content-Type');
            console.log(`Content-Type: ${contentType}`);
            console.log(`Content-Disposition: ${contentDisposition}`);
            
            let filename = (() => {
                if (zip) return `figures-${chatId}.zip`;
                if (format === 'latex') return `figure-${validFigures[currentIndex].id}.tex`;
                return `figure-${validFigures[currentIndex].id}.${format}`;
            })();

            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1].replace(/['"]/g, '');
                    console.log(`Extracted filename: ${filename}`);
                }
            }

            return response.blob().then(blob => {
                console.log(`Blob type: ${blob.type}, size: ${blob.size} bytes`);
                return { blob, filename };
            });
        })
        .then(({ blob, filename }) => {
            // For zip files, ensure the correct extension
            if (blob.type === 'application/zip' || 
                (downloadAll && format === 'png') || 
                filename.endsWith('.zip')) {
                if (!filename.endsWith('.zip')) {
                    filename = `${filename}.zip`;
                }
            }
            
            // Create a URL for the blob
            const url = window.URL.createObjectURL(blob);

            // Create a hidden anchor element
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;
            link.download = filename;
            console.log(`Downloading as: ${filename}`);

            // Append to the document, click it, and remove it
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);

            notifications.show({
                title: 'Download complete',
                message: `${format.toUpperCase()}${downloadAll ? ' (all figures)' : ''} has been downloaded`,
                color: 'green',
            });
        })
        .catch(error => {
            console.error('Download failed:', error);
            notifications.show({
                title: 'Download failed',
                message: `Failed to download the figure: ${error.message}`,
                color: 'red',
            });
        })
        .finally(() => {
            setDownloadLoading(false);
            setDownloadFormat(null);
        });
  };

  const renderContent = () => {
    switch (figure.generation_status) {
      case 'idle':
        return (
          <Center style={{ height: '100%', maxHeight: '700px' }}>
            <PulseText text={`Waiting to generate figure ${currentIndex + 1} of ${validFigures.length}...`} />
          </Center>
        );
      case 'generating':
        return (
          <Center style={{ height: '100%', maxHeight: '700px' }}>
            <PulseText text={`Generating figure ${currentIndex + 1} of ${validFigures.length}...`} />
          </Center>
        );
      case 'complete':
        return (
          <Card p={0} w="auto" key={"figure-" + figure.id} shadow={"none"} style={{ margin: '0 auto' }}>
            <Box
              pos="relative"
              style={{
                maxWidth: '100%',
                maxHeight: '700px',
                display: 'flex',
                justifyContent: 'center',
                margin: '0',
                padding: 0,
              }}
            >
              <Box style={{ width: '100%', position: 'relative' }}>
                <Skeleton
                  visible={true}
                  height={"100%"}
                  radius={0}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    maxWidth: '100%',
                    display: 'block',
                    margin: 0
                  }}
                />
                <Image
                  src={getFigureUrl(classId, figure.id, svgFailed ? 'png' : 'svg')}
                  alt="Figure"
                  width={800}
                  height={600}
                  className={styles.figureImage}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '700px',
                    height: 'auto',
                    objectFit: 'contain',
                    opacity: 0,
                    borderRadius: '12px',
                    transition: 'opacity 0.2s',
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    const aspectRatio = img.naturalWidth / img.naturalHeight;
                    if (aspectRatio > 1.5) {
                      img.style.padding = '0.5rem';
                    }
                    img.style.opacity = '1';
                    const skeleton = img.parentElement?.querySelector('.mantine-Skeleton-root');
                    if (skeleton) {
                      (skeleton as HTMLElement).style.display = 'none';
                    }
                  }}
                  onError={() => {
                    if (!svgFailed) {
                      setSvgFailed(true);
                    }
                  }}
                  priority={false}
                />
              </Box>
            </Box>
          </Card>
        );
    }
  };

  // If no valid figures, show appropriate message
  if (validFigures.length === 0) {
    return (
      <Card withBorder p="md" w={"100%"} shadow='none'>
        <Center style={{ height: '200px', maxHeight: '700px' }}>
          {hasErrorFigures ? (
            <PulseText text="Retrying figure generation..." />
          ) : (
            <PulseText text="Generating figure(s)..." />
          )}
        </Center>
      </Card>
    );
  }

  return (
    <Card
      withBorder={validFigures.length > 1}
      p={validFigures.length > 1 ? "md" : 0}
      w={"100%"}
      ref={cardRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      shadow='none'
      style={{ position: 'relative' }}
    >
      {validFigures.length > 1 ? (
        <Group justify="space-between" mb="md">
          <Group>
            <Group>
              <ActionIcon
                disabled={currentIndex === 0}
                onClick={handlePrevious}
                variant="subtle"
              >
                <IconChevronLeft size={20} />
              </ActionIcon>

              <Text size="sm">Figure {currentIndex + 1} of {validFigures.length}</Text>

              <ActionIcon
                disabled={currentIndex === validFigures.length - 1}
                onClick={handleNext}
                variant="subtle"
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Group>
            {showDownloadMenu && <Text size="sm" c="dimmed">{figure.title}</Text>}
            {figure.generation_status === 'generating' && (
              <Text size="sm" c="blue" fw={500}>Generating...</Text>
            )}
            {figure.generation_status === 'idle' && (
              <Text size="sm" c="dimmed" fw={500}>Waiting...</Text>
            )}
          </Group>

          {showDownloadMenu && figure.generation_status === 'complete' && <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <Tooltip label={downloadLoading ? `Downloading ${downloadFormat?.toUpperCase()}...` : "Download Figure"}>
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
              <Menu.Label>Current Figure</Menu.Label>
              <Menu.Item
                leftSection={<IconFile size={14} />}
                onClick={() => handleDownload('png', false)}
                disabled={downloadLoading}
              >
                {downloadLoading && downloadFormat === 'png' ? 'Downloading...' : 'PNG Image'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypePdf size={14} />}
                onClick={() => handleDownload('pdf', false)}
                disabled={downloadLoading}
              >
                {downloadLoading && downloadFormat === 'pdf' ? 'Downloading...' : 'PDF Document'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypography size={14} />}
                onClick={() => handleDownload('latex', false)}
                disabled={downloadLoading}
              >
                {downloadLoading && downloadFormat === 'latex' ? 'Downloading...' : 'LaTeX Source'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>All Figures</Menu.Label>
              <Menu.Item
                leftSection={<IconFile size={14} />}
                onClick={() => handleDownload('png', true)}
                disabled={downloadLoading}
              >
                {downloadLoading && downloadFormat === 'png' ? 'Downloading...' : 
                 validFigures.length > 1 ? 'PNG Images (ZIP)' : 'PNG Image'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypePdf size={14} />}
                onClick={() => handleDownload('pdf', true)}
                disabled={downloadLoading}
              >
                {downloadLoading && downloadFormat === 'pdf' ? 'Downloading...' : 'Combined PDF'}
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFileTypography size={14} />}
                onClick={() => handleDownload('latex', true)}
                disabled={downloadLoading}
              >
                {downloadLoading && downloadFormat === 'latex' ? 'Downloading...' : 'Combined LaTeX'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>}
        </Group>
      ) : (
        /* Header for single figure with title and download button */
        <Group justify="space-between" style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 10, padding: '0 10px' }}>
          <Text size="sm" c="dimmed" p="xs" style={{ borderRadius: '4px' }}>
            {showDownloadMenu && figure.title}
            {figure.generation_status === 'generating' && (
              <Text span ml="xs" c="blue" fw={500}>Generating...</Text>
            )}
            {figure.generation_status === 'idle' && (
              <Text span ml="xs" c="dimmed" fw={500}>Waiting...</Text>
            )}
          </Text>
          
          <Box>
            {showDownloadMenu && figure.generation_status === 'complete' && <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <Tooltip label={downloadLoading ? `Downloading ${downloadFormat?.toUpperCase()}...` : "Download Figure"}>
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
                <Menu.Item
                  leftSection={<IconFile size={14} />}
                  onClick={() => handleDownload('png')}
                  disabled={downloadLoading}
                >
                  {downloadLoading && downloadFormat === 'png' ? 'Downloading...' : 'PNG Image'}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={14} />}
                  onClick={() => handleDownload('pdf')}
                  disabled={downloadLoading}
                >
                  {downloadLoading && downloadFormat === 'pdf' ? 'Downloading...' : 'PDF Document'}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileTypography size={14} />}
                  onClick={() => handleDownload('latex')}
                  disabled={downloadLoading}
                >
                  {downloadLoading && downloadFormat === 'latex' ? 'Downloading...' : 'LaTeX Source'}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>}
          </Box>
        </Group>
      )}

      {renderContent()}
    </Card>
  );
}


