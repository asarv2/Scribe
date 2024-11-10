/**
 * NotesSummary.tsx
 * Will show all of the images of the notes (for now)
 * @AshokSaravanan222
 * 11-08-2024
 */

import { AspectRatio, Box, Card, Group, SimpleGrid, Skeleton, Text } from "@mantine/core"
import { DocData } from "../types"
import Image from "next/image"

type NoteSummaryProps = {
    classId: string
    documents: DocData[]
    loading: boolean
    clickPageNumber: (pageNumber: number) => void
}

export default function NotesSummary({ classId, documents, loading, clickPageNumber }: NoteSummaryProps) {

    // want each of the images to be square in grid
    return (
        <Skeleton visible={loading}>
            <SimpleGrid cols={3}>
                {documents.map((document) => {
                    const imageURL = `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${document.lecture}/images/page_${document.timestamp}.png`
                    return (
                        <Card shadow="sm" padding="lg" radius="md" withBorder key={document.id} onClick={() => clickPageNumber(document.timestamp - 1)} style={{ cursor: "pointer" }}>
                            <Card.Section>
                                <AspectRatio ratio={16 / 9}>
                                    <Image
                                        src={imageURL}
                                        alt={`Page ${document.timestamp}`}
                                        width={200}
                                        height={200}
                                    />
                                </AspectRatio>
                            </Card.Section>

                            <Group justify="space-between" mt="md" mb="xs">
                                <Text fw={500}>Slide {document.timestamp}</Text>
                            </Group>

                        </Card>
                    )
                })}
            </SimpleGrid>
        </Skeleton>
    )
}