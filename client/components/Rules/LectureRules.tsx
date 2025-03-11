/**
 * LectureRules.tsx
 * 
 * This component is used to display the rules for the lecture.
 * @AshokSaravanan222
 * 02.05.2025
 */

import { Lecture } from "@/types";
import { getLecture } from "@/utils/queries/get-lecture";
import { getLectureRules } from "@/utils/queries/get-lecture-rules";
import { updateLectureInfo } from "@/utils/services/lecture";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { Button, Divider, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function LectureRules({ lecture }: { lecture: Lecture }) {
    const [aiInstructions, setAiInstructions] = useState<string>(lecture.additional_info ?? '');
    const [loading, setLoading] = useState<boolean>(false);

    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();


    const {data: rules, isLoading: loadingRules} = useQuery({
        queryKey: ["lectureRules", lecture.id],
        queryFn: () => getLectureRules(supabase, lecture.id)
    })

    const handleSave = async () => {
        try {
            setLoading(true);
            const {success, error} = await updateLectureInfo(lecture.id, aiInstructions);
            if (success) {
                queryClient.invalidateQueries({ queryKey: ["lecture", lecture.id] });
                notifications.show({
                    title: "AI Instructions saved",
                    message: "AI Instructions saved successfully",
                    color: "green"
                })
            } else {
                throw new Error(error);
            }
        } catch (error) {
            notifications.show({
                title: "Failed to save AI Instructions",
                message: "Failed to save AI Instructions",
                color: "red"
            })
        } finally {
            setLoading(false);
        }
    }
        
    return (
        <Stack>
            <Text>Lecture Rules</Text>
            <Stack>
                {rules && rules.length > 0 ? rules.map((rule) => (
                    <Text key={rule.id}>{rule.rule}</Text>
                )) : (
                    <Text>No rules found</Text>
                )}
            </Stack>
            <Divider />
            <Textarea
                label="AI Instructions"
                value={aiInstructions}
                onChange={(event) => setAiInstructions(event.currentTarget.value)}
                description="Provide custom instructions for how the AI should discuss this lecture"
                placeholder="Example: Focus on explaining the key concepts in simple terms"
                autosize
                minRows={4}
                maxRows={8}
            />
            <Button onClick={handleSave} loading={loading} disabled={aiInstructions === lecture.additional_info}>
                Save
            </Button>
        </Stack>
    )
}