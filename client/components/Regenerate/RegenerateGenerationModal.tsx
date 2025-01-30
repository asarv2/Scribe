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
import { Evaluation, Generation } from "@/types"
import { getEvaluationAsText } from "@/utils/services/evaluations"

type RegenerateGenerationModalProps = {
    generation: Generation
    evaluations: Evaluation[]
}

export default function RegenerateGenerationModal({ generation, evaluations }: RegenerateGenerationModalProps) {
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
        // try {
        //     const finalComments = `${additionalInfo}\n${getEvaluationComments()}`
        //     const newGeneration = await createGeneration(generation.class, generation.name, generation.type, generation.lectures, generation.topics, generation.num_questions, generation.mcq, generation.conceptual, generation.single, finalComments, `${process.env.NEXT_PUBLIC_API_URL}`, generation.id, Number(generation.version) + 1);
        //     if (!newGeneration) {
        //         throw new Error("Failed to create new generation");
        //     } else {
        //         // make an api call to 
        //         if (generation.type === 'summary') {
        //             // invoke the generate/summary endpoint, do not wait for response
        //             fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/summary`, {
        //                 method: 'POST',
        //                 headers: {
        //                     'Content-Type': 'application/json',
        //                 },
        //                 body: JSON.stringify({
        //                     class_id: generation.class,
        //                     generation_id: newGeneration.id,
        //                 })
        //             });
        //             queryClient.invalidateQueries({ queryKey: ["summariesGenerations", generation.class] });
        //             // do not wait for response
        //             router.push(`/classes/${generation.class}/generate/summary`);
        //         } else if (generation.type === 'problem') {
        //             // invoke the generate/problems endpoint, do not wait for response
        //             fetch(`${process.env.NEXT_PUBLIC_API_URL}/generate/problems`, {
        //                 method: 'POST',
        //                 headers: {
        //                     'Content-Type': 'application/json',
        //                 },
        //                 body: JSON.stringify({
        //                     class_id: generation.class,
        //                     generation_id: newGeneration.id,
        //                 })
        //             });
        //             queryClient.invalidateQueries({ queryKey: ["problemGenerations", generation.class] });
        //             // do not wait for response
        //             router.push(`/classes/${generation.class}/generate/problems`);
        //         }
        //     }
        //     notifications.show({
        //         title: "Regenerate Started",
        //         message: "You have successfully regenerated " + generation.name,
        //         color: "blue",
        //     });
        // } catch (error: any) {
        //     console.error(error);
        //     notifications.show({
        //         title: "Failed to regenerate generation",
        //         message: error.message,
        //         color: "red",
        //     })
        // } finally {
        //     setLoading(false);
        //     close();
        // }

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