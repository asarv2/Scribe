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
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme } from "@mantine/core";
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
}

export default function LectureViewer({ classId, lectureId }: LectureViewerProps) {
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

    const getActiveImage = (documentId: string | null) => {
        if (!classData || !lecture || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${lectureId}/${documentId}.png`
    }

    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null && documents) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50;

            const currentIndex = documents.findIndex(doc => doc.id === activeDocumentId);
            if (deltaX > minSwipeDistance && currentIndex < documents.length - 1) {
                // Swipe left (next page)
                handlePageClick(documents[currentIndex + 1].id);
            } else if (deltaX < -minSwipeDistance && currentIndex > 0) {
                // Swipe right (previous page)
                handlePageClick(documents[currentIndex - 1].id);
            }
        }
        setTouchStartX(null);
    };

    useEffect(() => {
        // Set initial active document based on URL page parameter
        if (documents && documents.length > 0 && !activeDocumentId) {
            if (page) {
                // Handle both single page numbers and page ranges (e.g., "p.5" or "pp.5-7")
                const pageNum = parseInt(page.replace(/[^0-9]/g, ''));
                const matchingDoc = documents.find(doc => doc.page === pageNum);
                if (matchingDoc) {
                    setActiveDocumentId(matchingDoc.id);
                } else {
                    // Default to first page if specified page not found
                    setActiveDocumentId(documents[0].id);
                }
            } else {
                // No page specified, default to first page
                setActiveDocumentId(documents[0].id);
            }
        }
    }, [documents, activeDocumentId, page]);

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

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            {/* <Link href={`/classes/${classId}/lecture`}>
                                <IconArrowLeft size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} />
                            </Link> */}
                            <Text size="xl" fw={700} mb={6}>{lecture?.name}</Text>
                        </Group>
                        <Group>
                            <DeleteLectureModal lectureId={lectureId} lectureTitle={lecture?.name ?? ""} profile={profile ?? undefined} classId={lecture?.class ?? ""} />
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Stack>
                                <Card padding="md" pos="relative" withBorder>
                                    <Box
                                        style={{ 
                                            position: 'relative', 
                                            width: '100%', 
                                            height: 500,
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
                                            alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                                            width={500}
                                            height={500}
                                            style={{ 
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                borderRadius: "10px"
                                            }}
                                            sizes="100vw"
                                        />
                                        <ActionIcon
                                            size="xl"
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
                                                const currentIndex = documents?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                                                if (currentIndex > 0 && documents) {
                                                    handlePageClick(documents[currentIndex - 1].id);
                                                }
                                            }}
                                            disabled={!documents || documents.findIndex(doc => doc.id === activeDocumentId) === 0}
                                            aria-label="Previous Slide"
                                        >
                                            <IconArrowLeft size={32} color={colorScheme === "dark" ? "white" : "black"} />
                                        </ActionIcon>
                                        <ActionIcon
                                            size="xl"
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
                                                const currentIndex = documents?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                                                if (documents && currentIndex < documents.length - 1) {
                                                    handlePageClick(documents[currentIndex + 1].id);
                                                }
                                            }}
                                            disabled={!documents || documents.findIndex(doc => doc.id === activeDocumentId) === documents.length - 1}
                                            aria-label="Next Slide"
                                        >
                                            <IconArrowRight size={32} />
                                        </ActionIcon>
                                    </Box>
                                    <Box
                                        pos="absolute"
                                        bottom={10}
                                        right={10}
                                        p={2}
                                        style={{
                                            zIndex: 100,
                                        }}
                                    >
                                        <Text size="sm">Page {documents?.find(doc => doc.id === activeDocumentId)?.page}</Text>
                                    </Box>
                                </Card>

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
                            </Stack>
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Text fw={500} size="lg">
                                <Latex>{documents?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
                            </Text>
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>
        </ClassLayout>
    );
}