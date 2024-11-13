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
import { AspectRatio, Box, Button, Center, Container, em, Flex, Group, Input, LoadingOverlay, SimpleGrid, Skeleton, Stack, Text, useMantineTheme } from "@mantine/core";
import { useEffect, useState } from "react";
import { answerQuestion, answerSlideQuestion, } from "../../../utils/services/question";
import { notifications } from '@mantine/notifications';
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import { createQuery } from "../../../utils/services/query";
import { HeaderSimple } from "../../../components/HeaderSimple";
import VideoSummary from "../../../components/VideoSummary";
import NotesSummary from "../../../components/NotesSummary";
import Image from "next/image";
import { getSlides } from "@/utils/queries/get-slides";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { Map } from '@/components/Map'
import { ReactFlowProvider } from "reactflow";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINEAR_PROGRAMMING_MAP } from "@/utils/map/map-tree";


export default function Class({ params }: { params: { classId: string } }) {
    const [opened, { open, close }] = useDisclosure(false)
    const [openNodeLabel, setOpenNodeLabel] = useState<string>()
    const [openNodeDescription, setOpenNodeDescription] = useState<string>()
    const theme = useMantineTheme()
    const pathname = usePathname()

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // const { data: lectures, isLoading: loadingLectures } = useQuery({
    //     queryKey: ["lectures", classId],
    //     queryFn: () => getLectures(supabase, classId),
    // });

    const { data: slides, isLoading: loadingSlides } = useQuery({
        queryKey: ["slides", classId],
        queryFn: () => getSlides(supabase, classId),
    });

    // const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
    //     queryKey: ["textbooks", classId],
    //     queryFn: () => getTextbooks(supabase, classId),
    // });

    // console.log("slides", slides)





    return (
        <>
            <div style={{ position: "fixed", width: "100vw", zIndex: 100 }}>
                <HeaderSimple />
            </div>
            {/* <Container fluid>
                <SimpleGrid cols={5}>
                    {lectures?.map((lecture) => <Text>{lecture.name}</Text>)}
                </SimpleGrid>
                <SimpleGrid cols={5}>
                    {slides?.map((slide) => <Text>{slide.name}</Text>)}
                </SimpleGrid>
                <SimpleGrid cols={5}>
                    {textbooks?.map((textbook) => <Text>{textbook.title}</Text>)}
                </SimpleGrid>
            </Container> */}
            <div style={{ width: "100vw", height: "100vh" }}>
                <ReactFlowProvider>
                    <LoadingOverlay />
                    {/* <Map
						key={query.dataUpdatedAt}
						rootNode={data.output}
						onNodeClick={(label, description) => {
							console.log(label, description)
							setOpenNodeLabel(label)
							setOpenNodeDescription(description)
							open()
						}}
					/> */}
                    <Map rootNode={LINEAR_PROGRAMMING_MAP} />
                </ReactFlowProvider>
            </div>

            {/* Want a panel on the right hand side showing all of the lectures*/}
            <div style={{ position: "fixed", left: "5vw", top: "10vh", backgroundColor: theme.primaryColor === "dark" ? theme.colors.dark[7] : theme.colors.gray[0], padding: 20, overflowY: "scroll" }}>
                <SimpleGrid cols={1}>
                    {slides?.map((slide) => <Link href={`${pathname}/slide/${slide.id}`}><Button size={isMobile ? "compact-xs" : "md"}> L{slide.note_number} - {slide.name}</Button></Link>)}
                </SimpleGrid>
            </div>
        </>
    );
}