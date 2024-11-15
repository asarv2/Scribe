/**
 * app/classes/[classId]/slide/[slideId]/page.tsx
 * The page for a specific note in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import { ActionIcon, Anchor, AspectRatio, Box, Breadcrumbs, Button, Card, Center, Container, Divider, em, Flex, Grid, Group, Input, SimpleGrid, Skeleton, Space, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import { getSlideDocs } from "@/utils/queries/get-slide-docs";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { answerSlideQuestion, findRelevantNoteDocuments } from "@/utils/services/question";
import { createQuery } from "@/utils/services/query";
import { HeaderSimple } from "@/components/HeaderSimple";
import NotesSummary from "@/components/NotesSummary";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";
import { getSlide } from "@/utils/queries/get-slide";
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconArrowUp } from '@tabler/icons-react';


export default function Slide({ params }: { params: { classId: string, slideId: string } }) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [responseQuestion, setResponseQuestion] = useState<string>(""); // Store question asked
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);
    const pathname = usePathname();

    const [touchStartX, setTouchStartX] = useState<number | null>(null);


    const [pageNumber, setPageNumber] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const slideId = params.slideId;

    const handlePageClick = (newPageNumber: number) => {
        if (newPageNumber < 0 || newPageNumber >= (documents?.length ?? 0)) {
            return;
        }
        setPageNumber(newPageNumber);
    };

    const renderLearnMorePage = (pageNumber: number, index: number) => {
        return (
            <Button onClick={() => {
                window.scrollTo(0, 200);
                handlePageClick(pageNumber - 1)
            }} color="orange" key={`learn-more-${pageNumber}-${index}`}>Slide {pageNumber}</Button>
        )
    }

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClass } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId),
    });

    const { data: slide, isLoading: loadingSlide } = useQuery({
        queryKey: ["slide", slideId],
        queryFn: () => getSlide(supabase, slideId),
    });

    const { data: documents, isLoading: loadingDocs } = useQuery({
        queryKey: ["slideDocuments", slideId],
        queryFn: () => getSlideDocs(supabase, slideId),
    });

    const handleNotesClick = async () => {

        setLoading(true);
        setResponse("");
        setResponseQuestion("");
        setLearnMoreBubbles([]);
        try {
            if (!value) {
                throw new Error("Please enter a question");
            }
            if (!documents) {
                throw new Error("Documents are not loaded yet");
            }

            const docIds = await findRelevantNoteDocuments(value);

            const docs = docIds.map((id) => documents.find((doc) => doc.id === id)).filter((doc) => doc !== undefined);

            const pages = docs.map((doc) => doc.page);
            console.log("pages", pages);

            const images = docs.map((doc) => `${window.location.origin}/${classId}/${doc.slide}/page_${doc.page}.png`).filter((image) => image !== undefined)

            const context = docs.map((doc) => doc.content).join("\n");

            const { response } = await answerSlideQuestion(value, context, images);
            console.log(response);

            const { success, error } = await createQuery(value, response, classId);
            if (!success) {
                throw new Error(error);
            }

            setResponse(response)
            setResponseQuestion(value);
            setLearnMoreBubbles(pages.slice(0, 3));

            notifications.show({
                title: "Question asked",
                message: "Your question has been answered",
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to ask question",
                message: error.message,
                color: "red",
            });
        } finally {
            setLoading(false);
            setValue("");
        }
    }


    const getActiveImage = (pageNumber: number) => {
        const activeDocument = documents?.find((doc) => doc.page === pageNumber + 1);
        return activeDocument ? `/${classId}/${activeDocument.slide}/page_${activeDocument.page}.png` : "";
    }

    // const items = pathname.split("/").map((path, index) => (
    //     <Anchor href={path} key={index}>
    //       {path}
    //     </Anchor>
    //   ));

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
            <Container fluid>
                <Stack>
                    {/* <Breadcrumbs>{items}</Breadcrumbs> */}
                    <Group w={"100%"}>
                        <Link href={`/classes/${classId}`}>
                            <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                        </Link>
                        <Text size="xl" fw={700} mb={6}>{slide?.name}</Text>
                    </Group>
                    <Grid>
                        {/* Left Column with Sticky Video Player */}
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
                                            style={{ position: 'relative', width: '100%', height: 400 }}
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
                                            {/* Left Arrow */}
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
                                                disabled={pageNumber === 0}
                                                aria-label="Previous Slide"
                                            >
                                                <IconArrowLeft size={32} />
                                            </ActionIcon>
                                            {/* Right Arrow */}
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
                                                disabled={pageNumber === (documents ? documents.length - 1 : 0)}
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
                                            <Text size="sm">Slide {pageNumber + 1}</Text>
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
                                                    border: `2px solid ${doc.page === pageNumber + 1 ? 'blue' : 'transparent'}`,
                                                    width: 50,
                                                    height: 50,
                                                    position: 'relative',
                                                    flexShrink: 0, // Prevents the items from shrinking
                                                }}
                                                onClick={() => handlePageClick(doc.page - 1)}
                                            >
                                                <Image
                                                    src={`/${classId}/${doc.slide}/page_${doc.page}.png`}
                                                    alt={`Page ${doc.page}`}
                                                    fill
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            </Box>
                                        ))}
                                    </Flex>
                                    <Group>
                                        <Flex w="100%" gap="xs" align={"center"}>
                                            <Input
                                                size="md"
                                                radius="md"
                                                placeholder="Have any questions?"
                                                value={value}
                                                onChange={(e) => {
                                                    setValue(e.currentTarget.value);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleNotesClick();
                                                    }
                                                }}
                                                disabled={loading}
                                                style={{ flexGrow: 1 }}
                                            />
                                            <ActionIcon
                                                color="blue"
                                                onClick={handleNotesClick}
                                                loading={loading}
                                                size="lg" // Optional: Adjust size if needed
                                            >
                                                <IconArrowUp size={24} />
                                            </ActionIcon>
                                        </Flex>
                                        {/* <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleNotesClick}>
                                            Ask Question
                                        </Button> */}
                                        {responseQuestion.length !== 0 && response.length !== 0 && <Card padding="md" shadow="xs">
                                            <Text fw={700} size="md">Q: {responseQuestion}</Text>
                                            <Markdown>{response}</Markdown>
                                        </Card>}
                                        <Group>
                                            {learnMoreBubbles.sort(
                                                (a, b) => a - b
                                            ).map((timestamp, index) => renderLearnMorePage(timestamp, index))}
                                        </Group>
                                    </Group>
                                    {isMobile && <NotesSummary classId={classId} documentId={slideId} />}
                                </Stack>
                            </Box>
                        </Grid.Col>

                        {/* Right Column with Scrollable Summary */}
                        <Grid.Col span={isMobile ? 12 : 6}>
                            {!isMobile &&
                                <NotesSummary documentId={slideId} classId={classId} />}
                        </Grid.Col>
                    </Grid>
                </Stack>
            </Container>

        </>
    );
}