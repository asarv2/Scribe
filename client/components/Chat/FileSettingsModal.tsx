/**
 * FileSettingsModal.tsx
 * Modal to view and delete a file
 * @AshokSaravanan222
 * 04-22-2025
 */
import { getFile } from "@/utils/queries/get-file";
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ActionIcon, Button, Modal, Select, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useDisclosure } from "@mantine/hooks";
import { useStudentMode } from "../StudentModeContext";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconSettings } from "@tabler/icons-react";
import { ContentType, File } from "@/types";
import { updateFileContentType, updateFileName, updateFileDate } from "@/utils/services/file";
import { notifications } from "@mantine/notifications";
import { DatePickerInput } from "@mantine/dates";

export default function FileSettingsModal({ fileId, classId }: { fileId: string, classId: string }) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [opened, { open, close }] = useDisclosure(false);
    const [loading, setLoading] = useState(false);
    const { studentMode } = useStudentMode();

    // Form state
    const [title, setTitle] = useState("");
    const [contentType, setContentType] = useState<ContentType>("other");
    const [fileDate, setFileDate] = useState<Date | null>(null);

    // User and profile data
    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user?.id ?? ""),
        enabled: !!user
    });

    const { data: file, isLoading: fileLoading } = useQuery({
        queryKey: ["file", fileId],
        queryFn: () => getFile(supabase, fileId)
    })

    // Initialize form values when file data is loaded
    useEffect(() => {
        if (file) {
            setTitle(file.title || "");
            setContentType(file.content_type || "other");
            setFileDate(file.file_date ? new Date(file.file_date) : null);
        }
    }, [file]);

    const handleSave = async () => {
        try {
            setLoading(true);

            // Update file title
            const titleResult = await updateFileName(fileId, title);
            if (!titleResult.success) {
                throw new Error(`Failed to update title: ${titleResult.error}`);
            }

            // Update content type
            const contentTypeResult = await updateFileContentType(fileId, contentType);
            if (!contentTypeResult.success) {
                throw new Error(`Failed to update content type: ${contentTypeResult.error}`);
            }

            // Update file date if provided
            const fileDateString = fileDate ? fileDate.toISOString() : null;
            const dateResult = await updateFileDate(fileId, fileDateString);
            if (!dateResult.success) {
                throw new Error(`Failed to update date: ${dateResult.error}`);
            }


            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["file", fileId] });
            queryClient.invalidateQueries({ queryKey: ["files", classId] });

            notifications.show({
                title: 'Success',
                message: 'File settings updated successfully',
                color: 'green',
            });

            close();
        } catch (error) {
            console.error('Error updating file:', error);
            notifications.show({
                title: 'Error',
                message: error instanceof Error ? error.message : 'Failed to update file settings',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    const getSettingsMessage = (file: File) => {
        switch (file.content_type) {
            case 'lecture':
                return `Lecture Settings`
            case 'homework':
                return `Homework Settings`
            case 'rubric':
                return `Rubric Settings`
            case 'textbook':
                return `Textbook Settings`
            default:
                return `File Settings`
        }
    }

    return file && profile && ((profile.admin || profile.professor) && !studentMode) && (
        <>
            <Tooltip label={getSettingsMessage(file)}>
                <ActionIcon
                    size="lg"
                    variant="subtle"
                    color="blue"
                    onClick={(e) => {
                        e.stopPropagation();
                        open();
                    }}
                >
                    <IconSettings size={20} />
                </ActionIcon>
            </Tooltip>
            <Modal
                opened={opened}
                onClose={close}
                title="File Settings"
                size="md"
            >
                <Stack>
                    <TextInput
                        label="File Title"
                        placeholder="Enter file title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />

                    <Select
                        label="Content Type"
                        placeholder="Select content type"
                        value={contentType}
                        onChange={(value) => setContentType(value as ContentType)}
                        data={[
                            { value: 'lecture', label: 'Lecture' },
                            { value: 'homework', label: 'Homework' },
                            { value: 'textbook', label: 'Textbook' },
                            { value: 'rubric', label: 'Rubric' },
                            { value: 'other', label: 'Other' },
                        ]}
                        required
                    />

                    <DatePickerInput
                        label="File Date"
                        placeholder="Select a date"
                        value={fileDate}
                        onChange={setFileDate}
                        clearable
                        description="When the file will be available to students. Leave blank for unavailable."
                    />

                    <Button
                        onClick={handleSave}
                        loading={loading}
                        fullWidth
                        mt="md"
                    >
                        Save Changes
                    </Button>
                </Stack>
            </Modal>
        </>
    )
}