/**
 * app/classes/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { Button, Center, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme } from "@mantine/core";
import { Suspense, useEffect, useState } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { HeaderSimple } from "../../../components/HeaderSimple";
import { getSlides } from "@/utils/queries/get-slides";
import { flattenMapNode, Map } from '@/components/Map'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LP_MAP_CHAT_EDIT } from "@/utils/map/map-tree";
import { NodeDetail } from "@/components/NodeDetail";
import { getUser } from "@/utils/queries/get-user";
import AddLectureModal from "@/components/AddLectureModal";
import { getClass } from "@/utils/queries/get-class";
import { PracticeExam } from "@/types";
import AddQuestionsModal from "@/components/AddQuestionsModal";
import { intersectionBy, uniqBy } from "lodash";
import { getPracticeExams } from "@/utils/queries/get-practice-exams";
import { getMap } from "@/utils/queries/get-map";
import Latex from "react-latex-next";


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

    const { data: map, isLoading: loadingMap } = useQuery({
        queryKey: ["map", classId],
        queryFn: () => getMap(supabase, classId)
    })

    const { data: slides } = useQuery({
        queryKey: ["slides", classId],
        queryFn: () => getSlides(supabase, classId)
    })

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: classData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: practiceExams } = useQuery({
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

            <div style={{ position: "fixed", left: "0", top: "35vh", backgroundColor: "white", padding: 20, overflowY: "scroll", marginLeft: 15, marginTop: 70, height: "30vh", borderRadius: 10, boxShadow: "0 0 10px rgba(0,0,0,0.1)", display: "none" }}>
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
                title={<h3><Latex key={"Label"}>{openNodeLabel as string}</Latex></h3>}
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
                    <Latex key={"Description"}>{openNodeDescription as string}</Latex>
                    {
                        <Suspense
                            fallback={
                                <Center>
                                    <Loader />
                                </Center>
                            }
                        >
                            {openNodeId && map && <NodeDetail lectureIds={flattenMapNode(map).find((node) => node.id === openNodeId)?.lectures ?? []} />}
                        </Suspense>
                    }
                </Stack>
            </Modal>
        </>
    );
}