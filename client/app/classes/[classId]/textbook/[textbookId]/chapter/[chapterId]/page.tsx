/**
 * app/classes/[classId]/textbook/[textbookId]/chapter/[chapterId]/page.tsx
 * The page for a specific chapter in a textbook.
 * @AshokSaravanan222
 * 02.04.2025
 */
"use client"

import { useEffect, useState, useRef } from "react";
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Card, em, Group, Stack, Text } from "@mantine/core";
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
import { getFigures } from "@/utils/queries/get-figures";
import { getChapter } from "@/utils/queries/get-chapter";

export default function Chapter({ params }: { params: { classId: string, textbookId: string, chapterId: string } }) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [hoveredFigure, setHoveredFigure] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const textbookId = params.textbookId;
    const chapterId = params.chapterId;

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
        queryFn: () => getTextbookDocuments(supabase, textbookId, chapter?.start_page, chapter?.end_page),
        enabled: !!chapter
    })

    const { data: figures, isLoading: loadingFigures } = useQuery({
        queryKey: ["figures", textbookId],
        queryFn: () => getFigures(supabase, documents?.map((doc) => doc.id) ?? []),
        enabled: !!documents
    })

    const { data: textbook, isLoading: loadingTextbook } = useQuery({
        queryKey: ["textbook", textbookId],
        queryFn: () => getTextbook(supabase, textbookId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })



    const getActiveImage = (documentId: string | null) => {
        if (!classData || !textbook || !documentId) return "/placeholder_image.svg";
        return `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/textbooks/${classId}/${textbookId}/${documentId}.png`
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
        // Set initial active document
        if (documents && documents.length > 0 && !activeDocumentId) {
            setActiveDocumentId(documents[0].id);
        }
    }, [documents, activeDocumentId]);

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
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}/textbook/${textbookId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>{textbook?.title + " - " + chapter?.title}</Text>
                        </Group>
                        <Group>
                            <DeleteTextbookModal textbookId={textbookId} textbookTitle={textbook?.title ?? ""} user={user ?? undefined} classId={textbook?.class ?? ""} />
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Stack>
                                <Card padding="md" pos="relative" withBorder>
                                    <Box
                                        style={{ position: 'relative', width: '100%', height: 500 }}
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
                                            fill
                                            style={{ objectFit: 'contain' }}
                                            sizes="100vw"
                                        />
                                        {/* {!loadingFigures && figures?.filter(figure => figure.document === activeDocumentId).map(figure => {
                                            const isBottomHalf = (figure.y_min / 1000) > 0.5;
                                            return (
                                                <Box
                                                    key={figure.id}
                                                    style={{
                                                        position: 'absolute',
                                                        border: '2px solid #4CAF50',
                                                        transition: 'opacity 0.3s ease',
                                                        cursor: 'pointer',
                                                        zIndex: 50,
                                                        left: `${(figure.x_min / 1000) * 100}%`,
                                                        top: `${(figure.y_min / 1000) * 100}%`,
                                                        width: `${((figure.x_max - figure.x_min) / 1000) * 100}%`,
                                                        height: `${((figure.y_max - figure.y_min) / 1000) * 100}%`,
                                                        opacity: hoveredFigure === figure.id ? 0.8 : 0.2,
                                                    }}
                                                    onMouseEnter={() => setHoveredFigure(figure.id)}
                                                    onMouseLeave={() => setHoveredFigure(null)}
                                                >
                                                    {hoveredFigure === figure.id && (
                                                        <Text style={{
                                                            position: 'absolute',
                                                            [isBottomHalf ? 'bottom' : 'top']: '100%',
                                                            left: '0',
                                                            backgroundColor: 'rgba(76, 175, 80, 0.8)',
                                                            color: 'white',
                                                            padding: '2px 6px',
                                                            fontSize: '12px',
                                                            borderRadius: '4px',
                                                            marginTop: isBottomHalf ? undefined : '4px',
                                                            marginBottom: isBottomHalf ? '4px' : undefined,
                                                            zIndex: 51,
                                                            maxWidth: '200px',
                                                            wordWrap: 'break-word',
                                                            overflowWrap: 'break-word',
                                                            whiteSpace: 'normal',
                                                        }}>
                                                            {figure.description}
                                                        </Text>
                                                    )}
                                                </Box>
                                            );
                                        })} */}
                                        <ActionIcon
                                            size="xl"
                                            variant="filled"
                                            color="gray"
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
                                            aria-label="Previous Page"
                                        >
                                            <IconArrowLeft size={32} />
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
                                            aria-label="Next Page"
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
                                                border: `2px solid ${doc.id === activeDocumentId ? 'blue' : 'transparent'}`,
                                                width: 50,
                                                height: 50,
                                                position: 'relative',
                                                flexShrink: 0,
                                            }}
                                            onClick={() => handlePageClick(doc.id)}
                                        >
                                            <Image
                                                src={getActiveImage(doc.id)}
                                                alt={`Page ${doc.page}`}
                                                fill
                                                style={{ objectFit: 'cover' }}
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
        </>
    );
}