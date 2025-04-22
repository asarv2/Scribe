/**
 * FigureViewer.tsx
 * This component is used to display a figure in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import React, { useState } from 'react';
import { getFigureUrl } from "@/utils/services/images";
import { Card, Text, ActionIcon, Box, Group, Loader, Button, Center, Skeleton, Modal, Tooltip } from '@mantine/core';
import { IconDownload, IconRefresh } from '@tabler/icons-react';
import Image from "next/image";
import { notifications } from '@mantine/notifications';
import { Document, Figure, ViewerMode } from '../../types';
import { splitTextByDocuments } from '@/utils/chat/chat-helpers';
import Latex from '../Latex';
import styles from './FigureViewer.module.css';
import PulseText from '../Chat/Canvas/PulseText';

interface FigureViewerProps {
  figure: Figure;
  classId: string;
  viewerMode: ViewerMode;
  fileDocuments: Document[],
  handleEnhancedDocumentClick: (fileId: string, documentId?: string) => void;
  full?: boolean;
}

export default function FigureViewer({
  figure,
  classId,
  viewerMode,
  handleEnhancedDocumentClick,
  fileDocuments,
  full = false
}: FigureViewerProps) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const renderContent = () => {
    switch (figure.generation_status) {
      case 'idle':
        return (
          <Center style={{ height: '100%' }}>
            <PulseText text="Waiting to generate figure..." />
          </Center>
        );
      case 'generating':
        return (
          <Center style={{ height: '100%' }}>
            <PulseText text="Generating figure..." />
          </Center>
        );
      case 'error':
        return (
          <Center style={{ height: '100%' }}>
            <PulseText text="Error generating figure" error={true} />
          </Center>
        );
      case 'complete':
        return (
          <Card p={0} w={full ? "100%" : viewerMode.open ? "70%" : "50%"} key={"figure-" + figure.id} shadow={"none"}>
            <Box
              pos="relative"
              style={{
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'center',
                margin: '0',
                padding: 0,
                cursor: 'pointer'
              }}
              onClick={() => setModalOpen(true)}
            >
              {/* Download button overlay */}
              <Tooltip label="Download Figure">
                <ActionIcon
                  component="a"
                  href={getFigureUrl(classId, figure.id)}
                  download
                  pos="absolute"
                  top={10}
                  right={10}
                  variant="subtle"
                  style={{ zIndex: 10 }}
                  onClick={(e) => e.stopPropagation()} // Prevent modal from opening when clicking download
                >
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
              {/* <Latex handleEnhancedDocumentClick={handleEnhancedDocumentClick} classId={classId}>{splitTextByDocuments(figure.code, fileDocuments ?? [])}</Latex> */}

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
                  src={getFigureUrl(classId, figure.id)}
                  alt="Figure"
                  width={800}
                  height={600}
                  className={styles.figureImage}
                  style={{
                    maxWidth: '100%',
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
                  priority={false}
                />
              </Box>
            </Box>
          </Card>
        );
      default:
        return (
          <Center style={{ height: '100%' }}>
            <Text>Unknown status</Text>
          </Center>
        );
    }
  };

  return (figure.generation_status === 'idle' || figure.generation_status === 'generating' || figure.generation_status === 'complete') && (
    <>
      {renderContent()}

      {/* Full-screen modal for the figure */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        size="xl"
        padding="md"
        title={figure.title}
        styles={{
          content: {
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh',
          },
          header: {
            marginBottom: 0,
            paddingBottom: 10,
          },
          body: {
            flex: 1,
            overflow: 'hidden',
            padding: 0,
          }
        }}
        overlayProps={{
          backgroundOpacity: 0.55,
          blur: 3,
        }}
        centered
      >
        <Box
          p="md"
          style={{
            height: '100%',
            maxHeight: 'calc(90vh - 60px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {figure.generation_status === 'complete' && (
            <Box style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
              <Tooltip label="Download Figure">
                <ActionIcon
                  component="a"
                  href={getFigureUrl(classId, figure.id)}
                  download
                  pos="absolute"
                  top={10}
                  right={10}
                  variant="subtle"
                  style={{ zIndex: 10 }}
                >
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
              <Image
                src={getFigureUrl(classId, figure.id)}
                alt="Figure"
                width={1200}
                height={900}
                className={styles.figureImage}
                style={{
                  maxWidth: '100%',
                  maxHeight: 'calc(90vh - 80px)',
                  height: 'auto',
                  width: 'auto',
                  objectFit: 'contain',
                }}
                priority={true}
              />
            </Box>
          )}
        </Box>
      </Modal>
    </>
  );
}


