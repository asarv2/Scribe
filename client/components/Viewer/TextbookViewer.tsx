/**
 * TextbookViewer.tsx
 * 
 * This component is used to display the textbook viewer for the textbook page.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname, useSearchParams } from "next/navigation";
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
import DeleteTextbookModal from "@/components/Delete/DeleteTextbookModal";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { getTextbook } from "@/utils/queries/get-textbook";
import { getChapter } from "@/utils/queries/get-chapter";
import { getProfile } from "@/utils/queries/get-profile";
import { ClassLayout } from "../Class/ClassLayout";
type TextbookViewerProps = {
    classId: string;
    textbookId: string;
    chapterId: string;
    initialDocumentId?: string;
    embedded?: boolean;
}

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

export default function TextbookViewer({ 
    classId, 
    textbookId, 
    chapterId,
    initialDocumentId,
    embedded = false 
}: TextbookViewerProps) {
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

    const { data: chapter, isLoading: loadingChapter } = useQuery({
        queryKey: ["chapter", chapterId],
        queryFn: () => getChapter(supabase, chapterId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["chapterTextbookDocuments", textbookId, chapterId],
        queryFn: () => getTextbookDocuments(supabase, [textbookId], chapter?.start_page, chapter?.end_page),
        enabled: !!chapter
    })

    const { data: textbook, isLoading: loadingTextbook } = useQuery({
        queryKey: ["textbook", textbookId],
        queryFn: () => getTextbook(supabase, textbookId)
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
        if (!classData || !textbook || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookId}/${documentId}.png`
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

    // Shared viewer component
    const MainViewer = () => (
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
                alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                width={500}
                height={500}
                style={{ 
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: "contain"
                }}
                sizes="100vw"
                placeholder="blur"
                blurDataURL="/placeholder_image.svg"
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
    );

    // Shared preview strip component
    const PreviewStrip = () => (
        <Flex
            ref={previewScrollRef}
            gap={4}
            style={{
                overflowX: 'auto',
                padding: '2px',
                flexShrink: 0
            }}
        >
            {documents?.map((doc) => (
                <Box
                    key={doc.id}
                    data-document={doc.id}
                    style={{
                        cursor: 'pointer',
                        width: embedded ? 40 : 50,
                        height: embedded ? 40 : 50,
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
                        width={embedded ? 40 : 50}
                        height={embedded ? 40 : 50}
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
        <Box style={{ overflow: 'auto', paddingInline: embedded ? '2px' : 'md' }}>
            <Text fw={500} size={embedded ? "sm" : "lg"}>
                <Latex>{documents?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
            </Text>
        </Box>
    );

    if (embedded) {
        return (
            <Stack gap="xs" style={{ height: '100%' }}>
                <MainViewer />
                <PreviewStrip />
                <Description />
            </Stack>
        );
    }

    return (
        <ClassLayout classId={classId}>
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Skeleton visible={loadingTextbook} height={32} width={500}>
                                <Text size="xl" fw={700} mb={6}>{textbook?.title + " - " + chapter?.title}</Text>
                            </Skeleton>
                        </Group>
                        <Group>
                            {showDelete && (
                                <DeleteTextbookModal textbookId={textbookId} textbookTitle={textbook?.title ?? ""} profile={profile ?? undefined} classId={textbook?.class ?? ""} />
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