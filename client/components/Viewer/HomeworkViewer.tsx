/**
 * HomeworkViewer.tsx
 * Used to show all the exercises for a given homework
 * @AshokSaravanan222
 * 02-26-2025
 */

import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton, Modal, Divider } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Grid, Flex, Container } from "@mantine/core";
import Latex from "@/components/Latex";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "../Class/ClassLayout";
import DeleteHomeworkModal from "../Delete/DeleteHomeworkModal";
import { getHomework } from "@/utils/queries/get-homework";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";
import { getExercises } from "@/utils/queries/get-exercises";
import { getExerciseDocuments } from "@/utils/queries/get-exercise-docs";
import { Exercise } from "@/types";

type HomeworkViewerProps = {
    classId: string;
    homeworkId: string;
    initialExerciseId?: string;
}

export default function HomeworkViewer({
    classId,
    homeworkId,
    initialExerciseId,
}: HomeworkViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const supabase = useSupabaseBrowser();
    const searchParams = useSearchParams();
    const page = searchParams.get("page");
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // Query hooks
    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["homeworkDocuments", homeworkId],
        queryFn: () => getHomeworkDocuments(supabase, [homeworkId])
    });

    const { data: homework, isLoading: loadingHomework } = useQuery({
        queryKey: ["homework", homeworkId],
        queryFn: () => getHomework(supabase, homeworkId)
    });

    const { data: exercises, isLoading: loadingExercises } = useQuery({
        queryKey: ["homeworkExercises", homeworkId],
        queryFn: () => getExercises(supabase, [], [homeworkId])
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

    const sortExercises = (exercises: any[]) => {
        return [...exercises].sort((a, b) => {
            if (a.problem_number !== b.problem_number) {
                return a.problem_number - b.problem_number;
            }
            const partA = a.problem_part_number || 0;
            const partB = b.problem_part_number || 0;
            return partA - partB;
        });
    };

    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null && exercises) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50;

            const sortedExercises = sortExercises(exercises);
            const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);
            if (deltaX > minSwipeDistance && currentIndex < sortedExercises.length - 1) {
                handleExerciseClick(sortedExercises[currentIndex + 1].id);
            } else if (deltaX < -minSwipeDistance && currentIndex > 0) {
                handleExerciseClick(sortedExercises[currentIndex - 1].id);
            }
        }
        setTouchStartX(null);
    };

    useEffect(() => {
        if (exercises && exercises.length > 0 && !activeExerciseId) {
            if (initialExerciseId) {
                setActiveExerciseId(initialExerciseId);
            } else {
                setActiveExerciseId(exercises[0].id);
            }
        }
    }, [exercises, activeExerciseId, initialExerciseId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!exercises) return;
            const sortedExercises = sortExercises(exercises);
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

    // Function to open the full-size image modal
    const openImageModal = () => {
        setIsImageModalOpen(true);
    };


    const getActiveImage = (exerciseId: string | null) => {
        if (!exerciseId) return "/placeholder_image.svg";
        const document = documents?.find(doc => doc.exercises.includes(exerciseId));
        if (!document) return "/placeholder_image.svg";

        if (document.textbook) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`;
        }
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exerciseId}.png`;
    };

    const getExerciseInfo = (exercise: Exercise | undefined) => {
        if (!exercise) return "";
        return (
            <Stack>
                {exercise.info && (
                    <Box>
                        <Text fw={600} mb={4}>Information:</Text>
                        <Text><Latex>{exercise.info}</Latex></Text>
                    </Box>
                )}
                {exercise.info && exercise.description && (
                    <Divider />
                )}

                {exercise.description && (
                    <Box>
                        {/* <Text fw={600} mb={4}>Description:</Text> */}
                        <Text><Latex>{exercise.description}</Latex></Text>
                    </Box>
                )}
            </Stack>
        )
    }

    return (
        <Stack gap="xs" style={{ height: '100%' }}>
            {loadingDocuments || loadingExercises ? (
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
                        alt={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.problem_number}`}
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
                        blurDataURL={"/placeholder_image.svg"}
                        onClick={openImageModal} // Add click handler to open modal
                    />
                    <ActionIcon
                       size={"lg"}
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
                            Problem {exercises?.find(ex => ex.id === activeExerciseId)?.problem_number}
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
                {loadingDocuments || loadingExercises ? (
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
                                    alt={`Exercise ${exercise.problem_number}`}
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
                {loadingDocuments || loadingExercises ? (
                    <Stack>
                        <Skeleton height={16} width="90%" />
                        <Skeleton height={16} width="85%" />
                        <Skeleton height={16} width="70%" />
                    </Stack>
                ) : (
                    <Stack>
                        {getExerciseInfo(exercises?.find(ex => ex.id === activeExerciseId))}
                    </Stack>
                )}
            </Box>

            {/* Add the full-size image modal */}
            <Modal
                opened={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                size="xl"
                padding="md"
                centered
                title={`Problem ${exercises?.find(ex => ex.id === activeExerciseId)?.problem_number}`}
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
                        alt={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.problem_number}`}
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



