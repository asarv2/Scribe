// /**
//  * app/classes/[classId]/textbook/[textbookId]/page.tsx
//  * The page for a specific textbook in a class.
//  * @AshokSaravanan222
//  * 11.11.2024
//  */
"use client"


// import { useQuery } from "@tanstack/react-query";
// import { AspectRatio, Box, Button, Center, Container, em, Group, Input, SimpleGrid, Stack, Text } from "@mantine/core";
// import { useEffect, useState } from "react";
// import { notifications } from '@mantine/notifications';
// import { useMediaQuery } from "@mantine/hooks";
// import Markdown from 'markdown-to-jsx'
// import Image from "next/image";
// import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
// import { getTextbookDocs } from "@/utils/queries/get-textbook-docs";
// import { HeaderSimple } from "@/components/HeaderSimple";
// import TextbookSummary from "@/components/TextbookSummary";
// import { answerTextbookQuestion } from "@/utils/services/question";
// import { getTextbookChapters } from "@/utils/queries/get-textbook-chapters";
// import { getTextbookDocuments } from "@/utils/services/textbook";
// import { createQuery } from "@/utils/services/query";
// import PDFViewer from "@/components/PDFViewer";


// export default function Textbook({ params }: { params: { classId: string, textbookId: string } }) {
//     const [value, setValue] = useState("");
//     const [loading, setLoading] = useState(false);
//     const [response, setResponse] = useState<string>(""); // Store responses
//     const [learnMoreBubbles, setLearnMoreBubbles] = useState<number[]>([]);

//     const [pageNumber, setPageNumber] = useState<number>(0);

//     const supabase = useSupabaseBrowser();
//     const classId = params.classId;
//     const textbookId = params.textbookId;

//     const handleTextbookClick = async () => {
//         setLoading(true);
//         setResponse("");
//         setLearnMoreBubbles([]);
//         try {
//             if (!value) {
//                 throw new Error("Please enter a question");
//             }

//             const { response, documents: docIds } = await answerTextbookQuestion(value);
//             const docs = await getTextbookDocuments(docIds);

//             const pages = docs.map((doc) => doc.page);

//             const { success, error } = await createQuery(value, response, classId);
//             if (!success) {
//                 throw new Error(error);
//             }

//             setResponse(response)
//             setLearnMoreBubbles(pages.slice(0, 3));

//             notifications.show({
//                 title: "Question asked",
//                 message: "Your question has been answered",
//                 color: "blue",
//             });
//         } catch (error: any) {
//             console.error(error);
//             notifications.show({
//                 title: "Failed to ask question",
//                 message: error.message,
//                 color: "red",
//             });
//         } finally {
//             setLoading(false);
//             setValue("");
//         }
//     }

//     const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

//     const handlePageClick = (pageNumber: number) => {
//         window.scrollTo(0, 0);
//         setPageNumber(pageNumber)
//     }

//     const renderLearnMorePage = (pageNumber: number, index: number) => {
//         return (
//             <Button onClick={() => handlePageClick(pageNumber)} color="orange" key={`learn-more-${pageNumber}-${index}`}>Page {pageNumber}</Button>
//         )
//     }

//     // too much to load all of the textbook documents at once. Rather would do chapters, and subchapters
//     // const { data: documents, isLoading: loadingDocs } = useQuery({
//     //     queryKey: ["textbookDocuments", textbookId],
//     //     queryFn: () => getTextbookDocs(supabase, textbookId),
//     // });

//     const { data: chapters, isLoading: loadingChapters } = useQuery({
//         queryKey: ["textbookChapters", textbookId],
//         queryFn: () => getTextbookChapters(supabase, textbookId),
//     });

//     return (
//         <>
//             <HeaderSimple />
//             <Container fluid>
//                 <SimpleGrid
//                     cols={isMobile ? 1 : 2}
//                     spacing="md"
//                 >
//                     {/* Left Column with Sticky Video Player */}
//                     <Box style={{ position: 'sticky', top: 0 }}>
//                         <Stack>
//                             <AspectRatio ratio={16 / 9}>
//                                 <PDFViewer pdfUrl={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/ce907bb8-f51e-4933-b9a2-d042c5b05e67/e8944344-2248-472d-9a8c-56a85c76bcba/textbook.pdf?t=2024-11-11T17%3A32%3A04.604Z`} pageNumber={pageNumber} setPageNumber={setPageNumber} />
//                             </AspectRatio>
//                             <Stack>
//                                 <Input
//                                     size="md"
//                                     radius="md"
//                                     placeholder="Your question here..."
//                                     value={value}
//                                     onChange={(e) => {
//                                         setValue(e.currentTarget.value);
//                                     }}
//                                     disabled={loading}
//                                 />
//                                 <Button variant="filled" loading={loading} loaderProps={{ type: 'dots' }} onClick={handleTextbookClick}>
//                                     Ask Question
//                                 </Button>
//                                 <Markdown>{response}</Markdown>
//                                 <Group>
//                                     {learnMoreBubbles.sort(
//                                         (a, b) => a - b
//                                     ).map((timestamp, index) => renderLearnMorePage(timestamp, index))}
//                                 </Group>
//                             </Stack>
//                             {isMobile && <TextbookSummary chapters={chapters ?? []} loading={loadingChapters} clickPageNumber={handlePageClick} classId={classId} />}
//                         </Stack>
//                     </Box>

