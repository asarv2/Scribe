/**
 * Button component for uploading a homework
 * @AshokSaravanan222
 * 27.03.2025
 */

import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ParseStatus } from "@/types";
import { createHomework } from "@/utils/services/homework";

export default function UploadHomeworkButton({ classId, icon = false, startParse = false, homeworkNumber }: { classId: string, icon?: boolean, startParse?: boolean, homeworkNumber?: number }) {
    const queryClient = useQueryClient();

    const handleUploadHomework = async (file: File) => {
        // Validate file is a PDF or TXT
        if (file.type !== 'application/pdf' && file.type !== 'text/plain' && file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            alert('Please upload a PDF, TXT, or DOCX file');
            return;
        }

        try {

            if (!homeworkNumber) {
                throw new Error('Homework number is required');
            }

            const title = file.name.replace(/\.(pdf|txt)$/i, '');
            const responseUrl = `${process.env.NEXT_PUBLIC_API_URL}`;

            // Create homework for supabase
            const homeworkId = await createHomework(classId, title, homeworkNumber, responseUrl);

            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('homework_id', homeworkId);
            formData.append('title', title);
            formData.append('file_path', ''); // Empty string for direct uploads
            formData.append('start_parse', startParse ? 'true' : 'false');
            // Upload the file
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/homework`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload homework');
            }

            // Refresh homeworks data
            queryClient.invalidateQueries({ queryKey: ["homeworks", classId] });

        } catch (error) {
            console.error('Error uploading homework:', error);
            notifications.show({
                title: 'Error uploading homework',
                message: 'Please try again.',
                color: 'red',
            });
        }
    };

    const homeworkInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            {icon ? <Tooltip label="Upload Homeworks">
                <ActionIcon
                    size="md"
                    variant="subtle"
                    onClick={() => homeworkInputRef.current?.click()}
                >
                    <IconUpload size={14} />
                </ActionIcon>
            </Tooltip> : 
            <Button
                leftSection={<IconUpload size={14} />}
                onClick={() => homeworkInputRef.current?.click()}
            >
                Upload Homeworks
            </Button>}
            <input
                type="file"
                ref={homeworkInputRef}
                onChange={(e) => {
                    e.preventDefault();
                    if (e.target.files?.length) {
                        Array.from(e.target.files).forEach(file => handleUploadHomework(file));
                    }
                }}
                accept="application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                multiple
            />
        </>
    )
}