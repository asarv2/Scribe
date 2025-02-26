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
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Grid, Flex, Container } from "@mantine/core";
import Latex from "@/components/Latex";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "../Class/ClassLayout";
import DeleteHomeworkModal from "../Delete/DeleteHomeworkModal";
import { getHomework } from "@/utils/queries/get-homework";
import { getHomeworkDocuments } from "@/utils/queries/get-homework-docs";

type HomeworkViewerProps = {    
    classId: string;
    homeworkId: string;
    initialDocumentId?: string;
    embedded?: boolean;
}

export default function HomeworkViewer({ 
    classId, 
    homeworkId, 
    initialDocumentId,
    embedded = false 
}: HomeworkViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);

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

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    });

    const handlePageClick = (newDocumentId: string) => {
        setActiveDocumentId(newDocumentId);
    };

    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null && documents) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50;

            const currentIndex = documents.findIndex(doc => doc.id === activeDocumentId);
            if (deltaX > minSwipeDistance && currentIndex < documents.length - 1) {
                handlePageClick(documents[currentIndex + 1].id);
            } else if (deltaX < -minSwipeDistance && currentIndex > 0) {
                handlePageClick(documents[currentIndex - 1].id);
            }
        }
        setTouchStartX(null);
    };

    useEffect(() => {
        if (documents && documents.length > 0 && !activeDocumentId) {
            if (initialDocumentId) {
                setActiveDocumentId(initialDocumentId);
            } else if (page) {
                const pageNum = parseInt(page.replace(/[^0-9]/g, ''));
                const matchingDoc = documents.find(doc => doc.page === pageNum);
                if (matchingDoc) {
                    setActiveDocumentId(matchingDoc.id);
                } else {
                    setActiveDocumentId(documents[0].id);
                }
            } else {
                setActiveDocumentId(documents[0].id);
            }
        }
    }, [documents, activeDocumentId, page, initialDocumentId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!documents) return;
            const currentIndex = documents.findIndex(doc => doc.id === activeDocumentId);

            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                handlePageClick(documents[currentIndex - 1].id);
            } else if (event.key === 'ArrowRight' && currentIndex < documents.length - 1) {
                handlePageClick(documents[currentIndex + 1].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeDocumentId, documents]);

    useEffect(() => {
        if (previewScrollRef.current) {
            const activeThumb = previewScrollRef.current.querySelector(`[data-document="${activeDocumentId}"]`);
            if (activeThumb) {
                activeThumb.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    }, [activeDocumentId]);

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

    // Main components
    const MainViewer = ({ height = 500 }: { height?: number }) => (
        <Card padding="md" pos="relative" withBorder>
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
                <Image
                    src={getActiveImage(activeDocumentId)}
                    alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                    width={500}
                    height={500}
                    style={{ 
                        maxWidth: '100%',
                        maxHeight: '100%',
                        borderRadius: "10px",
                        objectFit: "contain"
                    }}
                    sizes="100vw"
                    placeholder="blur"
                    blurDataURL={"/placeholder_image.svg"}
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
                        const currentIndex = documents?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                        if (currentIndex > 0 && documents) {
                            handlePageClick(documents[currentIndex - 1].id);
                        }
                    }}
                    disabled={!documents || documents.findIndex(doc => doc.id === activeDocumentId) === 0}
                    aria-label="Previous Page"
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
                        const currentIndex = documents?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                        if (documents && currentIndex < documents.length - 1) {
                            handlePageClick(documents[currentIndex + 1].id);
                        }
                    }}
                    disabled={!documents || documents.findIndex(doc => doc.id === activeDocumentId) === documents.length - 1}
                    aria-label="Next Page"
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
                        Page {documents?.find(doc => doc.id === activeDocumentId)?.page}
                    </Text>
                </Box>
            </Box>
        </Card>
    );

    const PreviewStrip = () => (
        <Flex
            ref={previewScrollRef}
            gap="0.5rem"
            style={{
                overflowX: 'auto',
                padding: '0.5rem',
            }}
        >
            {documents?.map((doc) => (
                <Box
                    key={doc.id}
                    data-document={doc.id}
                    style={{
                        cursor: 'pointer',
                        width: 50,
                        height: 50,
                        position: 'relative',
                        flexShrink: 0,
                        borderRadius: '4px',
                        overflow: 'hidden',
                    }}
                    onClick={() => handlePageClick(doc.id)}
                >
                    <Image
                        src={getActiveImage(doc.id)}
                        alt={`Page ${doc.page}`}
                        width={50}
                        height={50}
                        style={{ 
                            objectFit: 'cover',
                            outline: doc.id === activeDocumentId ? '2px solid skyblue' : 'none',
                            outlineOffset: '-2px',
                        }}
                        sizes="100vw"
                    />
                </Box>
            ))}
        </Flex>
    );

    const Description = () => (
        <Box p="md" style={{ overflow: 'auto' }}>
            <Text fw={500} size="lg">
                <Latex>{documents?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
            </Text>
        </Box>
    );

    const getActiveImage = (documentId: string | null) => {
        const document = documents?.find(doc => doc.id === documentId);
        if (!document) return "/placeholder_image.svg";
        if (document.textbook) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${document.textbook}/${documentId}.png`;
        } else if (document.exercise) {
            return `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${document.exercise}/${documentId}.png`;
        }
        return "/placeholder_image.svg";
    };

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Skeleton visible={loadingHomework} height={32} width={500}>
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
                                {loadingDocuments ? (
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
                            {loadingDocuments ? (
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



