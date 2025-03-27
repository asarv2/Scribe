/**
 * FigureViewer.tsx
 * This component is used to display a figure in the viewer.
 * @AshokSaravanan222
 * 03-25-2025
 */

import React, { useState } from 'react';
import { getFigureUrl } from "@/utils/services/images";
import { Card, Text, ActionIcon, Box, Group, Loader, Button, Center, Skeleton } from '@mantine/core';
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

  const handleRetry = async () => {
    try {
      setLoading(true);

      if (!figure.message) {
        throw new Error('No message id found');
      }

      const formData = new FormData();
      formData.append("message_id", figure.message);
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
              <Text c="dimmed">Generated at {new Date(figure.created_at).toLocaleString()}</Text>
              <ActionIcon 
                component="a" 
                href={getFigureUrl(figure.id)} 
                download
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Group>
            
            <Box
              pos="relative"
              style={{
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'center',
                margin: '1rem 0',
                padding: 0
              }}
            >
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
    <Card withBorder p="md" w={viewerMode?.immersive ? '100%' : 700} key={"figure-" + figure.id}>
      {renderContent()}
    </Card>
  );
}


