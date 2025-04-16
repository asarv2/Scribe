/**
 * Button component for uploading a lecture
 * @AshokSaravanan222
 * 27.03.2025
 */

import { ActionIcon, Button, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconUpload } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ContentType, FileType, ParseStatus } from "@/types";
import { v4 as uuidv4 } from 'uuid';

// Import tus client
import * as tus from 'tus-js-client';
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";

export default function UploadFileButton({ classId, icon = false, startParse = false, fileNumber, contentType }: { classId: string, icon?: boolean, startParse?: boolean, fileNumber?: number, contentType: ContentType }) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase)
    });

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user?.id ?? ""),
        enabled: !!user
    });



    const handleUploadFile = async (file: File) => {
        try {
            if (!fileNumber) {
                throw new Error('File number is required');
            }
            if (!profile) {
                throw new Error('Profile is required');
            }

            const uploadId = uuidv4();
            
            // Show upload notification
            const notificationId = notifications.show({
                id: `upload-${uploadId}`,
                title: 'Uploading file',
                message: `Uploading ${file.name}...`,
                loading: true,
                autoClose: false,
            });
            
            // Create a new tus upload
            return new Promise((resolve, reject) => {
                // Get the base URL for the API
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
                
                // Create a new tus upload
                const upload = new tus.Upload(file, {
                    // Endpoint for creating uploads
                    endpoint: `${baseUrl}/upload/tus`,
                    // Store URL in localStorage to resume upload after browser restart
                    storeFingerprintForResuming: true,
                    // Add metadata
                    metadata: {
                        filename: file.name,
                        filetype: file.type,
                        fileId: uploadId,
                        classId: classId,
                        profileId: profile.id,
                        startParse: startParse ? 'true' : 'false',
                        baseUrl: baseUrl,
                        contentType: contentType
                    },
                    // Called when upload progress changes
                    onProgress(bytesUploaded, bytesTotal) {
                        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                        notifications.update({
                            id: `upload-${uploadId}`,
                            message: `Uploading ${file.name}: ${percentage}%`,
                        });
                    },
                    // Called when upload is completed successfully
                    onSuccess() {
                        console.log('Upload completed successfully');
                        
                        // Finalize the upload by calling the finalize endpoint
                        fetch(`${baseUrl}/upload/tus/finalize`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ fileId: uploadId }),
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error('Failed to finalize upload');
                            }
                            return response.json();
                        })
                        .then(data => {
                            notifications.update({
                                id: `upload-${uploadId}`,
                                title: 'Upload complete',
                                message: `${file.name} uploaded successfully`,
                                loading: false,
                                autoClose: 5000,
                                color: 'green',
                            });
                            
                            // Refresh files data
                            queryClient.invalidateQueries({ queryKey: ["files", classId] });
                            
                            // Reset the file input to allow re-uploading the same file
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }
                            
                            resolve(data);
                        })
                        .catch(error => {
                            console.error('Error finalizing upload:', error);
                            notifications.update({
                                id: `upload-${uploadId}`,
                                title: 'Upload error',
                                message: `Failed to process ${file.name}: ${error.message}`,
                                loading: false,
                                autoClose: 5000,
                                color: 'red',
                            });
                            reject(error);
                        });
                    },
                    // Called when an error occurs
                    onError(error) {
                        console.error('Error uploading file:', error);
                        notifications.update({
                            id: `upload-${uploadId}`,
                            title: 'Upload error',
                            message: `Failed to upload ${file.name}: ${error.message}`,
                            loading: false,
                            autoClose: 5000,
                            color: 'red',
                        });
                        reject(error);
                    },
                });
                
                // Start the upload
                upload.start();
            });

        } catch (error) {
            console.error('Error uploading file:', error);
            notifications.show({
                title: 'Error uploading file',
                message: error instanceof Error ? error.message : 'Please try again.',
                color: 'red',
            });
            
            // Reset the file input even on error
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const renderButtonText = (contentType: ContentType) => {
        if (contentType === "lecture") {
            return "Upload Lectures";
        } else if (contentType === "textbook") {
            return "Upload Textbooks";
        } else if (contentType === "homework") {
            return "Upload Homeworks";
        }
    }

    return (
        <>
            {icon ? <Tooltip label="Upload Files">
                <ActionIcon
                    size="md"
                    variant="subtle"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <IconUpload size={14} />
                </ActionIcon>
            </Tooltip> : 
            <Button
                leftSection={<IconUpload size={14} />}
                onClick={() => fileInputRef.current?.click()}
            >
                {renderButtonText(contentType)}
            </Button>}
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                    e.preventDefault();
                    if (e.target.files?.length) {
                        Array.from(e.target.files).forEach(file => handleUploadFile(file));
                        // Reset the input value after handling files
                        // This allows the onChange event to fire again even if the same file is selected
                        e.currentTarget.value = '';
                    }
                }}
                accept="application/pdf,video/*,audio/*,image/*"
                style={{ display: 'none' }}
                multiple
            />
        </>
    )
}