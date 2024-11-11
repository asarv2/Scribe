/**
 * app/classes/[classId]/lecture/[lectureId]/page.tsx
 * The page for a specific lecture in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../../../utils/supabase/supabase-browser";
import { AspectRatio, Box, Button, Center, Container, em, Group, Input, SimpleGrid, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import { createQuery } from "../../../../../utils/services/query";
import { HeaderSimple } from "../../../../../components/HeaderSimple";
import VideoSummary from "@/components/VideoSummary";
import Image from "next/image";
import { getLectureDocs } from "@/utils/queries/get-lecture-docs";
import { answerQuestion } from "@/utils/services/question";


export default function Lecture({ params }: { params: { classId: string, lectureId: string } }) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

    const [startSeconds, setStartSeconds] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const lectureId = params.lectureId;

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


    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: documents, isLoading: loadingDocs } = useQuery({
        queryKey: ["lectureDocuments", lectureId],
        queryFn: () => getLectureDocs(supabase, lectureId),
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

    return (
        <>
            <HeaderSimple />
            <Container fluid>
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
            </Container>

        </>
    );
}