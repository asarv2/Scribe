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
import Summary from "../../components/Summary";
import { SummaryData } from "../../types";

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
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses

    const handleClick = async () => {
        setLoading(true);
        try {
            if (!value) {
                throw new Error("Please enter a question");
            }

            const response = await answerQuestion(value);
            setResponse(response)

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

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);


    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <SimpleGrid cols={isMobile ? 1 : 2}>
                    <Stack>
                        {/* <VideoPlayer /> */}
                        <AspectRatio ratio={16 / 9} >
                            <iframe id="kaltura_player" src="https://cdnapisec.kaltura.com/p/983291/sp/98329100/embedIframeJs/uiconf_id/29134031/partner_id/983291?iframeembed=true&playerId=kaltura_player&entry_id=1_ugzuv5ip&flashvars[streamerType]=auto&amp;flashvars[localizationCode]=en&amp;flashvars[sideBarContainer.plugin]=true&amp;flashvars[sideBarContainer.position]=left&amp;flashvars[sideBarContainer.clickToClose]=true&amp;flashvars[chapters.plugin]=true&amp;flashvars[chapters.layout]=vertical&amp;flashvars[chapters.thumbnailRotator]=false&amp;flashvars[streamSelector.plugin]=true&amp;flashvars[EmbedPlayer.SpinnerTarget]=videoHolder&amp;flashvars[dualScreen.plugin]=true&amp;flashvars[Kaltura.addCrossoriginToIframe]=true&amp;&wid=1_57ol4cmw" width="100%" height="100%" allow="autoplay *; fullscreen *; encrypted-media *" sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation" title="Spring 2023 - MA261 - Chen (7:30)"></iframe>
                        </AspectRatio>
                        {isMobile && <Summary data={exampleData} />}
                        <Stack>
                            <Input size="md" radius="md" placeholder="Your question here..." value={value} onChange={(e) => {
                                setValue(e.currentTarget.value);
                            }} disabled={loading} />
                            <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleClick}>Ask Question</Button>
                            <Text>{response}</Text>
                        </Stack>
                    </Stack>
                    {!isMobile && <Summary data={exampleData} />}
                </SimpleGrid>
            </Container>
        </>
    );
}