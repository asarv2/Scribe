/**
 * app/classes/[classId]/textbook/[textbookId]/page.tsx
 * The page for a specific textbook in a class.
 * @AshokSaravanan222
 * 11.11.2024
 */
"use client"


import { useQuery } from "@tanstack/react-query";
import { AspectRatio, Box, Button, Container, em, Group, Input, SimpleGrid, Stack } from "@mantine/core";
import { useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import TextbookSummary from "@/components/TextbookSummary";
import { answerTextbookQuestion } from "@/utils/services/gemini";
import { getTextbookChapters } from "@/utils/queries/get-textbook-chapters";
import { getTextbookDocuments } from "@/utils/services/textbook";
import { createQuery } from "@/utils/services/query";
import PDFViewer from "@/components/PDFViewer";


export default function Textbook({ params }: { params: { classId: string, textbookId: string } }) {
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string>(""); // Store responses
    const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

    const [pageNumber, setPageNumber] = useState<number>(0);

    const supabase = useSupabaseBrowser();
    const classId = params.classId;
    const textbookId = params.textbookId;

    const handleTextbookClick = async () => {
        setLoading(true);
        setResponse("");
        setLearnMoreBubbles([]);
        try {
            if (!value) {
                throw new Error("Please enter a question");
            }

            const { response, documents: docIds } = await answerTextbookQuestion(value);
            const docs = await getTextbookDocuments(docIds);

            const pages = docs.map((doc) => doc.page);

            const { success, error } = await createQuery(value, response, classId);
            if (!success) {
                throw new Error(error);
            }

            setResponse(response)
            setLearnMoreBubbles(pages.slice(0, 3));

            notifications.show({
                title: "Question asked",
                message: "Your question has been answered",
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to ask question",
                message: error.message,
                color: "red",
            });
        } finally {
            setLoading(false);
            setValue("");
        }
    }

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const handlePageClick = (pageNumber: number) => {
        window.scrollTo(0, 0);
        setPageNumber(pageNumber)
    }

    const renderLearnMorePage = (pageNumber: number, index: number) => {
        return (
            <Button onClick={() => handlePageClick(pageNumber)} color="orange" key={`learn-more-${pageNumber}-${index}`}>Page {pageNumber}</Button>
        )
    }

    const { data: chapters, isLoading: loadingChapters } = useQuery({
        queryKey: ["textbookChapters", textbookId],
        queryFn: () => getTextbookChapters(supabase, textbookId),
    });

    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <SimpleGrid
                    cols={isMobile ? 1 : 2}
                    spacing="md"
                >
                    {/* Left Column with Sticky Video Player */}
                    <Box style={{ position: 'sticky', top: 0 }}>
                        <Stack>
                            <AspectRatio ratio={16 / 9}>
                                <PDFViewer pdfUrl={`/ce907bb8-f51e-4933-b9a2-d042c5b05e67/e8944344-2248-472d-9a8c-56a85c76bcba/textbook.pdf?t=2024-11-11T17%3A32%3A04.604Z`} pageNumber={pageNumber} setPageNumber={setPageNumber} />
                            </AspectRatio>
                            <Stack>
                                <Input
                                    size="md"
                                    radius="md"
                                    placeholder="Your question here..."
                                    value={value}
                                    onChange={(e) => {
                                        setValue(e.currentTarget.value);
                                    }}
                                    disabled={loading}
                                />
                                <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleTextbookClick}>
                                    Ask Question
                                </Button>
                                <Markdown>{response}</Markdown>
                                <Group>
                                    {learnMoreBubbles.sort(
                                        (a, b) => a - b
                                    ).map((timestamp, index) => renderLearnMorePage(timestamp, index))}
                                </Group>
                            </Stack>
                            {isMobile && <TextbookSummary chapters={chapters ?? []} loading={loadingChapters} clickPageNumber={handlePageClick} classId={classId} />}
                        </Stack>
                    </Box>

                    {/* Right Column with Scrollable Summary */}
                    {!isMobile && <TextbookSummary chapters={chapters ?? []} loading={loadingChapters} clickPageNumber={handlePageClick} classId={classId} />}
                </SimpleGrid>
            </Container>

        </>
    );
}