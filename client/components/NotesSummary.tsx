/**
 * NotesSummary.tsx
 * Will show all of the images of the notes (for now)
 * @AshokSaravanan222
 * 11-08-2024
 */

import { Slide, SlideData } from "@/types"
import { getSummaries } from "@/utils/queries/get-summary"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { AspectRatio, Box, Card, Group, SimpleGrid, Skeleton, Text } from "@mantine/core"
import { useQuery } from "@tanstack/react-query"
import Markdown from "markdown-to-jsx"
import Image from "next/image"

type NoteSummaryProps = {
    classId: string
    documentId: string
}

export default function NotesSummary({ classId, documentId }: NoteSummaryProps) {
    const supabase = useSupabaseBrowser();

    // want each of the images to be square in grid

    const { data: summaries, isLoading: loadingSummaries } = useQuery({
        queryKey: ["summaries", documentId],
        queryFn: () => getSummaries(supabase, documentId),
    });

    return (
        <Card withBorder mah={600} style={{overflowY: "auto"}}>
            {summaries?.map((summary, index) => (
                <Markdown>{summary?.content}</Markdown>
            ))}
        </Card>
    )
}