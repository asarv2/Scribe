/**
 * HomeworkContent.tsx
 * This component will be used to display homework assignments.
 * @AshokSaravanan222
 * 03/06/2025
 */
import { Button, Card, Stack, Text, Group, Skeleton } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
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
    displayMode: 'horizontal' | 'vertical';
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
    displayMode
}: HomeworkContentProps) {
    // Function to get homework image URL
    const getHomeworkImageUrl = (homeworkId: string) => {
        if (!homeworkId) return '/placeholder_image.svg';
        const exercise = exercises?.find(e => e.homework === homeworkId);
        if (!exercise) return '/placeholder_image.svg';

        const textbookDocumentHomework = textbookDocuments?.find(d => d.homeworks?.includes(homeworkId));
        if (textbookDocumentHomework) return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentHomework.textbook}/${textbookDocumentHomework.id}.png`;

        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`;
    };

    // Skeleton component for content items
    function ContentSkeleton() {
        return (
            <Card withBorder style={{ width: displayMode === 'horizontal' ? '300px' : '100%', flexShrink: 0 }}>
                <Group align="flex-start">
                    <Skeleton height={150} width={150} />
                    <Stack gap="xs">
                        <Skeleton height={24} width={200} />
                        <Skeleton height={16} width={150} />
                    </Stack>
                </Group>
            </Card>
        );
    }

    if (loadingHomeworks || loadingExercises) {
        return (
            <Group wrap={displayMode === 'horizontal' ? 'nowrap' : 'wrap'}>
                <ContentSkeleton />
                <ContentSkeleton />
                <ContentSkeleton />
            </Group>
        );
    }

    if (!homeworks || homeworks.length === 0) {
        return (
            <Text c="dimmed" ta="center">No homework assignments yet</Text>
        );
    }

    return (
        <Group wrap={displayMode === 'horizontal' ? 'nowrap' : 'wrap'}>
            {homeworks.sort((a, b) =>
                new Date(b.created_at ?? "").getTime() - new Date(a.created_at ?? "").getTime()
            ).map((homework) => {
                const homeworkExercises = exercises?.filter(e => e.homework === homework.id) ?? [];
                const isProcessing = homework.parse_status !== "complete";

                if (isProcessing) {
                    return (
                        <Card 
                            withBorder 
                            key={homework.id}
                            style={{ 
                                width: displayMode === 'horizontal' ? '300px' : '100%',
                                flexShrink: 0
                            }}
                        >
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
                        <Card 
                            withBorder
                            style={{ 
                                width: displayMode === 'horizontal' ? '300px' : '100%',
                                flexShrink: 0
                            }}
                        >
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
            })}
            <style jsx global>{`
                @keyframes progress-animation {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </Group>
    );
}