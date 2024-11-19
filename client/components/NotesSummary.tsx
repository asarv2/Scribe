/**
 * NotesSummary.tsx
 * Will show all of the images of the notes (for now)
 * @AshokSaravanan222
 * 11-16-2024
 */

import { Slide, SlideData } from "@/types"
import { getSummaries } from "@/utils/queries/get-summary"
import { regenerateSummary } from "@/utils/services/gemini"
import { createSummary } from "@/utils/services/summary"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { AspectRatio, Box, Card, Flex, Group, SimpleGrid, Skeleton, Text, Title, Tooltip } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconChevronLeft, IconChevronRight, IconDownload, IconReload } from "@tabler/icons-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import jsPDF from "jspdf"
import Markdown from "markdown-to-jsx"
import { marked } from "marked"
import Image from "next/image"
import { useState } from "react"
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

type NoteSummaryProps = {
    classId: string
    slideId: string
    className: string
    slideName: string
    documents: SlideData[]
}

export default function NotesSummary({ classId, slideId, className, slideName, documents }: NoteSummaryProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [currentSummaryIndex, setCurrentSummaryIndex] = useState(0);
    const [regenerateLoading, setRegenerateLoading] = useState(false);



    const { data: summaries, isLoading: loadingSummaries } = useQuery({
        queryKey: ["summaries", slideId],
        queryFn: () => getSummaries(supabase, slideId),
    });

    const handleRegenerate = async () => {
        setRegenerateLoading(true);
        try {
            if (!documents || documents.length === 0) {
                throw new Error('No documents available to regenerate summary.');
            }
            if (!summaries || summaries.length === 0) {
                throw new Error('No summaries available to regenerate.');
            }
            // regenerate summary, invalidate the cache
            const summary = await regenerateSummary(classId, className, documents, summaries);
            if (!summary) {
                throw new Error('Failed to regenerate summary');
            }

            const { success, error } = await createSummary(slideId, summary);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["summaries", slideId]
                });
            }


            notifications.show({
                title: "Regenerate",
                message: "Regenerate successful",
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to regenerate",
                message: error.message,
                color: "red",
            });
        } finally {
            setRegenerateLoading(false);
        }
    }

    const handleDownload = async () => {
        try {
            if (!summaries || summaries.length === 0) {
                throw new Error('No summaries available to download.');
            }
            const currentSummary = summaries[currentSummaryIndex];

            const doc = new jsPDF('p', 'pt', 'a4');
            const content = currentSummary.content;

            // Convert Markdown to HTML
            const htmlContent = `
            <style>
              body {
                width: 100%;
                max-width: 100%;
                margin: 0;
                padding: 0;
                font-family: Helvetica, Arial, sans-serif;
                font-size: 12pt;
                line-height: 1.2;
              }
            </style>
            ${marked(content)}
          `;

            // Adjust page width
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            doc.html(htmlContent, {
                x: 40,
                y: 40,
                width: pageWidth - 80, // Account for margins
                windowWidth: pageWidth,
                margin: [20, 20],
                callback: function (doc) {
                    doc.save(`${slideName || 'summary'}.pdf`);
                },
            });

            notifications.show({
                title: 'Download',
                message: 'Download successful',
                color: 'blue',
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: 'Failed to download',
                message: error.message,
                color: 'red',
            });
        }
    };


    const handlePrevSummary = () => {
        if (currentSummaryIndex > 0) {
            setCurrentSummaryIndex(currentSummaryIndex - 1);
        }
    };

    const handleNextSummary = () => {
        if (summaries && currentSummaryIndex < summaries.length - 1) {
            setCurrentSummaryIndex(currentSummaryIndex + 1);
        }
    };


    return (
        <>
            {
                summaries && summaries.length > 0 ? (
                    <>
                        <Card withBorder style={{ overflowY: 'auto' }} mah={1150}>
                            <Flex justify="space-between">
                                <Title order={3}>Summary</Title>
                                <Group>
                                    <Tooltip label="Regenerate">
                                        <IconReload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleRegenerate} />
                                    </Tooltip>
                                    <Tooltip label="Download PDF">
                                        <IconDownload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleDownload} />
                                    </Tooltip>
                                </Group>
                            </Flex>
                            <Skeleton visible={loadingSummaries || regenerateLoading}>
                                <Markdown>{summaries[currentSummaryIndex]?.content}</Markdown>
                            </Skeleton>
                        </Card>
                        <Flex justify="space-between" align="center" gap="sm">
                            {summaries && summaries.length > 1 ? <Group gap="xs">
                                <IconChevronLeft
                                    size={18}
                                    color={currentSummaryIndex > 0 ? 'black' : 'gray'}
                                    style={{ cursor: currentSummaryIndex > 0 ? 'pointer' : 'default' }}
                                    onClick={currentSummaryIndex > 0 ? handlePrevSummary : undefined}
                                />
                                <Text size="sm">
                                    {currentSummaryIndex + 1} / {summaries.length}
                                </Text>
                                <IconChevronRight
                                    size={18}
                                    color={
                                        summaries && currentSummaryIndex < summaries.length - 1 ? 'black' : 'gray'
                                    }
                                    style={{
                                        cursor:
                                            summaries && currentSummaryIndex < summaries.length - 1
                                                ? 'pointer'
                                                : 'default',
                                    }}
                                    onClick={
                                        summaries && currentSummaryIndex < summaries.length - 1
                                            ? handleNextSummary
                                            : undefined
                                    }
                                />
                            </Group> : <Box />}

                            <Text size="sm">
                                {new Date(summaries[currentSummaryIndex].created_at).toLocaleString()}
                            </Text>
                        </Flex>
                    </>
                ) : (
                    <Text>No summaries available.</Text>
                )
            }
        </>
    )
}