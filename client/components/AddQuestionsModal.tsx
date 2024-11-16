/**
 * AddQuestionsModal.tsx
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
import { generatePracticeExam, generateSummary, generateTopics, storeSlideDocuments } from "@/utils/services/gemini"
import { createSummary } from "@/utils/services/summary"
import { Slide, Topic } from "@/types"
import { MapNode } from "@/utils/map/map-tree"
import { createTopics } from "@/utils/services/topics"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { createPracticeQuestions } from "@/utils/services/questions"
import { useRouter } from "next/navigation"

type AddQuestionsModalProps = {
    slides: Slide[]
    slideId: string
    classId: string
    isMobile: boolean
    user: User | undefined
}

export default function AddQuestionsModal({ classId, isMobile, slideId, user, slides }: AddQuestionsModalProps) {
    const [opened, { open, close }] = useDisclosure(false);

    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const router = useRouter();

    const isProfessor = (user: User | undefined) => {
        return user && user.email === "asiladie@purdue.edu"
    }

    const handleAddQuestions = async () => {
        setLoading(true);
        try {

            // generate practice questions
            // generate the practice questions from the topics
            setLoadingText("Generating practice questions...");
            const questionResponse = await generatePracticeExam("", [], []);
            if (!questionResponse) {
                throw new Error("Failed to generate practice questions");
            }
            console.log("Practice Questions: ", questionResponse);
            const questions = questionResponse.questions;

            // save to supabase
            setLoadingText("Saving practice questions...");
            const { success: practiceSuccess, error: practiceError } = await createPracticeQuestions(slideId, questions);
            if (!practiceSuccess) {
                throw new Error(practiceError);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["questions", classId]
                });
            }


            const questionId = ""
            notifications.show({
                title: "Questions added",
                message: "You have successfully questions",
                color: "blue",
            });
            // router.push(`/classes/${classId}/questions/${questionId}`);

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
        setSelected([]);
        close();
    }

    return (
        <>
            {isProfessor(user) && <Button size={isMobile ? "compact-xs" : "sm"} leftSection={<IconPlus size={20} />} color="teal" onClick={open}>Practice Questions</Button>}

            <Modal opened={opened} onClose={onModalClose} title="Practice Questions" centered>
                <Stack>
                    <Stack>
                        {slides.map((slide) => <Button onClick={() => setSelected([...selected, slide.id])}>{slide.name}</Button>)}
                    </Stack>
                    <Button onClick={handleAddQuestions} disabled={selected.length === 0} loading={loading}>Submit</Button>
                    <Text>{loadingText}</Text>
                </Stack>
            </Modal>
        </>
    )
}