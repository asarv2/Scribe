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
import { answerQuestion, answerSlideQuestion, } from "../../../utils/services/gemini";
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
import { flattenMapNode, Map } from '@/components/Map'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LINEAR_PROGRAMMING_MAP, LINEAR_PROGRAMMING_V2_MAP, LP_MAP, LP_MAP_CHAT, LP_MAP_CHAT_EDIT, LP_MAP_CHAT_V2, LP_MAP_CHAT_V3 } from "@/utils/map/map-tree";
import { NodeDetail } from "@/components/NodeDetail";
import { getMap } from "@/utils/queries/get-map";
import { ReactFlowProvider } from "@xyflow/react";
import { IconPlus } from "@tabler/icons-react";
import { getUser } from "@/utils/queries/get-user";
import { User } from "@supabase/supabase-js";
import AddLectureModal from "@/components/AddLectureModal";
import { getClass } from "@/utils/queries/get-class";
import AddQuestionsModal from "@/components/AddQuestionsModal";
import { PracticeExam } from "@/types";
import { getPracticeExams } from "@/utils/queries/get-practice-exams";
import { isProfessor } from "@/utils/lecture/isProfessor";
import { differenceBy, intersectionBy, uniqBy } from "lodash";


export default function Class({ params }: { params: { classId: string } }) {
    const [opened, { open, close }] = useDisclosure(false)
    const [openNodeId, setOpenNodeId] = useState<string>()
    const [openNodeLabel, setOpenNodeLabel] = useState<string>()
    const [openNodeDescription, setOpenNodeDescription] = useState<string>()
    const theme = useMantineTheme()
    const pathname = usePathname()
    const [pastExams, setPastExams] = useState<PracticeExam[]>([])

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);


    // const { data: map, isLoading: loadingMap } = useQuery({
    //     queryKey: ["map", classId],
    //     queryFn: () => getMap(supabase, classId)
    // })
    const map = LP_MAP_CHAT_EDIT

    const { data: slides, isLoading: loadingSlides } = useQuery({
        queryKey: ["slides", classId],
        queryFn: () => getSlides(supabase, classId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: practiceExams, isLoading: loadingPracticeExams } = useQuery({
        queryKey: ["practiceExams", classId],
        queryFn: () => getPracticeExams(supabase, classId)
    })

    // Load past exams from localStorage on component mount
    useEffect(() => {
        const savedExams = localStorage.getItem(`pastExams-${classId}`);
        if (savedExams) {
            setPastExams(JSON.parse(savedExams));
        }
    }, [classId]);

    // Function to get current exams
    const getCurrentExams = (practiceExams: PracticeExam[] | undefined) => {
        // want to remove all exams from pastExams if they are not present in practiceExams
        if (practiceExams) {
            // first find all the ones that are the common between the two
            const newPastExams = intersectionBy(practiceExams, pastExams, 'id')

            // should only see thier personal exams and the ones the professor has created
            const allExams = [...newPastExams, ...(practiceExams ?? []).filter((exam) => exam.professor)]
            const noDuplicateIds = uniqBy(allExams, 'id')
            return noDuplicateIds
        } else {
            return []
        }
    };

    return (
        <>
            <div style={{ position: "fixed", width: "100vw", zIndex: 100 }}>
                <HeaderSimple />
            </div>
            <div style={{ width: "100vw", height: "100vh" }}>
                {map && <Map
                    rootNode={map}
                    onNodeClick={(topicId, label, description) => {
                        setOpenNodeId(topicId)
                        setOpenNodeLabel(label)
                        setOpenNodeDescription(description)
                        open()
                    }}
                />}
            </div>

            <div style={{ position: "fixed", left: "0", top: "0", backgroundColor: "white", padding: 20, overflowY: "scroll", marginLeft: 15, marginTop: 70, height: "30vh", borderRadius: 10, boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
                <SimpleGrid cols={1}>
                    {slides?.map((slide) => <Link href={`${pathname}/slide/${slide.id}`}><Button size={isMobile ? "compact-xs" : "sm"}> L{slide.note_number} - {slide.name}</Button></Link>)}
                    <AddLectureModal user={user ?? undefined} isMobile={isMobile ?? true} classId={classId} noteCount={slides?.length ?? 0} currentMap={map ?? null} className={classData?.title ?? ""} />
                </SimpleGrid>
            </div>

            <div style={{ position: "fixed", left: "0", top: "35vh", backgroundColor: "white", padding: 20, overflowY: "scroll", marginLeft: 15, marginTop: 70, height: "30vh", borderRadius: 10, boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
                <SimpleGrid cols={1}>
                    {getCurrentExams(practiceExams).map((exam, i) => (
                        <Button key={i} size={isMobile ? "compact-xs" : "sm"} component={Link} href={`${pathname}/practice-exam/${exam.id}`}>{exam.name}</Button>
                    ))}
                    <AddQuestionsModal
                        slides={slides ?? []}
                        slideId={""}
                        classId={classId}
                        className={classData?.title ?? ""}
                        isMobile={isMobile ?? true}
                        user={user ?? undefined}
                        onExamGenerated={(exam) => {
                            const savedExams = localStorage.getItem(`pastExams-${classId}`);
                            const savedExamsParsed = savedExams ? JSON.parse(savedExams) : [];
                            const updatedExams = [...savedExamsParsed, exam];
                            localStorage.setItem(
                                `pastExams-${classId}`,
                                JSON.stringify(updatedExams)
                            );
                            setPastExams(updatedExams);
                        }}
                    />
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
                            {openNodeId && <NodeDetail lectureIds={flattenMapNode(map).find((node) => node.id === openNodeId)?.lectures ?? []} />}
                        </Suspense>
                    }
                </Stack>
            </Modal>
        </>
    );
}