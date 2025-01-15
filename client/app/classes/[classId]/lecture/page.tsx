/**
 * app/classes/[classId]/lecture/page.tsx
 * This page is for showing the lectures of the class. It will show all the lectures of the class, and the option to upload lectures manually.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useRef, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconUpload, IconRefresh } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, em, Group, Loader, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import DeleteLectureModal from "@/components/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getLectures } from "@/utils/queries/get-lectures";
import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";
import { createLecture } from "@/utils/services/lecture";
import { getDocuments } from "@/utils/queries/get-documents";
import * as pdfjs from 'pdfjs-dist';
import { Document, Lecture, Topic } from "@/types";
import { getTopics } from "@/utils/queries/get-topics";

export default function LecturePage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const fileInputRef = useRef<HTMLButtonElement>(null);
    const classId = params.classId;
    const router = useRouter();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId, false)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["documents", classId],
        queryFn: () => getDocuments(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    })

    const { data: topics, isLoading: loadingTopics } = useQuery({
        queryKey: ["topics", classId],
        queryFn: () => getTopics(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [parsingLectures, setParsingLectures] = useState<Set<string>>(new Set());
    const [progressMap, setProgressMap] = useState<Record<string, number>>({});

    const handleFilesUpload = async (files: File[] | null) => {
        if (!files || files.length === 0) {
            notifications.show({
                title: 'Error',
                message: 'Please select PDF files',
                color: 'red'
            });
            return;
        }

        const invalidFiles = files.filter(file => !file.type.includes('pdf'));
        if (invalidFiles.length > 0) {
            notifications.show({
                title: 'Error',
                message: 'Only PDF files are allowed',
                color: 'red'
            });
            return;
        }

        try {
            setSelectedFiles(files);

            const uploadPromises = files.map(async (file) => {
                try {
                    await processLecturePDF(
                        file,
                        classId,
                    );

                    notifications.show({
                        title: 'Success',
                        message: `${file.name} uploaded successfully`,
                        color: 'green'
                    });
                } catch (error) {
                    notifications.show({
                        title: 'Error',
                        message: `Failed to upload ${file.name}`,
                        color: 'red'
                    });
                    console.error(`Upload error for ${file.name}:`, error);
                }
            });

            await Promise.all(uploadPromises);

            setSelectedFiles([]);

        } catch (error) {
            notifications.show({
                title: 'Error',
                message: 'Failed to process files',
                color: 'red'
            });
            console.error('Upload error:', error);
        }
    };

    const processLecturePDF = async (
        file: File,
        classId: string,
    ) => {
        const file_name = file.name.split(".")[0];
        console.log("File name:", file_name);

        // convert file to array buffer
        const pdfBuffer = await file.arrayBuffer();

        // Get actual page count using PDF.js with proper worker setup
        const pdfJS = await import('pdfjs-dist');
        pdfJS.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';

        const pdf = await pdfJS.getDocument(pdfBuffer).promise;
        const numPages = pdf.numPages;
        console.log("Number of pages:", numPages);

        const lecture = await createLecture(classId, file_name, (lectures?.length ?? 0) + 1, numPages);
        console.log("Lecture ID:", lecture.id);
        // uploading images to supabase
        const images = await Promise.all(Array.from({ length: numPages }, async (_, i) => {
            const page = await pdf.getPage(i + 1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Convert canvas to blob
            const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob((blob) => blob ? resolve(blob) : reject('Failed to create blob'), 'image/png')
            );

            // Fix the storage path - remove 'object' from the path
            const uploadPath = `${classId}/lectures/${lecture.id}/images/${i + 1}.png`;
            console.log("Uploading to path:", uploadPath); // Debug log

            return supabase.storage
                .from("slides") // Just the bucket name
                .upload(uploadPath, blob, {
                    cacheControl: '3600',
                    upsert: true // Add this if you want to overwrite existing files
                });
        }));
        console.log("Images uploaded:", images);
        const response = await supabase.functions.invoke('parse-lecture', {
            body: {
                class_id: classId,
                lecture_id: lecture.id,
                handwritten: true
            }
        });
        console.log("Parse lecture function response:", response);
    };

    const getProgress = (lectureId: string) => {
        if (progressMap[lectureId] !== undefined) {
            return progressMap[lectureId];
        }

        if (!documents || !lectures) return 0;
        const lectureDocuments = documents.filter(document => document.lecture === lectureId);
        const lecture = lectures.find(lecture => lecture.id === lectureId);
        if (!lecture || lecture.pages === 0) return 0;

        const progress = (lectureDocuments.length / lecture.pages) * 100;

        setProgressMap(prev => ({
            ...prev,
            [lectureId]: progress
        }));

        return progress;
    };

    const canRetryBatching = (lecture: Lecture) => {
        const lectureTopics = topics?.filter(topic => topic.lectures?.includes(lecture.id) && topic.map_parent !== null);
        if (!lectureTopics || lectureTopics.length === 0) return true;
        return false
    }

    const canRetry = (lecture: Lecture) => {
        const TIMEOUT = 150 * 1000; // 150 seconds in milliseconds
        if (lecture.last_parse_attempt) {
            const lastAttempt = new Date(lecture.last_parse_attempt);
            const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();
            if (timeSinceLastAttempt > TIMEOUT && (lecture.parse_status === 'parsing' || lecture.parse_status === 'batching')) {
                return true;
            }
        }
        return false;
    }



    const handleRetry = async (classId: string, lecture: Lecture) => {
        try {
            setParsingLectures(prev => new Set(prev).add(lecture.id));
            if (lecture.parse_status === 'batching' || canRetryBatching(lecture)) {
                // If in batching state, retry the batching process
                await retryBatching(lecture.id);
            } else {
                // Otherwise retry the parsing process
                const response = await supabase.functions.invoke('parse-lecture', {
                    body: {
                        class_id: classId,
                        lecture_id: lecture.id,
                        handwritten: true
                    }
                });

                if (response.error) {
                    throw new Error(response.error.message);
                }
            }
        } catch (error) {
            console.error('Error retrying:', error);
            notifications.show({
                title: 'Error',
                message: `Failed to retry ${lecture.parse_status === 'batching' ? 'batching' : 'parsing'}. Please try again.`,
                color: 'red'
            });
        } finally {
            setParsingLectures(prev => {
                const next = new Set(prev);
                next.delete(lecture.id);
                return next;
            });
        }
    };

    const retryBatching = async (lectureId: string) => {
        try {
            const response = await supabase.functions.invoke('batch-topics', {
                body: {
                    class_id: classId,
                    lecture_id: lectureId
                }
            });
            console.log("Batch topics function response:", response);
        } catch (error) {
            console.error('Error retrying batching:', error);
            notifications.show({
                title: 'Error',
                message: 'Failed to retry batching. Please try again.',
                color: 'red'
            });
        }
    }

    useEffect(() => {
        const channel = supabase
            .channel('realtime-lectures')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'lectures',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newLecture = payload.new as Lecture;
                        console.log("Lecture:", newLecture);
                        // Update your lectures state with the new data
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[]) => {
                            return [...oldData, newLecture];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedLecture = payload.new as Lecture;
                        console.log("Updated Lecture:", updatedLecture);
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[]) => {
                            return oldData.map(lecture => lecture.id === updatedLecture.id ? updatedLecture : lecture);
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase]);

    useEffect(() => {
        if (!lectures) return;
        const channel = supabase
            .channel('realtime-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `lecture=in.(${lectures.map(lecture => lecture.id).join(',')})`
                },
                (payload) => {
                    console.log("Document change:", payload);

                    // Update documents in React Query cache
                    queryClient.setQueryData(["documents", classId], (oldData: Document[] = []) => {
                        let newData;
                        if (payload.eventType === 'INSERT') {
                            newData = [...oldData, payload.new];
                        } else if (payload.eventType === 'DELETE') {
                            newData = oldData.filter(doc => doc.id !== payload.old.id);
                        } else if (payload.eventType === 'UPDATE') {
                            newData = oldData.map(doc =>
                                doc.id === payload.new.id ? payload.new : doc
                            );
                        } else {
                            newData = oldData;
                        }
                        const newDocument = payload.new as Document;

                        // Update progress for the affected lecture
                        const lectureId = newDocument.lecture;
                        if (lectureId) {
                            const lecture = lectures?.find(l => l.id === lectureId);
                            if (lecture) {
                                const progress = (newData.filter(doc => doc.lecture === lectureId).length / lecture.pages) * 100;
                                setProgressMap(prev => ({
                                    ...prev,
                                    [lectureId]: progress
                                }));
                            }
                        }

                        return newData;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, lectures, queryClient]);

    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>Lectures</Text>
                        </Group>
                        <Group>
                            <Button onClick={() => fileInputRef.current?.click()} leftSection={<IconUpload size={14} />}>Upload Lectures</Button>
                            <FileInput
                                ref={fileInputRef}
                                placeholder="Upload PDFs"
                                accept="application/pdf"
                                multiple
                                onChange={handleFilesUpload}
                                value={selectedFiles}
                                style={{ display: 'none' }}
                            />
                        </Group>
                    </Flex>

                    <Stack>
                        {(lectures && classData) && lectures.length > 0 && lectures.sort((a, b) => (b.note_number ?? 0) - (a.note_number ?? 0)).map((lecture) => {
                            if (lecture.parse_status !== "complete" || canRetryBatching(lecture)) {
                                const progress = getProgress(lecture.id);
                                const remainingPages = lecture.pages - Math.floor((progress / 100) * lecture.pages);
                                const estimatedSeconds = remainingPages * 4;
                                const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
                                return (
                                    <Card withBorder key={lecture.id}>
                                        <Group align="flex-start" justify="space-between">
                                            <Group align="flex-start">
                                                <MantineImage
                                                    src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/lectures/${lecture.id}/images/1.png`}
                                                    alt={`First page of ${lecture.name}`}
                                                    width={200}
                                                    height={150}
                                                    fit="contain"
                                                    fallbackSrc="/placeholder_image.svg"
                                                />
                                                <Stack gap="xs">
                                                    <Text size="lg" fw={500}>{lecture.name}</Text>
                                                    {canRetry(lecture) ? (
                                                        <Text size="sm" c="dimmed">
                                                            {lecture.parse_status === 'parsing' ? 'Retry parsing. The function may have timed out.' :
                                                                lecture.parse_status === 'batching' ? 'Retry batching. The function may have timed out.' :
                                                                    lecture.parse_status === 'error' ? 'Retry parse. The function may have timed out.' : 'Retry parse. The function may have timed out.'}
                                                        </Text>
                                                    ) : (
                                                        <Text size="sm" c="dimmed">
                                                            {lecture.parse_status === 'parsing' ? 'Parsing...' :
                                                                lecture.parse_status === 'batching' ? 'Creating topics and groups...' :
                                                                    lecture.parse_status === 'error' ? 'Parse failed' : lecture.parse_status === 'idle' ? 'Waiting to parse' : 'Could not find any topics.'}
                                                        </Text>
                                                    )}
                                                    {lecture.parse_error && (
                                                        <Text size="sm" c="red">
                                                            Error: {lecture.parse_error}
                                                        </Text>
                                                    )}
                                                    {canRetry(lecture) ?
                                                        <Progress
                                                            value={progress}
                                                            size="sm"
                                                            color={lecture.parse_status === 'parsing' ? 'blue' :
                                                                lecture.parse_status === 'batching' ? 'orange' :
                                                                    'blue'}
                                                        /> :
                                                        <Progress
                                                            value={progress}
                                                            size="sm"
                                                            color={lecture.parse_status === 'parsing' ? 'blue' :
                                                                lecture.parse_status === 'batching' || canRetryBatching(lecture) ? 'orange' :
                                                                    'blue'}
                                                            animated={lecture.parse_status === 'parsing' || lecture.parse_status === 'batching'}
                                                            striped={lecture.parse_status === 'parsing' || lecture.parse_status === 'batching'}
                                                        />}
                                                    {(lecture.parse_status === 'parsing') && (
                                                        <Text size="sm" c="dimmed">
                                                            Estimated time remaining: ~{estimatedMinutes} minute{estimatedMinutes !== 1 ? 's' : ''}
                                                        </Text>
                                                    )}
                                                </Stack>
                                            </Group>
                                            {canRetry(lecture) ?
                                                <Button
                                                    variant="light"
                                                    color={lecture.parse_status === 'parsing' ? 'blue' : 'orange'}
                                                    onClick={() => handleRetry(classId, lecture)}
                                                    leftSection={<IconRefresh size={16} />}
                                                    loading={parsingLectures.has(lecture.id)}
                                                >
                                                    {parsingLectures.has(lecture.id) ? 'Retrying...' :
                                                        lecture.parse_status === 'parsing' ? 'Retry Parsing' :
                                                            lecture.parse_status === 'batching' ? 'Retry Batching' :
                                                                !lecture.last_parse_attempt ? 'Start Parse' :
                                                                    'Processing...'}
                                                </Button> : <Button
                                                    variant="light"
                                                    color={lecture.parse_status === 'parsing' ? 'blue' : 'orange'}
                                                    onClick={() => handleRetry(classId, lecture)}
                                                    leftSection={<IconRefresh size={16} />}
                                                    disabled={lecture.parse_status === 'parsing' || lecture.parse_status === 'batching' || lecture.parse_status === 'idle'}
                                                    loading={parsingLectures.has(lecture.id)}
                                                >
                                                    {parsingLectures.has(lecture.id) ? 'Retrying...' :
                                                        lecture.parse_status === 'parsing' ? 'Parsing...' :
                                                            lecture.parse_status === 'batching' ? 'Processing...' :
                                                                'Retry Batching'}
                                                </Button>}
                                        </Group>
                                    </Card>
                                )
                            }
                            return (
                                <Link
                                    href={`/classes/${classId}/lecture/${lecture.id}`}
                                    key={lecture.id}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <Card withBorder>
                                        <Group align="flex-start">
                                            <MantineImage
                                                src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/lectures/${lecture.id}/images/1.png`}
                                                alt={`First page of ${lecture.name}`}
                                                width={200}
                                                height={150}
                                                fit="contain"
                                                fallbackSrc="/placeholder_image.svg" // You might want to add a placeholder image
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
                        })}
                    </Stack>
                </Stack>
            </Container>

        </>
    );
}