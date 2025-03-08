/**
 * HomeworkContent.tsx
 * This component will be used to display homework assignments.
 * @AshokSaravanan222
 * 03/06/2025
 */
import { useState, useRef } from "react";
import { Button, Card, Stack, Text, Group } from "@mantine/core";
import { IconRefresh, IconUpload } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { Document, Exercise, Homework } from "@/types";

interface HomeworkContentProps {
    classId: string;
    homeworks: Homework[] | undefined;
    exercises: Exercise[] | undefined;
    textbookDocuments: Document[] | undefined;
    loadingHomeworks: boolean;
    loadingExercises: boolean;
    processingHomeworks: Set<string>;
    setProcessingHomeworks: (value: React.SetStateAction<Set<string>>) => void;
    handleRetryHomework: (classId: string, homework: Homework) => void;
    handleUploadHomework: (file: File) => void;
}

export default function HomeworkContent({
    classId,
    homeworks,
    exercises,
    textbookDocuments,
    loadingHomeworks,
    loadingExercises,
    processingHomeworks,
    setProcessingHomeworks,
    handleRetryHomework,
    handleUploadHomework
}: HomeworkContentProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUploadHomework(file);
        }
        // Reset the input so the same file can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    // Trigger file input click
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    // Function to get homework image URL using the provided snippet
    const getHomeworkImageUrl = (homeworkId: string) => {
        if (!homeworkId) return '/placeholder_image.svg';
        // find the first exercise in the homework
        const exercise = exercises?.find(e => e.homework === homeworkId);
        if (!exercise) return '/placeholder_image.svg';

        // find the textbook document that has the same page number, but null for the chapter, homework and exercise
        const textbookDocumentHomework = textbookDocuments?.find(d => d.homeworks?.includes(homeworkId));
        if (textbookDocumentHomework) return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentHomework.textbook}/${textbookDocumentHomework.id}.png`;

        // return the /classid/exerciseid.png
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`;
    };

    // Skeleton component for content items
    function ContentSkeleton() {
        return (
            <Card withBorder>
                <Group align="flex-start">
                    <div style={{ width: 150, height: 150, borderRadius: "10px", background: "#f0f0f0" }} />
                    <Stack gap="xs">
                        <div style={{ height: 24, width: 200, background: "#f0f0f0", borderRadius: 4 }} />
                        <div style={{ height: 16, width: 150, background: "#f0f0f0", borderRadius: 4 }} />
                    </Stack>
                </Group>
            </Card>
        );
    }

    return (
        <Stack mt="md">
            <Group justify="space-between" align="center">
                <Text size="xl" fw={700} mb={6} pl={4}>Homework</Text>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        style={{ display: 'none' }}
                    />
                    <Button 
                        leftSection={<IconUpload size={14} />} 
                        onClick={triggerFileInput}
                    >
                        Upload Homework
                    </Button>
                </div>
            </Group>

            <Stack>
                {loadingHomeworks || loadingExercises ? (
                    <>
                        <ContentSkeleton />
                        <ContentSkeleton />
                        <ContentSkeleton />
                    </>
                ) : homeworks?.length === 0 ? (
                    <Text c="dimmed" ta="center">No homework assignments yet</Text>
                ) : (
                    homeworks?.sort((a, b) =>
                        new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()
                    ).map((homework) => {
                        const homeworkExercises = exercises?.filter(e => e.homework === homework.id) ?? [];
                        const isProcessing = homework.parse_status !== "complete";

                        if (isProcessing) {
                            return (
                                <Card withBorder key={homework.id}>
                                    <Group align="flex-start" justify="space-between">
                                        <Group align="flex-start">
                                            <Image
                                                src={getHomeworkImageUrl(homework.id)}
                                                alt={`First page of ${homework.title}`}
                                                width={150}
                                                height={150}
                                                style={{ objectFit: "contain", borderRadius: "10px" }}
                                            />
                                            <Stack gap="xs">
                                                <Text size="lg" fw={500}>{homework.title}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {homework.parse_status === 'parsing' ? 'Processing exercises...' :
                                                        homework.parse_status === 'error' ? 'Processing failed' :
                                                            homework.parse_status === 'idle' ? 'Waiting to process' :
                                                                'Could not process exercises.'}
                                                </Text>
                                                {homework.parse_error && (
                                                    <Text size="sm" c="red">
                                                        Error: {homework.parse_error}
                                                    </Text>
                                                )}
                                                <div
                                                    style={{
                                                        height: '8px',
                                                        width: '100%',
                                                        backgroundColor: '#e9ecef',
                                                        borderRadius: '4px',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: '100%',
                                                            backgroundColor: '#228be6',
                                                            animation: homework.parse_status === 'parsing' ? 'progress-animation 2s linear infinite' : 'none'
                                                        }}
                                                    />
                                                </div>
                                                {homework.parse_status === 'parsing' && (
                                                    <Text size="sm" c="dimmed">
                                                        Estimated time remaining: ~10 seconds
                                                    </Text>
                                                )}
                                            </Stack>
                                        </Group>
                                        <Button
                                            variant="light"
                                            color="blue"
                                            onClick={() => handleRetryHomework(classId, homework)}
                                            leftSection={<IconRefresh size={16} />}
                                            disabled={homework.parse_status === 'parsing' || homework.parse_status === 'idle'}
                                            loading={processingHomeworks.has(homework.id)}
                                        >
                                            {processingHomeworks.has(homework.id) ? 'Retrying...' :
                                                homework.parse_status === 'parsing' ? 'Processing...' :
                                                    homework.parse_status === 'error' ? 'Retry Processing' :
                                                        'Processing...'}
                                        </Button>
                                    </Group>
                                </Card>
                            );
                        }
                        return (
                            <Link
                                href={`/classes/c/${classId}/homework/${homework.id}`}
                                key={homework.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card withBorder>
                                    <Group align="flex-start">
                                        <Image
                                            src={getHomeworkImageUrl(homework.id)}
                                            alt={`First page of ${homework.title}`}
                                            width={150}
                                            height={150}
                                            style={{ objectFit: "contain", borderRadius: "10px" }}
                                        />
                                        <Stack gap="xs">
                                            <Text size="lg" fw={500}>{homework.title}</Text>
                                            <Group gap="xs">
                                                <Text size="sm" c="dimmed">
                                                    Created: {new Date(homework.created_at).toLocaleDateString()}
                                                </Text>
                                                <Text size="sm" c="dimmed">•</Text>
                                                <Text size="sm" c="dimmed">
                                                    {homeworkExercises.length} exercises
                                                </Text>
                                            </Group>
                                        </Stack>
                                    </Group>
                                </Card>
                            </Link>
                        );
                    })
                )}
            </Stack>
            <style jsx global>{`
                @keyframes progress-animation {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </Stack>
    );
}