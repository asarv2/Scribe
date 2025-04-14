/**
 * app/classes/c/[classId]/grader/page.tsx
 * Page for uploading and managing assignments in a class.
 * @AshokSaravanan222
 * 05.01.2025
 */
"use client";

import { useState, useRef, use } from 'react';
import { ActionIcon, Paper, Text, List, Group, Box, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconFile, IconTrash } from '@tabler/icons-react';
import { ClassLayout } from "@/components/Class/ClassLayout";

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  date: Date;
};

export default function GraderPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      // TODO: Implement actual file upload logic here
      // In a real app, upload to server and get a response
      
      setTimeout(() => {
        // Add file to our local state
        const newFile: UploadedFile = {
          id: Date.now().toString(),
          name: file.name,
          type: file.type,
          date: new Date()
        };
        
        setUploadedFiles(prev => [...prev, newFile]);
        
        notifications.show({
          title: 'Success',
          message: 'Assignment uploaded successfully',
          color: 'green',
        });
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 1500);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to upload assignment',
        color: 'red',
      });
      setIsUploading(false);
    }
  };

  const handleDeleteFile = (id: string) => {
    // In a real app, you would also delete from the server
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
    
    notifications.show({
      title: 'File Deleted',
      message: 'The file has been removed',
      color: 'blue',
    });
  };

  return (
    <ClassLayout classId={classId}>
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <Title order={2}>Assignment Grader</Title>
          <Paper 
            p="md" 
            withBorder 
            shadow="sm" 
            className="w-16 h-16 flex items-center justify-center"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              style={{ display: 'none' }}
              accept=".pdf,.docx,.zip"
            />
            <ActionIcon 
              color="blue" 
              size="xl" 
              radius="md"
              variant="light"
              onClick={() => fileInputRef.current?.click()}
              loading={isUploading}
            >
              <IconPlus size={24} />
            </ActionIcon>
          </Paper>
        </div>

        {uploadedFiles.length > 0 ? (
          <Paper p="md" withBorder>
            <Title order={4} mb="md">Uploaded Assignments</Title>
            <List spacing="sm">
              {uploadedFiles.map(file => (
                <List.Item 
                  key={file.id}
                  icon={<IconFile size={18} />}
                >
                  <Group gap="apart" style={{ width: '100%' }}>
                    <Box>
                      <Text>{file.name}</Text>
                      <Text size="xs" color="dimmed">
                        {file.date.toLocaleString()}
                      </Text>
                    </Box>
                    <ActionIcon 
                      color="red" 
                      variant="subtle"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </List.Item>
              ))}
            </List>
          </Paper>
        ) : (
          <Paper p="md" withBorder>
            <Group justify="center">
              <Text color="dimmed">
                No assignments uploaded yet.
              </Text>
            </Group>
          </Paper>
        )}
      </div>
    </ClassLayout>
  );
}
