/**
 * TextbookSummary.tsx
 * Will show all of the chapter outlines, and an option to click on the chapter to view the summary.
 * @AshokSaravanan222
 * 11-08-2024
 */

import { Chapter, TextbookData } from "@/types"
import { AspectRatio, Box, Card, Group, SimpleGrid, Skeleton, Text } from "@mantine/core"
import Image from "next/image"
import ChapterSummary from "./ChapterSummary"

type TextbookSummaryProps = {
    classId: string
    chapters: Chapter[]
    loading: boolean
    clickPageNumber: (pageNumber: number) => void
}

export default function TextbookSummary({ classId, chapters, loading, clickPageNumber }: TextbookSummaryProps) {
    // want each of the images to be square in grid
    return (
        <Skeleton visible={loading}>
            {chapters.map((chapter, index) => (
                <Card key={chapter.id} shadow="xs" padding="md">
                    <Group align="center">
                        <Box ml="md">
                            <Group onClick={() => clickPageNumber(chapter.page_number)} style={{cursor: "pointer"}}>
                                <Text fw={700}>{chapter.title}</Text>
                                <Text>{chapter.page_number}</Text>
                            </Group>
                            <ChapterSummary chapterId={chapter.id} clickPageNumber={clickPageNumber} />
                        </Box>
                    </Group>
                </Card>
            ))}
        </Skeleton>
    )
}