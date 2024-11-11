/**
 * app/classes/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import { getLectures } from "../../../utils/queries/get-lectures";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { AspectRatio, Box, Button, Center, Container, em, Group, Input, SimpleGrid, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { answerQuestion, answerSlideQuestion, } from "../../../utils/services/question";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import { createQuery } from "../../../utils/services/query";
import { HeaderSimple } from "../../../components/HeaderSimple";
import VideoSummary from "../../../components/VideoSummary";
import NotesSummary from "../../../components/NotesSummary";
import Image from "next/image";
import { getSlides } from "@/utils/queries/get-slides";
import { getTextbooks } from "@/utils/queries/get-textbooks";


export default function Class({ params }: { params: { classId: string } }) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

    const [startSeconds, setStartSeconds] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId),
    });

    const { data: slides, isLoading: loadingSlides } = useQuery({
        queryKey: ["slides", classId],
        queryFn: () => getSlides(supabase, classId),
    });

    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    console.log("lectures", lectures)
    console.log("slides", slides)
    console.log("textbooks", textbooks)


    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <SimpleGrid cols={5}>
                    {lectures?.map((lecture) => <Text>{lecture.name}</Text>)}
                </SimpleGrid>
                <SimpleGrid cols={5}>
                    {slides?.map((slide) => <Text>{slide.name}</Text>)}
                </SimpleGrid>
                <SimpleGrid cols={5}>
                    {textbooks?.map((textbook) => <Text>{textbook.title}</Text>)}
                </SimpleGrid>
            </Container>

        </>
    );
}