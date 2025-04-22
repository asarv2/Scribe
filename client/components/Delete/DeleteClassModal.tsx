/**
 * DeleteClassModal.tsx
 * Used to delete a class
 * @AshokSaravanan222
 * 04-08-2025
 */

import { Modal, Button, Text, Stack, Group, Tooltip, ActionIcon } from "@mantine/core";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { deleteClass } from "@/utils/services/class";
import { IconTrash } from "@tabler/icons-react";
import { getClass } from "@/utils/queries/get-class";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { getClasses } from "@/utils/queries/get-classes";
import { Class } from "@/types";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";

export default function DeleteClassModal({ classId }: { classId: string }) {
    const supabase = useSupabaseBrowser();
    const [opened, { open, close }] = useDisclosure(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const queryClient = useQueryClient();

    const router = useRouter();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classes, isLoading: loadingClasses } = useQuery({
        queryKey: ["classes"],
        queryFn: () => getClasses(supabase),
    });

    const handleDeleteClass = async () => {
        setDeleteLoading(true);
        try {
            if (!classes) {
                throw new Error("Classes not found");
            }
            if (!profile) {
                throw new Error("Profile not found");
            }

            const { success, error } = await deleteClass(classId);

            if (!success) {
                throw new Error(error);
            }

            queryClient.invalidateQueries({ queryKey: ["classes"] });
            queryClient.invalidateQueries({ queryKey: ["class", classId] });

            notifications.show({
                title: 'Success',
                message: 'Class deleted successfully',
                color: 'green'
            });

            const filteredClasses = classes?.filter((c: Class) => (profile.classes.includes(c.id) || profile.admin))

            // find first class that is not the deleted class
            const firstClass = filteredClasses?.find(c => c.id !== classId);
            if (firstClass) {
                router.push(`/class/${firstClass.id}`);
            } else {
                router.push('/');
            }
        } catch (error: any) {
            notifications.show({
                title: 'Error',
                message: error.message,
                color: 'red'
            });
        } finally {
            setDeleteLoading(false);
            close();
        }
    };

    const classData = classes?.find(c => c.id === classId);

    return <>
        <Tooltip label="Delete Class">
            <ActionIcon
                variant="subtle"
                size="lg"
                color="red"
                onClick={open}
            >
                <IconTrash size={20} />
            </ActionIcon>
        </Tooltip>
        <Modal
            opened={opened}
            onClose={close}
            title={`Delete ${classData?.title}`}
            size={"md"}
            centered
        >
            <Stack>
                <Text size="sm">
                    Are you sure you want to delete {classData?.class_code}? This action cannot be undone.
                </Text>
                <Group justify="flex-end">
                    <Button
                        variant="subtle"
                        onClick={close}
                    >
                        Cancel
                    </Button>
                    <Button
                        color="red"
                        loading={deleteLoading}
                        onClick={handleDeleteClass}
                    >
                        Delete
                    </Button>
                </Group>
            </Stack>
        </Modal>
    </>
}