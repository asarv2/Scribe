/**
 * app/classes/c/[classId]/grader/page.tsx
 * Page for uploading assignments and grading them with AI.
 * @AshokSaravanan222
 * 05.01.2025
 */
"use client";

import { useState, useRef, useCallback } from 'react';
import { use } from 'react';  // Import React.use
import { ActionIcon, Paper, Text, List, Group, Box, Title, Loader, Button, Badge, Accordion, Progress, Alert, Container, Grid, Flex } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconFile, IconTrash, IconCheck, IconX, IconInfoCircle, IconUpload } from '@tabler/icons-react';
import { ClassLayout } from "@/components/Class/ClassLayout";

type GradedQuestion = {
  questionNumber: number;
  score: number;
  maxScore: number;
  explanation: string;
  correct: boolean;
};

type GradingResult = {
  totalScore: number;
  maxPossibleScore: number;
  questions: GradedQuestion[];
  feedback: string;
};

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  date: Date;
  file: File;
  isProcessing: boolean;
  gradingResult?: GradingResult;
};

export default function GraderPage({ params }: { params: { classId: string } }) {
  // Access classId directly from params
  const { classId } = params;

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      // Add file to our local state
      const newFile: UploadedFile = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        date: new Date(),
        file: file,
        isProcessing: false
      };
      
      setUploadedFiles(prev => [...prev, newFile]);
      
      notifications.show({
        title: 'Success',
        message: 'File uploaded successfully',
        color: 'green',
      });
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to upload file',
        color: 'red',
      });
      setIsUploading(false);
    }
  };

  const handleDeleteFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
    
    notifications.show({
      title: 'File Deleted',
      message: 'The file has been removed',
      color: 'blue',
    });
  };

  const handleGradeFile = async (fileId: string) => {
    // Find the file
    const fileToGrade = uploadedFiles.find(file => file.id === fileId);
    if (!fileToGrade) return;

    // Update file status to processing
    setUploadedFiles(prev => 
      prev.map(file => 
        file.id === fileId ? { ...file, isProcessing: true } : file
      )
    );

    try {
      // Create form data to send to the API
      const formData = new FormData();
      formData.append('file', fileToGrade.file);
      
      // Add file metadata
      formData.append('filename', fileToGrade.name);
      formData.append('filetype', fileToGrade.type);
      
      // Optional context about the assignment (can be expanded in the UI later)
      const assignmentContext = `Class ID: ${classId}, File: ${fileToGrade.name}`;
      formData.append('context', assignmentContext);
      
      // For image files AND PDFs, we'll convert to base64 and send in the request
      let base64File = null;
      if (fileToGrade.type.includes('image/') || fileToGrade.type.includes('pdf')) {
        console.log(`Converting ${fileToGrade.type} file to base64...`);
        base64File = await convertFileToBase64(fileToGrade.file);
        formData.append('base64file', base64File);
      }
      
      // Send file to our backend API for grading
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/grader/grade`;
      console.log('Sending request to API URL:', apiUrl);
      console.log('File being sent:', fileToGrade.name, fileToGrade.type);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Details:', errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      // Get grading result
      const result = await response.json();
      
      // Update file with grading result
      setUploadedFiles(prev => 
        prev.map(file => 
          file.id === fileId ? { 
            ...file, 
            isProcessing: false,
            gradingResult: result
          } : file
        )
      );
      
      notifications.show({
        title: 'Grading Complete',
        message: 'The assignment has been graded successfully',
        color: 'green',
      });
    } catch (error) {
      console.error("Grading error:", error);
      
      // Update file status to not processing
      setUploadedFiles(prev => 
        prev.map(file => 
          file.id === fileId ? { ...file, isProcessing: false } : file
        )
      );
      
      notifications.show({
        title: 'Grading Failed',
        message: 'Failed to grade the assignment. Please try again.',
        color: 'red',
      });
    }
  };
  
  // Helper function to convert file to base64 - needed for image processing
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <ClassLayout classId={classId}>
      <Container fluid>
        <div className="p-6">
          <Title order={2} mb="xl">Assignment Grader</Title>

          <Grid>
            {/* Upload Assignment Card */}
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Paper p="md" withBorder radius="md" style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Flex direction="column" align="center" gap="md">
                  <IconUpload size={48} stroke={1.5} color="gray" />
                  <Button
                    variant="light"
                    onClick={() => fileInputRef.current?.click()}
                    loading={isUploading}
                  >
                    Upload Assignment
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelected}
                      style={{ display: 'none' }}
                      accept=".pdf,.docx,.png,.jpg,.jpeg"
                    />
                  </Button>
                </Flex>
              </Paper>
            </Grid.Col>

            {/* Assignment Cards */}
            {uploadedFiles.map(file => (
              <Grid.Col key={file.id} span={{ base: 12, sm: 6, md: 3 }}>
                <Paper 
                  withBorder 
                  radius="md" 
                  style={{ 
                    height: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    height: '100%',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      paddingRight: '8px',
                      marginBottom: '2px'
                    }}>
                      <Group gap="apart" mb="xs">
                        <Group>
                          <IconFile size={18} />
                          <Box>
                            <Text fw={500}>{file.name}</Text>
                            <Text size="xs" color="dimmed">
                              {file.date.toLocaleString()}
                            </Text>
                          </Box>
                        </Group>
                        <ActionIcon 
                          color="red" 
                          variant="subtle"
                          onClick={() => handleDeleteFile(file.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                      
                      {!file.isProcessing && !file.gradingResult && (
                        <Button 
                          fullWidth
                          size="sm" 
                          variant="light"
                          onClick={() => handleGradeFile(file.id)}
                          mt="sm"
                        >
                          Grade Assignment
                        </Button>
                      )}
                      
                      {file.isProcessing && (
                        <Flex align="center" justify="center" gap="sm" mt="md">
                          <Loader size="sm" />
                          <Text size="sm">Grading...</Text>
                        </Flex>
                      )}

                      {file.gradingResult && (
                        <Box mt="md">
                          <Group gap="apart" mb="xs">
                            <Text size="sm" fw={500}>
                              Score: {file.gradingResult.totalScore}/{file.gradingResult.maxPossibleScore}
                            </Text>
                            <Badge 
                              color={file.gradingResult.totalScore / file.gradingResult.maxPossibleScore >= 0.7 ? "green" : "yellow"}
                            >
                              {Math.round(file.gradingResult.totalScore / file.gradingResult.maxPossibleScore * 100)}%
                            </Badge>
                          </Group>

                          <Progress 
                            value={(file.gradingResult.totalScore / file.gradingResult.maxPossibleScore) * 100} 
                            mb="sm"
                            color={file.gradingResult.totalScore / file.gradingResult.maxPossibleScore >= 0.7 ? "green" : "yellow"}
                          />

                          <Text size="xs" mb="md" lineClamp={2}>
                            {file.gradingResult.feedback}
                          </Text>

                          <Accordion>
                            {file.gradingResult.questions.map(question => (
                              <Accordion.Item key={question.questionNumber} value={`question-${question.questionNumber}`}>
                                <Accordion.Control>
                                  <Group>
                                    <Text size="sm">Q{question.questionNumber}</Text>
                                    <Badge 
                                      size="sm"
                                      color={question.correct ? "green" : "yellow"}
                                      rightSection={
                                        question.correct ? 
                                          <IconCheck size={12} /> : 
                                          <IconX size={12} />
                                      }
                                    >
                                      {question.score}/{question.maxScore}
                                    </Badge>
                                  </Group>
                                </Accordion.Control>
                                <Accordion.Panel>
                                  <Text size="sm">{question.explanation}</Text>
                                </Accordion.Panel>
                              </Accordion.Item>
                            ))}
                          </Accordion>
                        </Box>
                      )}
                    </div>
                  </div>
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </div>
      </Container>
    </ClassLayout>
  );
}
