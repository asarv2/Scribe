/**
 * app/classes/c/[classId]/content/page.tsx
 * This page will be an interactive page allowing the professor to view the content for the class, which includes lectures, textbooks (and their chapters in particular), and homework assignments.
 * @AshokSaravanan222
 * 03/06/2025
 * 
 */
"use client";

import { useEffect, useRef, useState, useMemo, use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Container, Flex, Group, Stack, Text, Progress, Tabs, Skeleton, TextInput, Select, ScrollArea, Tooltip, RingProgress, ActionIcon } from "@mantine/core";
import { IconUpload, IconRefresh, IconBook, IconNotebook, IconClipboard, IconSearch } from "@tabler/icons-react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ClassLayout } from "@/components/Class/ClassLayout";
import Image from "next/image";
import Link from "next/link";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClass } from "@/utils/queries/get-class";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getDocumentsLecture } from "@/utils/queries/get-documents-lecture";
import { getDocumentsTextbook } from "@/utils/queries/get-documents-textbook";
import { getExercises } from "@/utils/queries/get-exercises";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { Lecture, Textbook, Homework, Chapter } from "@/types";
import { getChapters } from "@/utils/queries/get-chapters";
import { notifications } from "@mantine/notifications";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";
import UploadLectureButton from "@/components/Buttons/UploadLectureButton";
import UploadHomeworkButton from "@/components/Buttons/UploadHomeworkButton";
import UploadTextbookButton from "@/components/Buttons/UploadTextbookButton";

