/**
 * RegenerateGenerationModal.tsx
 * Modal to regenerate a generation
 * @AshokSaravanan222
 * 11-15-2024
 */

import { Button, Input, Modal, Stack, Text, Textarea, Tooltip, useMantineColorScheme } from "@mantine/core"
import { useDisclosure } from "@mantine/hooks"
import { IconRefresh } from "@tabler/icons-react"
import { useState } from "react"
import { notifications } from "@mantine/notifications"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { createGeneration } from "@/utils/services/generation"
import { Evaluation, Generation, Question } from "@/types"
import { getEvaluationAsText } from "@/utils/services/evaluations"
import { createQuestions } from "@/utils/services/questions"
import { getUser } from "@/utils/queries/get-user"
import { getProfile } from "@/utils/queries/get-profile"
import useSupabaseBrowser from "@/utils/supabase/supabase-browser"
type RegenerateGenerationModalProps = {
    generation: Generation
    problems: Question[]
    evaluations: Evaluation[]
}

export default function RegenerateGenerationModal({ generation, evaluations, problems }: RegenerateGenerationModalProps) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);

    const { colorScheme } = useMantineColorScheme();

    const getEvaluationComments = () => {
        const comments = evaluations.map(evaluation => getEvaluationAsText(evaluation)).join("\n");
        console.log(comments);
        return "Moreover, take CAREFUL note of the following comments to improve the generation from last time:\n" + comments;
    }

    const [additionalInfo, setAdditionalInfo] = useState(generation.additional_info);
    const router = useRouter();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user!.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const handleRegenerateGeneration = async () => {
        setLoading(true);
        try {
            let profileId = profile?.admin ? null : profile?.id;
            const finalComments = `${additionalInfo}\n${getEvaluationComments()}`
            const newGeneration = await createGeneration(generation.class, generation.name, generation.type, `${process.env.NEXT_PUBLIC_API_URL}`, generation.id, generation.version, profileId);

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
            <Tooltip label="Regenerate"><IconRefresh size={24} color={colorScheme === "dark" ? "white" : "black"} style={{ cursor: "pointer" }} onClick={open} /></Tooltip>

            <Modal opened={opened} onClose={close} title="Regenerate Generation" centered>
                <Stack>
                    <Textarea placeholder="Additional comments" value={additionalInfo} onChange={(e: any) => setAdditionalInfo(e.target.value)} autosize minRows={4} />
                    <Button onClick={handleRegenerateGeneration} loading={loading} color="blue">Regenerate</Button>
                </Stack>
            </Modal>
        </>
    )
}