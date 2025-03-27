/**
 * Button component for uploading a textbook
 * @AshokSaravanan222
 * 27.03.2025
 */

import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ParseStatus } from "@/types";

export default function UploadTextbookButton({ classId, icon = false, initalStatus = "parsing" }: { classId: string, icon?: boolean, initalStatus?: ParseStatus }) {
    const queryClient = useQueryClient();

    const handleUploadTextbook = async (file: File) => {
        // Validate file is a PDF
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file');
            return;
        }

        try {
            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('title', file.name.replace('.pdf', ''));
            formData.append('file_path', ''); // Empty string for direct uploads
            formData.append('response_url', `${process.env.NEXT_PUBLIC_API_URL}`);
            formData.append('initial_status', initalStatus);
            // Upload the file
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/textbook`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to upload textbook');
            }

            // Refresh textbooks data
            queryClient.invalidateQueries({ queryKey: ["textbooks", classId] });

        } catch (error) {
            console.error('Error uploading textbook:', error);
            notifications.show({
                title: 'Error uploading textbook',
                message: 'Please try again.',
                color: 'red',
            });
        }
    };

    const textbookInputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            {icon ? <Tooltip label="Upload Textbook">
                <ActionIcon
                    size="md"
                    variant="subtle"
                    onClick={() => textbookInputRef.current?.click()}
                >
                    <IconUpload size={14} />
                </ActionIcon>
            </Tooltip> : 
            <Button
                leftSection={<IconUpload size={14} />}
                onClick={() => textbookInputRef.current?.click()}
            >
                Upload Textbook
            </Button>}
            <input
                type="file"
                ref={textbookInputRef}
                onChange={(e) => {
                    e.preventDefault();
                    if (e.target.files?.length) {
                        Array.from(e.target.files).forEach(file => handleUploadTextbook(file));
                    }
                }}
                accept="application/pdf"
                style={{ display: 'none' }}
                multiple
            />
        </>
    )
}