//                     {/* Right Column with Scrollable Summary */}
//                     {!isMobile && <TextbookSummary chapters={chapters ?? []} loading={loadingChapters} clickPageNumber={handlePageClick} classId={classId} />}
//                 </SimpleGrid>
//             </Container>

//         </>
//     );
// }




import { useQuery } from "@tanstack/react-query";
import { getLectures } from "../../../utils/queries/get-lectures";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { AspectRatio, Box, Button, Center, Container, em, Group, Input, LoadingOverlay, Modal, SimpleGrid, Stack, Text, useMantineTheme } from "@mantine/core";
import { useEffect, useState } from "react";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { getSlides } from "@/utils/queries/get-slides";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { Map } from '@/components/Map'
import { CALCULUS_MAP } from "@/utils/map/map-tree";
import { ReactFlowProvider } from "reactflow";

export default function Class({ params }: { params: { classId: string } }) {
    const [opened, { open, close }] = useDisclosure(false);
    const [classTitle, setClassTitle] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [classes, setClasses] = useState<{ id: string, title: string }[]>([]);
    const theme = useMantineTheme();
    const pathname = usePathname();

    const supabase = useSupabaseBrowser();
    const classId = params.classId;

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    // Add new class
    const handleAddClass = () => {
        if (classTitle && file) {
            const newClass = { id: `${classes.length}`, title: classTitle };
            setClasses((prevClasses) => [...prevClasses, newClass]);
            setClassTitle("");
            setFile(null);
            close();
        }
    };

    return (
        <>
            {/* Header */}
            <div style={{ position: "fixed", width: "100vw", zIndex: 100 }}>
                {/* Your header content */}
            </div>

            {/* <Container fluid>
                <SimpleGrid cols={5}>
                    {lectures?.map((lecture) => <Text>{lecture.name}</Text>)}
                </SimpleGrid>
                <SimpleGrid cols={5}>
                    {slides?.map((slide) => <Text>{slide.name}</Text>)}
                </SimpleGrid>
                <SimpleGrid cols={5}>
                    {textbooks?.map((textbook) => <Text>{textbook.title}</Text>)}
                </SimpleGrid>
            </Container> */}
            <div style={{width: "100vw", height: "100vh"}}>
                <ReactFlowProvider>
                <LoadingOverlay />
					{/* <Map
						key={query.dataUpdatedAt}
						rootNode={data.output}
						onNodeClick={(label, description) => {
							console.log(label, description)
							setOpenNodeLabel(label)
							setOpenNodeDescription(description)
							open()
						}}
					/> */}
                    <Map rootNode={CALCULUS_MAP} />
                </ReactFlowProvider>
            </div>


            {/* Sidebar with Add Class Button */}
            <div style={{
                position: "fixed",
                left: "5vw",
                top: "10vh",
                width: "20vw",
                height: "80vh",
                backgroundColor: theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.colors.gray[0],
                padding: 20,
                overflowY: "scroll",
                zIndex: 101  // Ensures sidebar is above the map
            }}>
                <SimpleGrid cols={1}>
                    {/* Display classes */}
                    {classes.map((classItem) => (
                        <Button key={classItem.id} fullWidth>{classItem.title}</Button>
                    ))}
                    {/* "Add Class" Button */}
                    <Button
                        fullWidth
                        style={{
                            backgroundColor: "blue",
                            color: "white",
                            marginTop: 10,
                            padding: "10px 0"

                        }}
                        onClick={open}
                    >
                        + Add Lecture
                    </Button>
                </SimpleGrid>
            </div>

            {/* Modal for Adding New Class */}
            <Modal opened={opened} onClose={close} title="Add New Lecture" centered>
                <Stack spacing="md">
                    <Input
                        placeholder="Lecture Title"
                        value={classTitle}
                        onChange={(e) => setClassTitle(e.target.value)}
                    />
                    <Input
                        type="file"
                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                    />
                    <Button onClick={handleAddClass} disabled={!classTitle || !file}>Submit</Button>
                </Stack>
            </Modal>

            {/* Map Component (Mind Map) */}
            <div style={{
                position: "fixed",
                left: "30vw",  // Adjusts position to the right of the sidebar
                top: "10vh",
                width: "65vw",
                height: "80vh",
                zIndex: 100  // Ensures map remains below the sidebar and modal
            }}>
                {/* Your mind map component here */}
            </div>
        </>
    );
}
