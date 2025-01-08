/**
 * app/classes/[classId]/lecture/[lectureId]/page.tsx
 * The page for a specific lecture in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { useEffect, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
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
import DeleteLectureModal from "@/components/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import Latex from "react-latex-next";

export default function Lecture({ params }: { params: { classId: string, lectureId: string} }) {
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState<number>(1);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const lectureId = params.lectureId;
    

    const handlePageClick = (newPageNumber: number) => {
        if (newPageNumber < 1 || (newPageNumber > (documents?.length ?? 0))) {
            return;
        }
        setPageNumber(newPageNumber);
    };

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["lectureDocuments", lectureId],
        queryFn: () => getLectureDocuments(supabase, lectureId)
    })

    const { data: lecture, isLoading: loadingLecture } = useQuery({
        queryKey: ["lecture", lectureId],
        queryFn: () => getLecture(supabase, lectureId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const getActiveImage = (pageNumber: number) => {
        if (!classData || !lecture) return "";
        const activeDocument = documents?.find((doc) => doc.page === pageNumber);
        return activeDocument ? `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/lectures/${lectureId}/images/${activeDocument.page}.png` : "";
    }

    const handleSwipe = (touchEndX: number) => {
        if (touchStartX !== null) {
            const deltaX = touchStartX - touchEndX;
            const minSwipeDistance = 50; // Minimum distance for a swipe

            if (deltaX > minSwipeDistance) {
                // Swipe left (next page)
                handlePageClick(pageNumber + 1);
            } else if (deltaX < -minSwipeDistance) {
                // Swipe right (previous page)
                handlePageClick(pageNumber - 1);
            }
        }
        setTouchStartX(null);
    };


    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                handlePageClick(pageNumber - 1);
            } else if (event.key === 'ArrowRight') {
                handlePageClick(pageNumber + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [pageNumber, documents]);


    return (
        <>
            <HeaderSimple />
            <Container fluid style={{ marginTop: "30px" }}>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>{lecture?.name}</Text>
                        </Group>
                        <Group>
                            <DeleteLectureModal lectureId={lectureId} lectureTitle={lecture?.name ?? ""} user={user ?? undefined} classId={lecture?.class ?? ""} />
                        </Group>
                    </Flex>
                    <Grid>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Box
                                style={{ position: 'relative', width: '100%', height: 400 }}
                                onTouchStart={(e) => {
                                    setTouchStartX(e.changedTouches[0].clientX);
                                }}
                                onTouchEnd={(e) => {
                                    const touchEndX = e.changedTouches[0].clientX;
                                    handleSwipe(touchEndX);
                                }}
                            >
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
                                                src={getActiveImage(pageNumber)}
                                                alt={`Page ${pageNumber + 1}`}
                                                fill
                                                style={{ objectFit: 'contain' }}
                                            />
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
                                                onClick={() => handlePageClick(pageNumber - 1)}
                                                disabled={pageNumber === 1}
                                                aria-label="Previous Slide"
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
                                                onClick={() => handlePageClick(pageNumber + 1)}
                                                disabled={pageNumber === (documents ? documents.length : 0)}
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
                                            <Text size="sm">Slide {pageNumber}</Text>
                                        </Box>
                                    </Card>

                                    <Flex
                                        gap="0.5rem"
                                        style={{
                                            overflowX: 'auto', // Enables horizontal scrolling
                                        }}
                                    >
                                        {documents?.map((doc) => (
                                            <Box
                                                key={doc.id}
                                                style={{
                                                    cursor: 'pointer',
                                                    border: `2px solid ${doc.page === pageNumber ? 'blue' : 'transparent'}`,
                                                    width: 50,
                                                    height: 50,
                                                    position: 'relative',
                                                    flexShrink: 0, // Prevents the items from shrinking
                                                }}
                                                onClick={() => handlePageClick(doc.page)}
                                            >
                                                <Image
                                                    src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classId}/lectures/${lectureId}/images/${doc.page}.png`}
                                                    alt={`Page ${doc.page}`}
                                                    fill
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            </Box>
                                        ))}
                                    </Flex>
                                </Stack>
                            </Box>
                        </Grid.Col>
                        <Grid.Col span={isMobile ? 12 : 6}>
                            <Text fw={500} size="lg"><Latex>{documents?.find((doc) => doc.page === pageNumber)?.description ?? ""}</Latex></Text>
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>

        </>
    );
}