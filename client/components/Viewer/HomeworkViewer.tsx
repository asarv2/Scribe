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
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton, Modal } from "@mantine/core";
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

type HomeworkViewerProps = {
    classId: string;
    homeworkId: string;
    initialExerciseId?: string;
    embedded?: boolean;
}

export default function HomeworkViewer({
    classId,
    homeworkId,
    initialExerciseId,
    embedded = false
}: HomeworkViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    const { colorScheme } = useMantineColorScheme();
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

    // Skeleton components
    function MainViewerSkeleton() {
        return (
            <Card padding="md" pos="relative" withBorder>
                <Box style={{
                    position: 'relative',
                    width: '100%',
                    height: 500,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    <Skeleton height="100%" width="100%" radius="md" />
                </Box>
            </Card>
        );
    }

    function PreviewStripSkeleton() {
        return (
            <Flex gap="0.5rem" style={{ padding: '0.5rem' }}>
                {[...Array(8)].map((_, index) => (
                    <Skeleton key={index} height={50} width={50} radius="sm" />
                ))}
            </Flex>
        );
    }

    function DescriptionSkeleton() {
        return (
            <Stack>
                <Skeleton height={20} width="90%" />
                <Skeleton height={20} width="85%" />
                <Skeleton height={20} width="70%" />
            </Stack>
        );
    }

    // Function to open the full-size image modal
    const openImageModal = () => {
        setIsImageModalOpen(true);
    };

    // Main components
    const MainViewer = ({ height = 500 }: { height?: number }) => {
        const [isImageLoading, setIsImageLoading] = useState(false);
        const currentExercise = exercises?.find(ex => ex.id === activeExerciseId);
        const sortedExercises = exercises ? sortExercises(exercises) : [];
        const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);

        if (embedded) {
            return (
                <Box style={{ 
                    position: 'relative', 
                    width: '100%',
                    aspectRatio: '16/9',
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
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
                        alt={`Exercise ${currentExercise?.problem_number}`}
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
                            Problem {currentExercise?.problem_number}
                        </Text>
                    </Box>
                </Box>
            );
        }

        return (
            <Card padding="md" pos="relative" withBorder>
                <Stack>
                    <Group justify="space-between">
                        <Group>
                            <Text fw={700} size="lg">Exercise {currentExercise?.title}</Text>
                            <Text c="dimmed">
                                (p. {currentExercise?.start_page})
                            </Text>
                        </Group>
                    </Group>
                    <Box style={{
                        position: 'relative',
                        width: '100%',
                        height,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                        onTouchStart={(e) => setTouchStartX(e.changedTouches[0].clientX)}
                        onTouchEnd={(e) => handleSwipe(e.changedTouches[0].clientX)}
                    >
                        {isImageLoading && (
                            <Skeleton 
                                height="100%" 
                                width="100%" 
                                radius="md"
                                style={{
                                    position: 'absolute',
                                    zIndex: 1
                                }}
                            />
                        )}
                        <Image
                            src={getActiveImage(activeExerciseId)}
                            alt={`Exercise ${currentExercise?.title}`}
                            width={500}
                            height={500}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                borderRadius: "10px",
                                objectFit: "contain",
                                padding: "10px",
                                opacity: isImageLoading ? 0 : 1,
                                transition: 'opacity 0.2s ease-in-out',
                                cursor: "zoom-in" // Add cursor to indicate clickable
                            }}
                            sizes="100vw"
                            onLoadingComplete={() => setIsImageLoading(false)}
                            onLoadStart={() => setIsImageLoading(true)}
                            priority
                            onClick={openImageModal} // Add click handler to open modal
                        />
                        <ActionIcon
                            size={embedded ? "lg" : "xl"}
                            variant="filled"
                            color={colorScheme === "dark" ? "gray" : "dark"}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: embedded ? 5 : 10,
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
                            <IconArrowLeft size={embedded ? 24 : 32} color={colorScheme === "dark" ? "white" : "black"} />
                        </ActionIcon>
                        <ActionIcon
                            size={embedded ? "lg" : "xl"}
                            variant="filled"
                            color="gray"
                            style={{
                                position: 'absolute',
                                top: '50%',
                                right: embedded ? 5 : 10,
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
                            <IconArrowRight size={embedded ? 24 : 32} />
                        </ActionIcon>
                        <Box
                            pos="absolute"
                            bottom={embedded ? 5 : 10}
                            right={embedded ? 5 : 10}
                            p={embedded ? 4 : 8}
                            style={{
                                zIndex: 100,
                                backgroundColor: colorScheme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
                                borderRadius: "4px",
                            }}
                        >
                            <Text
                                size={embedded ? "xs" : "sm"}
                                fw={500}
                                style={{
                                    color: colorScheme === "dark" ? "white" : "black",
                                    textShadow: colorScheme === "dark" ?
                                        "0px 0px 4px rgba(0,0,0,0.5)" :
                                        "0px 0px 4px rgba(255,255,255,0.5)"
                                }}
                            >
                                {currentExercise?.title}
                            </Text>
                        </Box>
                    </Box>
                </Stack>
            </Card>
        );
    };

    const PreviewStrip = () => (
        <Flex
            ref={previewScrollRef}
            gap="0.5rem"
            style={{
                overflowX: 'auto',
                padding: '0.5rem',
            }}
        >
            {exercises && sortExercises(exercises).map((exercise) => (
                <Box
                    key={exercise.id}
                    data-exercise={exercise.id}
                    style={{
                        cursor: 'pointer',
                        width: 50,
                        height: 50,
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
                        width={50}
                        height={50}
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
    );

    const Description = () => {
        const currentExercise = exercises?.find(ex => ex.id === activeExerciseId);
        const currentDocument = documents?.find(doc => doc.exercises.includes(activeExerciseId ?? ""));
        const relatedDocuments = documents?.filter(doc => 
            // Document must be for the same exercise
            doc.exercises.includes(activeExerciseId ?? "") && 
            // Document must be from the same homework
            doc.homeworks.includes(homeworkId) &&
            // Document must have a page number
            doc.page &&
            currentExercise?.start_page &&
            currentExercise?.end_page &&
            // Document's page must be OUTSIDE the range of current exercise
            (doc.page < currentExercise.start_page || doc.page > currentExercise.end_page)
        )?.reduce((unique: any[], doc) => {
            const exists = unique.find(item => item.page === doc.page);
            if (!exists) {
                unique.push(doc);
            }
            return unique;
        }, [])?.sort((a, b) => (a.page || 0) - (b.page || 0));

        if (!currentExercise) return null;

        const getDocumentImage = (document: any) => {
            if (!document) return "/placeholder_image.svg";
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${document.id}.png`;
        };

        return (
            <Stack>
                <Text fw={500}>Problem {currentExercise.problem_number}{currentExercise.problem_part_number !== 1 ? 
                    `${String.fromCharCode(96 + currentExercise.problem_part_number)})` : 
                    ""}</Text>

                {currentExercise.info ? (
                    <Box>
                        <Text fw={600} mb={4}>Information:</Text>
                        <Text><Latex>{currentExercise.info}</Latex></Text>
                    </Box>
                ) : (
                    <Text fw={600} mb={4}>No information provided.</Text>
                )}

                {currentExercise.given && (
                    <Box>
                        <Text fw={600} mb={4}>Given:</Text>
                        <Text><Latex>{currentExercise.given}</Latex></Text>
                    </Box>
                )}

                {currentDocument?.description && (
                    <Box>
                        <Text><Latex>{currentDocument.description}</Latex></Text>
                    </Box>
                )}

                {relatedDocuments && relatedDocuments.length > 0 && (
                    <Box>
                        <Text fw={600} mb={4}>Additional Context:</Text>
                        <Box
                            style={{
                                overflowX: 'auto',
                                overflowY: 'hidden',
                                whiteSpace: 'nowrap',
                                padding: '4px'
                            }}
                        >
                            <Flex gap="md" wrap="nowrap">
                                {relatedDocuments.map((doc) => (
                                    <Box 
                                        key={doc.id}
                                        style={{
                                            display: 'inline-block',
                                            verticalAlign: 'top',
                                            width: '200px',
                                            flexShrink: 0
                                        }}
                                    >
                                        <Text size="sm" c="dimmed" mb={4}>
                                            Page {doc.page || 'Unknown'}
                                        </Text>
                                        <Card p="xs" withBorder>
                                            <Image
                                                src={getDocumentImage(doc)}
                                                alt={`Page ${doc.page}`}
                                                width={180}
                                                height={240}
                                                style={{
                                                    width: '100%',
                                                    height: '240px',
                                                    objectFit: 'contain',
                                                    borderRadius: '4px'
                                                }}
                                            />
                                            {doc.description && (
                                                <Text 
                                                    mt={4} 
                                                    size="sm"
                                                    style={{
                                                        whiteSpace: 'normal',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 3,
                                                        WebkitBoxOrient: 'vertical',
                                                        lineHeight: '1.4'
                                                    }}
                                                >
                                                    <Latex>{doc.description}</Latex>
                                                </Text>
                                            )}
                                        </Card>
                                    </Box>
                                ))}
                            </Flex>
                        </Box>
                    </Box>
                )}
            </Stack>
        );
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

    if (embedded) {
        return (
            <Stack gap="xs" style={{ height: '100%' }}>
                {loadingDocuments || loadingExercises ? (
                    // Skeleton for embedded viewer
                    <Box style={{ 
                        position: 'relative', 
                        width: '100%',
                        aspectRatio: '16/9',
                        backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
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
                        backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
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
                        <Text fw={500} size="sm">
                            <Latex>{exercises?.find(ex => ex.id === activeExerciseId)?.info ?? ""}</Latex>
                        </Text>
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

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Skeleton visible={loadingExercises} height={32} width={500}>
                                <Text size="xl" fw={700} mb={6}>{homework?.title}</Text>
                            </Skeleton>
                        </Group>
                        <Group>
                            {profile?.professor && (
                                <DeleteHomeworkModal
                                    homeworkId={homeworkId}
                                    homeworkTitle={homework?.title ?? ""}
                                    profile={profile}
                                    classId={homework?.class ?? ""}
                                />
                            )}
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Stack>
                                {loadingDocuments || loadingExercises ? (
                                    <>
                                        <MainViewerSkeleton />
                                        <PreviewStripSkeleton />
                                    </>
                                ) : (
                                    <>
                                        <MainViewer />
                                        <PreviewStrip />
                                    </>
                                )}
                            </Stack>
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            {loadingDocuments || loadingExercises ? (
                                <DescriptionSkeleton />
                            ) : (
                                <Description />
                            )}
                        </Grid.Col>
                    </Grid>
                </Stack>
                
                {/* Add the full-size image modal */}
                <Modal 
                    opened={isImageModalOpen} 
                    onClose={() => setIsImageModalOpen(false)}
                    size="xl"
                    padding="md"
                    centered
                    title={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.title}`}
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
                            alt={`Exercise ${exercises?.find(ex => ex.id === activeExerciseId)?.title}`}
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
            </Container>
        </ClassLayout>
    );
}



