/**
 * app/classes/[classId].tsx
 * Each class will have its own page
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import { getLectures } from "../../../utils/queries/get-lectures";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { getClassDocs, getDocs } from "../../../utils/queries/get-docs";
import { AspectRatio, Box, Button, Center, Container, em, Group, Input, SimpleGrid, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { answerQuestion, answerSlideQuestion, createQuestion, findRelevantDocuments } from "../../../utils/services/question";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import { DocData, SummaryData } from "../../../types";
import Markdown from 'markdown-to-jsx'
import { createQuery } from "../../../utils/services/query";
import { HeaderSimple } from "../../../components/HeaderSimple";
import VideoSummary from "../../../components/VideoSummary";
import NotesSummary from "../../../components/NotesSummary";
import Image from "next/image";


export default function Class({ params }: { params: { classId: string } }) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

    const [startSeconds, setStartSeconds] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const handlePlayerClick = (seconds: number) => {
        window.scrollTo(0, 0);
        setStartSeconds(seconds)
    };

    const renderLearnMore = (timestamp: number, index: number) => {
        return (
            <Button onClick={() => handlePlayerClick(timestamp)} color="orange" key={`learn-more-${timestamp}-${index}`}>
                {formatTimestamp(timestamp)}
            </Button>
        );
    };

    const formatTimestamp = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60)
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
    }

    const handlePageClick = (pageNumber: number) => {
        window.scrollTo(0, 0);
        setPageNumber(pageNumber)
    }

    const renderLearnMorePage = (pageNumber: number, index: number) => {
        return (
            <Button onClick={() => handlePlayerClick(pageNumber)} color="orange" key={`learn-more-${pageNumber}-${index}`}>Slide {pageNumber}</Button>
        )
    }

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // const { data: lectures, isLoading: loadingLectures } = useQuery({
    //     queryKey: ["lectures", classId],
    //     queryFn: () => getLectures(supabase, classId),
    // });

    const { data: documents, isLoading: loadingDocs } = useQuery({
        queryKey: ["classDocuments", classId],
        queryFn: () => getClassDocs(supabase, classId),
    });

    const handleClick = async () => {
        setLoading(true);
        setResponse("");
        setLearnMoreBubbles([]);
        try {
            if (!value) {
                throw new Error("Please enter a question");
            }

            const { response, documents: docIds } = await answerQuestion(value);
            const docs = docIds.map((docId) => documents?.find((doc) => doc.id === docId)).filter((doc) => doc !== undefined);
            const timestamps = docs.map((doc) => doc.timestamp);
            console.log("timestamps", timestamps);

            const { success, error } = await createQuery(value, response, classId);
            if (!success) {
                throw new Error(error);
            }

            setResponse(response)
            setLearnMoreBubbles(timestamps.slice(0, 3));

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
    };

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

            const docIds = await findRelevantDocuments(value);

            const docs = docIds.map((id) => documents.find((doc) => doc.id === id)).filter((doc) => doc !== undefined);

            const timestamps = docs.map((doc) => doc.timestamp);
            console.log("timestamps", timestamps);

            const images = docs.map((doc) => `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${doc.lecture}/images/page_${doc.timestamp}.png`).filter((image) => image !== undefined).slice(0, 3);

            const context = docs.map((doc) => doc.content).join("\n");

            const { response } = await answerSlideQuestion(value, context, images);
            console.log(response);

            const { success, error } = await createQuery(value, response, classId);
            if (!success) {
                throw new Error(error);
            }

            setResponse(response)
            setLearnMoreBubbles(timestamps.slice(0, 3));

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

    const renderVideoPage = () => {
        return (
            <SimpleGrid
                cols={isMobile ? 1 : 2}
                spacing="md"
            >
                {/* Left Column with Sticky Video Player */}
                <Box style={{ position: 'sticky', top: 0 }}>
                    <Stack>
                        <AspectRatio ratio={16 / 9}>
                            <iframe
                                id="kaltura_player"
                                src={`https://cdnapisec.kaltura.com/p/983291/sp/98329100/embedIframeJs/uiconf_id/29134031/partner_id/983291?iframeembed=true&playerId=kaltura_player&entry_id=1_ugzuv5ip&flashvars[streamerType]=auto&flashvars[localizationCode]=en&flashvars[chapters.plugin]=true&flashvars[chapters.layout]=vertical&flashvars[chapters.thumbnailRotator]=false&flashvars[EmbedPlayer.SpinnerTarget]=videoHolder&flashvars[Kaltura.addCrossoriginToIframe]=true&flashvars[autoPlay]=true&flashvars[mediaProxy.mediaPlayFrom]=${startSeconds}`}
                                width="100%"
                                height="100%"
                                allow="autoplay *; fullscreen *; encrypted-media *"
                                title="Spring 2023 - MA261 - Chen (7:30)"
                            ></iframe>
                        </AspectRatio>
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
                            <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleClick}>
                                Ask Question
                            </Button>
                            <Markdown>{response}</Markdown>
                            <Group>
                                {learnMoreBubbles.sort(
                                    (a, b) => a - b
                                ).map((timestamp, index) => renderLearnMore(timestamp, index))}
                            </Group>
                        </Stack>
                        {isMobile && <VideoSummary documents={documents ?? []} loading={loadingDocs} clickPlayer={handlePlayerClick} lectureLength={3239} />}
                    </Stack>
                </Box>

                {/* Right Column with Scrollable Summary */}
                {!isMobile && <VideoSummary documents={documents ?? []} loading={loadingDocs} clickPlayer={handlePlayerClick} lectureLength={3239} />}
            </SimpleGrid>
        )
    }

    const renderNotesPage = () => {
        const activeDocument = documents?.find((doc) => doc.timestamp === pageNumber + 1);
        const imageLink = activeDocument ? `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${activeDocument.lecture}/images/page_${activeDocument.timestamp}.png` : "";

        return (
            <SimpleGrid
                cols={isMobile ? 1 : 2}
                spacing="md"
            >
                {/* Left Column with Sticky Video Player */}
                <Box style={{ position: 'sticky', top: 0 }}>
                    <Stack>
                        <AspectRatio ratio={16 / 9}>
                            <Image
                                src={imageLink}
                                alt={`Page ${pageNumber + 1}`}
                                width={500}
                                height={500}
                            />
                        </AspectRatio>
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
                        {isMobile && <NotesSummary documents={documents ?? []} loading={loadingDocs} clickPageNumber={handlePageClick} classId={classId} />}
                    </Stack>
                </Box>

                {/* Right Column with Scrollable Summary */}
                {!isMobile && <NotesSummary documents={documents ?? []} loading={loadingDocs} clickPageNumber={handlePageClick} classId={classId} />}
            </SimpleGrid>
        )
    }

    return (
        <>
            <HeaderSimple />
            <Container fluid>
                {(classId === "cfe37701-9a73-4416-ba01-81e28989e64c") ? renderVideoPage() : renderNotesPage()}
                {/* <SimpleGrid
                    cols={isMobile ? 1 : 2}
                    spacing="md"
                >
                    <Box style={{ position: 'sticky', top: 0 }}>
                        <Stack>
                            <AspectRatio ratio={16 / 9}>
                                {classId === "cfe37701-9a73-4416-ba01-81e28989e64c" ? <iframe
                                    id="kaltura_player"
                                    src={`https://cdnapisec.kaltura.com/p/983291/sp/98329100/embedIframeJs/uiconf_id/29134031/partner_id/983291?iframeembed=true&playerId=kaltura_player&entry_id=1_ugzuv5ip&flashvars[streamerType]=auto&flashvars[localizationCode]=en&flashvars[chapters.plugin]=true&flashvars[chapters.layout]=vertical&flashvars[chapters.thumbnailRotator]=false&flashvars[EmbedPlayer.SpinnerTarget]=videoHolder&flashvars[Kaltura.addCrossoriginToIframe]=true&flashvars[autoPlay]=true&flashvars[mediaProxy.mediaPlayFrom]=${startSeconds}`}
                                    width="100%"
                                    height="100%"
                                    allow="autoplay *; fullscreen *; encrypted-media *"
                                    title="Spring 2023 - MA261 - Chen (7:30)"
                                ></iframe> : <Center><Text>Slides</Text></Center>}
                            </AspectRatio>
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
                                <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleClick}>
                                    Ask Question
                                </Button>
                                <Markdown>{response}</Markdown>
                                <Group>
                                    {learnMoreBubbles.sort(
                                        (a, b) => a - b
                                    ).map((timestamp) => renderLearnMore(timestamp))}
                                </Group>
                            </Stack>
                            {isMobile && (classId === "cfe37701-9a73-4416-ba01-81e28989e64c") && <VideoSummary documents={documents ?? []} loading={loadingDocs} clickPlayer={handlePlayerClick} lectureLength={3239} />}
                        </Stack>
                    </Box>

                    {!isMobile && (classId === "cfe37701-9a73-4416-ba01-81e28989e64c") && <VideoSummary documents={documents ?? []} loading={loadingDocs} clickPlayer={handlePlayerClick} lectureLength={3239} />}
                </SimpleGrid> */}
            </Container>

        </>
    );
}