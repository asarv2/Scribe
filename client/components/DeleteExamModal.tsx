/**
 * DeleteExamModal.tsx
 * Modal to remove a practice exam from the mindmap
 * @AshokSaravanan222
 * 11-17-2024
 */

import { Button, Modal, Stack, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { User } from "@supabase/supabase-js";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { isProfessor } from "@/utils/lecture/isProfessor";
import { deletePracticeExam } from "@/utils/services/questions";
import { PracticeExam } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

type DeleteExamModalProps = {
    classId: string;
    exam: PracticeExam | undefined;
    user: User | undefined;
};

export default function DeleteExamModal({ exam, user, classId }: DeleteExamModalProps) {
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        try {
            if (!exam) {
                throw new Error("Exam not found");
            }
            setLoading(true);
            const { success, error } = await deletePracticeExam(exam.id);
            if (!success) {
                throw new Error(error);
            } else {
                queryClient.invalidateQueries({ queryKey: ["practiceExams", classId] });
            }

            notifications.show({
                title: "Deleted",
                message: "The practice exam has been deleted.",
            });
            close();
            router.push(`/classes/${classId}`);
        } catch (error) {
            notifications.show({
                title: "Error",
                message: "Failed to delete practice exam",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {(isProfessor(user, classId) || !exam?.professor) && (
                <Tooltip label="Delete Exam">
                    <IconTrash size={24} color="black" style={{ cursor: "pointer" }} onClick={open} />
                </Tooltip>
            )}

            <Modal opened={opened} onClose={close} title="Delete Exam" centered>
                <Stack>
                    <Text>Are you sure you want to remove {exam?.name}?</Text>
                    <Button onClick={handleDelete} loading={loading} color="red">
                        Delete
                    </Button>
                </Stack>
            </Modal>
        </>
    );
}
