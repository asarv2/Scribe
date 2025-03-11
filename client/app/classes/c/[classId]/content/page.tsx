/**
 * app/classes/c/[classId]/content/page.tsx
 * This page will be an interactive page allowing the professor to view the content for the class, which includes lectures, textbooks (and their chapters in particular), and homework assignments.
 * @AshokSaravanan222
 * 03/06/2025
 * 
 */
"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Container, Flex, Group, Stack, Text, Progress, Tabs, Skeleton, TextInput, Select, ScrollArea } from "@mantine/core";
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
import LectureContent from "@/components/Content/LectureContent";
import TextbookContent from "@/components/Content/TextbookContent";
import { getChapters } from "@/utils/queries/get-chapters";
import HomeworkContent from "@/components/Content/HomeworkContent";
import { notifications } from "@mantine/notifications";

export default function ContentPage({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const [activeTab, setActiveTab] = useState<string | null>("lectures");

    // File input refs
    const lectureInputRef = useRef<HTMLInputElement>(null);
    const textbookInputRef = useRef<HTMLInputElement>(null);
    const homeworkInputRef = useRef<HTMLInputElement>(null);

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
        queryFn: () => getLectures(supabase, classId, false)
    });

    const { data: lectureDocuments, isLoading: loadingLectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getDocumentsLecture(supabase, lectures?.map(lecture => lecture.id) ?? []),
        enabled: !!lectures
    });

    // Textbooks data
    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId)
    });

    const { data: textbookDocuments, isLoading: loadingTextbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getDocumentsTextbook(supabase, textbooks?.map(textbook => textbook.id) ?? []),
        enabled: !!textbooks
    });

    // Homework data
    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId)
    });

    const { data: exercises, isLoading: loadingExercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, [], homeworks?.map(h => h.id) ?? []),
        enabled: !!homeworks
    });

    const { data: textbookDocsForHomework, isLoading: loadingTextbookDocsForHomework } = useQuery({
        queryKey: ["textbookDocumentsForHomework", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks?.map(t => t.id) ?? []),
        enabled: !!textbooks
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

    const handleUploadHomework = async (file: File) => {
        // Validate file is a PDF or TXT
        if (file.type !== 'application/pdf' && file.type !== 'text/plain' && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            alert('Please upload a PDF, TXT, or DOCX file');
            return;
        }
        
        try {
            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('title', file.name.replace(/\.(pdf|txt)$/i, ''));
            formData.append('file_path', ''); // Empty string for direct uploads
            formData.append('response_url', `${process.env.NEXT_PUBLIC_API_URL}`);
            
            // Upload the file
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/homework`, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload homework');
            }
            
            // Refresh homeworks data
            queryClient.invalidateQueries({ queryKey: ["homeworks", classId] });
            
        } catch (error) {
            console.error('Error uploading homework:', error);
            notifications.show({
                title: 'Error uploading homework',
                message: 'Please try again.',
                color: 'red',
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

    const handleUploadLecture = async (file: File) => {
        try {
            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('title', file.name.replace('.pdf', ''));
            formData.append('file_path', ''); // Empty since we're uploading directly
            formData.append('response_url', `${process.env.NEXT_PUBLIC_API_URL}`);
            
            // Upload the file
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/lecture`, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload lecture');
            }
            
            // Refresh lectures data
            queryClient.invalidateQueries({ queryKey: ["lectures", classId] });
            
        } catch (error) {
            console.error('Error uploading lecture:', error);
            notifications.show({
                title: 'Error uploading lecture',
                message: 'Please try again.',
                color: 'red',
            });
        }
    };

    const handleUploadTextbook = async (file: File) => {
        // Validate file is a PDF
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }
        
        try {
            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('title', file.name.replace('.pdf', ''));
            formData.append('file_path', ''); // Empty string for direct uploads
            formData.append('response_url', `${process.env.NEXT_PUBLIC_API_URL}`);
            
            // Upload the file
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/textbook`, {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload textbook');
            }
            
            // Refresh textbooks data
            queryClient.invalidateQueries({ queryKey: ["textbooks", classId] });
            
        } catch (error) {
            console.error('Error uploading textbook:', error);
            notifications.show({
                title: 'Error uploading textbook',
                message: 'Please try again.',
                color: 'red',
            });
        }
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack gap="xl">
                    {/* Lectures Section */}
                    <Stack>
                        <Group justify="space-between" align="center">
                            <Text size="xl" fw={700}>Lectures</Text>
                            <Button
                                leftSection={<IconUpload size={14} />}
                                onClick={() => lectureInputRef.current?.click()}
                            >
                                Upload Lecture
                            </Button>
                        </Group>
                        
                        <Card withBorder p="xs">
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
                            
                            <ScrollArea>
                                <LectureContent 
                                    classId={classId}
                                    lectures={filteredLectures}
                                    lectureDocuments={lectureDocuments}
                                    loadingLectures={loadingLectures}
                                    loadingLectureDocuments={loadingLectureDocuments}
                                    parsingLectures={parsingLectures}
                                    setParsingLectures={setParsingLectures}
                                    handleRetryLecture={handleRetryLecture}
                                    displayMode="horizontal"
                                />
                            </ScrollArea>
                        </Card>
                    </Stack>

                    {/* Textbooks Section */}
                    <Stack>
                        <Group justify="space-between" align="center">
                            <Text size="xl" fw={700}>Textbooks</Text>
                            <Button
                                leftSection={<IconUpload size={14} />}
                                onClick={() => textbookInputRef.current?.click()}
                            >
                                Upload Textbook
                            </Button>
                        </Group>
                        
                        <Card withBorder p="xs">
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
                                <TextbookContent 
                                    classId={classId}
                                    textbooks={filteredTextbooks}
                                    textbookDocuments={textbookDocuments}
                                    chapters={chaptersByTextbook}
                                    loadingTextbooks={loadingTextbooks}
                                    loadingTextbookDocuments={loadingTextbookDocuments}
                                    parsingTextbooks={parsingTextbooks}
                                    setParsingTextbooks={setParsingTextbooks}
                                    handleRetryTextbook={handleRetryTextbook}
                                    displayMode="horizontal"
                                />
                            </ScrollArea>
                        </Card>
                    </Stack>

                    {/* Homeworks Section */}
                    <Stack>
                        <Group justify="space-between" align="center">
                            <Text size="xl" fw={700}>Homework</Text>
                            <Button
                                leftSection={<IconUpload size={14} />}
                                onClick={() => homeworkInputRef.current?.click()}
                            >
                                Upload Homework
                            </Button>
                        </Group>
                        
                        <Card withBorder p="xs">
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
                                <HomeworkContent 
                                    classId={classId}
                                    homeworks={filteredHomeworks}
                                    exercises={exercises}
                                    textbookDocuments={textbookDocsForHomework}
                                    loadingHomeworks={loadingHomeworks}
                                    loadingExercises={loadingExercises}
                                    processingHomeworks={processingHomeworks}
                                    setProcessingHomeworks={setProcessingHomeworks}
                                    handleRetryHomework={handleRetryHomework}
                                    displayMode="horizontal"
                                />
                            </ScrollArea>
                        </Card>
                    </Stack>

                    {/* Hidden file inputs */}
                    <input
                        type="file"
                        ref={lectureInputRef}
                        onChange={(e) => {
                            e.preventDefault();
                            if (e.target.files?.[0]) {
                                handleUploadLecture(e.target.files[0]);
                            }
                        }}
                        accept="application/pdf"
                        style={{ display: 'none' }}
                    />
                    <input
                        type="file"
                        ref={textbookInputRef}
                        onChange={(e) => {
                            e.preventDefault();
                            if (e.target.files?.[0]) {
                                handleUploadTextbook(e.target.files[0]);
                            }
                        }}
                        accept="application/pdf"
                        style={{ display: 'none' }}
                    />
                    <input
                        type="file"
                        ref={homeworkInputRef}
                        onChange={(e) => {
                            e.preventDefault();
                            if (e.target.files?.[0]) {
                                handleUploadHomework(e.target.files[0]);
                            }
                        }}
                        accept="application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        style={{ display: 'none' }}
                    />
                </Stack>
            </Container>
        </ClassLayout>
    );
}