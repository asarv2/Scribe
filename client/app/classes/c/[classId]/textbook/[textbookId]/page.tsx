/**
 * app/classes/[classId]/textbook/[textbookId]/page.tsx
 * The page for a specific textbook in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { Chapter, Exercise } from '@/types';
import { getChapters } from '@/utils/queries/get-chapters';
import { getDocumentsTextbook } from '@/utils/queries/get-documents-textbook';
import { getTextbook } from '@/utils/queries/get-textbook';
import { getExercises } from '@/utils/queries/get-exercises';
import useSupabaseBrowser from '@/utils/supabase/supabase-browser';
import { Card, Group, Stack, Text, Container, Flex, Button, useMantineColorScheme, Skeleton, Box, Grid, ActionIcon, Select, Modal, TextInput, Textarea, Divider } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconPencil, IconChevronDown } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { ClassLayout } from '@/components/Class/ClassLayout';
import { useMediaQuery, useIntersection } from '@mantine/hooks';
import Latex from '@/components/Latex';
import { notifications } from '@mantine/notifications';
import DeleteTextbookModal from "@/components/Delete/DeleteTextbookModal";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getMessages } from "@/utils/queries/get-messages";

export default function Textbook({ params }: { params: { classId: string, textbookId: string } }) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const classId = params.classId;
    const textbookId = params.textbookId;
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { colorScheme } = useMantineColorScheme();
    const previewScrollRef = useRef<HTMLDivElement>(null);

    // State for navigation
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);

    // State for editing
    const [textbookName, setTextbookName] = useState('');
    const [chapterName, setChapterName] = useState('');
    const [textbookAiInstructions, setTextbookAiInstructions] = useState('');
    const [chapterAiInstructions, setChapterAiInstructions] = useState('');
    const [isTextbookNameUpdating, setIsTextbookNameUpdating] = useState(false);
    const [isChapterNameUpdating, setIsChapterNameUpdating] = useState(false);
    const [isTextbookAiUpdating, setIsTextbookAiUpdating] = useState(false);
    const [isChapterAiUpdating, setIsChapterAiUpdating] = useState(false);
    const [isTextbookNameEditing, setIsTextbookNameEditing] = useState(false);
    const [isTextbookAiEditing, setIsTextbookAiEditing] = useState(false);
    const [isChapterNameEditing, setIsChapterNameEditing] = useState(false);
    const [isChapterAiEditing, setIsChapterAiEditing] = useState(false);

    // Add state for exercise editing
    const [exerciseName, setExerciseName] = useState('');
    const [exerciseAiInstructions, setExerciseAiInstructions] = useState('');
    const [isExerciseNameEditing, setIsExerciseNameEditing] = useState(false);
    const [isExerciseAiEditing, setIsExerciseAiEditing] = useState(false);
    const [isExerciseNameUpdating, setIsExerciseNameUpdating] = useState(false);
    const [isExerciseAiUpdating, setIsExerciseAiUpdating] = useState(false);

    // Add state for related chats
    const [relatedChats, setRelatedChats] = useState<any[]>([]);

    // Fetch textbook data
    const { data: textbook, isLoading: loadingTextbook } = useQuery({
        queryKey: ['textbook', textbookId],
        queryFn: () => getTextbook(supabase, textbookId)
    });

    // Fetch chapters
    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ['chapters', textbookId],
        queryFn: () => getChapters(supabase, [textbookId])
    });

    // Fetch documents
    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["textbookDocuments", textbookId],
        queryFn: () => getDocumentsTextbook(supabase, [textbookId]),
    });

    // Fetch exercises
    const { data: exercises, isLoading: loadingExercises } = useQuery({
        queryKey: ["exercises", textbookId],
        queryFn: () => getExercises(supabase, chapters?.map(c => c.id) || [], []),
        enabled: !!chapters
    });

    // Add queries for chats
    const { data: chats, isLoading: loadingChats } = useQuery({
        queryKey: ["allChats", params.classId],
        queryFn: () => getAllChats(supabase, params.classId),
    });

    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["messages", params.classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
    });

    // Filter documents by selected chapter
    const filteredDocuments = documents?.filter(doc => {
        if (!selectedChapter) {
            // If no chapter selected, show all pages from this textbook
            return doc.textbook === textbookId;
        }
        // If chapter selected, show only pages from that chapter
        return doc.textbook === textbookId && doc.chapter === selectedChapter;
    }).sort((a, b) => (a.page || 0) - (b.page || 0));

    // Set initial document and chapter
    useEffect(() => {
        if (documents && documents.length > 0 && !activeDocumentId) {
            setActiveDocumentId(documents[0].id);
        }
    }, [documents, activeDocumentId]);

    // Update exercises when chapter changes
    useEffect(() => {
        if (selectedChapter && exercises) {
            const chapterExercises = exercises.filter(ex => ex.chapter === selectedChapter);
            if (chapterExercises.length > 0) {
                setSelectedExercise(null); // Reset selected exercise when chapter changes
            }
        }
    }, [selectedChapter, exercises]);

    // Scroll to active document in preview strip
    useEffect(() => {
        if (activeDocumentId && previewScrollRef.current) {
            const activeElement = previewScrollRef.current.querySelector(`[data-image="${activeDocumentId}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeDocumentId]);

    // Update form values when textbook or chapter changes
    useEffect(() => {
        if (textbook) {
            setTextbookName(textbook.title || '');
            setTextbookAiInstructions(textbook.additional_info || '');
        }
    }, [textbook]);

    useEffect(() => {
        if (selectedChapter && chapters) {
            const chapter = chapters.find(c => c.id === selectedChapter);
            if (chapter) {
                setChapterName(chapter.title || '');
                setChapterAiInstructions(chapter.additional_info || '');
            }
        }
    }, [selectedChapter, chapters]);

    // Update exercise form values when selection changes
    useEffect(() => {
        if (selectedExercise && exercises) {
            const exercise = exercises.find(e => e.id === selectedExercise);
            if (exercise) {
                setExerciseName(exercise.info || `Exercise ${exercise.exercise_number}`);
                setExerciseAiInstructions(exercise.info || '');
            }
        }
    }, [selectedExercise, exercises]);

    // Add useEffect to filter related chats
    useEffect(() => {
        if (!chats || !messages || !selectedChapter) return;

        const filtered = chats.filter(chat => {
            const chatMessages = messages.filter(msg => msg.chat === chat.id);
            return chatMessages.some(msg =>
                msg.chapters &&
                Array.isArray(msg.chapters) &&
                msg.chapters.includes(selectedChapter)
            );
        });

        setRelatedChats(filtered);
    }, [chats, messages, selectedChapter]);

    // Handle page navigation
    const handlePageClick = (documentId: string) => {
        setActiveDocumentId(documentId);

        // Update selected chapter based on page
        const doc = documents?.find(d => d.id === documentId);
        if (doc && chapters) {
            const pageChapter = chapters.find(c =>
                doc.page >= c.start_page && doc.page <= c.end_page
            );
            if (pageChapter && pageChapter.id !== selectedChapter) {
                setSelectedChapter(pageChapter.id);
            }
        }
    };

    // Handle chapter selection
    const handleChapterSelect = (chapterId: string | null) => {
        if (!chapterId) {
            setSelectedChapter(null);
            setSelectedExercise(null);
            setActiveDocumentId(documents?.[0]?.id || null);
            return;
        }

        setSelectedChapter(chapterId);
        const chapter = chapters?.find(c => c.id === chapterId);
        if (chapter && documents) {
            // Find the first document in this chapter
            const firstDoc = documents.find(d => d.page === chapter.start_page);
            if (firstDoc) {
                setActiveDocumentId(firstDoc.id);
            }
        }
    };

    // Handle exercise selection
    const handleExerciseSelect = (exerciseId: string | null) => {
        if (!exerciseId) {
            setSelectedExercise(null);
            return;
        }

        setSelectedExercise(exerciseId);

        // Find the exercise and its associated document
        const exercise = exercises?.find(ex => ex.id === exerciseId);
        if (exercise && documents) {
            // Find document that contains this exercise
            const exerciseDoc = documents.find(d =>
                d.page >= exercise.start_page &&
                d.page <= exercise.end_page &&
                d.textbook === textbookId
            );

            if (exerciseDoc) {
                setActiveDocumentId(exerciseDoc.id);
            }
        }
    };

    // Handle swipe gestures
    const handleSwipe = (touchEndX: number) => {
        if (touchStartX === null) return;

        const swipeDistance = touchEndX - touchStartX;
        const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) || 0;

        if (Math.abs(swipeDistance) > 50 && filteredDocuments) {
            if (swipeDistance > 0 && currentIndex > 0) {
                setActiveDocumentId(filteredDocuments[currentIndex - 1].id);
            } else if (swipeDistance < 0 && currentIndex < filteredDocuments.length - 1) {
                setActiveDocumentId(filteredDocuments[currentIndex + 1].id);
            }
        }
    };

    // Handle updating textbook name
    const handleUpdateTextbookName = async () => {
        if (!textbookName.trim()) return;

        try {
            setIsTextbookNameUpdating(true);

            const { error } = await supabase
                .from('textbooks')
                .update({ title: textbookName })
                .eq('id', textbookId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['textbook', textbookId] });
            notifications.show({
                title: 'Textbook name updated',
                message: 'Textbook name updated successfully',
                color: 'green'
            });
        } catch (error) {
            console.error('Error updating textbook name:', error);
            notifications.show({
                title: 'Error',
                message: 'Failed to update textbook name',
                color: 'red'
            });
        } finally {
            setIsTextbookNameUpdating(false);
        }
    };

    // Handle updating chapter name
    const handleUpdateChapterName = async () => {
        if (!chapterName.trim() || !selectedChapter) return;

        try {
            setIsChapterNameUpdating(true);

            const { error } = await supabase
                .from('chapters')
                .update({ title: chapterName })
                .eq('id', selectedChapter);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['chapters', textbookId] });
            notifications.show({
                title: 'Chapter name updated',
                message: 'Chapter name updated successfully',
                color: 'green'
            });
        } catch (error) {
            console.error('Error updating chapter name:', error);
            notifications.show({
                title: 'Error',
                message: 'Failed to update chapter name',
                color: 'red'
            });
        } finally {
            setIsChapterNameUpdating(false);
        }
    };

    // Handle updating textbook AI instructions
    const handleUpdateTextbookAiInstructions = async () => {
        try {
            setIsTextbookAiUpdating(true);

            const { error } = await supabase
                .from('textbooks')
                .update({ additional_info: textbookAiInstructions })
                .eq('id', textbookId);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['textbook', textbookId] });
            notifications.show({
                title: 'AI Instructions updated',
                message: 'Textbook AI instructions updated successfully',
                color: 'green'
            });
        } catch (error) {
            console.error('Error updating textbook AI instructions:', error);
            notifications.show({
                title: 'Error',
                message: 'Failed to update textbook AI instructions',
                color: 'red'
            });
        } finally {
            setIsTextbookAiUpdating(false);
        }
    };

    // Handle updating chapter AI instructions
    const handleUpdateChapterAiInstructions = async () => {
        if (!selectedChapter) return;

        try {
            setIsChapterAiUpdating(true);

            const { error } = await supabase
                .from('chapters')
                .update({ additional_info: chapterAiInstructions })
                .eq('id', selectedChapter);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['chapters', textbookId] });
            notifications.show({
                title: 'AI Instructions updated',
                message: 'Chapter AI instructions updated successfully',
                color: 'green'
            });
        } catch (error) {
            console.error('Error updating chapter AI instructions:', error);
            notifications.show({
                title: 'Error',
                message: 'Failed to update chapter AI instructions',
                color: 'red'
            });
        } finally {
            setIsChapterAiUpdating(false);
        }
    };

    // Handle exercise name update
    const handleUpdateExerciseName = async () => {
        if (!exerciseName.trim() || !selectedExercise) return;

        try {
            setIsExerciseNameUpdating(true);
            await supabase
                .from('exercises')
                .update({ info: exerciseName })
                .eq('id', selectedExercise);

            queryClient.invalidateQueries({ queryKey: ["exercises", textbookId] });
            notifications.show({
                title: "Exercise updated",
                message: "Exercise name has been updated successfully",
                color: "green"
            });
            setIsExerciseNameEditing(false);
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update exercise name",
                color: "red"
            });
        } finally {
            setIsExerciseNameUpdating(false);
        }
    };

    // Handle exercise AI instructions update
    const handleUpdateExerciseAiInstructions = async () => {
        if (!selectedExercise) return;

        try {
            setIsExerciseAiUpdating(true);
            await supabase
                .from('exercises')
                .update({ info: exerciseAiInstructions })
                .eq('id', selectedExercise);

            queryClient.invalidateQueries({ queryKey: ["exercises", textbookId] });
            notifications.show({
                title: "Exercise updated",
                message: "Exercise AI instructions have been updated successfully",
                color: "green"
            });
            setIsExerciseAiEditing(false);
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update exercise AI instructions",
                color: "red"
            });
        } finally {
            setIsExerciseAiUpdating(false);
        }
    };

    // Get image URL for a document with transformations for better loading
    const getActiveImage = (documentId: string | null, fullSize = false) => {
        if (!documentId) return "/placeholder_image.svg";

        const baseUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookId}/${documentId}.png`;

        // Add Supabase image transformations for thumbnails
        if (!fullSize) {
            return `${baseUrl}?width=500&height=500&resize=contain`;
        }

        return baseUrl;
    };

    // Get exercise image with transformations
    const getExerciseImage = (exerciseId: string | null, fullSize = false) => {
        if (!exerciseId) return "/placeholder_image.svg";
        const document = documents?.find(doc => doc.exercises?.includes(exerciseId));
        if (!document) return "/placeholder_image.svg";

        const baseUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${document.textbook}/${exerciseId}.png`;

        // Add Supabase image transformations for thumbnails
        if (!fullSize) {
            return `${baseUrl}?width=500&height=500&resize=contain`;
        }

        return baseUrl;
    };

    // Prepare chapter options for dropdown
    const chapterOptions = chapters?.map(chapter => ({
        value: chapter.id,
        label: `Chapter ${chapter.chapter_number}: ${chapter.title}`
    })) || [];

    // Prepare exercise options for dropdown
    const exerciseOptions = exercises
        ?.filter(ex => ex.chapter === selectedChapter)
        .map(exercise => ({
            value: exercise.id,
            label: `Exercise ${exercise.exercise_number}`
        })) || [];

    // Get current document and exercise
    const currentDocument = documents?.find(doc => doc.id === activeDocumentId);
    const currentExercise = selectedExercise
        ? exercises?.find(ex => ex.id === selectedExercise)
        : exercises?.find(ex =>
            currentDocument &&
            ex.start_page <= currentDocument.page &&
            ex.end_page >= currentDocument.page
        );
    // Add these navigation helper functions
    const handlePrevPage = () => {
        if (!activeDocumentId || !filteredDocuments) return;

        const currentIndex = filteredDocuments.findIndex(doc => doc.id === activeDocumentId);
        if (currentIndex > 0) {
            setActiveDocumentId(filteredDocuments[currentIndex - 1].id);
        }
    };

    const handleNextPage = () => {
        if (!activeDocumentId || !filteredDocuments) return;

        const currentIndex = filteredDocuments.findIndex(doc => doc.id === activeDocumentId);
        if (currentIndex < filteredDocuments.length - 1) {
            setActiveDocumentId(filteredDocuments[currentIndex + 1].id);
        }
    };

    // Description component
    const Description = () => {
        const currentChapter = chapters?.find(c => c.id === selectedChapter);
        const currentExercise = exercises?.find(ex => ex.id === selectedExercise);

        return (
            <Stack gap="md">
                {/* Show only one set of instructions at a time based on selection hierarchy */}
                {selectedExercise && currentExercise ? (
                    // Exercise Settings - highest priority
                    <Stack gap="md">
                        <Stack gap="xs">
                            <Text size="sm" fw={500}>Exercise Name</Text>
                            <Group justify="space-between">
                                <TextInput
                                    placeholder="Exercise name"
                                    value={exerciseName}
                                    onChange={(e) => setExerciseName(e.currentTarget.value)}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    onClick={handleUpdateExerciseName}
                                    loading={isExerciseNameUpdating}
                                    disabled={!exerciseName.trim()}
                                >
                                    Save
                                </Button>
                            </Group>
                        </Stack>

                        <Stack gap="xs">
                            <Text size="sm" fw={500}>AI Instructions</Text>
                            <Group justify="space-between">
                                <Textarea
                                    placeholder="Instructions for AI when discussing this exercise"
                                    value={exerciseAiInstructions}
                                    onChange={(e) => setExerciseAiInstructions(e.currentTarget.value)}
                                    autosize
                                    minRows={3}
                                    maxRows={5}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    onClick={handleUpdateExerciseAiInstructions}
                                    loading={isExerciseAiUpdating}
                                >
                                    Save
                                </Button>
                            </Group>
                        </Stack>

                        {currentExercise.given && (
                            <Stack gap="xs">
                                <Text size="sm" fw={500}>Instructions:</Text>
                                <Text size="sm"><Latex>{currentExercise.given}</Latex></Text>
                            </Stack>
                        )}
                    </Stack>
                ) : selectedChapter && currentChapter ? (
                    // Chapter Settings - medium priority
                    <Stack gap="md">
                        <Stack gap="xs">
                            <Text size="sm" fw={500}>Chapter Name</Text>
                            <Group justify="space-between">
                                <TextInput
                                    placeholder="Chapter name"
                                    value={chapterName}
                                    onChange={(e) => setChapterName(e.currentTarget.value)}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    onClick={handleUpdateChapterName}
                                    loading={isChapterNameUpdating}
                                    disabled={!chapterName.trim()}
                                >
                                    Save
                                </Button>
                            </Group>
                        </Stack>

                        <Stack gap="xs">
                            <Text size="sm" fw={500}>AI Instructions</Text>
                            <Group justify="space-between">
                                <Textarea
                                    placeholder="Instructions for AI when discussing this chapter"
                                    value={chapterAiInstructions}
                                    onChange={(e) => setChapterAiInstructions(e.currentTarget.value)}
                                    autosize
                                    minRows={3}
                                    maxRows={5}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    onClick={handleUpdateChapterAiInstructions}
                                    loading={isChapterAiUpdating}
                                >
                                    Save
                                </Button>
                            </Group>
                        </Stack>
                    </Stack>
                ) : (
                    // Textbook Settings - lowest priority, shown when nothing else is selected
                    <Stack gap="md">
                        <Stack gap="xs">
                            <Text size="sm" fw={500}>Textbook Name</Text>
                            <Group justify="space-between">
                                <TextInput
                                    placeholder="Textbook name"
                                    value={textbookName}
                                    onChange={(e) => setTextbookName(e.currentTarget.value)}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    onClick={handleUpdateTextbookName}
                                    loading={isTextbookNameUpdating}
                                    disabled={!textbookName.trim()}
                                >
                                    Save
                                </Button>
                            </Group>
                        </Stack>

                        <Stack gap="xs">
                            <Text size="sm" fw={500}>AI Instructions</Text>
                            <Group justify="space-between">
                                <Textarea
                                    placeholder="Instructions for AI when discussing this textbook"
                                    value={textbookAiInstructions}
                                    onChange={(e) => setTextbookAiInstructions(e.currentTarget.value)}
                                    autosize
                                    minRows={3}
                                    maxRows={5}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    onClick={handleUpdateTextbookAiInstructions}
                                    loading={isTextbookAiUpdating}
                                >
                                    Save
                                </Button>
                            </Group>
                        </Stack>
                    </Stack>
                )}
            </Stack>
        );
    };

    // Skeleton components
    const MainViewerSkeleton = () => (
        <Skeleton height={500} radius="md" />
    );

    const PreviewStripSkeleton = () => (
        <Flex gap={4} style={{ padding: '2px', height: '40px' }}>
            {[...Array(6)].map((_, index) => (
                <Skeleton key={index} height={35} width={35} radius="sm" />
            ))}
        </Flex>
    );

    const DescriptionSkeleton = () => (
        <Stack>
            <Skeleton height={24} width="80%" />
            <Skeleton height={16} width="90%" />
            <Skeleton height={16} width="85%" />
            <Skeleton height={16} width="70%" />
        </Stack>
    );

    // Update the intersection observer settings
    const { ref: settingsIntersection, entry: settingsEntry } = useIntersection({
        root: null,
        threshold: 0.2,
        rootMargin: '-100px 0px'
    });

    // Add functions to navigate between exercises
    const handlePrevExercise = () => {
        if (!selectedExercise || !exercises) return;

        const sortedExercises = [...exercises]
            .filter(ex => ex.chapter === selectedChapter)
            .sort((a, b) => (a.exercise_number || 0) - (b.exercise_number || 0));

        const currentIndex = sortedExercises.findIndex(ex => ex.id === selectedExercise);
        if (currentIndex > 0) {
            setSelectedExercise(sortedExercises[currentIndex - 1].id);
        }
    };

    const handleNextExercise = () => {
        if (!selectedExercise || !exercises) return;

        const sortedExercises = [...exercises]
            .filter(ex => ex.chapter === selectedChapter)
            .sort((a, b) => (a.exercise_number || 0) - (b.exercise_number || 0));

        const currentIndex = sortedExercises.findIndex(ex => ex.id === selectedExercise);
        if (currentIndex < sortedExercises.length - 1) {
            setSelectedExercise(sortedExercises[currentIndex + 1].id);
        }
    };

    // Add RelatedChats component
    const RelatedChats = () => {
        if (loadingChats || loadingMessages) {
            return (
                <Box
                    style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        paddingBottom: '16px',
                    }}
                >
                    <Flex gap="md" wrap="nowrap">
                        {[1, 2, 3, 4].map((i) => (
                            <Card
                                key={i}
                                withBorder
                                padding="sm"
                                style={{
                                    width: '180px',
                                    minWidth: '180px',
                                    height: '180px'
                                }}
                            >
                                <Skeleton height={100} width="100%" radius="sm" mb="sm" />
                                <Skeleton height={15} width="70%" radius="sm" mb="sm" />
                                <Skeleton height={10} width="90%" radius="sm" />
                            </Card>
                        ))}
                    </Flex>
                </Box>
            );
        }

        if (relatedChats.length === 0) {
            return <Text c="dimmed">No chats mention this chapter yet</Text>;
        }

        return (
            <Box
                style={{
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    paddingBottom: '16px',
                }}
            >
                <Flex gap="md" wrap="nowrap">
                    {relatedChats.map(chat => {
                        // Use the first available image from the chapter
                        const firstImage = documents?.find(d => d.chapter === selectedChapter)?.id;
                        const imageUrl = firstImage ? getActiveImage(firstImage, false) : "/placeholder_image.svg";

                        return (
                            <Card
                                key={chat.id}
                                withBorder
                                padding="sm"
                                component="a"
                                href={`/classes/c/${params.classId}/chat/${chat.id}`}
                                style={{
                                    width: '180px',
                                    minWidth: '180px',
                                    height: '180px',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <Card.Section style={{ height: '100px', overflow: 'hidden' }}>
                                    <Image
                                        src={imageUrl}
                                        alt={chat.name || "Chat preview"}
                                        width={180}
                                        height={100}
                                        style={{
                                            objectFit: 'cover',
                                            width: '100%',
                                            height: '100%'
                                        }}
                                        unoptimized={true}
                                    />
                                </Card.Section>

                                <Stack mt="xs" gap="xs" style={{ flex: 1 }}>
                                    <Text
                                        fw={500}
                                        lineClamp={2}
                                        style={{ flex: 1 }}
                                        size="sm"
                                    >
                                        {chat.name || "Untitled Chat"}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        {new Date(chat.created_at).toLocaleDateString()}
                                    </Text>
                                </Stack>
                            </Card>
                        );
                    })}
                </Flex>
            </Box>
        );
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Skeleton visible={loadingTextbook} height={32} width={loadingTextbook ? 300 : '100%'}>
                                <Text size="xl" fw={700} mb={6}>{textbook?.title}</Text>
                            </Skeleton>
                        </Group>

                        {/* Add DeleteTextbookModal */}
                        <Group>
                            <Skeleton visible={loadingTextbook} width={loadingTextbook ? 100 : '100%'}>
                                <DeleteTextbookModal
                                    textbookId={textbookId}
                                    textbookTitle={textbook?.title ?? ""}
                                    classId={classId}
                                />
                            </Skeleton>
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Box style={{
                                position: isMobile ? 'relative' : 'sticky',
                                top: 80,
                                zIndex: 10,
                                height: 'calc(100vh - 40px)',
                                display: 'flex'
                            }}>
                                <Stack pos="relative" style={{ width: '100%' }}>
                                    {loadingDocuments ? (
                                        <>
                                            <MainViewerSkeleton />
                                            <PreviewStripSkeleton />
                                        </>
                                    ) : (
                                        <>
                                            {selectedExercise && currentExercise ? (
                                                <Card padding="md" pos="relative" withBorder style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                    <Image
                                                        src={getExerciseImage(selectedExercise, true)}
                                                        alt={`Exercise ${currentExercise?.exercise_number || ''}`}
                                                        width={500}
                                                        height={500}
                                                        style={{
                                                            maxWidth: '100%',
                                                            maxHeight: '100%',
                                                            objectFit: "contain",
                                                            cursor: "zoom-in"
                                                        }}
                                                        sizes="100vw"
                                                        placeholder="blur"
                                                        blurDataURL="/placeholder_image.svg"
                                                        onClick={() => setIsImageModalOpen(true)}
                                                        onLoadingComplete={() => setIsImageLoading(false)}
                                                        unoptimized={true}
                                                    />

                                                    <ActionIcon
                                                        size="lg"
                                                        variant="filled"
                                                        color={colorScheme === "dark" ? "gray" : "dark"}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: 5,
                                                            transform: 'translateY(-50%)',
                                                            zIndex: 100,
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePrevExercise();
                                                        }}
                                                        disabled={!exercises || !selectedExercise || exercises.filter(ex => ex.chapter === selectedChapter).findIndex(ex => ex.id === selectedExercise) === 0}
                                                        aria-label="Previous Exercise"
                                                    >
                                                        <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} />
                                                    </ActionIcon>

                                                    <ActionIcon
                                                        size="lg"
                                                        variant="filled"
                                                        color="gray"
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            right: 5,
                                                            transform: 'translateY(-50%)',
                                                            zIndex: 100,
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleNextExercise();
                                                        }}
                                                        disabled={!exercises || !selectedExercise || exercises.filter(ex => ex.chapter === selectedChapter).findIndex(ex => ex.id === selectedExercise) === exercises.filter(ex => ex.chapter === selectedChapter).length - 1}
                                                        aria-label="Next Exercise"
                                                    >
                                                        <IconArrowRight size={24} />
                                                    </ActionIcon>

                                                    <Box
                                                        pos="absolute"
                                                        bottom={5}
                                                        right={5}
                                                        p={4}
                                                        style={{
                                                            zIndex: 100,
                                                            backgroundColor: colorScheme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
                                                            borderRadius: "4px",
                                                        }}
                                                    >
                                                        <Text
                                                            size="xs"
                                                            fw={500}
                                                            style={{
                                                                color: colorScheme === "dark" ? "white" : "black",
                                                                textShadow: colorScheme === "dark" ?
                                                                    "0px 0px 4px rgba(0,0,0,0.5)" :
                                                                    "0px 0px 4px rgba(255,255,255,0.5)"
                                                            }}
                                                        >
                                                            Exercise {currentExercise?.exercise_number}
                                                        </Text>
                                                    </Box>
                                                </Card>
                                            ) : <Card padding="md" pos="relative" withBorder style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                <Image
                                                    src={getActiveImage(activeDocumentId, true)}
                                                    alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page || ''}`}
                                                    width={500}
                                                    height={500}
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '100%',
                                                        objectFit: "contain",
                                                        cursor: "zoom-in"
                                                    }}
                                                    sizes="100vw"
                                                    placeholder="blur"
                                                    blurDataURL="/placeholder_image.svg"
                                                    onClick={() => setIsImageModalOpen(true)}
                                                    onLoadingComplete={() => setIsImageLoading(false)}
                                                    unoptimized={true}
                                                />

                                                <ActionIcon
                                                    size="lg"
                                                    variant="filled"
                                                    color={colorScheme === "dark" ? "gray" : "dark"}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: 5,
                                                        transform: 'translateY(-50%)',
                                                        zIndex: 100,
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePrevPage();
                                                    }}
                                                    disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === 0}
                                                    aria-label="Previous Page"
                                                >
                                                    <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} />
                                                </ActionIcon>

                                                <ActionIcon
                                                    size="lg"
                                                    variant="filled"
                                                    color="gray"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        right: 5,
                                                        transform: 'translateY(-50%)',
                                                        zIndex: 100,
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleNextPage();
                                                    }}
                                                    disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === filteredDocuments.length - 1}
                                                    aria-label="Next Page"
                                                >
                                                    <IconArrowRight size={24} />
                                                </ActionIcon>

                                                <Box
                                                    pos="absolute"
                                                    bottom={5}
                                                    right={5}
                                                    p={4}
                                                    style={{
                                                        zIndex: 100,
                                                        backgroundColor: colorScheme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
                                                        borderRadius: "4px",
                                                    }}
                                                >
                                                    <Text
                                                        size="xs"
                                                        fw={500}
                                                        style={{
                                                            color: colorScheme === "dark" ? "white" : "black",
                                                            textShadow: colorScheme === "dark" ?
                                                                "0px 0px 4px rgba(0,0,0,0.5)" :
                                                                "0px 0px 4px rgba(255,255,255,0.5)"
                                                        }}
                                                    >
                                                        Page {documents?.find(doc => doc.id === activeDocumentId)?.page}
                                                    </Text>
                                                </Box>
                                            </Card>}
                                            <Box style={{ flexShrink: 0, height: '40px', marginBottom: '4px' }}>
                                                {selectedExercise && currentExercise && exercises ? (
                                                    <Flex
                                                        ref={previewScrollRef}
                                                        gap={4}
                                                        style={{
                                                            overflowX: 'auto',
                                                            padding: '2px',
                                                            height: '100%',
                                                            width: '100%'
                                                        }}
                                                    >
                                                        {exercises
                                                            .filter(ex => ex.chapter === selectedChapter)
                                                            .sort((a, b) => (a.exercise_number || 0) - (b.exercise_number || 0)).map((ex) => (
                                                                <Box
                                                                    key={ex.id}
                                                                    data-image={ex.id}
                                                                    style={{
                                                                        cursor: 'pointer',
                                                                        width: 35,
                                                                        height: 35,
                                                                        position: 'relative',
                                                                        flexShrink: 0,
                                                                        borderRadius: '4px',
                                                                        overflow: 'hidden',
                                                                    }}
                                                                    onClick={() => handleExerciseSelect(ex.id)}
                                                                >
                                                                    <Image
                                                                        src={getExerciseImage(ex.id, false)}
                                                                        alt={`Exercise ${ex.exercise_number}`}
                                                                        width={35}
                                                                        height={35}
                                                                        style={{
                                                                            objectFit: 'cover',
                                                                            outline: ex.id === selectedExercise ? '2px solid skyblue' : 'none',
                                                                            outlineOffset: '-2px',
                                                                        }}
                                                                        sizes="35px"
                                                                        unoptimized={true}
                                                                    />
                                                                </Box>
                                                            ))}
                                                    </Flex>) : <Flex
                                                        ref={previewScrollRef}
                                                        gap={4}
                                                        style={{
                                                            overflowX: 'auto',
                                                            padding: '2px',
                                                            height: '100%',
                                                            width: '100%'
                                                        }}
                                                    >
                                                    {filteredDocuments?.map((doc) => (
                                                        <Box
                                                            key={doc.id}
                                                            data-image={doc.id}
                                                            style={{
                                                                cursor: 'pointer',
                                                                width: 35,
                                                                height: 35,
                                                                position: 'relative',
                                                                flexShrink: 0,
                                                                borderRadius: '4px',
                                                                overflow: 'hidden',
                                                            }}
                                                            onClick={() => handlePageClick(doc.id)}
                                                        >
                                                            <Image
                                                                src={getActiveImage(doc.id, false)}
                                                                alt={`Page ${doc.page}`}
                                                                width={35}
                                                                height={35}
                                                                style={{
                                                                    objectFit: 'cover',
                                                                    outline: doc.id === activeDocumentId ? '2px solid skyblue' : 'none',
                                                                    outlineOffset: '-2px',
                                                                }}
                                                                sizes="35px"
                                                                unoptimized={true}
                                                            />
                                                        </Box>
                                                    ))}
                                                </Flex>}
                                            </Box>
                                        </>
                                    )}
                                </Stack>
                            </Box>
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Box style={{
                                position: 'relative',
                                overflow: 'auto',
                                maxHeight: 'calc(100vh - 55px)'
                            }}>
                                <Stack style={{ paddingBottom: '20px' }}>
                                    <Group>
                                        <Select
                                            placeholder="Select Chapter"
                                            data={chapterOptions}
                                            value={selectedChapter}
                                            onChange={handleChapterSelect}
                                            style={{ width: 250 }}
                                            disabled={loadingChapters}
                                            rightSection={<IconChevronDown size={16} />}
                                        />
                                        <Select
                                            placeholder="Select Exercise"
                                            data={exerciseOptions}
                                            value={selectedExercise}
                                            onChange={handleExerciseSelect}
                                            style={{ width: 250 }}
                                            disabled={loadingExercises}
                                            rightSection={<IconChevronDown size={16} />}
                                            clearable
                                        />
                                    </Group>
                                    <Box
                                        ref={settingsIntersection}
                                        style={{
                                            transition: 'transform 0.3s ease, opacity 0.3s ease',
                                            transform: settingsEntry?.isIntersecting ? 'translateY(0)' : 'translateY(20px)',
                                            opacity: settingsEntry?.isIntersecting ? 1 : 0.5,
                                        }}
                                    >
                                        {loadingDocuments ? (
                                            <DescriptionSkeleton />
                                        ) : (
                                            <Description />
                                        )}
                                    </Box>

                                    <Divider my="sm" />

                                    {/* Page Description Section - Moved from left side */}
                                    {!loadingDocuments && currentDocument?.description && (
                                        <>
                                            <Box>
                                                <Text fw={700} mb="md">Page Description</Text>
                                                <Card withBorder p="md">
                                                    <Text fw={500} size="sm">
                                                        <Latex>{currentDocument.description}</Latex>
                                                    </Text>
                                                </Card>
                                            </Box>
                                            <Divider my="sm" />
                                        </>
                                    )}

                                    {/* Related Chats Section */}
                                    <Box>
                                        <Text fw={700} mb="md">Related Chats</Text>
                                        <RelatedChats />
                                    </Box>
                                </Stack>
                            </Box>
                        </Grid.Col>
                    </Grid>
                </Stack>

                {/* Full-size image modal - updated to match ChapterViewer */}
                <Modal
                    opened={isImageModalOpen}
                    onClose={() => setIsImageModalOpen(false)}
                    size="xl"
                    padding="md"
                    centered
                    title={selectedExercise
                        ? `Exercise ${exercises?.find(ex => ex.id === selectedExercise)?.exercise_number}`
                        : `Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`
                    }
                >
                    <Box
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '80vh'
                        }}
                    >
                        <Image
                            src={selectedExercise ? getExerciseImage(selectedExercise, true) : getActiveImage(activeDocumentId, true)}
                            alt={selectedExercise
                                ? `Exercise ${exercises?.find(ex => ex.id === selectedExercise)?.exercise_number}`
                                : `Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`
                            }
                            width={1200}
                            height={1200}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: "contain"
                            }}
                            sizes="100vw"
                            unoptimized={true}
                        />
                    </Box>
                </Modal>
            </Container>
        </ClassLayout>
    );
}