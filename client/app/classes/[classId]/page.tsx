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
import { AspectRatio, Box, Button, Center, Container, em, Flex, Group, Input, Loader, LoadingOverlay, Modal, SimpleGrid, Skeleton, Stack, Text, useMantineTheme } from "@mantine/core";
import { Suspense, useEffect, useState } from "react";
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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINEAR_PROGRAMMING_MAP, LINEAR_PROGRAMMING_V2_MAP } from "@/utils/map/map-tree";
import { NodeDetail } from "@/components/NodeDetail";
import { getMap } from "@/utils/queries/get-map";
import { ReactFlowProvider } from "@xyflow/react";
import { IconPlus } from "@tabler/icons-react";
import { getUser } from "@/utils/queries/get-user";
import { User } from "@supabase/supabase-js";
import AddLectureModal from "@/components/AddLectureModal";


export default function Class({ params }: { params: { classId: string } }) {
    const [opened, { open, close }] = useDisclosure(false)
    const [openNodeId, setOpenNodeId] = useState<string>()
    const [openNodeLabel, setOpenNodeLabel] = useState<string>()
    const [openNodeDescription, setOpenNodeDescription] = useState<string>()
    const theme = useMantineTheme()
    const pathname = usePathname()

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: map, isLoading: loadingMap } = useQuery({
        queryKey: ["map", classId],
        queryFn: () => getMap(supabase, classId)
    })

    const { data: slides, isLoading: loadingSlides } = useQuery({
        queryKey: ["slides", classId],
        queryFn: () => getSlides(supabase, classId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })



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
                    {map && <Map
                        rootNode={map}
                        onNodeClick={(topicId, label, description) => {
                            console.log(topicId, label, description)
                            setOpenNodeId(topicId)
                            setOpenNodeLabel(label)
                            setOpenNodeDescription(description)
                            open()
                        }}
                    />}
                </ReactFlowProvider>
            </div>

            {/* Want a panel on the right hand side showing all of the lectures*/}
            <div style={{ position: "fixed", left: "0", top: "0", backgroundColor: "white", padding: 20, overflowY: "scroll", marginLeft: 15, marginTop: 70, height: "70vh", borderRadius: 10, boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
                <SimpleGrid cols={1}>
                    {slides?.map((slide) => <Link href={`${pathname}/slide/${slide.id}`}><Button size={isMobile ? "compact-xs" : "sm"}> L{slide.note_number} - {slide.name}</Button></Link>)}
                    <AddLectureModal user={user} isMobile={isMobile ?? true}/>
                </SimpleGrid>
            </div>

            <Modal
                opened={opened}
                onClose={close}
                title={<h3>{openNodeLabel}</h3>}
                centered
                overlayProps={{
                    color:
                        theme.primaryColor === 'dark'
                            ? theme.colors.dark[9]
                            : theme.colors.gray[2],
                    opacity: 0.25,
                    blur: 2,
                }}
                transitionProps={{ transition: 'fade', duration: 200 }}
            >
                <Stack>
                    <Text>{openNodeDescription}</Text>

                    {
                        <Suspense
                            fallback={
                                <Center>
                                    <Loader />
                                </Center>
                            }
                        >
                            {openNodeId && <NodeDetail topicId={openNodeId} />}
                        </Suspense>
                    }
                </Stack>
            </Modal>
        </>
    );
}