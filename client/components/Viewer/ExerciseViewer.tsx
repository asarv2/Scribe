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
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton } from "@mantine/core";
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
    textbookId: string;
    chapterId: string;
    initialExerciseId?: string;
    embedded?: boolean;
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
    textbookId,
    initialExerciseId,
    embedded = false 
}: ExerciseViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);

    const { colorScheme } = useMantineColorScheme();
    const supabase = useSupabaseBrowser();
    const searchParams = useSearchParams();
    const exerciseNumber = searchParams.get("exercise");

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

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
        const document = documents?.find(doc => doc.exercise === exerciseId);
        if (!document) return "/placeholder_image.svg";

        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${document.textbook}/${exerciseId}/${document.id}.png`;
    };

    const sortExercises = (exercises: Exercise[]) => {
        return [...exercises].sort((a, b) => a.exercise_number - b.exercise_number);
    };

    // Shared viewer component
    const MainViewer = ({ height = 500 }: { height?: number }) => {
        const [isImageLoading, setIsImageLoading] = useState(false);
        const currentExercise = exercises?.find(ex => ex.id === activeExerciseId);
        const sortedExercises = exercises ? [...exercises].sort((a, b) => a.exercise_number - b.exercise_number) : [];
        const currentIndex = sortedExercises.findIndex(ex => ex.id === activeExerciseId);

        if (embedded) {
            return (
                <Box style={{ 
                    position: 'relative', 
                    width: '100%',
                    aspectRatio: '1',
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colorScheme === "dark" ? "#25262b" : "#f8f9fa",
                    borderRadius: "10px",
                    flexShrink: 0
                }}
                onTouchStart={(e) => setTouchStartX(e.changedTouches[0].clientX)}
                onTouchEnd={(e) => handleSwipe(e.changedTouches[0].clientX)}
                >
                    <Image
                        src={getActiveImage(activeExerciseId)}
                        alt={`Exercise ${currentExercise?.exercise_number}`}
                        width={500}
                        height={500}
                        style={{ 
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: "contain"
                        }}
                        sizes="100vw"
                        priority
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
                            if (!sortedExercises.length) return;
                            if (currentIndex > 0) {
                                handleExerciseClick(sortedExercises[currentIndex - 1].id);
                            }
                        }}
                        disabled={!sortedExercises.length || currentIndex === 0}
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
                            if (!sortedExercises.length) return;
                            if (currentIndex < sortedExercises.length - 1) {
                                handleExerciseClick(sortedExercises[currentIndex + 1].id);
                            }
                        }}
                        disabled={!sortedExercises.length || currentIndex === sortedExercises.length - 1}
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
                            Exercise {currentExercise?.title}
                        </Text>
                    </Box>
                </Box>
            );
        }

        return (
            <Card padding="md" pos="relative" withBorder>
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
                    alt={`Exercise ${currentExercise?.exercise_number}`}
                    width={500}
                    height={500}
                    style={{ 
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: "contain",
                        opacity: isImageLoading ? 0 : 1,
                        transition: 'opacity 0.2s ease-in-out'
                    }}
                    sizes="100vw"
                    onLoadingComplete={() => setIsImageLoading(false)}
                    onLoadStart={() => setIsImageLoading(true)}
                    priority
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
                        if (!sortedExercises.length) return;
                        if (currentIndex > 0) {
                            handleExerciseClick(sortedExercises[currentIndex - 1].id);
                        }
                    }}
                    disabled={!sortedExercises.length || currentIndex === 0}
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
                        if (!sortedExercises.length) return;
                        if (currentIndex < sortedExercises.length - 1) {
                            handleExerciseClick(sortedExercises[currentIndex + 1].id);
                        }
                    }}
                    disabled={!sortedExercises.length || currentIndex === sortedExercises.length - 1}
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
                        Exercise {currentExercise?.title}
                    </Text>
                </Box>
            </Card>
        );
    };

    // Preview strip for exercises
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

    // Exercise Information component
    const Description = () => {
        const currentExercise = exercises?.find(ex => ex.id === activeExerciseId);
        const currentDocument = documents?.find(doc => doc.exercise === activeExerciseId);
        const relatedDocuments = documents?.filter(doc => 
            // Document must be for the same exercise
            doc.exercise === activeExerciseId && 
            // Document must be from the same textbook
            doc.textbook === textbookId &&
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
                <Text fw={500}>Exercise {currentExercise.title}</Text>

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
        // Set initial active exercise based on URL exercise parameter
        if (exercises && exercises.length > 0 && !activeExerciseId) {
            if (exerciseNumber) {
                const matchingEx = exercises.find(ex => ex.exercise_number === parseInt(exerciseNumber));
                if (matchingEx) {
                    setActiveExerciseId(matchingEx.id);
                } else {
                    setActiveExerciseId(exercises[0].id);
                }
            } else {
                setActiveExerciseId(exercises[0].id);
            }
        }
    }, [exercises, activeExerciseId, exerciseNumber]);

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

    if (embedded) {
        return (
            <Stack gap="xs" style={{ height: '100%' }}>
                <MainViewer />
                
                {/* Tighter preview strip */}
                <Flex
                    ref={previewScrollRef}
                    gap={4}
                    style={{
                        overflowX: 'auto',
                        padding: '2px',
                        flexShrink: 0
                    }}
                >
                    {exercises && sortExercises(exercises).map((exercise) => (
                        <Box
                            key={exercise.id}
                            data-exercise={exercise.id}
                            style={{
                                cursor: 'pointer',
                                width: 40,
                                height: 40,
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
                                width={40}
                                height={40}
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

                {/* Description with minimal padding */}
                <Box style={{ overflow: 'auto', paddingInline: '2px' }}>
                    <Text fw={500} size="sm">
                        <Latex>{exercises?.find(ex => ex.id === activeExerciseId)?.info ?? ""}</Latex>
                    </Text>
                </Box>
                <Box style={{ overflow: 'auto', paddingInline: '2px' }}>
                    <Text fw={500} size="sm">
                        <Latex>{exercises?.find(ex => ex.id === activeExerciseId)?.given ?? ""}</Latex>
                    </Text>
                </Box>
            </Stack>
        );
    }

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Skeleton visible={loadingChapter} height={32} width={500}>
                                <Text size="xl" fw={700} mb={6}>{chapter?.title} - Exercises</Text>
                            </Skeleton>
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Stack>
                                {loadingExercises || loadingDocuments ? (
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
                            {loadingExercises ? (
                                <DescriptionSkeleton />
                            ) : (
                                <Description />
                            )}
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>
        </ClassLayout>
    );
}