export default function ContentPage({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();

    // Search states
    const [lectureSearch, setLectureSearch] = useState('');
    const [textbookSearch, setTextbookSearch] = useState('');
    const [homeworkSearch, setHomeworkSearch] = useState('');

    // Sort states
    const [lectureSortOrder, setLectureSortOrder] = useState('newest');
    const [textbookSortOrder, setTextbookSortOrder] = useState('newest');
    const [homeworkSortOrder, setHomeworkSortOrder] = useState('newest');

    // Processing states
    const [parsingLectures, setParsingLectures] = useState<Set<string>>(new Set());
    const [parsingTextbooks, setParsingTextbooks] = useState<Set<string>>(new Set());
    const [processingHomeworks, setProcessingHomeworks] = useState<Set<string>>(new Set());

    // User and profile data
    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user?.id ?? ""),
        enabled: !!user
    });

    // Class data
    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    });

    // Lectures data
    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId], false)
    });

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getDocumentsLecture(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    });

    // Textbooks data
    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId])
    });

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    });

    // Homework data
    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId])
    });

    const { data: exercises, isLoading: loadingExercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, [], homeworks?.map(h => h.id) ?? []),
        enabled: !!homeworks
    });

    const { data: homeworkDocs, isLoading: loadingHomeworkDocs } = useQuery({
        queryKey: ["homeworkDocs", classId],
        queryFn: () => getHomeworkDocuments(supabase, homeworks?.map(h => h.id) ?? []),
        enabled: !!homeworks
    });

    // Add this query inside the ContentPage component
    const { data: allChapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks?.map(t => t.id) ?? []),
        enabled: !!textbooks && textbooks.length > 0
    });

    // Create a memoized object to organize chapters by textbook
    const chaptersByTextbook = useMemo(() => {
        if (!allChapters) return {};

        const result: Record<string, Chapter[]> = {};
        allChapters.forEach(chapter => {
            if (!result[chapter.textbook]) {
                result[chapter.textbook] = [];
            }
            result[chapter.textbook].push(chapter);
        });
        return result;
    }, [allChapters]);

    // Filtered data
    const filteredLectures = useMemo(() => {
        if (!lectures) return [];
        return lectures
            .filter(lecture =>
                lecture.name?.toLowerCase().includes(lectureSearch.toLowerCase()) ?? false
            )
            .sort((a, b) => {
                if (lectureSortOrder === 'newest') {
                    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
                } else if (lectureSortOrder === 'oldest') {
                    return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime();
                } else {
                    return (a.name ?? '').localeCompare(b.name ?? '');
                }
            });
    }, [lectures, lectureSearch, lectureSortOrder]);

    const filteredTextbooks = useMemo(() => {
        if (!textbooks) return [];
        return textbooks
            .filter(textbook =>
                textbook.title.toLowerCase().includes(textbookSearch.toLowerCase())
            )
            .sort((a, b) => {
                if (textbookSortOrder === 'newest') {
                    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
                } else if (textbookSortOrder === 'oldest') {
                    return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime();
                } else {
                    return a.title.localeCompare(b.title);
                }
            });
    }, [textbooks, textbookSearch, textbookSortOrder]);

    const filteredHomeworks = useMemo(() => {
        if (!homeworks) return [];
        return homeworks
            .filter(homework =>
                homework.title.toLowerCase().includes(homeworkSearch.toLowerCase())
            )
            .sort((a, b) => {
                if (homeworkSortOrder === 'newest') {
                    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
                } else if (homeworkSortOrder === 'oldest') {
                    return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime();
                } else {
                    return a.title.localeCompare(b.title);
                }
            });
    }, [homeworks, homeworkSearch, homeworkSortOrder]);

    const handleRetryLecture = async (classId: string, lecture: Lecture) => {
        try {
            setParsingLectures(prev => new Set(prev).add(lecture.id));
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/lecture`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lecture_id: lecture.id,
                })
            });
        } catch (error) {
            console.error('Error retrying lecture:', error);
        } finally {
            setParsingLectures(prev => {
                const next = new Set(prev);
                next.delete(lecture.id);
                return next;
            });
        }
    };

    const handleRetryTextbook = async (classId: string, textbook: Textbook) => {
        try {
            setParsingTextbooks(prev => new Set(prev).add(textbook.id));
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/textbook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    textbook_id: textbook.id,
                })
            });
            queryClient.invalidateQueries({ queryKey: ["textbooks", classId] });
        } catch (error) {
            console.error('Error retrying textbook:', error);
        } finally {
            setParsingTextbooks(prev => {
                const next = new Set(prev);
                next.delete(textbook.id);
                return next;
            });
        }
    };

    const getTextbookImage = (textbookId: string) => {
        if (!textbookId) return '/placeholder_image.svg';
        const document = textbookDocuments?.find(document => document.textbook === textbookId);
        if (!document) return '/placeholder_image.svg';
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`
    };

    // Homework functions
    const handleRetryHomework = async (classId: string, homework: Homework) => {
        try {
            setProcessingHomeworks(prev => new Set(prev).add(homework.id));
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/parse/homework`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    homework_id: homework.id,
                })
            });
            queryClient.invalidateQueries({ queryKey: ["homeworks", classId] });
        } catch (error) {
            console.error('Error retrying homework:', error);
        } finally {
            setProcessingHomeworks(prev => {
                const next = new Set(prev);
                next.delete(homework.id);
                return next;
            });
        }
    };

    // Add realtime subscriptions for lectures
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
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[] | undefined) => {
                            return oldData ? [...oldData, newLecture] : [newLecture];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedLecture = payload.new as Lecture;
                        queryClient.setQueryData(["lectures", classId], (oldData: Lecture[] | undefined) => {
                            return oldData ? oldData.map(lecture =>
                                lecture.id === updatedLecture.id ? updatedLecture : lecture
                            ) : [updatedLecture];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscriptions for lecture documents
    useEffect(() => {
        if (!lectures || lectures.length === 0) return;

        const channel = supabase
            .channel('realtime-lecture-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `lecture=in.(${lectures.map(lecture => lecture.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["lectureDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, lectures, queryClient]);

    // Add realtime subscriptions for textbooks
    useEffect(() => {
        const channel = supabase
            .channel('realtime-textbooks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'textbooks',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newTextbook = payload.new as Textbook;
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[] | undefined) => {
                            return oldData ? [...oldData, newTextbook] : [newTextbook];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedTextbook = payload.new as Textbook;
                        queryClient.setQueryData(["textbooks", classId], (oldData: Textbook[] | undefined) => {
                            return oldData ? oldData.map(textbook =>
                                textbook.id === updatedTextbook.id ? updatedTextbook : textbook
                            ) : [updatedTextbook];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscriptions for textbook documents
    useEffect(() => {
        if (!textbooks || textbooks.length === 0) return;

        const channel = supabase
            .channel('realtime-textbook-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `textbook=in.(${textbooks.map(textbook => textbook.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["textbookDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, textbooks, queryClient]);

    // Add realtime subscriptions for homeworks
    useEffect(() => {
        const channel = supabase
            .channel('realtime-homeworks')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'homeworks',
                    filter: `class=eq.${classId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newHomework = payload.new as Homework;
                        queryClient.setQueryData(["homeworks", classId], (oldData: Homework[] | undefined) => {
                            return oldData ? [...oldData, newHomework] : [newHomework];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedHomework = payload.new as Homework;
                        queryClient.setQueryData(["homeworks", classId], (oldData: Homework[] | undefined) => {
                            return oldData ? oldData.map(homework =>
                                homework.id === updatedHomework.id ? updatedHomework : homework
                            ) : [updatedHomework];
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, queryClient]);

    // Add realtime subscriptions for exercises
    useEffect(() => {
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homework-exercises')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'exercises',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["exercises", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, homeworks, queryClient]);

    // Add realtime subscriptions for homework documents
    useEffect(() => {
        if (!homeworks || homeworks.length === 0) return;

        const channel = supabase
            .channel('realtime-homework-documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'prod',
                    table: 'documents',
                    filter: `homework=in.(${homeworks.map(homework => homework.id).join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: ["homeworkDocuments", classId]
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [classId, supabase, homeworks, queryClient]);

    // Add these functions to your ContentPage component
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

    const getLectureImage = (lectureId: string) => {
        if (!lectureId) return '/placeholder_image.svg';
        const filteredDocuments = lectureDocuments?.filter(document => document?.lecture === lectureId);
        if (!filteredDocuments || filteredDocuments.length === 0) return '/placeholder_image.svg';
        const document = (filteredDocuments.length > 1 && classId === "ae333215-2914-4026-8aae-418f1255cdd0") ? filteredDocuments[1] : filteredDocuments[0];
        if (!document) return '/placeholder_image.svg';
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${document.lecture}/${document.id}.png`
    };

    // Textbook functions
    const getTextbookProgress = useMemo(() => {
        return (textbookId: string, uploading: boolean = false) => {
            if (!textbookDocuments || !textbooks) return 0;
            const filteredDocs = textbookDocuments.filter(document =>
                document.textbook === textbookId && (uploading || document.processed)
            );
            const textbook = textbooks.find(textbook => textbook.id === textbookId);
            if (!textbook || textbook.pages === 0) return 0;
            return (filteredDocs.length / textbook.pages) * 100;
        };
    }, [textbookDocuments, textbooks]);

    const getHomeworkProgress = useMemo(() => {
        return (homeworkId: string, uploading: boolean = false) => {
            if (!exercises || !homeworks) return 0;
            const filteredDocs = exercises.filter(exercise =>
                exercise.homework === homeworkId && (uploading || exercise.description !== "")
            ) || 0;
            const homework = homeworks.find(homework => homework.id === homeworkId);
            if (!homework) return 0;
            return (filteredDocs.length / (exercises.filter(e => e.homework === homeworkId).length)) * 100;
        };
    }, [exercises, homeworks]);

    // Update the ContentSkeleton function
    function ContentSkeleton() {
        return (
            <Card withBorder style={{
                width: '350px',
                height: '320px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Stack style={{ height: '100%' }}>
                    <Skeleton height={200} width={320} style={{ margin: "0 auto" }} />
                    <Group align="flex-start" justify="space-between">
                        <Stack gap="xs" style={{ flex: 1 }}>
                            <Skeleton height={24} width="80%" />
                            <Skeleton height={16} width="60%" />
                        </Stack>
                        <Skeleton height={34} width={34} circle />
                    </Group>
                    <Skeleton height={8} width="100%" mt="xs" />
                    <Skeleton height={16} width="40%" mt="xs" />
                </Stack>
            </Card>
        );
    }

    const getHomeworkImageUrl = (homeworkId: string) => {
        if (!homeworkId) return '/placeholder_image.svg';
        const exercise = exercises?.find(e => e.homework === homeworkId);
        if (!exercise) return '/placeholder_image.svg';

        const textbookDocumentHomework = textbookDocuments?.find(d => d.homeworks?.includes(homeworkId));
        if (textbookDocumentHomework) return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentHomework.textbook}/${textbookDocumentHomework.id}.png`;

        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`;
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack gap="xl">
                    {/* Lectures Section */}
                    {classData?.lecture_enabled &&
                        <Stack>
                            <Group justify="space-between" align="center">
                                <Text size="xl" fw={700}>Lectures</Text>
                                <UploadLectureButton classId={classId} />
                            </Group>

                            <Group align="center" mb="md">
                                <TextInput
                                    placeholder="Search lectures..."
                                    leftSection={<IconSearch size={14} />}
                                    style={{ flexGrow: 1 }}
                                    value={lectureSearch}
                                    onChange={(e) => setLectureSearch(e.currentTarget.value)}
                                />
                                <Select
                                    data={[
                                        { value: 'newest', label: 'Newest First' },
                                        { value: 'oldest', label: 'Oldest First' },
                                        { value: 'name', label: 'Name' },
                                    ]}
                                    value={lectureSortOrder}
                                    onChange={(value) => setLectureSortOrder(value || 'newest')}
                                />
                            </Group>

                            <ScrollArea scrollbarSize={0}>
                                <Group wrap="nowrap" style={{ paddingBottom: 5 }}>
                                    {loadingLectures || loadingLectureDocuments ? (
                                        <>
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                        </>
                                    ) : !filteredLectures || filteredLectures.length === 0 ? (
                                        <Text c="dimmed" ta="center">No lectures found</Text>
                                    ) : (
                                        filteredLectures.sort((a, b) => (b.note_number ?? 0) - (a.note_number ?? 0)).map((lecture) => {
                                            if (lecture.parse_status !== "complete") {
                                                return (
                                                    <Card
                                                        withBorder
                                                        key={lecture.id}
                                                        style={{
                                                            width: '350px',
                                                            height: '320px',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        <Stack style={{ width: '100%', height: '100%' }}>
                                                            <Image
                                                                src={getLectureImage(lecture.id)}
                                                                alt={`First page of ${lecture.name}`}
                                                                width={320}
                                                                height={200}
                                                                style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                                                            />
                                                            <Group align="flex-start" justify="space-between">
                                                                <Stack gap="xs" style={{ flex: 1 }}>
                                                                    <Text size="lg" fw={500} lineClamp={1}>{lecture.name}</Text>
                                                                    <Text size="sm" c={lecture.parse_error ? "red" : "dimmed"} lineClamp={2}>
                                                                        {lecture.parse_error ?
                                                                            `Error: ${lecture.parse_error}` :
                                                                            lecture.parse_status === 'parsing' ? 'Parsing lecture content...' :
                                                                                lecture.parse_status === 'error' ? 'Processing failed' :
                                                                                    lecture.parse_status === 'idle' ? 'Waiting to process' :
                                                                                        lecture.parse_status === 'extracting' ? 'Extracting content...' :
                                                                                            lecture.parse_status === 'uploading' ? 'Uploading content...' :
                                                                                                'Processing content...'}
                                                                    </Text>
                                                                </Stack>
                                                                {lecture.parse_status !== 'error' ? <RingProgress
                                                                    size={60}
                                                                    thickness={4}
                                                                    sections={[{ value: getLectureProgress(lecture.id, lecture.parse_status !== 'parsing'), color: "blue" }]}
                                                                    label={
                                                                        <Text size="xs" ta="center">
                                                                            {Math.round(getLectureProgress(lecture.id, lecture.parse_status !== 'parsing'))}%
                                                                        </Text>
                                                                    }
                                                                /> : <ActionIcon variant="light" color="blue" size="lg" onClick={() => handleRetryLecture(classId, lecture)}>
                                                                    <IconRefresh size={20} />
                                                                </ActionIcon>}
                                                            </Group>
                                                        </Stack>
                                                    </Card>
                                                );
                                            }
                                            return (
                                                <Link
                                                    href={`/classes/c/${classId}/lecture/${lecture.id}`}
                                                    key={lecture.id}
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <Card
                                                        withBorder
                                                        style={{
                                                            width: '350px',
                                                            height: '320px',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        <Stack style={{ height: '100%' }}>
                                                            <Image
                                                                src={getLectureImage(lecture.id)}
                                                                alt={`First page of ${lecture.name}`}
                                                                width={320}
                                                                height={200}
                                                                style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                                                            />
                                                            <Stack gap="xs" mt="auto">
                                                                <Text size="lg" fw={500} lineClamp={1}>{lecture.name}</Text>
                                                                <Text size="sm" c="dimmed">
                                                                    Uploaded {new Date(lecture.created_at ?? "").toLocaleDateString()}
                                                                </Text>
                                                            </Stack>
                                                        </Stack>
                                                    </Card>
                                                </Link>
                                            );
                                        })
                                    )}
                                </Group>
                            </ScrollArea>
                        </Stack>
                    }

                    {/* Textbooks Section */}
                    {classData?.textbook_enabled &&
                        <Stack>
                            <Group justify="space-between" align="center">
                                <Text size="xl" fw={700}>Textbooks</Text>
                                <UploadTextbookButton classId={classId} />
                            </Group>

                            <Group align="center" mb="md">
                                <TextInput
                                    placeholder="Search textbooks..."
                                    leftSection={<IconSearch size={14} />}
                                    style={{ flexGrow: 1 }}
                                    value={textbookSearch}
                                    onChange={(e) => setTextbookSearch(e.currentTarget.value)}
                                />
                                <Select
                                    data={[
                                        { value: 'newest', label: 'Newest First' },
                                        { value: 'oldest', label: 'Oldest First' },
                                        { value: 'name', label: 'Name' },
                                    ]}
                                    value={textbookSortOrder}
                                    onChange={(value) => setTextbookSortOrder(value || 'newest')}
                                />
                            </Group>

                            <ScrollArea>
                                <Group wrap="nowrap" style={{ paddingBottom: 5 }}>
                                    {loadingTextbooks || loadingTextbookDocuments ? (
                                        <>
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                        </>
                                    ) : !filteredTextbooks || filteredTextbooks.length === 0 ? (
                                        <Text c="dimmed" ta="center">No textbooks found</Text>
                                    ) : (
                                        filteredTextbooks.map((textbook) => {
                                            if (textbook.parse_status !== "complete") {
                                                return (
                                                    <Card
                                                        withBorder
                                                        key={textbook.id}
                                                        style={{
                                                            width: '350px',
                                                            height: '320px',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        <Stack style={{ width: '100%', height: '100%' }}>
                                                            <Image
                                                                src={getTextbookImage(textbook.id)}
                                                                alt={`First page of ${textbook.title}`}
                                                                width={320}
                                                                height={200}
                                                                style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                                                            />
                                                            <Group align="flex-start" justify="space-between">
                                                                <Stack gap="xs" style={{ flex: 1 }}>
                                                                    <Text size="lg" fw={500} lineClamp={1}>{textbook.title}</Text>
                                                                    <Text size="sm" c={textbook.parse_error ? "red" : "dimmed"} lineClamp={2}>
                                                                        {textbook.parse_error ?
                                                                            `Error: ${textbook.parse_error}` :
                                                                            textbook.parse_status === 'parsing' ? 'Parsing textbook content...' :
                                                                                textbook.parse_status === 'error' ? 'Processing failed' :
                                                                                    textbook.parse_status === 'idle' ? 'Waiting to process' :
                                                                                        textbook.parse_status === 'extracting' ? 'Extracting content...' :
                                                                                            textbook.parse_status === 'uploading' ? 'Uploading content...' :
                                                                                                'Processing content...'}
                                                                    </Text>
                                                                </Stack>
                                                                {textbook.parse_status !== 'error' ? <RingProgress
                                                                    size={60}
                                                                    thickness={4}
                                                                    sections={[{ value: getTextbookProgress(textbook.id, textbook.parse_status !== 'parsing'), color: "blue" }]}
                                                                    label={
                                                                        <Text size="xs" ta="center">
                                                                            {Math.round(getTextbookProgress(textbook.id, textbook.parse_status !== 'parsing'))}%
                                                                        </Text>
                                                                    }
                                                                /> : <ActionIcon variant="light" color="blue" size="lg" onClick={() => handleRetryTextbook(classId, textbook)}>
                                                                    <IconRefresh size={20} />
                                                                </ActionIcon>}
                                                            </Group>
                                                        </Stack>
                                                    </Card>
                                                );
                                            }
                                            return (
                                                <Link
                                                    href={`/classes/c/${classId}/textbook/${textbook.id}`}
                                                    key={textbook.id}
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <Card
                                                        withBorder
                                                        style={{
                                                            width: '350px',
                                                            height: '320px',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        <Stack style={{ height: '100%' }}>
                                                            <Image
                                                                src={getTextbookImage(textbook.id)}
                                                                alt={`First page of ${textbook.title}`}
                                                                width={320}
                                                                height={200}
                                                                style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                                                            />
                                                            <Stack gap="xs" mt="auto">
                                                                <Text size="lg" fw={500} lineClamp={1}>{textbook.title}</Text>
                                                                <Text size="sm" c="dimmed">
                                                                    Uploaded {new Date(textbook.created_at ?? "").toLocaleDateString()}
                                                                </Text>
                                                            </Stack>
                                                        </Stack>
                                                    </Card>
                                                </Link>
                                            );
                                        })
                                    )}
                                </Group>
                            </ScrollArea>
                        </Stack>
                    }

                    {/* Homeworks Section */}
                    {classData?.homework_enabled &&
                        <Stack>
                            <Group justify="space-between" align="center">
                                <Text size="xl" fw={700}>Homework</Text>
                                <UploadHomeworkButton classId={classId} />
                            </Group>

                            <Group align="center" mb="md">
                                <TextInput
                                    placeholder="Search homework..."
                                    leftSection={<IconSearch size={14} />}
                                    style={{ flexGrow: 1 }}
                                    value={homeworkSearch}
                                    onChange={(e) => setHomeworkSearch(e.currentTarget.value)}
                                />
                                <Select
                                    data={[
                                        { value: 'newest', label: 'Newest First' },
                                        { value: 'oldest', label: 'Oldest First' },
                                        { value: 'name', label: 'Name' },
                                    ]}
                                    value={homeworkSortOrder}
                                    onChange={(value) => setHomeworkSortOrder(value || 'newest')}
                                />
                            </Group>

                            <ScrollArea>
                                <Group wrap="nowrap" style={{ paddingBottom: 5 }}>
                                    {loadingHomeworks || loadingExercises ? (
                                        <>
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                            <ContentSkeleton />
                                        </>
                                    ) : !filteredHomeworks || filteredHomeworks.length === 0 ? (
                                        <Text c="dimmed" ta="center">No homework assignments found</Text>
                                    ) : (
                                        filteredHomeworks.map((homework) => {
                                            const homeworkExercises = exercises?.filter(e => e.homework === homework.id) ?? [];

                                            if (homework.parse_status !== "complete") {
                                                return (
                                                    <Card
                                                        withBorder
                                                        key={homework.id}
                                                        style={{
                                                            width: '350px',
                                                            height: '320px',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        <Stack style={{ width: '100%', height: '100%' }}>
                                                            <Image
                                                                src={getHomeworkImageUrl(homework.id)}
                                                                alt={`First page of ${homework.title}`}
                                                                width={320}
                                                                height={200}
                                                                style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                                                            />
                                                            <Group align="flex-start" justify="space-between">
                                                                <Stack gap="xs" style={{ flex: 1 }}>
                                                                    <Text size="lg" fw={500} lineClamp={1}>{homework.title}</Text>
                                                                    <Text size="sm" c={homework.parse_error ? "red" : "dimmed"} lineClamp={2}>
                                                                        {homework.parse_error ?
                                                                            `Error: ${homework.parse_error}` :
                                                                            homework.parse_status === 'parsing' ? 'Processing exercises...' :
                                                                                homework.parse_status === 'error' ? 'Processing failed' :
                                                                                    homework.parse_status === 'idle' ? 'Waiting to process' :
                                                                                        'Processing content...'}
                                                                    </Text>
                                                                </Stack>
                                                                {homework.parse_status !== 'error' ? <RingProgress
                                                                    size={60}
                                                                    thickness={4}
                                                                    sections={[{ value: homework.parse_status === 'parsing' ? getHomeworkProgress(homework.id, homework.parse_status !== 'parsing') : 0, color: "blue" }]}
                                                                    label={
                                                                        <Text size="xs" ta="center">
                                                                            {Math.round(getHomeworkProgress(homework.id, homework.parse_status !== 'parsing'))}%
                                                                        </Text>
                                                                    }
                                                                /> : <ActionIcon variant="light" color="blue" size="lg" onClick={() => handleRetryHomework(classId, homework)}>
                                                                    <IconRefresh size={20} />
                                                                </ActionIcon>}
                                                            </Group>
                                                        </Stack>
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
                                                            width: '350px',
                                                            height: '320px',
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        <Stack style={{ height: '100%' }}>
                                                            <Image
                                                                src={getHomeworkImageUrl(homework.id)}
                                                                alt={`First page of ${homework.title}`}
                                                                width={320}
                                                                height={200}
                                                                style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                                                            />
                                                            <Stack gap="xs" mt="auto">
                                                                <Text size="lg" fw={500} lineClamp={1}>{homework.title}</Text>
                                                                <Text size="sm" c="dimmed">
                                                                    {homeworkExercises.length} exercises • Uploaded {new Date(homework.created_at ?? "").toLocaleDateString()}
                                                                </Text>
                                                            </Stack>
                                                        </Stack>
                                                    </Card>
                                                </Link>
                                            );
                                        })
                                    )}
                                </Group>
                            </ScrollArea>
                        </Stack>
                    }
                </Stack>
            </Container>
        </ClassLayout>
    );
}