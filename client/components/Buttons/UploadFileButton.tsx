/**
 * Button component for uploading a lecture
 * @AshokSaravanan222
 * 27.03.2025
 */

import { ActionIcon, Button, Menu, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBookDownload, IconFile, IconFileExcel, IconFileTypePpt, IconFileUpload, IconUpload } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ContentType, FileType, ParseStatus } from "@/types";
import { v4 as uuidv4 } from 'uuid';

// Import tus client
import * as tus from 'tus-js-client';
import { getProfile } from "@/utils/queries/get-profile";
import { getUser } from "@/utils/queries/get-user";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getClass } from "@/utils/queries/get-class";
import { useStudentMode } from "../StudentModeContext";
import { createFile } from "@/utils/services/file";
import { getFiles } from "@/utils/queries/get-files";

export default function UploadFileButton({ classId, startParse = false }: { classId: string, startParse?: boolean }) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Add a new ref to track the selected content type
    const contentTypeRef = useRef<ContentType>('other');
    const { studentMode } = useStudentMode();

    const { data: user } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
        enabled: !!supabase
    })

    const { data: profile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user?.id
    })

    const { data: classData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId),
        enabled: !!classId
    })

    const { data: files } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, [classId]),
        enabled: !!classId
    })

    const handleUploadFile = async (file: File) => {
        try {
            if (!profile) {
                throw new Error("Profile not found");
            }
            // Use the contentTypeRef value instead of getting it from the input
            const contentType = contentTypeRef.current;

            const fullFileName = file.name;
            // get the file name without the extension
            const fileName = fullFileName.split('.').slice(0, -1).join('.');
            
            let fileType: FileType = "other";
            // find the file type
            if (file.type === "application/pdf") {
                fileType = "pdf";
            } else if (file.type === "video/mp4") {
                fileType = "video";
            } else if (file.type === "audio/wav") {
                fileType = "audio";
            } else if (file.type === "video/webm") {
                fileType = "video";
            } else if (file.type === "image/jpeg" || file.type === "image/png") {
                fileType = "image";
            }

            // find the file number (1 more than the highest file number in the class)
            const fileNumber = files?.length ? Math.max(...files.map(file => file.file_number)) + 1 : 1;

            // create a new file
            const fileId = await createFile(classId, fileName, fileNumber, fileType, contentType, profile.id);

            const addProfile = !((profile.admin || profile.professor) && !studentMode) // if they are not a professor

            // Show upload notification
            notifications.show({
                id: `upload-${fileId}`,
                title: 'Uploading file',
                message: `Uploading ${file.name}...`,
                loading: true,
                autoClose: false,
            });

            // Create a new tus upload
            return new Promise((resolve, reject) => {
                // Get the base URL for the API
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

                let metadata = {}
                if (addProfile) {
                    metadata = {
                        filename: file.name,
                        filetype: file.type,
                        fileId: fileId,
                        classId: classId,
                        startParse: startParse ? 'true' : 'false',
                        baseUrl: baseUrl,
                        contentType: contentType,
                    }
                } else {
                    metadata = {
                        filename: file.name,
                        filetype: file.type,
                        fileId: fileId,
                        classId: classId,
                        startParse: startParse ? 'true' : 'false',
                        baseUrl: baseUrl,
                        contentType: contentType,
                        profile: profile.id,
                    }
                }

                // Create a new tus upload
                const upload = new tus.Upload(file, {
                    // Endpoint for creating uploads
                    endpoint: `${baseUrl}/upload/tus`,
                    // Store URL in localStorage to resume upload after browser restart
                    storeFingerprintForResuming: true,
                    // Add metadata
                    metadata: metadata,
                    // Called when upload progress changes
                    onProgress(bytesUploaded, bytesTotal) {
                        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
                        notifications.update({
                            id: `upload-${fileId}`,
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
                            body: JSON.stringify({ fileId: fileId }),
                        })
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Failed to finalize upload');
                                }
                                return response.json();
                            })
                            .then(data => {
                                notifications.update({
                                    id: `upload-${fileId}`,
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
                                    id: `upload-${fileId}`,
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
                            id: `upload-${fileId}`,
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

    return (
        <>
            {profile && ((profile.admin || profile.professor) && !studentMode) ?
                <Menu
                    openDelay={100}
                    closeDelay={200}
                    width={200}
                    shadow="md"
                    trigger="click-hover"
                    transitionProps={{ transition: 'fade', duration: 200 }}
                >
                    <Menu.Target>
                        <ActionIcon size={30} aria-label="Upload content">
                            <IconUpload size={18} />
                        </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>Upload Content</Menu.Label>
                        <Menu.Item
                            leftSection={<IconFileTypePpt size={14} />}
                            onClick={() => {
                                // Set content type before clicking
                                contentTypeRef.current = 'lecture';
                                if (fileInputRef.current) {
                                    fileInputRef.current.click();
                                }
                            }}
                        >
                            Lecture
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconBookDownload size={14} />}
                            onClick={() => {
                                // Set content type before clicking
                                contentTypeRef.current = 'textbook';
                                if (fileInputRef.current) {
                                    fileInputRef.current.click();
                                }
                            }}
                        >
                            Textbook
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconFileExcel size={14} />}
                            onClick={() => {
                                // Set content type before clicking
                                contentTypeRef.current = 'homework';
                                if (fileInputRef.current) {
                                    fileInputRef.current.click();
                                }
                            }}
                        >
                            Homework
                        </Menu.Item>
                        <Menu.Item
                            leftSection={<IconFile size={14} />}
                            onClick={() => {
                                // Set content type before clicking
                                contentTypeRef.current = 'other';
                                if (fileInputRef.current) {
                                    fileInputRef.current.click();
                                }
                            }}
                        >
                            Other
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu> : classData?.files_enabled ?
                    <Tooltip label={"Upload files"}>
                        <ActionIcon size={30} aria-label="Upload files" onClick={() => {
                            // Set content type before clicking
                            contentTypeRef.current = 'other';
                            if (fileInputRef.current) {
                                fileInputRef.current.click();
                            }
                        }}>
                            <IconUpload size={18} />
                        </ActionIcon>
                    </Tooltip> : null
            }
            <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                    e.preventDefault();
                    if (e.target.files?.length) {
                        // Use the contentTypeRef value instead of e.target.value
                        Array.from(e.target.files).forEach(file => handleUploadFile(file));
                        // Reset the input value after handling files
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