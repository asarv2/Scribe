/**
 * RegenerateGenerationModal.tsx
 * Modal to regenerate a generation
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Input, Modal, Stack, Text, Textarea, Tooltip } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { User } from "@supabase/supabase-js"
import { IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { uploadLectureImages } from "@/utils/services/storage"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { isProfessor } from "@/utils/lecture/isProfessor"
import { deleteLecture } from "@/utils/services/lecture"
import { createGeneration } from "@/utils/services/generation"
import { Evaluation, Generation, Question } from "@/types"
import { getEvaluationAsText } from "@/utils/services/evaluations"
import { createQuestions } from "@/utils/services/questions"

type RegenerateGenerationModalProps = {
    generation: Generation
    problems: Question[]
    evaluations: Evaluation[]
}

export default function RegenerateGenerationModal({ generation, evaluations, problems }: RegenerateGenerationModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);

    const getEvaluationComments = () => {
        const comments = evaluations.map(evaluation => getEvaluationAsText(evaluation)).join("\n");
        console.log(comments);
        return "Moreover, take CAREFUL note of the following comments to improve the generation from last time:\n" + comments;
    }

    const [additionalInfo, setAdditionalInfo] = useState(generation.additional_info);
    const router = useRouter();

    const handleRegenerateGeneration = async () => {
        setLoading(true);
        try {
            const finalComments = `${additionalInfo}\n${getEvaluationComments()}`
            const newGeneration = await createGeneration(generation.class, generation.name, generation.type, `${process.env.NEXT_PUBLIC_API_URL}`, generation.id, generation.version);

            const questions = problems.map(problem => ({
                generation: newGeneration.id,
                additional_info: problem.additional_info + finalComments,
                references: problem.references,
                multipart: problem.multipart ? problem.multipart : undefined,
                mcq: problem.mcq,
                conceptual: problem.conceptual,
            }));

            const { success, error } = await createQuestions(questions);
            if (!success) {
                throw new Error(error);
            }
            // dont wait for response
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/problems`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_id: generation.class,
                    generation_id: newGeneration.id,
                })
            });

            queryClient.invalidateQueries({ queryKey: ["problemGenerations", generation.class] });
            router.push(`/classes/${generation.class}/generate/`);

            notifications.show({
                title: "Regenerate Started",
                message: "You have successfully regenerated " + generation.name,
                color: "blue",
            });
        } catch (error: any) {
            console.error(error);
            notifications.show({
                title: "Failed to regenerate generation",
                message: error.message,
                color: "red",
            })
        } finally {
            setLoading(false);
            close();
        }

    }

    return (
        <>
            <Tooltip label="Regenerate"><IconRefresh size={24} color="black" style={{ cursor: "pointer" }} onClick={open} /></Tooltip>

            <Modal opened={opened} onClose={close} title="Regenerate Generation" centered>
                <Stack>
                    <Textarea placeholder="Additional comments" value={additionalInfo} onChange={(e: any) => setAdditionalInfo(e.target.value)} autosize minRows={4} />
                    <Button onClick={handleRegenerateGeneration} loading={loading} color="blue">Regenerate</Button>
                </Stack>
            </Modal>
        </>
    )
}