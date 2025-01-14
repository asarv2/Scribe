/**
 * app/classes/[classId].tsx
 * Page for each of the classes
 * @AshokSaravanan222
 * 09.01.2024
 */
"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query";
import useSupabaseBrowser from "../../../utils/supabase/supabase-browser";
import { Button, Center, em, Loader, Modal, SimpleGrid, Stack, Text, useMantineTheme } from "@mantine/core";
import { Suspense, useEffect, useState } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { HeaderSimple } from "../../../components/HeaderSimple";
import { flattenMapNode, Map } from '@/components/Map'
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NodeDetail } from "@/components/NodeDetail";
import { getUser } from "@/utils/queries/get-user";
import { getMap } from "@/utils/queries/get-map";
import Latex from "@/components/Latex";
import { NodeImages } from "@/components/NodeImages";
import { updateTopicPosition } from "@/utils/services/topics";
import { getClass } from "@/utils/queries/get-class";


export default function Class({ params }: { params: { classId: string } }) {
    const queryClient = useQueryClient()
    const [opened, { open, close }] = useDisclosure(false)
    const [openNodeId, setOpenNodeId] = useState<string>()
    const [openNodeLabel, setOpenNodeLabel] = useState<string>()
    const [openNodeDescription, setOpenNodeDescription] = useState<string>()
    const theme = useMantineTheme()
    const pathname = usePathname()

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const { data: classData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: map, isLoading: loadingMap } = useQuery({
        queryKey: ["map", classId],
        queryFn: () => getMap(supabase, classId, classData!.map),
        enabled: !!classData
    })

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    return (
        <>
            <HeaderSimple />
            <div style={{ width: "100vw", height: "100vh" }} key="map">
                {map && <Map
                    user={user ?? undefined}
                    classId={classId}
                    rootNode={map}
                    onNodeClick={(topicId, label, description) => {
                        setOpenNodeId(topicId)
                        setOpenNodeLabel(label)
                        setOpenNodeDescription(description)
                        open()
                    }}
                    onNodePositionChange={async (nodes) => {
                        try {
                            const { success, error } = await updateTopicPosition(nodes.map(node => ({ ...node, class: classId })))
                            if (success) {
                                console.log('Node position changed:', nodes)
                                queryClient.invalidateQueries({ queryKey: ["map", classId] })
                            } else {
                                throw new Error(error)
                            }
                        } catch (error) {
                            console.error('Error updating node position:', error)
                        }
                    }}
                />}
            </div>

            <Modal
                opened={opened}
                onClose={close}
                title={<Text size="lg" fw={700}><Latex key={"Label"}>{openNodeLabel as string}</Latex></Text>}
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
                    {
                        <Suspense
                            fallback={
                                <Center>
                                    <Loader />
                                </Center>
                            }
                        >
                            {openNodeId && map && <NodeImages visuals={flattenMapNode(map).find((node) => node.id === openNodeId)?.visuals ?? []} />}
                        </Suspense>
                    }
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
                    <Link href={`${pathname}/generate/new?topic=${openNodeId}`}>
                        <Button onClick={close} style={{ width: "100%" }}>Generate Problems</Button>
                    </Link>
                </Stack>
            </Modal>
        </>
    );
}