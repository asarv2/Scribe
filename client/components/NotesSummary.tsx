/**
 * NotesSummary.tsx
 * Will show all of the images of the notes (for now)
 * @AshokSaravanan222
 * 11-16-2024
 */

import { getSummaries } from "@/utils/queries/get-summary"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { Card, Flex, Group, Skeleton, Text, Title, Tooltip } from "@mantine/core"
import { notifications } from "@mantine/notifications"
import { IconDownload } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import jsPDF from "jspdf"
import Markdown from "markdown-to-jsx"
import { marked } from "marked"
import 'katex/dist/katex.min.css';

type NoteSummaryProps = {
    lectureId: string
    lectureName: string
}

export default function NotesSummary({ lectureId, lectureName }: NoteSummaryProps) {
    const supabase = useSupabaseBrowser();

    const { data: summaries, isLoading: loadingSummaries } = useQuery({
        queryKey: ["summaries", lectureId],
        queryFn: () => getSummaries(supabase, lectureId),
    });

    
    // const handleDownload = async () => {
    //     try {
    //         if (!summaries || summaries.length === 0) {
    //             throw new Error('No summaries available to download.');
    //         }
    //         const currentSummary = summaries[0];

    //         const doc = new jsPDF('p', 'pt', 'a4');
    //         const content = currentSummary.content;

    //         // Convert Markdown to HTML
    //         const htmlContent = `
    //         <style>
    //           body {
    //             width: 100%;
    //             max-width: 100%;
    //             margin: 0;
    //             padding: 0;
    //             font-family: Helvetica, Arial, sans-serif;
    //             font-size: 12pt;
    //             line-height: 1.2;
    //           }
    //         </style>
    //         ${marked(content)}
    //       `;

    //         // Adjust page width
    //         const pageWidth = doc.internal.pageSize.getWidth();

    //         doc.html(htmlContent, {
    //             x: 40,
    //             y: 40,
    //             width: pageWidth - 80, // Account for margins
    //             windowWidth: pageWidth,
    //             margin: [20, 20],
    //             callback: function (doc) {
    //                 doc.save(`${lectureName || 'summary'}.pdf`);
    //             },
    //         });

    //         notifications.show({
    //             title: 'Download',
    //             message: 'Download successful',
    //             color: 'blue',
    //         });
    //     } catch (error: any) {
    //         console.error(error);
    //         notifications.show({
    //             title: 'Failed to download',
    //             message: error.message,
    //             color: 'red',
    //         });
    //     }
    // };



    return (
        <>
            {
                summaries && summaries.length > 0 ? (
                    <>
                        <Card withBorder style={{ overflowY: 'auto' }} h={600}>
                            <Flex justify="space-between">
                                <Title order={3}>Summary</Title>
                                {/* <Group>
                                    <Tooltip label="Download PDF">
                                        <IconDownload size={24} color="black" style={{ cursor: "pointer" }} onClick={handleDownload} />
                                    </Tooltip>
                                </Group> */}
                            </Flex>
                            <Skeleton visible={loadingSummaries}>
                                <Markdown>{summaries[0]?.content}</Markdown>
                            </Skeleton>
                        </Card>
                    </>
                ) : (
                    <Text>No summaries available.</Text>
                )
            }
        </>
    )
}