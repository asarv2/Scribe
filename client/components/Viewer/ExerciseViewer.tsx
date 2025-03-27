/**
 * ExerciseViewer.tsx
 * 
 * This component is used to display the exercise viewer for the exercise page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton, Modal } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Grid, Flex, Container } from "@mantine/core";
import { getChapter } from "@/utils/queries/get-chapter";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "../Class/ClassLayout";
import Latex from "@/components/Latex";
import { getExercises } from "@/utils/queries/get-exercises";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { Exercise } from "@/types";
import { getChapterDocuments } from "@/utils/queries/get-chapter-docs";

type ExerciseViewerProps = {
    classId: string;
    chapterId: string;
    initialExerciseId?: string;
}

function MainViewerSkeleton() {
    return (
        <Box style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1',
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--mantine-color-dark-6)",
            borderRadius: "10px",
            flexShrink: 0
        }}>
            <Skeleton height="100%" width="100%" />
        </Box>
    );
}

function PreviewStripSkeleton() {
    return (
        <Flex gap={4} style={{ padding: '2px' }}>
            {[...Array(8)].map((_, index) => (
                <Skeleton
                    key={index}
                    height={50}
                    width={50}
                    radius="4px"
                />
            ))}
        </Flex>
    );
}

function DescriptionSkeleton() {
    return (
        <Stack>
            <Card withBorder>
                <Stack>
                    <Group>
                        <Skeleton height={24} width={120} />
                        <Skeleton height={20} width={80} />
                    </Group>
                    <Skeleton height={20} width="60%" />
                    <Box>
                        <Skeleton height={20} width={100} mb={8} />
                        <Skeleton height={16} width="90%" mb={4} />
                        <Skeleton height={16} width="85%" mb={4} />
                        <Skeleton height={16} width="70%" />
                    </Box>
                    <Box>
                        <Skeleton height={20} width={80} mb={8} />
                        <Skeleton height={16} width="80%" mb={4} />
                        <Skeleton height={16} width="75%" />
                    </Box>
                    <Group>
                        <Skeleton height={16} width={80} />
                        <Skeleton height={16} width={100} />
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
}

export default function ExerciseViewer({
    classId,
    chapterId,
    initialExerciseId,
}: ExerciseViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const supabase = useSupabaseBrowser();
    const searchParams = useSearchParams();
    const exerciseNumber = searchParams.get("exercise");

    // Query hooks
    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["chapterDocuments", chapterId],
        queryFn: () => getChapterDocuments(supabase, [chapterId])
    });

    // Add this query to fetch exercises
    const { data: exercises, isLoading: loadingExercises } = useQuery({
        queryKey: ["chapterExercises", chapterId],
        queryFn: () => getExercises(supabase, [chapterId], []) // You'll need to create this query function
    });


    const { data: chapter, isLoading: loadingChapter } = useQuery({
        queryKey: ["chapter", chapterId],
        queryFn: () => getChapter(supabase, chapterId)
    });

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    });

    const handleExerciseClick = (exerciseId: string) => {
        setActiveExerciseId(exerciseId);
    };

    const getActiveImage = (exerciseId: string | null) => {
        if (!exerciseId) return "/placeholder_image.svg";
        const document = documents?.find(doc => doc.exercises.includes(exerciseId));
        if (!document) return "/placeholder_image.svg";

        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${document.textbook}/${exerciseId}.png`;
    };

    const sortExercises = (exercises: Exercise[]) => {
        return [...exercises].sort((a, b) => a.exercise_number - b.exercise_number);
    };

    // Function to open the full-size image modal
    const openImageModal = () => {
        setIsImageModalOpen(true);
    };

    // Add the handleSwipe function:
    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null && exercises) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50;

            const sortedExercises = [...exercises].sort((a, b) => a.exercise_number - b.exercise_number);
            const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);

            if (deltaX > minSwipeDistance && currentIndex < sortedExercises.length - 1) {
                // Swipe left (next exercise)
                handleExerciseClick(sortedExercises[currentIndex + 1].id);
            } else if (deltaX < -minSwipeDistance && currentIndex > 0) {
                // Swipe right (previous exercise)
                handleExerciseClick(sortedExercises[currentIndex - 1].id);
            }
        }
        setTouchStartX(null);
    };

    // Add these useEffect hooks:
    useEffect(() => {
        // Set initial active exercise based on initialExerciseId prop or URL exercise parameter
        if (exercises && exercises.length > 0 && !activeExerciseId) {
            if (initialExerciseId) {
                // First try to find the exact exercise by ID
                setActiveExerciseId(initialExerciseId);
            } else if (exerciseNumber) {
                // If no initialExerciseId but URL has exercise number
                const matchingEx = exercises.find(ex => ex.exercise_number === parseInt(exerciseNumber));
                if (matchingEx) {
                    setActiveExerciseId(matchingEx.id);
                } else {
                    setActiveExerciseId(sortExercises(exercises)[0].id);
                }
            } else {
                // Default to first exercise
                setActiveExerciseId(sortExercises(exercises)[0].id);
            }
        }
    }, [exercises, activeExerciseId, exerciseNumber, initialExerciseId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!exercises) return;
            const sortedExercises = [...exercises].sort((a, b) => a.exercise_number - b.exercise_number);
            const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);

            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                handleExerciseClick(sortedExercises[currentIndex - 1].id);
            } else if (event.key === 'ArrowRight' && currentIndex < sortedExercises.length - 1) {
                handleExerciseClick(sortedExercises[currentIndex + 1].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeExerciseId, exercises]);

    useEffect(() => {
        if (previewScrollRef.current) {
            const activeThumb = previewScrollRef.current.querySelector(`[data-exercise="${activeExerciseId}"]`);
            if (activeThumb) {
                activeThumb.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeExerciseId]);

    return (
        <Stack gap="xs" style={{ height: '100%' }}>
            {loadingExercises || loadingDocuments ? (
                // Skeleton for embedded viewer
                <Box style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    borderRadius: "10px",
                    flexShrink: 0
                }}>
                    <Skeleton height="100%" width="100%" radius="md" />
                </Box>
            ) : (
                <Box style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '16/9',
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "10px",
                    flexShrink: 0
                }}
                    onTouchStart={(e) => {
                        setTouchStartX(e.changedTouches[0].clientX);
                    }}
                    onTouchEnd={(e) => {
                        const touchEndX = e.changedTouches[0].clientX;
                        handleSwipe(touchEndX);
                    }}
                >
                    <Image
                        src={getActiveImage(activeExerciseId)}
                        alt={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.exercise_number}`}
                        width={500}
                        height={500}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain",
                            cursor: "zoom-in" // Add cursor to indicate clickable
                        }}
                        sizes="100vw"
                        placeholder="blur"
                        blurDataURL="/placeholder_image.svg"
                        onClick={openImageModal} // Add click handler to open modal
                    />
                    <ActionIcon
                        size="lg"
                        variant="filled"
                        color="gray"
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: 5,
                            transform: 'translateY(-50%)',
                            zIndex: 100,
                        }}
                        onClick={() => {
                            const sortedExercises = exercises ? sortExercises(exercises) : [];
                            const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);
                            if (currentIndex > 0) {
                                handleExerciseClick(sortedExercises[currentIndex - 1].id);
                            }
                        }}
                        disabled={!exercises || sortExercises(exercises).findIndex(ex => ex.id === activeExerciseId) === 0}
                        aria-label="Previous Exercise"
                    >
                        <IconArrowLeft size={24} />
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
                        onClick={() => {
                            const sortedExercises = exercises ? sortExercises(exercises) : [];
                            const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);
                            if (currentIndex < sortedExercises.length - 1) {
                                handleExerciseClick(sortedExercises[currentIndex + 1].id);
                            }
                        }}
                        disabled={!exercises || sortExercises(exercises).findIndex(ex => ex.id === activeExerciseId) === sortExercises(exercises).length - 1}
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
                            backgroundColor: "rgba(0,0,0,0.7)",
                            borderRadius: "4px",
                        }}
                    >
                        <Text
                            size="xs"
                            fw={500}
                            style={{
                                color: "white",
                                textShadow: "0px 0px 4px rgba(0,0,0,0.5)"
                            }}
                        >
                            Exercise {exercises?.find(ex => ex.id === activeExerciseId)?.exercise_number}
                        </Text>
                    </Box>
                </Box>
            )}

            {/* Preview strip with fixed height and better visibility */}
            <Box
                style={{
                    flexShrink: 0,
                    height: '40px', // Fixed height
                    marginBottom: '4px' // Add some space between preview and description
                }}
            >
                {loadingExercises || loadingDocuments ? (
                    <Flex gap={4} style={{ padding: '2px', height: '100%' }}>
                        {[...Array(6)].map((_, index) => (
                            <Skeleton key={index} height={35} width={35} radius="sm" />
                        ))}
                    </Flex>
                ) : (
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
                        {exercises && sortExercises(exercises).map((exercise) => (
                            <Box
                                key={exercise.id}
                                data-exercise={exercise.id}
                                style={{
                                    cursor: 'pointer',
                                    width: 35, // Slightly smaller
                                    height: 35, // Slightly smaller
                                    position: 'relative',
                                    flexShrink: 0,
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                }}
                                onClick={() => handleExerciseClick(exercise.id)}
                            >
                                <Image
                                    src={getActiveImage(exercise.id)}
                                    alt={`Exercise ${exercise.exercise_number}`}
                                    width={35}
                                    height={35}
                                    style={{
                                        objectFit: 'cover',
                                        outline: exercise.id === activeExerciseId ? '2px solid skyblue' : 'none',
                                        outlineOffset: '-2px',
                                    }}
                                    sizes="100vw"
                                />
                            </Box>
                        ))}
                    </Flex>
                )}
            </Box>

            {/* Description with flex-grow to take remaining space */}
            <Box style={{
                overflow: 'auto',
                paddingInline: '2px',
                flexGrow: 1,
                minHeight: '80px' // Ensure description always has some minimum height
            }}>
                {loadingExercises || loadingDocuments ? (
                    <Stack>
                        <Skeleton height={16} width="90%" />
                        <Skeleton height={16} width="85%" />
                        <Skeleton height={16} width="70%" />
                    </Stack>
                ) : (
                    <>
                        <Text fw={500} size="sm">
                            <Latex>{exercises?.find(ex => ex.id === activeExerciseId)?.info ?? ""}</Latex>
                        </Text>
                        <Text fw={500} size="sm" mt={8}>
                            <Latex>{exercises?.find(ex => ex.id === activeExerciseId)?.given ?? ""}</Latex>
                        </Text>
                    </>
                )}
            </Box>

            {/* Add the full-size image modal */}
            <Modal
                opened={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="xl"
                padding="md"
                centered
                title={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.exercise_number}`}
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
                        src={getActiveImage(activeExerciseId)}
                        alt={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.exercise_number}`}
                        width={1200}
                        height={1200}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain"
                        }}
                        sizes="100vw"
                    />
                </Box>
            </Modal>
        </Stack>
    );
}

