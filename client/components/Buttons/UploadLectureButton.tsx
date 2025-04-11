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
import { FileType, ParseStatus } from "@/types";
import { createLecture } from "@/utils/services/lecture";

export default function UploadLectureButton({ classId, icon = false, startParse = false, lectureNumber }: { classId: string, icon?: boolean, startParse?: boolean, lectureNumber?: number }) {
    const queryClient = useQueryClient();

    const handleUploadLecture = async (file: File) => {
        try {

            if (!lectureNumber) {
                throw new Error('Lecture number is required');
            }

            const title = file.name.split('.').slice(0, -1).join('.');
            const responseUrl = `${process.env.NEXT_PUBLIC_API_URL}`;

            let file_type: FileType = "other";
            let ext = file.name.split('.').pop()?.toLowerCase();
            if (!ext) {
                throw new Error('File extension is required');
            }

            if (ext === 'pdf') {
                file_type = "pdf";
            } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
                file_type = "audio";
            } else if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
                file_type = "video";
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
                file_type = "image";
            }

            // Create lecture for supabase
            const lectureId = await createLecture(classId, title, lectureNumber, file_type, responseUrl);
            
            // Create form data to match server requirements
            const formData = new FormData();
            formData.append('file', file);
            formData.append('class_id', classId);
            formData.append('lecture_id', lectureId);
            formData.append('file_path', ''); // Empty since we're uploading directly
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