/**
 * app/classes/[classId]/lecture/page.tsx
 * This page is for showing the lectures of the class. It will show all the lectures of the class, and the option to upload lectures manually.
 * @AshokSaravanan222
 * 01.03.2025
 */
"use client"

import { useEffect, useRef, useState } from "react";
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from "@mantine/hooks";
import Markdown from 'markdown-to-jsx'
import Image from "next/image";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { HeaderSimple } from "@/components/HeaderSimple";
import Link from "next/link";
import { getClass } from "@/utils/queries/get-class";;
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconArrowRight, IconUpload } from '@tabler/icons-react';
import { getUser } from "@/utils/queries/get-user";
import { ActionIcon, Box, Button, em, Group, Stack } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLecture } from "@/utils/queries/get-lecture";
import { Grid } from "@mantine/core";
import { Flex } from "@mantine/core";
import { Container } from "@mantine/core";
import DeleteLectureModal from "@/components/DeleteLectureModal";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import Latex from "react-latex-next";
import { getLectures } from "@/utils/queries/get-lectures";
import { Text, Card, Image as MantineImage } from "@mantine/core";
import { useRouter } from "next/navigation";
import { FileInput, Progress } from "@mantine/core";

export default function LecturePage({ params }: { params: { classId: string} }) {
    const supabase = useSupabaseBrowser();
    const fileInputRef = useRef<HTMLButtonElement>(null);
    const classId = params.classId;
    const router = useRouter();

    const isMobile = useMediaQuery(`(max-width: ${em(750)})`);

    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    })

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    })

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

    const handleFilesUpload = async (files: File[] | null) => {
        if (!files || files.length === 0) {
            notifications.show({
                title: 'Error',
                message: 'Please select PDF files',
                color: 'red'
            });
            return;
        }

        const invalidFiles = files.filter(file => !file.type.includes('pdf'));
        if (invalidFiles.length > 0) {
            notifications.show({
                title: 'Error',
                message: 'Only PDF files are allowed',
                color: 'red'
            });
            return;
        }

        try {
            setSelectedFiles(files);
            
            const uploadPromises = files.map(async (file) => {
                try {
                    setUploadProgress(prev => ({
                        ...prev,
                        [file.name]: 0
                    }));

                    await processLecturePDF(
                        file, 
                        classId,
                        (progress) => {
                            setUploadProgress(prev => ({
                                ...prev,
                                [file.name]: progress
                            }));
                        }
                    );

                    notifications.show({
                        title: 'Success',
                        message: `${file.name} uploaded successfully`,
                        color: 'green'
                    });
                } catch (error) {
                    notifications.show({
                        title: 'Error',
                        message: `Failed to upload ${file.name}`,
                        color: 'red'
                    });
                    console.error(`Upload error for ${file.name}:`, error);
                }
            });

            await Promise.all(uploadPromises);
            
            setSelectedFiles([]);
            setUploadProgress({});
            
        } catch (error) {
            notifications.show({
                title: 'Error',
                message: 'Failed to process files',
                color: 'red'
            });
            console.error('Upload error:', error);
        }
    };

    const processLecturePDF = async (
        file: File, 
        classId: string,
        onProgress: (progress: number) => void
    ) => {
        console.log('Processing PDF:', file.name);
    };

    return (
        <>
            <HeaderSimple />
            <Container fluid>
                <Stack>
                    <Flex justify="space-between" align="center">
                        <Group>
                            <Link href={`/classes/${classId}`}>
                                <IconArrowLeft size={24} color="black" style={{ cursor: "pointer" }} />
                            </Link>
                            <Text size="xl" fw={700} mb={6}>Lectures</Text>
                        </Group>
                        <Group>
                            <Button onClick={() => fileInputRef.current?.click()} leftSection={<IconUpload size={14} />}>Upload Lectures</Button>
                            <FileInput
                                ref={fileInputRef}
                                placeholder="Upload PDFs"
                                accept="application/pdf"
                                multiple
                                onChange={handleFilesUpload}
                                value={selectedFiles}
                                style={{ display: 'none' }}
                            />
                        </Group>
                    </Flex>

                    {Object.entries(uploadProgress).length > 0 && (
                        <Stack>
                            {Object.entries(uploadProgress).map(([fileName, progress]) => (
                                <div key={fileName}>
                                    <Text size="sm">{fileName}</Text>
                                    <Progress 
                                        value={progress}
                                        size="sm" 
                                    />
                                </div>
                            ))}
                        </Stack>
                    )}

                    <Stack>
                        {(lectures && classData) && lectures.length > 0 && lectures.map((lecture) => (
                            <Link 
                                href={`/classes/${classId}/lecture/${lecture.id}`} 
                                key={lecture.id}
                                style={{ textDecoration: 'none' }}
                            >
                                <Card withBorder>
                                    <Group align="flex-start">
                                        <MantineImage
                                            src={`https://hmdqtnywfebxjugxzlvc.supabase.co/storage/v1/object/public/slides/${classData.class_code}/lectures/${lecture.name}/images/1.png`}
                                            alt={`First page of ${lecture.name}`}
                                            width={200}
                                            height={150}
                                            fit="contain"
                                            fallbackSrc="/placeholder-image.png" // You might want to add a placeholder image
                                        />
                                        <Stack gap="xs">
                                            <Text size="lg" fw={500}>{lecture.name}</Text>
                                            <Text size="sm" c="dimmed">
                                                Uploaded {new Date(lecture.created_at ?? "").toLocaleDateString()}
                                            </Text>
                                        </Stack>
                                    </Group>
                                </Card>
                            </Link>
                        ))}
                    </Stack>
                </Stack>
            </Container>

        </>
    );
}