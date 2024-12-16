/**
 * AddQuestionsModal.tsx
 * Modal to add a lecture to the mindmap
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Group, Input, Modal, Stack, Text } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { User } from "@supabase/supabase-js"
import { IconPlus } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { useQueryClient } from "@tanstack/react-query"
import { generatePracticeExam } from "@/utils/services/gemini"
import { PracticeExam, Slide } from "@/types"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
import { createPracticeExam, createPracticeQuestions } from "@/utils/services/questions"
import { useRouter } from "next/navigation"
import { isProfessor } from "@/utils/lecture/isProfessor"
import { getSlideDocs } from "@/utils/queries/get-slide-docs"

type AddQuestionsModalProps = {
    slides: Slide[]
    slideId: string
    classId: string
    className: string
    isMobile: boolean
    user: User | undefined
    onExamGenerated: (exam: PracticeExam) => void
}

export default function AddQuestionsModal({ classId, isMobile, slideId, user, slides, className, onExamGenerated }: AddQuestionsModalProps) {
    const [title, setTitle] = useState<string>();
    const [opened, { open, close }] = useDisclosure(false);
    const [numQuestions, setNumQuestions] = useState<string>();
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();
    const router = useRouter();
    const professor = isProfessor(user, classId);


    const handleAddQuestions = async () => {
        setLoading(true);
        try {
            if (!title || !numQuestions) {
                throw new Error("Please enter a title and number of questions");
            }
            // generate the practice exam
            setLoadingText("Generating practice exam...");
            const practiceExamResponse = await createPracticeExam(classId, title, selected, professor, Number(numQuestions));
            if (!practiceExamResponse) {
                throw new Error("Failed to generate practice exam");
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["practiceExams", classId]
                });
            }
            console.log("Practice Exam: ", practiceExamResponse);

            // generate the practice questions
            setLoadingText("Generating practice questions...");

            const textSummaries: string[][] = [];
            const imgPaths: string[][] = [];
            for (const slide of slides) {
                const documents = await getSlideDocs(supabase, slide.id);
                const slideTextSummaries = documents?.map(d => d.content).filter(content => content !== undefined) as string[];
                const slideImgPaths = documents?.map(d => `https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/lectures/${classId}/${slide.id}/page_${d.page}.png`).filter(path => path !== undefined) as string[];
                textSummaries.push(slideTextSummaries);
                imgPaths.push(slideImgPaths);
            }


            const questions = await generatePracticeExam(classId, textSummaries, imgPaths, Number(numQuestions)); // TODO: add the images
            if (!questions) {
                throw new Error("Failed to generate practice questions");
            }

            // save to supabase
            setLoadingText("Saving practice questions...");
            const { success: practiceSuccess, error: practiceError } = await createPracticeQuestions(practiceExamResponse.id, questions.questions);
            if (!practiceSuccess) {
                throw new Error(practiceError);
            } else {
                queryClient.invalidateQueries({
                    queryKey: ["practiceQuestions", classId]
                });
            }

            if (!professor) {
                onExamGenerated(practiceExamResponse)
            }

            notifications.show({
                title: "Questions added",
                message: "You have successfully questions",
                color: "blue",
            });
            router.push(`/classes/${classId}/practice-exam/${practiceExamResponse.id}`);

        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to add questions",
                message: error.message,
                color: "red",
            })
        } finally {
            setLoading(false);
            setLoadingText("");
            onModalClose();
        }

    }

    const onModalClose = () => {
        setSelected([]);
        setNumQuestions(undefined);
        setTitle(undefined)
        close();
    }

    return (
        <>
            <Button size={isMobile ? "compact-xs" : "sm"} leftSection={<IconPlus size={20} />} color="teal" onClick={open}>Practice Questions</Button>
            <Modal opened={opened} onClose={onModalClose} title="Add Practice Questions" centered>
                <Stack>
                    <Text>Title</Text>
                    <Input 
                        placeholder="Enter a title for the practice exam"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <Text>Select Lectures</Text>
                    <Stack>
                        {slides.map((slide) => 
                        <Group key={slide.id}>
                            <Button
                                onClick={() => {
                                    if (selected.includes(slide.id)) {
                                        setSelected(selected.filter(id => id !== slide.id));
                                    } else {
                                        setSelected([...selected, slide.id]);
                                    }
                                }}
                                variant={selected.includes(slide.id) ? "filled" : "outline"}
                            >
                                L{slide.note_number} - {slide.name}
                            </Button>
                        </Group>)}
                    </Stack>
                    <Text>Number of Questions</Text>
                    <Input
                        placeholder="Enter how many questions you want to generate"
                        value={numQuestions}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Only allow integers
                            if (value === '' || /^\d+$/.test(value)) {
                                setNumQuestions(value);
                            }
                        }}
                    />
                    <Button onClick={handleAddQuestions} disabled={selected.length === 0 || !title || !numQuestions} loading={loading}>Submit</Button>
                    <Text>{loadingText}</Text>
                </Stack>
            </Modal>
        </>
    )
}