/**
 * ChapterViewer.tsx
 * 
 * This component is used to display the chapter viewer for the chapter page.
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
import { ActionIcon, Box, Card, em, Group, Stack, Text, useMantineColorScheme, Skeleton, Modal } from "@mantine/core";
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
import { getChapterDocuments } from "@/utils/queries/get-chapter-docs";
type ChapterViewerProps = {
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

export default function ChapterViewer({ 
    classId, 
    textbookId, 
    chapterId,
    initialDocumentId,
    embedded = false 
}: ChapterViewerProps) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [hoveredFigure, setHoveredFigure] = useState<string | null>(null);
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

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
        queryKey: ["chapterDocuments", textbookId, chapterId],
        queryFn: () => getChapterDocuments(supabase, [chapterId]),
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

    const filteredDocuments = documents?.sort((a, b) => a.page - b.page);

    const getActiveImage = (documentId: string | null) => {
        if (!classData || !textbook || !documentId) return "/placeholder_image.svg";
        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookId}/${documentId}.png`
    }

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
        // Set initial active document based on URL page parameter or initialDocumentId
        if (filteredDocuments && filteredDocuments.length > 0 && !activeDocumentId) {
            if (initialDocumentId) {
                // Always prioritize initialDocumentId when it's provided
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

    // Add this effect to handle changes to initialDocumentId
    useEffect(() => {
        if (initialDocumentId && filteredDocuments) {
            setActiveDocumentId(initialDocumentId);
        }
    }, [initialDocumentId, filteredDocuments]);

    // Function to open the full-size image modal
    const openImageModal = () => {
        setIsImageModalOpen(true);
    };

    // Shared viewer component
    const MainViewer = () => (
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
                src={getActiveImage(activeDocumentId)}
                alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
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
                priority={true}
                unoptimized={true}
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
                    const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                    if (currentIndex > 0 && filteredDocuments) {
                        handlePageClick(filteredDocuments[currentIndex - 1].id);
                    }
                }}
                disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === 0}
                aria-label="Previous Page"
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
                    const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                    if (filteredDocuments && currentIndex < filteredDocuments.length - 1) {
                        handlePageClick(filteredDocuments[currentIndex + 1].id);
                    }
                }}
                disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === filteredDocuments.length - 1}
                aria-label="Next Page"
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
                height: '100%',
                width: '100%'
            }}
        >
            {filteredDocuments?.map((doc) => (
                <Box
                    key={doc.id}
                    data-document={doc.id}
                    style={{
                        cursor: 'pointer',
                        width: 35, // Slightly smaller
                        height: 35, // Slightly smaller
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
                        width={35}
                        height={35}
                        style={{ 
                            objectFit: 'cover',
                            outline: doc.id === activeDocumentId ? '2px solid skyblue' : 'none',
                            outlineOffset: '-2px',
                        }}
                        sizes="100vw"
                        unoptimized={true}
                    />
                </Box>
            ))}
        </Flex>
    );

    // Description component
    const Description = () => (
        <Box style={{ overflow: 'auto', paddingInline: '2px' }}>
            <Text fw={500} size="sm">
                <Latex>{documents?.find((doc) => doc.id === activeDocumentId)?.description ?? ""}</Latex>
            </Text>
        </Box>
    );

    if (embedded) {
        return (
            <Stack gap="xs" style={{ height: '100%' }}>
                {loadingDocuments ? (
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
                            src={getActiveImage(activeDocumentId)}
                            alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
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
                            unoptimized={true}
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
                                const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                                if (currentIndex > 0 && filteredDocuments) {
                                    handlePageClick(filteredDocuments[currentIndex - 1].id);
                                }
                            }}
                            disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === 0}
                            aria-label="Previous Page"
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
                                const currentIndex = filteredDocuments?.findIndex(doc => doc.id === activeDocumentId) ?? 0;
                                if (filteredDocuments && currentIndex < filteredDocuments.length - 1) {
                                    handlePageClick(filteredDocuments[currentIndex + 1].id);
                                }
                            }}
                            disabled={!filteredDocuments || filteredDocuments.findIndex(doc => doc.id === activeDocumentId) === filteredDocuments.length - 1}
                            aria-label="Next Page"
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
                                Page {documents?.find(doc => doc.id === activeDocumentId)?.page}
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
                    {loadingDocuments ? (
                        <Flex gap={4} style={{ padding: '2px', height: '100%' }}>
                            {[...Array(6)].map((_, index) => (
                                <Skeleton key={index} height={35} width={35} radius="sm" />
                            ))}
                        </Flex>
                    ) : (
                        <PreviewStrip />
                    )}
                </Box>
                
                {/* Description with flex-grow to take remaining space */}
                <Box style={{ 
                    overflow: 'auto', 
                    paddingInline: '2px',
                    flexGrow: 1,
                    minHeight: '80px' // Ensure description always has some minimum height
                }}>
                    {loadingDocuments ? (
                        <Stack>
                            <Skeleton height={16} width="90%" />
                            <Skeleton height={16} width="85%" />
                            <Skeleton height={16} width="70%" />
                        </Stack>
                    ) : (
                        <Description />
                    )}
                </Box>
                
                {/* Add the full-size image modal */}
                <Modal 
                    opened={isImageModalOpen} 
                    onClose={() => setIsImageModalOpen(false)}
                    size="xl"
                    padding="md"
                    centered
                    title={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
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
                            src={getActiveImage(activeDocumentId)}
                            alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                            width={1200}
                            height={1200}
                            style={{ 
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: "contain"
                            }}
                            sizes="100vw"
                            unoptimized={true}
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
                            <Skeleton visible={loadingTextbook} height={32} width={1000}>
                                <Text size="xl" fw={700} mb={6}>{textbook?.title + " - " + chapter?.title}</Text>
                            </Skeleton>
                        </Group>
                        {/* <Group>
                            {showDelete && (
                                <DeleteTextbookModal textbookId={textbookId} textbookTitle={textbook?.title ?? ""} profile={profile ?? undefined} classId={textbook?.class ?? ""} />
                            )}
                        </Group> */}
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
                
                {/* Add the full-size image modal */}
                <Modal 
                    opened={isImageModalOpen} 
                    onClose={() => setIsImageModalOpen(false)}
                    size="xl"
                    padding="md"
                    centered
                    title={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
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
                            src={getActiveImage(activeDocumentId)}
                            alt={`Page ${documents?.find(doc => doc.id === activeDocumentId)?.page}`}
                            width={1200}
                            height={1200}
                            style={{ 
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: "contain"
                            }}
                            sizes="100vw"
                            unoptimized={true}
                        />
                    </Box>
                </Modal>
            </Container>
        </ClassLayout>
    );
}