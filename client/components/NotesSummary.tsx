/**
 * NotesSummary.tsx
 * Will show all of the images of the notes (for now)
 * @AshokSaravanan222
 * 11-08-2024
 */

import { Slide, SlideData } from "@/types"
import { AspectRatio, Box, Card, Group, SimpleGrid, Skeleton, Text } from "@mantine/core"
import Image from "next/image"

type NoteSummaryProps = {
    classId: string
    documents: SlideData[]
    loading: boolean
    clickPageNumber: (pageNumber: number) => void
}

export default function NotesSummary({ classId, documents, loading, clickPageNumber }: NoteSummaryProps) {

    // want each of the images to be square in grid
    return (
        <Skeleton visible={loading}>
            <SimpleGrid cols={3}>
                {documents.map((document) => {
                    const imageURL = `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${document.slide}/images/page_${document.page}.png`
                    return (
                        <Card shadow="sm" padding="lg" radius="md" withBorder key={document.id} onClick={() => clickPageNumber(document.page - 1)} style={{ cursor: "pointer" }}>
                            <Card.Section>
                                <AspectRatio ratio={16 / 9}>
                                    <Image
                                        src={imageURL}
                                        alt={`Page ${document.page}`}
                                        width={200}
                                        height={200}
                                    />
                                </AspectRatio>
                            </Card.Section>

                            <Group justify="space-between" mt="md" mb="xs">
                                <Text fw={500}>Slide {document.page}</Text>
                            </Group>

                        </Card>
                    )
                })}
            </SimpleGrid>
        </Skeleton>
    )
}