/**
 * TextbookSummary.tsx
 * Will show all of the chapter outlines, and an option to click on the chapter to view the summary.
 * @AshokSaravanan222
 * 11-08-2024
 */

import { Chapter, TextbookData } from "@/types"
import { getTextbookSubchapters } from "@/utils/queries/get-textbook-subchapters"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { AspectRatio, Box, Card, Group, SimpleGrid, Skeleton, Text } from "@mantine/core"
import { useQuery } from "@tanstack/react-query"
import Image from "next/image"

type ChapterSummaryProps = {
    chapterId: string
    clickPageNumber: (pageNumber: number) => void
}

export default function ChapterSummary({ chapterId, clickPageNumber }: ChapterSummaryProps) {
    const supabase = useSupabaseBrowser();

    const {data: subchapters, isLoading: loadingSubchapters} = useQuery({
        queryKey: ["textbookSubchapters", chapterId],
        queryFn: () => getTextbookSubchapters(supabase, chapterId),
    });

    return (
        <Skeleton visible={loadingSubchapters}>
            {subchapters?.map((subchapter, index) => (
                <Group onClick={() => clickPageNumber(subchapter.page_number)} style={{cursor: "pointer"}}>
                    <Text fw={400}> - {subchapter.title}</Text>
                    <Text>{subchapter.page_number}</Text>
                </Group>
            ))}
        </Skeleton>
    )
}