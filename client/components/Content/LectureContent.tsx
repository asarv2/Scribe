/**
 * LectureContent.tsx
 * This component will be used to display the content of a lecture.
 * @AshokSaravanan222
 * 03/06/2025
 */
import { useState, useMemo, useRef } from "react";
import { Button, Card, Stack, Text, Progress, Group, Skeleton } from "@mantine/core";
import { IconRefresh, IconUpload } from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { Lecture } from "@/types";

interface LectureContentProps {
    classId: string;
    lectures: Lecture[] | undefined;
    lectureDocuments: any[] | undefined;
    loadingLectures: boolean;
    loadingLectureDocuments: boolean;
    parsingLectures: Set<string>;
    setParsingLectures: (value: React.SetStateAction<Set<string>>) => void;
    handleRetryLecture: (classId: string, lecture: Lecture) => void;
    handleUploadLecture: (file: File) => void;
}

export default function LectureContent({
    classId,
    lectures,
    lectureDocuments,
    loadingLectures,
    loadingLectureDocuments,
    parsingLectures,
    setParsingLectures,
    handleRetryLecture,
    handleUploadLecture
}: LectureContentProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleUploadLecture(file);
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

    // Lecture functions
    const getLectureProgress = useMemo(() => {
        return (lectureId: string, uploading: boolean = false) => {
            if (!lectureDocuments || !lectures) return 0;
            const filteredDocs = lectureDocuments.filter(document =>
                document.lecture === lectureId && (uploading || document.processed)
            );
            const lecture = lectures.find(lecture => lecture.id === lectureId);
            if (!lecture || lecture.pages === 0) return 0;
            if (lecture.upload_progress !== 1) return lecture.upload_progress * 100;
            return (filteredDocs.length / lecture.pages) * 100;
        };
    }, [lectureDocuments, lectures]);

    const getLectureEstimatedTime = useMemo(() => {
        return (lectureId: string, uploading: boolean = false) => {
            const lecture = lectures?.find(lecture => lecture.id === lectureId);
            if (!lecture || lecture.pages === 0) return 0;
            return Number(((lecture.pages * 4)) * (100 - getLectureProgress(lectureId, uploading)) / 100).toFixed(2);
        };
    }, [lectures, getLectureProgress]);

    const getLectureImage = (lectureId: string) => {
        if (!lectureId) return '/placeholder_image.svg';
        const filteredDocuments = lectureDocuments?.filter(document => document?.lecture === lectureId);
        if (!filteredDocuments || filteredDocuments.length === 0) return '/placeholder_image.svg';
        const document = (filteredDocuments.length > 1 && classId === "ae333215-2914-4026-8aae-418f1255cdd0") ? filteredDocuments[1] : filteredDocuments[0];
        if (!document) return '/placeholder_image.svg';
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${document.lecture}/${document.id}.png`
    };

    // Skeleton component for content items
    function ContentSkeleton() {
        return (
            <Card withBorder>
                <Group align="flex-start">
                    <Skeleton visible={true} height={150} width={150} />
                    <Stack gap="xs">
                        <Skeleton visible={true} height={24} width={200} />
                        <Skeleton visible={true} height={16} width={150} />
                    </Stack>
                </Group>
            </Card>
        );
    }

    return (
        <Stack mt="md">
            <Group justify="space-between" align="center">
                <Text size="xl" fw={700} mb={6} pl={4}>Lectures</Text>
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        style={{ display: 'none' }}
                    />
                    <Button 
                        leftSection={<IconUpload size={14} />} 
                        onClick={triggerFileInput}
                    >
                        Upload Lectures
                    </Button>
                </div>
            </Group>

            <Stack>
                {loadingLectures || loadingLectureDocuments ? (
                    <>
                        <ContentSkeleton />
                        <ContentSkeleton />
                        <ContentSkeleton />
                    </>
                ) : lectures?.length === 0 ? (
                    <Text c="dimmed" ta="center">No lectures found</Text>
                ) : (
                    lectures?.sort((a, b) => (b.note_number ?? 0) - (a.note_number ?? 0)).map((lecture) => {
                        if (lecture.parse_status !== "complete") {
                            return (
                                <Card withBorder key={lecture.id}>
                                    <Group align="flex-start" justify="space-between">
                                        <Group align="flex-start">
                                            <Image
                                                src={getLectureImage(lecture.id)}
                                                alt={`First page of ${lecture.name}`}
                                                width={150}
                                                height={150}
                                                style={{ objectFit: "contain", borderRadius: "10px" }}
                                            />
                                            <Stack gap="xs">
                                                <Text size="lg" fw={500}>{lecture.name}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {lecture.parse_status === 'parsing' ? 'Parsing...' :
                                                        lecture.parse_status === 'error' ? 'Parse failed' :
                                                            lecture.parse_status === 'idle' ? 'Waiting to parse' :
                                                                'Could not find any topics.'}
                                                </Text>
                                                {lecture.parse_error && (
                                                    <Text size="sm" c="red">
                                                        Error: {lecture.parse_error}
                                                    </Text>
                                                )}
                                                <Progress
                                                    value={getLectureProgress(lecture.id, lecture.parse_status !== 'parsing')}
                                                    size="sm"
                                                    color="blue"
                                                    animated={lecture.parse_status === 'parsing'}
                                                    striped={lecture.parse_status === 'parsing'}
                                                />
                                                {(lecture.parse_status === 'parsing') && (
                                                    <Text size="sm" c="dimmed">
                                                        Estimated time remaining: ~{getLectureEstimatedTime(lecture.id, lecture.parse_status !== 'parsing')} seconds
                                                    </Text>
                                                )}
                                            </Stack>
                                        </Group>
                                        <Button
                                            variant="light"
                                            color="blue"
                                            onClick={() => handleRetryLecture(classId, lecture)}
                                            leftSection={<IconRefresh size={16} />}
                                            disabled={lecture.parse_status === 'parsing' || lecture.parse_status === 'idle'}
                                            loading={parsingLectures.has(lecture.id)}
                                        >
                                            {parsingLectures.has(lecture.id) ? 'Retrying...' :
                                                lecture.parse_status === 'parsing' ? 'Parsing...' :
                                                    lecture.parse_status === 'error' ? 'Retry' :
                                                        'Processing...'}
                                        </Button>
                                    </Group>
                                </Card>
                            );
                        }
                        return (
                            <Link
                                href={`/classes/c/${classId}/lecture/${lecture.id}`}
                                key={lecture.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card withBorder>
                                    <Group align="flex-start">
                                        <Image
                                            src={getLectureImage(lecture.id)}
                                            alt={`First page of ${lecture.name}`}
                                            width={150}
                                            height={150}
                                            style={{ objectFit: "contain", borderRadius: "10px" }}
                                        />
                                        <Stack gap="xs">
                                            <Text size="lg" fw={500}>{lecture.name}</Text>
                                            <Text size="sm" c="dimmed">
                                                Uploaded {new Date(lecture.created_at ?? "").toLocaleDateString()}
                                            </Text>
                                        </Stack>
                                    </Group>
                                </Card>
                            </Link>
                        );
                    })
                )}
            </Stack>
        </Stack>
    );
}


