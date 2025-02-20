/**
 * LectureViewer.tsx
 * 
 * This component is used to display the lecture viewer for the lecture page.
 * @AshokSaravanan222
 * 02.05.2025
 */
import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import DeleteLectureModal from "@/components/Delete/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import Latex from "@/components/Latex";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "../Class/ClassLayout";

type LectureViewerProps = {
    classId: string;
    lectureId: string;
    initialDocumentId?: string;
    embedded?: boolean;
}

export default function LectureViewer({ 
    classId, 
    lectureId, 
    initialDocumentId,
    embedded = false 
}: LectureViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [hoveredFigure, setHoveredFigure] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);

    const { colorScheme } = useMantineColorScheme();

    const supabase = useSupabaseBrowser();

    const searchParams = useSearchParams();
    const page = searchParams.get("page");

    const handlePageClick = (newDocumentId: string) => {
        setActiveDocumentId(newDocumentId);
    };

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["lectureDocuments", lectureId],
        queryFn: () => getLectureDocuments(supabase, [lectureId])
    })

    const { data: lecture, isLoading: loadingLecture } = useQuery({
        queryKey: ["lecture", lectureId],
        queryFn: () => getLecture(supabase, lectureId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const showDelete = profile?.professor || profile?.admin;

    const getActiveImage = (documentId: string | null) => {
        if (!classData || !lecture || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${lectureId}/${documentId}.png`;
    }

    const filteredDocuments = documents?.filter(doc => !(classId === "ae333215-2914-4026-8aae-418f1255cdd0" && doc.page === 1));

    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null && filteredDocuments) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50;

            const currentIndex = filteredDocuments.findIndex(doc => doc.id === activeDocumentId);
            if (deltaX > minSwipeDistance && currentIndex < filteredDocuments.length - 1) {
                // Swipe left (next page)
                handlePageClick(filteredDocuments[currentIndex + 1].id);
            } else if (deltaX < -minSwipeDistance && currentIndex > 0) {
                // Swipe right (previous page)
                handlePageClick(filteredDocuments[currentIndex - 1].id);
            }
        }
        setTouchStartX(null);
    };

    useEffect(() => {
        if (filteredDocuments && filteredDocuments.length > 0 && !activeDocumentId) {
            if (initialDocumentId) {
                setActiveDocumentId(initialDocumentId);
            } else if (page) {
                // Handle both single page numbers and page ranges (e.g., "p.5" or "pp.5-7")
                const pageNum = parseInt(page.replace(/[^0-9]/g, ''));
                const matchingDoc = filteredDocuments.find(doc => doc.page === pageNum);
                if (matchingDoc) {
                    setActiveDocumentId(matchingDoc.id);
                } else {
                    // Default to first page if specified page not found
                    setActiveDocumentId(filteredDocuments[0].id);
                }
            } else {
                // No page specified, default to first page
                setActiveDocumentId(filteredDocuments[0].id);
            }
        }
    }, [filteredDocuments, activeDocumentId, page, initialDocumentId]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!filteredDocuments) return;
            const currentIndex = filteredDocuments.findIndex(doc => doc.id === activeDocumentId);

            if (event.key === 'ArrowLeft' && currentIndex > 0) {
                handlePageClick(filteredDocuments[currentIndex - 1].id);
            } else if (event.key === 'ArrowRight' && currentIndex < filteredDocuments.length - 1) {
                handlePageClick(filteredDocuments[currentIndex + 1].id);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeDocumentId, filteredDocuments]);

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

    // Add skeleton components
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

    // Shared viewer component
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
            onTouchStart={(e) => {
                setTouchStartX(e.changedTouches[0].clientX);
            }}
            onTouchEnd={(e) => {
                const touchEndX = e.changedTouches[0].clientX;
                handleSwipe(touchEndX);
            }}
            >
                <Image
                    src={getActiveImage(activeDocumentId)}
                    alt={`Page ${filteredDocuments?.find(doc => doc.id === activeDocumentId)?.page}`}
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
                        const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                        if (currentIndex > 0 && filteredDocuments) {
                            handlePageClick(filteredDocuments[currentIndex - 1].id);
                        }
                    }}
                    disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === 0}
                    aria-label="Previous Slide"
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
                        const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                        if (filteredDocuments && currentIndex < filteredDocuments.length - 1) {
                            handlePageClick(filteredDocuments[currentIndex + 1].id);
                        }
                    }}
                    disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === filteredDocuments.length - 1}
                    aria-label="Next Slide"
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
                        Page {filteredDocuments?.find(doc => doc.id === activeDocumentId)?.page}
                    </Text>
                </Box>
            </Box>
        </Card>
    );

    // Shared preview strip component
    const PreviewStrip = () => (
        <Flex
            ref={previewScrollRef}
            gap="0.5rem"
            style={{
                overflowX: 'auto',
                padding: '0.5rem',
            }}
        >
            {filteredDocuments?.map((doc) => (
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

    // Description component
    const Description = () => (
        <Box p="md" style={{ overflow: 'auto' }}>
            <Text fw={500} size="lg">
                <Latex>{filteredDocuments?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
            </Text>
        </Box>
    );

    if (embedded) {
        return (
            <Stack gap="xs" style={{ height: '100%' }}>
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
                onTouchStart={(e) => {
                    setTouchStartX(e.changedTouches[0].clientX);
                }}
                onTouchEnd={(e) => {
                    const touchEndX = e.changedTouches[0].clientX;
                    handleSwipe(touchEndX);
                }}
                >
                    <Image
                        src={getActiveImage(activeDocumentId)}
                        alt={`Page ${filteredDocuments?.find(doc => doc.id === activeDocumentId)?.page}`}
                        width={500}
                        height={500}
                        style={{ 
                            maxWidth: '100%',
                            maxHeight: '100%',
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
                            const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                            if (currentIndex > 0 && filteredDocuments) {
                                handlePageClick(filteredDocuments[currentIndex - 1].id);
                            }
                        }}
                        disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === 0}
                        aria-label="Previous Slide"
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
                            const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                            if (filteredDocuments && currentIndex < filteredDocuments.length - 1) {
                                handlePageClick(filteredDocuments[currentIndex + 1].id);
                            }
                        }}
                        disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === filteredDocuments.length - 1}
                        aria-label="Next Slide"
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
                            Page {filteredDocuments?.find(doc => doc.id === activeDocumentId)?.page}
                        </Text>
                    </Box>
                </Box>
                
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
                    {filteredDocuments?.map((doc) => (
                        <Box
                            key={doc.id}
                            data-document={doc.id}
                            style={{
                                cursor: 'pointer',
                                width: 40,
                                height: 40,
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
                                width={40}
                                height={40}
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

                {/* Description with minimal padding */}
                <Box style={{ overflow: 'auto', paddingInline: '2px' }}>
                    <Text fw={500} size="sm">
                        <Latex>{filteredDocuments?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
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
                            <Skeleton visible={loadingLecture} height={32} width={500}>
                                <Text size="xl" fw={700} mb={6}>{lecture?.name}</Text>
                            </Skeleton>
                        </Group>
                        <Group>
                            {showDelete && (
                                <DeleteLectureModal lectureId={lectureId} lectureTitle={lecture?.name ?? ""} profile={profile ?? undefined} classId={lecture?.class ?? ""} />
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