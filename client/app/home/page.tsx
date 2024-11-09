/**
 * app/home/page.tsx
 * The home page component for the app.
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"
import { HeaderSimple } from "../../components/HeaderSimple";
import { AspectRatio, Box, Button, Center, Container, em, Group, Input, SimpleGrid, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { answerQuestion, createQuestion } from "../../utils/services/question";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import { DocData, SummaryData } from "../../types";
import useSupabaseBrowser from "../../utils/supabase/supabase-browser";
import { getDocs } from "../../utils/queries/get-docs";
import { useQuery } from "@tanstack/react-query";
import Markdown from 'markdown-to-jsx'
import { createQuery } from "../../utils/services/query";
import VideoSummary from "../../components/VideoSummary";

const lectureLength = 3239 // in seconds

const exampleData: SummaryData = [
    {
        heading: "Introduction",
        timestamp: "0:30",
        children: [
            {
                subheading: "What is the course about?",
                timestamp: "1:18",
                children: [
                    {
                        text: "This course is about...",
                        timestamp: "2:10"
                    }, {
                        text: "This course is about...",
                        timestamp: "3:41"
                    }, {
                        text: "This course is about...",
                        timestamp: "4:40"
                    }
                ]
            }, {
                subheading: "What is the course about?",
                timestamp: "15:53",
                children: [
                    {
                        text: "This course is about...",
                        timestamp: "17:27"
                    }, {
                        text: "This course is about...",
                        timestamp: "20:00"
                    }, {
                        text: "This course is about...",
                        timestamp: "20:35"
                    }
                ]
            }
        ]
    }, {
        heading: "Lecture 1",
        timestamp: "3:41",
        children: [
            {
                subheading: "What is the course about?",
                timestamp: "4:40",
                children: [
                    {
                        text: "This course is about...",
                        timestamp: "7:01"
                    }, {
                        text: "This course is about...",
                        timestamp: "8:48"
                    }, {
                        text: "This course is about...",
                        timestamp: "12:47"
                    }
                ]
            }, {
                subheading: "What is the course about?",
                timestamp: "15:53",
                children: [
                    {
                        text: "This course is about...",
                        timestamp: "17:27"
                    }, {
                        text: "This course is about...",
                        timestamp: "20:00"
                    }, {
                        text: "This course is about...",
                        timestamp: "20:35"
                    }
                ]
            }
        ]
    }, {
        heading: "Lecture 2",
        timestamp: "8:48",
        children: [
            {
                subheading: "What is the course about?",
                timestamp: "12:47",
                children: [
                    {
                        text: "This course is about...",
                        timestamp: "14:34"
                    }, {
                        text: "This course is about...",
                        timestamp: "15:53"
                    }, {
                        text: "This course is about...",
                        timestamp: "17:27"
                    }
                ]
            }, {
                subheading: "What is the course about?",
                timestamp: "15:53",
                children: [
                    {
                        text: "This course is about...",
                        timestamp: "17:27"
                    }, {
                        text: "This course is about...",
                        timestamp: "20:00"
                    }, {
                        text: "This course is about...",
                        timestamp: "20:35"
                    }
                ]
            }
        ]
    }
]

export default function Home() {
    const supabase = useSupabaseBrowser();
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

    const [startSeconds, setStartSeconds] = useState<number>(0);

    const lectureId = "3ae57d24-8426-44c3-816b-f23e3ae04d0b"

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

            const {success, error} = await createQuery(value, response, lectureId);
            if (!success) {
                throw new Error(error);
            }

            setResponse(response)
            setLearnMoreBubbles(timestamps)

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

    const calculateKeyPress = (seconds: number, lectureLength: number) => {
        // should find the percentage of the lecture that has been completed
        // map percenrage ranges to keys (0-10% -> HOME, 10-20% -> 1, 20-30% -> 2, 30-40% -> 3, 40-50% -> 4, 50-60% -> 5, 60-70% -> 6, 70-80% -> 7, 80-90% -> 8, 90-100% -> 9)
        const percentage = seconds / lectureLength
        if (percentage <= 0.1) {
            return "Home"
        } else if (percentage <= 0.2) {
            return "1"
        } else if (percentage <= 0.3) {
            return "2"
        } else if (percentage <= 0.4) {
            return "3"
        } else if (percentage <= 0.5) {
            return "4"
        } else if (percentage <= 0.6) {
            return "5"
        } else if (percentage <= 0.7) {
            return "6"
        } else if (percentage <= 0.8) {
            return "7"
        } else if (percentage <= 0.9) {
            return "8"
        } else {
            return "9"
        }
    }

    const handlePlayerClick = (seconds: number) => {
        window.scrollTo(0, 0);
        setStartSeconds(seconds)
    };

    const renderLearnMore = (timestamp: number) => {
        return (
            <Button onClick={() => handlePlayerClick(timestamp)} color="orange">{formatTimestamp(timestamp)}</Button>
        )
    }

    const formatTimestamp = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60)
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
    }

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: documents, isLoading: loadingDocs } = useQuery({
        queryKey: ["documents", lectureId],
        queryFn: () => getDocs(supabase, lectureId),
    });



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
                                    ).map((timestamp) => renderLearnMore(timestamp))}
                                </Group>
                            </Stack>
                            {isMobile && <VideoSummary documents={documents ?? []} loading={loadingDocs} clickPlayer={handlePlayerClick} lectureLength={3239}/>}
                        </Stack>
                    </Box>

                    {/* Right Column with Scrollable Summary */}
                    {!isMobile && <VideoSummary documents={documents ?? []} loading={loadingDocs} clickPlayer={handlePlayerClick} lectureLength={3239} />}
                </SimpleGrid>
            </Container>

        </>
    );
}