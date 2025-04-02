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
import { Figure, ViewerMode } from '../../types';

interface FigureViewerProps {
  figure: Figure;
  classId: string;
  viewerMode: ViewerMode;
}

export default function FigureViewer({
  figure,
  classId,
  viewerMode
}: FigureViewerProps) {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleRetry = async (figure: Figure) => {
    try {
      setLoading(true);

      if (!figure.message) {
        throw new Error('No message id found');
      }

      const formData = new FormData();
      formData.append("message_id", figure.message);
      formData.append("figure_id", figure.id);
      formData.append("class_id", classId);

      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/figures`, {
        method: 'POST',
        body: formData
      });

      notifications.show({
        title: 'Figure generated',
        message: 'Figure generated successfully',
        color: 'green',
      });
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Error generating figure',
        message: 'Error generating figure',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (figure.generation_status) {
      case 'idle':
        return (
          <Center style={{ height: '100%' }}>
            <Text>Waiting to generate figure...</Text>
          </Center>
        );
      case 'generating':
        return (
          <Center style={{ height: '100%' }}>
            <Loader />
            <Text ml="md">Generating figure...</Text>
          </Center>
        );
      case 'error':
        return (
          <Center style={{ height: '100%', flexDirection: 'column' }}>
            <Text c="red" mb="md">Error generating figure: {figure.generation_error}</Text>
            <Button
              leftSection={<IconRefresh size={14} />}
              color="red"
              variant="outline"
              onClick={() => handleRetry(figure)}
              loading={loading}
            >
              Retry
            </Button>
          </Center>
        );
      case 'complete':
        return (
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
                href={getFigureUrl(figure.id)}
                download
                pos="absolute"
                top={10}
                right={10}
                variant="filled"
                style={{ zIndex: 10 }}
                onClick={(e) => e.stopPropagation()} // Prevent modal from opening when clicking download
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>

            <Box style={{ width: '100%', position: 'relative' }}>
              <Skeleton
                visible={true}
                height={"100%"}
                radius="md"
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
                src={getFigureUrl(figure.id)}
                alt="Figure"
                width={800}
                height={600}
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: '24px',
                  objectFit: 'contain',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  padding: '1rem'
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
        );
      default:
        return (
          <Center style={{ height: '100%' }}>
            <Text>Unknown status</Text>
          </Center>
        );
    }
  };

  return (figure.generation_status === 'idle' || figure.generation_status === 'generating' || figure.generation_status === 'error' || figure.generation_status === 'complete') && (
    <>
      <Card withBorder p="md" w={viewerMode.open ? "50%" : "40%"} key={"figure-" + figure.id}>
        {renderContent()}
      </Card>

      {/* Full-screen modal for the figure */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        size="xl"
        padding="md"
        title="Figure"
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
                  href={getFigureUrl(figure.id)}
                  download
                  pos="absolute"
                  top={10}
                  right={10}
                  variant="filled"
                  style={{ zIndex: 10 }}
                >
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
              <Image
                src={getFigureUrl(figure.id)}
                alt="Figure"
                width={1200}
                height={900}
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


