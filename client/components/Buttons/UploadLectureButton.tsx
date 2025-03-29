/**
 * Button component for uploading a lecture
 * @AshokSaravanan222
 * 27.03.2025
 */

import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ParseStatus } from "@/types";

export default function UploadLectureButton({ classId, icon = false, startParse = false }: { classId: string, icon?: boolean, startParse?: boolean }) {
    const queryClient = useQueryClient();

    const handleUploadLecture = async (file: File) => {
        try {
            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('title', file.name.split('.').slice(0, -1).join('.')); // Remove file extension
            formData.append('file_path', ''); // Empty since we're uploading directly
            formData.append('response_url', `${process.env.NEXT_PUBLIC_API_URL}`);
            formData.append('start_parse', startParse ? 'true' : 'false');
            
            // Upload the file
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/lecture`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload lecture');
            }

            // Refresh lectures data
            queryClient.invalidateQueries({ queryKey: ["lectures", classId] });

        } catch (error) {
            console.error('Error uploading lecture:', error);
            notifications.show({
                title: 'Error uploading lecture',
                message: 'Please try again.',
                color: 'red',
            });
        }
    };

    const lectureInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            {icon ? <Tooltip label="Upload Lectures">
                <ActionIcon
                    size="md"
                    variant="subtle"
                    onClick={() => lectureInputRef.current?.click()}
                >
                    <IconUpload size={14} />
                </ActionIcon>
            </Tooltip> : 
            <Button
                leftSection={<IconUpload size={14} />}
                onClick={() => lectureInputRef.current?.click()}
            >
                Upload Lectures
            </Button>}
            <input
                type="file"
                ref={lectureInputRef}
                onChange={(e) => {
                    e.preventDefault();
                    if (e.target.files?.length) {
                        Array.from(e.target.files).forEach(file => handleUploadLecture(file));
                    }
                }}
                accept="application/pdf,video/*,audio/*,image/*"
                style={{ display: 'none' }}
                multiple
            />
        </>
    )
}