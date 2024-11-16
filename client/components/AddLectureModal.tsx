/**
 * AddLectureModal.tsx
 * Modal to add a lecture to the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Input, Modal, Stack, Text } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { User } from "@supabase/supabase-js"
import { IconPlus } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { createSlide } from "@/utils/services/lecture"
import { uploadLectureImages } from "@/utils/services/storage"
import { useQueryClient } from "@tanstack/react-query"
import { generateSummary, generateTopics, storeSlideDocuments } from "@/utils/services/gemini"
import { createSummary } from "@/utils/services/summary"
import { Topic } from "@/types"
import { MapNode } from "@/utils/map/map-tree"
import { createTopics } from "@/utils/services/topics"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"

type AddLectureModalProps = {
    className: string
    currentMap: MapNode | null
    noteCount: number // how many notes they already have, so we can increment the count by 1
    classId: string
    isMobile: boolean
    user: User | undefined
}

export default function AddLectureModal({ classId, isMobile, user, noteCount, currentMap, className }: AddLectureModalProps) {
    const [opened, { open, close }] = useDisclosure(false);
    const [lectureTitle, setLectureTitle] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();

    const isProfessor = (user: User | undefined) => {
        return user && user.email === "sarava18@purdue.edu"
    }

    const handleAddLecture = async () => {
        setLoading(true);
        try {
            if (!file) {
                throw new Error("Please select a file");
            }
            if (!lectureTitle) {
                throw new Error("Please enter a title");
            }

            // Create slide for the class
            setLoadingText("Creating lecture...");
            const slideResponse = await createSlide(classId, lectureTitle, noteCount + 1);
            if (!slideResponse) {
                throw new Error("Failed to create slide");
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["slides", classId]
                });
            }
            const slideId = slideResponse.id;
            const slideName = slideResponse.name;

            // Initialize pdf.js for extracting text content from the PDF
            setLoadingText("Extracting text and images...");
            const pdfUrl = URL.createObjectURL(file);
            const pdfJS = await import('pdfjs-dist');
            pdfJS.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs'; // Ensure correct path
            const pdf = await pdfJS.getDocument(pdfUrl).promise;

            const textSummaries: string[] = [];
            const imgUrls: Blob[] = [];

            const numPages = pdf.numPages;

            // Process each page (here we loop through the first page)
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);

                // Extract text content from the page
                const textContent = await page.getTextContent();
                const textItems = textContent.items.map((item: any) => item.str);
                const text = textItems.join(' ');
                textSummaries.push(text);

                // Extract image content from the page
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d')!;
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                // Wait for the rendering to complete
                await page.render({ canvasContext: context, viewport }).promise;

                // Ensure to wait for the blob before proceeding
                const imageBlob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/png', 0.1);
                });
                if (imageBlob) {
                    imgUrls.push(imageBlob);
                }
            }

            console.log("Text Summaries: ", textSummaries);
            console.log("Photo Data: ", imgUrls);

            // uploading to supabase
            setLoadingText("Uploading images...");
            const imgPaths = await Promise.all(imgUrls.map(async (photo, index) => {
                const filePath = `${classId}/${slideId}/page_${index + 1}.png`;
                const { error: uploadError } = await supabase.storage.from('lectures').upload(filePath, photo);
                if (uploadError) {
                    throw new Error(uploadError.message);
                }
                return "https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/" + filePath;
            }));

            // storing text embeddings in database
            setLoadingText("Storing text...");
            const {success: textSuccess, error: textError} = await storeSlideDocuments(slideId, textSummaries);
            if (!textSuccess) {
                throw new Error(textError);
            }
            
            // Generate the summary with the text and images
            setLoadingText("Generating summary...");
            const summary = await generateSummary(className, textSummaries, imgPaths);
            if (!summary) {
                throw new Error("Failed to generate summary");
            }
            console.log("Summary: ", summary);

            // // save to supabase
            setLoadingText("Saving summary...");
            const { success: summarySuccess, error: summaryError } = await createSummary(slideId, summary);
            if (!summarySuccess) {
                throw new Error(summaryError);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["summaries", slideId]
                });
            }

            // generate the topics from the summary
            setLoadingText("Generating topics...");
            const summaries = ["<START: " + slideName + " | " + slideId + "> " + summary + " <END>"]; // just one summary for now
            const response = await generateTopics(classId, className, summaries, currentMap);
            if (!response) {
                throw new Error("Failed to generate topics");
            }
            console.log("Topics: ", response);
            const { success: topicSuccess, error: topicError } = await createTopics(classId, response);
            if (!topicSuccess) {
                throw new Error(topicError);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["map", classId]
                });
            }
            
            notifications.show({
                title: "Lecture added",
                message: "You have successfully added " + lectureTitle,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to add lecture",
                message: error.message,
                color: "red",
            })
        } finally {
            setLoading(false);
            onModalClose();
        }

    }

    const onModalClose = () => {
        setLectureTitle("");
        setLoadingText("");
        setFile(null);
        close();
    }

    return (
        <>
            {isProfessor(user) && <Button size={isMobile ? "compact-xs" : "sm"} leftSection={<IconPlus size={20} />} color="teal" onClick={open}>Add Lecture</Button>}

            <Modal opened={opened} onClose={onModalClose} title="Add New Lecture" centered>
                <Stack>
                    <Input
                        placeholder="Lecture Title"
                        value={lectureTitle}
                        onChange={(e) => setLectureTitle(e.target.value)}
                    />
                    <Input
                        type="file"
                        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                    />
                    <Button onClick={handleAddLecture} disabled={!lectureTitle || !file} loading={loading}>Submit</Button>
                    <Text>{loadingText}</Text>
                </Stack>
            </Modal>
        </>
    )
}