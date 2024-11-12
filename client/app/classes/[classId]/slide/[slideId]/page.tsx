/**
 * app/classes/[classId]/slide/[slideId]/page.tsx
 * The page for a specific note in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import { AspectRatio, Box, Button, Center, Container, em, Group, Input, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
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


export default function Slide({ params }: { params: { classId: string, slideId: string } }) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

    const [pageNumber, setPageNumber] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const slideId = params.slideId;

    const handlePageClick = (pageNumber: number) => {
        // window.scrollTo(0, 0);
        setPageNumber(pageNumber)
    }

    const renderLearnMorePage = (pageNumber: number, index: number) => {
        return (
            <Button onClick={() => handlePageClick(pageNumber)} color="orange" key={`learn-more-${pageNumber}-${index}`}>Slide {pageNumber}</Button>
        )
    }

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: documents, isLoading: loadingDocs } = useQuery({
        queryKey: ["slideDocuments", slideId],
        queryFn: () => getSlideDocs(supabase, slideId),
    });

    const handleNotesClick = async () => {

        setLoading(true);
        setResponse("");
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

            const images = docs.map((doc) => `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${doc.slide}/images/page_${doc.page}.png`).filter((image) => image !== undefined)

            const context = docs.map((doc) => doc.content).join("\n");

            const { response } = await answerSlideQuestion(value, context, images);
            console.log(response);

            const { success, error } = await createQuery(value, response, classId);
            if (!success) {
                throw new Error(error);
            }

            setResponse(response)
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
        return activeDocument ? `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${activeDocument.slide}/images/page_${activeDocument.page}.png` : "";
    }

    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Stack>
                    <Link href={`${window.location.origin}/classes/${classId}`}><Button>Back</Button></Link>
                    <Text fw={700} size="xl">{classId} - {slideId}</Text>
                    <SimpleGrid
                        cols={isMobile ? 1 : 2}
                        spacing="md"
                    >
                        {/* Left Column with Sticky Video Player */}
                        <Box>
                            <Stack>
                                <AspectRatio ratio={1}>
                                    <Image
                                        src={getActiveImage(pageNumber)}
                                        alt={`Page ${pageNumber + 1}`}
                                        width={500}
                                        height={500}
                                    />
                                </AspectRatio>
                                <Group>
                                    {documents?.map((doc) => (
                                        <Box
                                            key={doc.id}
                                            style={{
                                                cursor: "pointer",
                                                border: `2px solid ${doc.page === pageNumber + 1 ? "blue" : "transparent"}`,
                                            }}
                                            onClick={() => handlePageClick(doc.page - 1)}
                                        >
                                            <Image
                                                src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${doc.slide}/images/page_${doc.page}.png`}
                                                alt={`Page ${doc.page}`}
                                                width={50}
                                                height={50}
                                            />
                                        </Box>
                                    ))}
                                </Group>
                                <Stack>
                                    <Input
                                        size="md"
                                        radius="md"
                                        placeholder="Your question here..."
                                        value={value}
                                        onChange={(e) => {
                                            setValue(e.currentTarget.value);
                                        }}
                                        disabled={loading}
                                    />
                                    <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleNotesClick}>
                                        Ask Question
                                    </Button>
                                    <Markdown>{response}</Markdown>
                                    <Group>
                                        {learnMoreBubbles.sort(
                                            (a, b) => a - b
                                        ).map((timestamp, index) => renderLearnMorePage(timestamp, index))}
                                    </Group>
                                </Stack>
                                {isMobile && <NotesSummary classId={classId} documentId={slideId} />}
                            </Stack>
                        </Box>

                        {/* Right Column with Scrollable Summary */}
                        {!isMobile && <NotesSummary documentId={slideId} classId={classId} />}
                    </SimpleGrid>
                </Stack>
            </Container>

        </>
    );
}