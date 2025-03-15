/**
 * app/classes/c/[classId]/homework/[homeworkId]/page.tsx
 * This page is used to view a single homework.
 * @AshokSaravanan222
 * 02-26-2025
 * 
 */
"use client"
import DeleteHomeworkModal from "@/components/Delete/DeleteHomeworkModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHomework } from "@/utils/queries/get-homework";
import { getExercises } from "@/utils/queries/get-exercises";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getAllChats } from "@/utils/queries/get-all-chats";
import { getMessages } from "@/utils/queries/get-messages";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TextInput, Button, Group, Card, Stack, Text, Badge, Accordion, ActionIcon, Modal, Box, Container, Flex, Grid, Skeleton, Textarea, Divider, em, Switch, NumberInput } from "@mantine/core";
import { IconMessage, IconSettings, IconRuler, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useDisclosure, useIntersection, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { updateHomeworkDate, updateHomeworkName, updateHomeworkInstructions } from "@/utils/services/homework";
import { updateExercise } from "@/utils/services/exercises";
import { DateTimePicker } from '@mantine/dates';
import { useMantineColorScheme } from "@mantine/core";
import Image from "next/image";
import Latex from "@/components/Latex";
import { ClassLayout } from "@/components/Class/ClassLayout";
import { Chat, Document, Exercise, Message } from "@/types";
import { useSearchParams } from "next/navigation";

type HomeworkProps = {
    params: {
        classId: string;
        homeworkId: string;
    }
}

export default function HomeworkPage({ params }: HomeworkProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [homeworkName, setHomeworkName] = useState<string>("");
    const [homeworkDate, setHomeworkDate] = useState<Date | null>(null);
    const [homeworkInstructions, setHomeworkInstructions] = useState<string>("");
    const [isNameUpdating, setIsNameUpdating] = useState(false);
    const [isDateUpdating, setIsDateUpdating] = useState(false);
    const [isInstructionsUpdating, setIsInstructionsUpdating] = useState(false);
    const [isProblemNumberUpdating, setIsProblemNumberUpdating] = useState(false);
    const [isMultipart, setIsMultipart] = useState<boolean>(false);
    const [problemPartNumber, setProblemPartNumber] = useState<number | null>(1);
    const [exerciseProblemNumber, setExerciseProblemNumber] = useState<number | null>(null);
    const { colorScheme } = useMantineColorScheme();
    const supabase = useSupabaseBrowser();
    const searchParams = useSearchParams();
    const page = searchParams.get("page");
    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const homeworkId = params.homeworkId;
    const classId = params.classId;

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

    const { data: chats, isLoading: loadingChats } = useQuery({
        queryKey: ["allChats", classId],
        queryFn: () => getAllChats(supabase, classId),
    });

    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ["messages", classId, chats],
        queryFn: () => getMessages(supabase, chats ? chats.map(chat => chat.id) : []),
        enabled: !!chats
    });

    const relatedChats = useMemo(() => {
        if (!chats || !messages) return [];

        return chats.filter(chat => {
            const chatMessages = messages.filter(msg => msg.chat === chat.id);
            return chatMessages.some(msg =>
                msg.homeworks &&
                Array.isArray(msg.homeworks) &&
                msg.homeworks.includes(homeworkId)
            );
        });
    }, [chats, messages, homeworkId]);

    const queryClient = useQueryClient();

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
            setActiveExerciseId(exercises[0].id);
        }
    }, [exercises, activeExerciseId]);

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

    useEffect(() => {
        if (homework) {
            setHomeworkName(homework.title || "");
            setHomeworkDate(homework.due ? new Date(homework.due) : null);
            setHomeworkInstructions(homework.additional_info || "");
        }
    }, [homework]);

    // Update the exercise state when active exercise changes
    useEffect(() => {
        if (exercises && activeExerciseId) {
            const currentExercise = exercises.find(ex => ex.id === activeExerciseId);
            if (currentExercise) {
                setExerciseProblemNumber(currentExercise.problem_number || null);
                setIsMultipart(currentExercise.problem_multipart);
                setProblemPartNumber(currentExercise.problem_part_number || 1);
            }
        }
    }, [activeExerciseId, exercises]);

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

        return (
            <Card padding="md" pos="relative" withBorder>
                <Stack>
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
                            size={"xl"}
                            variant="filled"
                            color={colorScheme === "dark" ? "gray" : "dark"}
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: 10,
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
                            size={"xl"}
                            variant="filled"
                            color="gray"
                            style={{
                                position: 'absolute',
                                top: '50%',
                                right: 10,
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
                            bottom={10}
                            right={10}
                            p={8}
                            style={{
                                zIndex: 100,
                                backgroundColor: colorScheme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.7)",
                                borderRadius: "4px",
                            }}
                        >
                            <Text
                                size={"xs"}
                                fw={500}
                                style={{
                                    color: colorScheme === "dark" ? "white" : "black",
                                    textShadow: colorScheme === "dark" ?
                                        "0px 0px 4px rgba(0,0,0,0.5)" :
                                        "0px 0px 4px rgba(255,255,255,0.5)"
                                }}
                            >
                                {`Problem ${currentExercise?.problem_number}${currentExercise?.problem_multipart ? `.${currentExercise?.problem_part_number}` : ""}`}
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

                {/* Add problem number editing UI */}
                <Card withBorder p="md">
                    <Stack gap="xs">
                        <Group justify="space-between">
                            <Text size="sm" fw={500}>Problem Number</Text>
                            <Group>
                                <Text size="xs">Multipart</Text>
                                <Switch 
                                    checked={isMultipart}
                                    onChange={(event) => setIsMultipart(event.currentTarget.checked)}
                                />
                            </Group>
                        </Group>
                        <Group justify="space-between">
                            <Group style={{ flex: 1 }}>
                                <NumberInput
                                    value={exerciseProblemNumber ?? ""}
                                    onChange={(value) => setExerciseProblemNumber(Number(value))}
                                    placeholder="Problem #"
                                    min={1}
                                    style={{ flex: isMultipart ? 0.5 : 1 }}
                                />
                                {isMultipart && (
                                    <NumberInput
                                        value={problemPartNumber ?? ""}
                                        onChange={(value) => setProblemPartNumber(Number(value))}
                                        placeholder="Part #"
                                        min={1}
                                        style={{ flex: 0.5 }}
                                    />
                                )}
                            </Group>
                            <Button
                                onClick={handleUpdateExerciseProblemNumber}
                                loading={isProblemNumberUpdating}
                                disabled={exerciseProblemNumber === null || 
                                    (exerciseProblemNumber === currentExercise.problem_number && 
                                    (isMultipart ? problemPartNumber : 1) === currentExercise.problem_part_number)}
                            >
                                Save
                            </Button>
                        </Group>
                    </Stack>
                </Card>

                {currentExercise.info && (
                    <Box>
                        <Text fw={600} mb={4}>Information:</Text>
                        <Text><Latex>{currentExercise.info}</Latex></Text>
                    </Box>
                )}

                {currentExercise.given && (
                    <Box>
                        <Text fw={600} mb={4}>Given:</Text>
                        <Text><Latex>{currentExercise.given}</Latex></Text>
                    </Box>
                )}
                {currentExercise.description && (
                    <Box>
                        <Text fw={600} mb={4}>Description:</Text>
                        <Text><Latex>{currentExercise.description}</Latex></Text>
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

    const handleUpdateHomeworkName = async () => {
        if (!homeworkName.trim()) return;

        try {
            setIsNameUpdating(true);
            await updateHomeworkName(homeworkId, homeworkName);
            queryClient.invalidateQueries({ queryKey: ["homework", homeworkId] });
            notifications.show({
                title: "Homework updated",
                message: "Homework name has been updated successfully",
                color: "green"
            });
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update homework name",
                color: "red"
            });
        } finally {
            setIsNameUpdating(false);
        }
    };

    const handleUpdateHomeworkDate = async () => {
        if (!homeworkDate) return;

        try {
            setIsDateUpdating(true);
            await updateHomeworkDate(homeworkId, homeworkDate.toISOString());
            queryClient.invalidateQueries({ queryKey: ["homework", homeworkId] });
            notifications.show({
                title: "Homework updated",
                message: "Homework due date has been updated successfully",
                color: "green"
            });
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update homework due date",
                color: "red"
            });
        } finally {
            setIsDateUpdating(false);
        }
    };

    const handleUpdateHomeworkInstructions = async () => {
        try {
            setIsInstructionsUpdating(true);
            await updateHomeworkInstructions(homeworkId, homeworkInstructions);
            queryClient.invalidateQueries({ queryKey: ["homework", homeworkId] });
            notifications.show({
                title: "AI Instructions saved",
                message: "AI instructions saved successfully",
                color: "green"
            });
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to save AI instructions",
                color: "red"
            });
        } finally {
            setIsInstructionsUpdating(false);
        }
    };

    const handleUpdateExerciseProblemNumber = async () => {
        if (!activeExerciseId || exerciseProblemNumber === null) return;

        try {
            setIsProblemNumberUpdating(true);
            await updateExercise(activeExerciseId, exerciseProblemNumber, problemPartNumber ?? 1, isMultipart);
            queryClient.invalidateQueries({ queryKey: ["homeworkExercises", homeworkId] });
            notifications.show({
                title: "Problem updated",
                message: "Problem number has been updated successfully",
                color: "green"
            });
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to update problem number",
                color: "red"
            });
        } finally {
            setIsProblemNumberUpdating(false);
        }
    };

    // Update the intersection observer settings
    const { ref: chatsIntersection, entry: chatsEntry } = useIntersection({
        root: null,
        threshold: 0.2,
        rootMargin: '-100px 0px'
    });

    const { ref: settingsIntersection, entry: settingsEntry } = useIntersection({
        root: null,
        threshold: 0.2,
        rootMargin: '-100px 0px'
    });

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px", position: "relative" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Skeleton visible={loadingHomework} height={32} width={loadingHomework ? 300 : '100%'}>
                                <Text size="xl" fw={700} mb={6}>{homework?.title}</Text>
                            </Skeleton>
                        </Group>
                        <Group>
                            <DeleteHomeworkModal
                                homeworkId={homeworkId}
                                homeworkTitle={homework?.title ?? ""}
                                profile={profile}
                                classId={homework?.class ?? ""}
                            />
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
                            </Box>
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Box style={{
                                position: 'relative',
                                overflow: 'auto',
                                maxHeight: 'calc(100vh - 55px)'
                            }}>
                                <Stack style={{ paddingBottom: '20px' }}>
                                    <Box
                                        ref={settingsIntersection}
                                        style={{
                                            transition: 'transform 0.3s ease, opacity 0.3s ease',
                                            transform: settingsEntry?.isIntersecting ? 'translateY(0)' : 'translateY(20px)',
                                            opacity: settingsEntry?.isIntersecting ? 1 : 0.5,
                                        }}
                                    >
                                        <Skeleton visible={loadingHomework}>
                                            <Stack gap="md">
                                                <Stack gap="xs">
                                                    <Text size="sm" fw={500}>Homework Name</Text>
                                                    <Group justify="space-between">
                                                        <TextInput
                                                            value={homeworkName}
                                                            onChange={(e) => setHomeworkName(e.currentTarget.value)}
                                                            placeholder="Enter homework name"
                                                            style={{ flex: 1 }}
                                                        />
                                                        <Button
                                                            onClick={handleUpdateHomeworkName}
                                                            loading={isNameUpdating}
                                                            disabled={!homeworkName.trim() || homeworkName === homework?.title}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>

                                                <Stack gap="xs">
                                                    <Group justify="space-between">
                                                        <Text size="sm" fw={500}>Problem Number</Text>
                                                        <Group>
                                                            <Text size="xs">Multipart</Text>
                                                            <Switch 
                                                                checked={isMultipart}
                                                                onChange={(event) => setIsMultipart(event.currentTarget.checked)}
                                                            />
                                                        </Group>
                                                    </Group>
                                                    <Group justify="space-between">
                                                        <Group style={{ flex: 1 }}>
                                                            <NumberInput
                                                                value={exerciseProblemNumber ?? ""}
                                                                onChange={(value) => setExerciseProblemNumber(Number(value))}
                                                                placeholder="Problem #"
                                                                min={1}
                                                                style={{ flex: isMultipart ? 0.5 : 1 }}
                                                            />
                                                            {isMultipart && (
                                                                <NumberInput
                                                                    value={problemPartNumber ?? ""}
                                                                    onChange={(value) => setProblemPartNumber(Number(value))}
                                                                    placeholder="Part #"
                                                                    min={1}
                                                                    style={{ flex: 0.5 }}
                                                                />
                                                            )}
                                                        </Group>
                                                        <Button
                                                            onClick={handleUpdateExerciseProblemNumber}
                                                            loading={isProblemNumberUpdating}
                                                            disabled={exerciseProblemNumber === null || 
                                                                (exerciseProblemNumber === exercises?.find(ex => ex.id === activeExerciseId)?.problem_number && 
                                                                isMultipart === ((exercises?.find(ex => ex.id === activeExerciseId)?.problem_part_number ?? 1) !== 1) &&
                                                                problemPartNumber === (exercises?.find(ex => ex.id === activeExerciseId)?.problem_part_number ?? 1))}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>

                                                <Stack gap="xs">
                                                    <Text size="sm" fw={500}>Due Date</Text>
                                                    <Group justify="space-between">
                                                        <DateTimePicker
                                                            placeholder="Select due date and time"
                                                            valueFormat="DD MMM YYYY hh:mm A"
                                                            value={homeworkDate}
                                                            onChange={setHomeworkDate}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <Button
                                                            onClick={handleUpdateHomeworkDate}
                                                            loading={isDateUpdating}
                                                            disabled={!homeworkDate || Boolean(homework?.due && new Date(homework.due).getTime() === homeworkDate.getTime())}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>

                                                <Stack gap="xs">
                                                    <Text size="sm" fw={500}>AI Instructions</Text>
                                                    <Group justify="space-between">
                                                        <Textarea
                                                            value={homeworkInstructions}
                                                            onChange={(event) => setHomeworkInstructions(event.currentTarget.value)}
                                                            placeholder="Example: Make sure to show your work"
                                                            autosize
                                                            minRows={3}
                                                            maxRows={5}
                                                            style={{ flex: 1 }}
                                                        />
                                                        <Button
                                                            onClick={handleUpdateHomeworkInstructions}
                                                            loading={isInstructionsUpdating}
                                                            disabled={homeworkInstructions === homework?.additional_info}
                                                        >
                                                            Save
                                                        </Button>
                                                    </Group>
                                                </Stack>
                                            </Stack>
                                        </Skeleton>
                                    </Box>

                                    <Divider my="sm" />

                                    {!loadingExercises && activeExerciseId && exercises?.find(ex => ex.id === activeExerciseId)?.description && (
                                        <>
                                            <Box>
                                                <Text fw={700} mb="md">Problem Description</Text>
                                                <Card withBorder p="md">
                                                    <Text fw={500} size="sm">
                                                        <Latex>{exercises?.find(ex => ex.id === activeExerciseId)?.description ?? ""}</Latex>
                                                    </Text>
                                                </Card>
                                            </Box>
                                            <Divider my="sm" />
                                        </>
                                    )}

                                    <Box
                                        ref={chatsIntersection}
                                        style={{
                                            transition: 'transform 0.3s ease, opacity 0.3s ease',
                                            transform: chatsEntry?.isIntersecting ? 'translateY(0)' : 'translateY(20px)',
                                            opacity: chatsEntry?.isIntersecting ? 1 : 0.5,
                                        }}
                                    >
                                        <Text fw={700} mb="md">Related Chats</Text>
                                        {loadingChats || loadingMessages ? (
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
                                        ) : relatedChats.length > 0 ? (
                                            <Box
                                                style={{
                                                    overflowX: 'auto',
                                                    overflowY: 'hidden',
                                                    paddingBottom: '16px',
                                                }}
                                            >
                                                <Flex gap="md" wrap="nowrap">
                                                    {relatedChats.map(chat => {
                                                        // Use the first available exercise image
                                                        const firstImage = exercises && exercises.length > 0 ?
                                                            getActiveImage(exercises[0].id) :
                                                            "/placeholder_image.svg";

                                                        return (
                                                            <Card
                                                                key={chat.id}
                                                                withBorder
                                                                padding="sm"
                                                                component="a"
                                                                href={`/classes/c/${classId}/chat/${chat.id}`}
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
                                                                        src={firstImage}
                                                                        alt={chat.name || "Chat preview"}
                                                                        width={180}
                                                                        height={100}
                                                                        style={{
                                                                            objectFit: 'cover',
                                                                            width: '100%',
                                                                            height: '100%'
                                                                        }}
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
                                                                    <Badge size="xs" variant="light">
                                                                        {new Date(chat.created_at).toLocaleDateString()}
                                                                    </Badge>
                                                                </Stack>
                                                            </Card>
                                                        );
                                                    })}
                                                </Flex>
                                            </Box>
                                        ) : (
                                            <Text c="dimmed">No chats mention this homework yet</Text>
                                        )}
                                    </Box>
                                </Stack>
                            </Box>
                        </Grid.Col>
                    </Grid>
                </Stack>

                {/* Full-size image modal */}
                <Modal
                    opened={isImageModalOpen}
                    onClose={() => setIsImageModalOpen(false)}
                    size="xl"
                    padding="md"
                    centered
                    title={`${exercises?.find(ex => ex.id === activeExerciseId)?.title}`}
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
