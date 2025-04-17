/**
 * Content.tsx
 * This component is for displaying the content of a class.
 * @AshokSaravanan222
 * 27.03.2025
 */
import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Container, Flex, Group, Stack, Text, Progress, Tabs, Skeleton, TextInput, Select, ScrollArea, Tooltip, RingProgress, ActionIcon } from "@mantine/core";
import { IconUpload, IconRefresh, IconBook, IconNotebook, IconClipboard, IconSearch, IconSend, IconFileAnalytics, IconTrash } from "@tabler/icons-react";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { ClassLayout } from "@/components/Class/ClassLayout";
import Image from "next/image";
import Link from "next/link";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { getClass } from "@/utils/queries/get-class";
import { notifications } from "@mantine/notifications";
import { getFiles } from "@/utils/queries/get-files";
import { getDocuments } from "@/utils/queries/get-documents";
import DeleteFileModal from "../Delete/DeleteFileModal";
import UploadFileButton from "../Buttons/UploadFileButton";
import { File } from "@/types";
import { getFileDocuments } from "@/utils/queries/get-file-docs";

export default function Content({ classId, navigateHomeAfterDelete = true }: { classId: string, navigateHomeAfterDelete?: boolean }) {
    const queryClient = useQueryClient();
    const supabase = useSupabaseBrowser();

    // Search states
    const [lectureSearch, setLectureSearch] = useState('');
    const [textbookSearch, setTextbookSearch] = useState('');
    const [homeworkSearch, setHomeworkSearch] = useState('');

    // Sort states
    const [lectureSortOrder, setLectureSortOrder] = useState('newest');
    const [textbookSortOrder, setTextbookSortOrder] = useState('newest');
    const [homeworkSortOrder, setHomeworkSortOrder] = useState('newest');

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

    // Class data
    const { data: classData, isLoading: loadingClassData } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    });

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, [classId])
    });

    const { data: documents, isLoading: loadingDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files?.map(file => file.id) ?? []),
        enabled: !!files
    });

    // Set up realtime subscription for files and documents
    useEffect(() => {
        const filesChannel = supabase
            .channel('files-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'prod',
                table: 'files',
                filter: `class=eq.${classId}`
            }, () => {
                queryClient.invalidateQueries({ queryKey: ["files", classId] });
            })
            .subscribe();

        const documentsChannel = supabase
            .channel('documents-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'prod',
                table: 'documents',
                filter: `class=eq.${classId}`
            }, () => {
                queryClient.invalidateQueries({ queryKey: ["fileDocuments", classId] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(filesChannel);
            supabase.removeChannel(documentsChannel);
        };
    }, [supabase, classId, queryClient]);

    // Group files by content type
    const lectures = useMemo(() => {
        if (!files) return [];
        return files.filter(file => file.content_type === 'lecture');
    }, [files]);

    const textbooks = useMemo(() => {
        if (!files) return [];
        return files.filter(file => file.content_type === 'textbook');
    }, [files]);

    const homeworks = useMemo(() => {
        if (!files) return [];
        return files.filter(file => file.content_type === 'homework');
    }, [files]);

    // Filtered data
    const filteredLectures = useMemo(() => {
        if (!lectures) return [];
        return lectures
            .filter(lecture =>
                lecture.title?.toLowerCase().includes(lectureSearch.toLowerCase()) ?? false
            )
            .sort((a, b) => {
                if (lectureSortOrder === 'newest') {
                    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
                } else if (lectureSortOrder === 'oldest') {
                    return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime();
                } else {
                    return (a.title ?? '').localeCompare(b.title ?? '');
                }
            });
    }, [lectures, lectureSearch, lectureSortOrder]);

    const filteredTextbooks = useMemo(() => {
        if (!textbooks) return [];
        return textbooks
            .filter(textbook =>
                textbook.title?.toLowerCase().includes(textbookSearch.toLowerCase()) ?? false
            )
            .sort((a, b) => {
                if (textbookSortOrder === 'newest') {
                    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
                } else if (textbookSortOrder === 'oldest') {
                    return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime();
                } else {
                    return (a.title ?? '').localeCompare(b.title ?? '');
                }
            });
    }, [textbooks, textbookSearch, textbookSortOrder]);

    const filteredHomeworks = useMemo(() => {
        if (!homeworks) return [];
        return homeworks
            .filter(homework =>
                homework.title?.toLowerCase().includes(homeworkSearch.toLowerCase()) ?? false
            )
            .sort((a, b) => {
                if (homeworkSortOrder === 'newest') {
                    return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime();
                } else if (homeworkSortOrder === 'oldest') {
                    return new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime();
                } else {
                    return (a.title ?? '').localeCompare(b.title ?? '');
                }
            });
    }, [homeworks, homeworkSearch, homeworkSortOrder]);

    // Retry processing functions
    const handleRetryProcessing = async (fileId: string) => {
        try {
            const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/parse/file`;

            await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    file_id: fileId,
                })
            });

            queryClient.invalidateQueries({ queryKey: ["files", classId] });
        } catch (error) {
            console.error(`Error retrying file:`, error);
        }
    };

    // Progress calculation functions
    const getFileProgress = useMemo(() => {
        return (fileId: string, uploading: boolean = false) => {
            if (!documents || !files) return 0;
            const file = files.find(f => f.id === fileId);
            if (!file || file.length === 0) return 0;


            const fileDocuments = documents.filter(doc =>
                doc.file === fileId && (uploading || doc.processed)
            );

            return (fileDocuments.length / file.length) * 100;
        };
    }, [documents, files]);

    // Image retrieval functions
    const getFileImage = (fileId: string) => {
        if (!fileId || !documents) return '/placeholder_image.svg';

        const fileDocuments = documents.filter(doc => doc.file === fileId);
        if (!fileDocuments || fileDocuments.length === 0) return '/placeholder_image.svg';

        const document = fileDocuments[0];
        if (!document) return '/placeholder_image.svg';

        const file = files?.find(f => f.id === fileId);
        if (!file) return '/placeholder_image.svg';

        return `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${document.id}.png`;
    };

    // Content skeleton for loading state
    function ContentSkeleton() {
        return (
            <Card withBorder style={{
                width: '350px',
                height: '320px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Stack style={{ height: '100%' }}>
                    <Skeleton height={200} width={320} style={{ margin: "0 auto" }} />
                    <Group align="flex-start" justify="space-between">
                        <Stack gap="xs" style={{ flex: 1 }}>
                            <Skeleton height={24} width="80%" />
                            <Skeleton height={16} width="60%" />
                        </Stack>
                        <Skeleton height={34} width={34} circle />
                    </Group>
                    <Skeleton height={8} width="100%" mt="xs" />
                    <Skeleton height={16} width="40%" mt="xs" />
                </Stack>
            </Card>
        );
    }

    // Helper function to get appropriate delete modal
    const getDeleteModal = (file: File) => {
        const contentType = file.content_type;

        return <DeleteFileModal
            classId={classId}
            fileId={file.id}
            contentType={contentType}
            profileId={profile?.id ?? ''}
            fileName={file.title ?? ''}
            navigateHome={navigateHomeAfterDelete}
        />;
    };

    // Helper function to get content status text
    const getContentStatusText = (file: any) => {
        if (file.parse_error) {
            return `Error: ${file.parse_error}`;
        }

        switch (file.parse_status) {
            case 'parsing':
                return `Parsing ${file.content_type} content...`;
            case 'error':
                return 'Processing failed';
            case 'idle':
                return 'Waiting to process';
            case 'extracting':
                return 'Extracting content...';
            case 'uploading':
                return getFileProgress(file.id, true) >= 100 ? 'Uploaded Content' : 'Uploading content...';
            case 'complete':
                return `Uploaded ${new Date(file.created_at ?? "").toLocaleDateString()}`;
            default:
                return 'Processing content...';
        }
    };

    // Helper function to render file card
    const renderFileCard = (file: File) => {
        const contentType = file.content_type;
        return (
            <Card
                withBorder
                key={file.id}
                style={{
                    width: '350px',
                    height: '320px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Stack style={{ width: '100%', height: '100%' }}>
                    <Image
                        src={getFileImage(file.id)}
                        alt={`First page of ${file.title}`}
                        width={320}
                        height={200}
                        style={{ objectFit: "contain", borderRadius: "8px", margin: "0 auto" }}
                    />
                    <Group align="flex-start" justify="space-between" style={{ flexWrap: 'nowrap' }}>
                        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
                            <Text size="lg" fw={500} lineClamp={1}>{file.title}</Text>
                            <Text size="sm" c={file.parse_error ? "red" : "dimmed"} lineClamp={2} style={{ wordBreak: "break-word" }}>
                                {getContentStatusText(file)}
                            </Text>
                        </Stack>
                        <div style={{ flexShrink: 0 }}>
                            {file.parse_status === 'error' ? (
                                <Tooltip label="Retry Processing">
                                    <ActionIcon variant="light" color="blue" size="lg" onClick={() => handleRetryProcessing(file.id)}>
                                        <IconRefresh size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : file.parse_status === 'uploading' && getFileProgress(file.id, true) >= 100 ? (
                                <Tooltip label={`Parse ${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`}>
                                    <ActionIcon variant="light" color="green" size="lg" onClick={() => handleRetryProcessing(file.id)}>
                                        <IconFileAnalytics size={20} />
                                    </ActionIcon>
                                </Tooltip>
                            ) : file.parse_status === 'uploading' || file.parse_status === 'parsing' ? (
                                <Tooltip label={`Retry Processing`}>
                                    <RingProgress
                                        size={60}
                                        thickness={4}
                                        sections={[{ value: getFileProgress(file.id, file.parse_status !== 'parsing'), color: "blue" }]}
                                        label={
                                            <Text size="xs" ta="center">
                                                {Math.round(getFileProgress(file.id, file.parse_status !== 'parsing'))}%
                                            </Text>
                                        }
                                        style={{ cursor: "pointer" }}
                                        onClick={() => handleRetryProcessing(file.id)}
                                    />
                                </Tooltip>
                            ) : (
                                <Tooltip label={`Delete ${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`}>
                                    {getDeleteModal(file)}
                                </Tooltip>
                            )}
                        </div>
                    </Group>
                </Stack>
            </Card>
        );
    };

    // Render content section
    const renderContentSection = (contentType: string, files: any[], filteredFiles: any[], search: string, setSearch: (value: string) => void, sortOrder: string, setSortOrder: (value: string) => void, uploadButton: JSX.Element) => {
        const isLoading = loadingFiles || loadingDocuments;
        const capitalizedType = contentType.charAt(0).toUpperCase() + contentType.slice(1) + (contentType === 'homework' ? '' : 's');

        return (
            <Stack>
                <Group justify="space-between" align="center">
                    <Text size="xl" fw={700}>{capitalizedType}</Text>
                    {uploadButton}
                </Group>

                <Group align="center" mb="md">
                    <TextInput
                        placeholder={`Search ${contentType}s...`}
                        leftSection={<IconSearch size={14} />}
                        style={{ flexGrow: 1 }}
                        value={search}
                        onChange={(e) => setSearch(e.currentTarget.value)}
                    />
                    <Select
                        data={[
                            { value: 'newest', label: 'Newest First' },
                            { value: 'oldest', label: 'Oldest First' },
                            { value: 'name', label: 'Name' },
                        ]}
                        value={sortOrder}
                        onChange={(value) => setSortOrder(value || 'newest')}
                    />
                </Group>

                <ScrollArea scrollbarSize={0}>
                    <Group wrap="nowrap" style={{ paddingBottom: 5 }}>
                        {isLoading ? (
                            <>
                                <ContentSkeleton />
                                <ContentSkeleton />
                                <ContentSkeleton />
                                {contentType === 'lecture' && (
                                    <>
                                        <ContentSkeleton />
                                        <ContentSkeleton />
                                        <ContentSkeleton />
                                        <ContentSkeleton />
                                    </>
                                )}
                            </>
                        ) : !filteredFiles || filteredFiles.length === 0 ? (
                            <Text c="dimmed" ta="center">No {contentType}s found</Text>
                        ) : (
                            filteredFiles.map((file) => {
                                return renderFileCard(file);
                            })
                        )}
                    </Group>
                </ScrollArea>
            </Stack>
        );
    };

    return (
        <Stack gap="xl">
            {/* Lectures Section */}
            {classData?.lecture_enabled && renderContentSection(
                'lecture',
                lectures,
                filteredLectures,
                lectureSearch,
                setLectureSearch,
                lectureSortOrder,
                setLectureSortOrder,
                <UploadFileButton
                    classId={classId}
                    contentType="lecture"
                    startParse={true}
                    fileNumber={lectures?.length ? lectures.length + 1 : 1}
                />
            )}

            {/* Textbooks Section */}
            {classData?.textbook_enabled && renderContentSection(
                'textbook',
                textbooks,
                filteredTextbooks,
                textbookSearch,
                setTextbookSearch,
                textbookSortOrder,
                setTextbookSortOrder,
                <UploadFileButton
                    classId={classId}
                    contentType="textbook"
                    startParse={true}
                    fileNumber={textbooks?.length ? textbooks.length + 1 : 1}
                />
            )}

            {/* Homeworks Section */}
            {classData?.homework_enabled && renderContentSection(
                'homework',
                homeworks,
                filteredHomeworks,
                homeworkSearch,
                setHomeworkSearch,
                homeworkSortOrder,
                setHomeworkSortOrder,
                <UploadFileButton
                    classId={classId}
                    contentType="homework"
                    startParse={true}
                    fileNumber={homeworks?.length ? homeworks.length + 1 : 1}
                />
            )}
        </Stack>
    );
}
