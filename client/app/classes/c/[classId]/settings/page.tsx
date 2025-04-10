/**
 * app/settings/page.tsx
 * Settings page, where they can view all of the class files from onedrive.
 * @AshokSaravanan222
 * 04/05/2025
 */
"use client"
import { ClassLayout } from "@/components/Class/ClassLayout";
import { Button, Container, Box, Text, Badge, Loader, Select, Group, Stack, Title, Paper, Grid } from "@mantine/core";
import { use, useState, useEffect } from "react";
import { getOneDrive } from "@/utils/queries/get-onedrive";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "@/utils/queries/get-profile";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { getOneDriveFilesWithAuth, updateRootFolder, getFolderDetailsWithAuth, getAndSyncOneDriveFiles, deactivateAllOneDriveFiles, getOneDriveFolders } from "@/utils/services/microsoft";
import { getClass } from "@/utils/queries/get-class";
import { notifications } from "@mantine/notifications";
import { getOnedriveFiles } from "@/utils/queries/get-onedrive-files";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { IconWand } from "@tabler/icons-react";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getFiles } from "@/utils/queries/get-files";
import { createFile } from "@/utils/services/file";
import { FileType, OneDriveFolder } from "@/types";
import Management from "@/components/Account/Management";
import { DriveItem } from "microsoft-graph";

// Define file category types
const FILE_CATEGORIES = {
    LECTURE: 'lecture',
    TEXTBOOK: 'textbook',
    HOMEWORK: 'homework',
    FILE: 'file',
    UNGROUPED: 'ungrouped'
};

export default function SettingsPage({ params }: { params: Promise<{ classId: string }> }) {
    const { classId } = use(params);
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [movingFile, setMovingFile] = useState(false);
    const [classifying, setClassifying] = useState(false);

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: classData, isLoading: classLoading } = useQuery({
        queryKey: ["class", classId],
        queryFn: () => getClass(supabase, classId)
    });

    const { data: lectures, isLoading: loadingLectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId])
    })

    const { data: textbooks, isLoading: loadingTextbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId])
    })

    const { data: homeworks, isLoading: loadingHomeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId])
    })

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", profile?.id, classId],
        queryFn: () => getFiles(supabase, profile!.id, [classId]),
        enabled: !!profile
    })

    // OneDrive data
    const { data: oneDrive, isLoading: loadingOneDrive } = useQuery({
        queryKey: ["onedrive", profile?.id],
        queryFn: () => getOneDrive(supabase, profile!.id),
        enabled: !!profile
    });

    const { data: onedriveFiles, isLoading: loadingOnedriveFiles } = useQuery({
        queryKey: ["onedrive-files", classId],
        queryFn: () => getOnedriveFiles(supabase, classId),
    })

    const { data: folders, isLoading: loadingFolders } = useQuery({
        queryKey: ["onedrive-folders", oneDrive?.id],
        queryFn: () => getOneDriveFolders(oneDrive?.id || "", 3),
        enabled: !!oneDrive
    })

    // Group files by category
    const lectureFiles = onedriveFiles?.filter(file => file.lecture !== null) || [];
    const textbookFiles = onedriveFiles?.filter(file => file.textbook !== null) || [];
    const homeworkFiles = onedriveFiles?.filter(file => file.homework !== null) || [];
    const otherFiles = onedriveFiles?.filter(file => file.file !== null) || [];
    const ungroupedFiles = onedriveFiles?.filter(file =>
        file.lecture === null &&
        file.textbook === null &&
        file.homework === null &&
        file.file === null
    ) || [];

    // Handle file drop between categories
    const handleFileDrop = async (fileId: string, fromCategory: string, toCategory: string) => {
        if (fromCategory === toCategory) return;

        setMovingFile(true);
        try {
            if (!oneDrive?.id) {
                throw new Error("No OneDrive ID found");
            }
            const response_url = `${process.env.NEXT_PUBLIC_API_URL}`;
            const formData = new FormData();
            formData.append('class_id', classId);
            formData.append('onedrive_id', oneDrive.id);
            formData.append('response_url', response_url);
            formData.append('start_upload', "false");
            
            // Create a JSON array with file ID and target category
            const fileData = JSON.stringify([[fileId, toCategory]]);
            formData.append('files', fileData);

            // Call the API to update the category
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/onedrive`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to move file');
            }

            // Refresh the files list
            await getAndSyncOneDriveFiles(oneDrive?.id || "", classId, classData?.root_folder || undefined);
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", classId] });
            
            notifications.show({
                title: "File moved successfully",
                message: "The file has been reclassified",
                color: "green",
            });
        } catch (error) {
            console.error("Error moving file:", error);
            notifications.show({
                title: "Error moving file",
                message: "There was an error reclassifying the file",
                color: "red",
            });
        } finally {
            setMovingFile(false);
        }
    };

    // Auto-classify all files
    const handleAutoClassify = async () => {
        setClassifying(true);
        try {
            if (!oneDrive?.id) {
                throw new Error("No OneDrive ID found");
            }
            const response_url = `${process.env.NEXT_PUBLIC_API_URL}`;
            const formData = new FormData();

            formData.append('class_id', classId);
            formData.append('onedrive_id', oneDrive.id);
            formData.append('response_url', response_url);
            formData.append('start_upload', "false");

            // Create a JSON array with just file IDs (no categories)
            const fileIds = onedriveFiles?.map(file => file.id) || [];
            formData.append('files', JSON.stringify(fileIds));

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload/onedrive`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to classify files');
            }

            // Refresh the files list
            await getAndSyncOneDriveFiles(oneDrive?.id || "", classId, classData?.root_folder || undefined);
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", classId] });
            
            notifications.show({
                title: "Files classified successfully",
                message: "All files have been automatically classified",
                color: "green",
            });
        } catch (error) {
            console.error("Error classifying files:", error);
            notifications.show({
                title: "Error classifying files",
                message: "There was an error during automatic classification",
                color: "red",
            });
        } finally {
            setClassifying(false);
        }
    };

    const handleRootFolderChange = async (newRootFolder: string) => {
        try {
            // First deactivate all existing files
            await deactivateAllOneDriveFiles(classId);

            // Update the root folder
            const { success, error } = await updateRootFolder(classId, newRootFolder);
            if (error || !success) {
                throw new Error(error ?? "Error updating root folder");
            }

            // Fetch and sync files from the new root folder
            await getAndSyncOneDriveFiles(oneDrive?.id || "", classId, newRootFolder);
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", classId] });

            notifications.show({
                title: "Root folder updated successfully",
                message: "The root folder has been updated and files synced",
                color: "green",
            });

            queryClient.invalidateQueries({ queryKey: ["class", classId] });
        } catch (error) {
            console.error("Error changing root folder:", error);
            notifications.show({
                title: "Error changing root folder",
                message: "There was an error changing the root folder",
                color: "red",
            });
        }
    }

    // Component for a draggable file item
    const DraggableFileItem = ({ file, category }: { file: any, category: string }) => {
        const [{ isDragging }, drag] = useDrag(() => ({
            type: 'FILE_ITEM',
            item: { id: file.id, currentCategory: category },
            collect: (monitor) => ({
                isDragging: !!monitor.isDragging(),
            }),
        }));

        return (
            <Paper key={file.item} withBorder ref={drag as unknown as React.RefObject<HTMLDivElement>} style={{
                opacity: isDragging ? 0.5 : 1,
                cursor: 'move',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #eee',
            }}>
                <Group justify="space-between">
                    <Text>{file.name}</Text>
                </Group>
            </Paper>
        );
    };

    // Component for a category that can receive files
    const CategoryDropZone = ({ category, title, files, onDrop, color = 'blue' }: { category: string, title: string, files: any[], onDrop: (fileId: string, currentCategory: string, newCategory: string) => Promise<void>, color?: string }) => {
        const [{ isOver }, drop] = useDrop(() => ({
            accept: 'FILE_ITEM',
            drop: (item: { id: string, currentCategory: string }) => onDrop(item.id, item.currentCategory, category),
            collect: (monitor) => ({
                isOver: !!monitor.isOver(),
            }),
        }));

        return (
            <Paper
                p="md"
                withBorder
                ref={drop as unknown as React.RefObject<HTMLDivElement>}
                style={{
                    backgroundColor: isOver ? 'rgba(0, 120, 255, 0.05)' : undefined,
                    borderColor: isOver ? `var(--mantine-color-${color}-filled)` : undefined,
                    transition: 'all 0.2s',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Title order={4} mb="md" c={color}>
                    {title} ({files.length})
                </Title>
                <Stack style={{ flex: 1, overflowY: 'auto', minHeight: '210px' }} gap="xs">
                    {files.length > 0 ? (
                        files.map((file) => (
                            <DraggableFileItem key={file.id} file={file} category={category} />
                        ))
                    ) : (
                        <Text c="dimmed" ta="center" pt="xl">
                            Drag files here
                        </Text>
                    )}
                </Stack>
            </Paper>
        );
    };

    return <ClassLayout classId={classId}>
        <Container fluid>
            <Group justify="space-between">
                <Text size="xl" fw={700}>Settings</Text>

            </Group>
            {/* <Paper p="md" withBorder mt="md">
                <Management classId={classData?.id ?? ""} />
            </Paper> */}

            <Paper p="md" withBorder mt="md">
                <Group justify="space-between" mb="md">
                    <Box>
                        <Group align="end">
                            {folders && folders.length > 0 ? (
                                <Select
                                    label="OneDrive Class Folder"
                                    placeholder="Select a folder"
                                    data={folders.map(folder => ({
                                        value: folder.id,
                                        label: folder.name || '',
                                    }))}
                                    value={classData?.root_folder || null}
                                    onChange={(value) => handleRootFolderChange(value || "")}
                                    clearable
                                    searchable
                                />
                            ) : loadingFolders ? (
                                <Loader size="sm" />
                            ) : (
                                <Text>No folders found</Text>
                            )}
                        </Group>
                    </Box>
                    <Button
                        onClick={handleAutoClassify}
                        loading={classifying}
                        disabled={!onedriveFiles?.length}
                        leftSection={<IconWand size={16} />}
                    >
                        Auto-Classify Files
                    </Button>
                </Group>

                <DndProvider backend={HTML5Backend}>
                    <Grid>
                        <Grid.Col span={4}>
                            <Stack h="600px">
                                <CategoryDropZone
                                    category={FILE_CATEGORIES.UNGROUPED}
                                    title="All Files"
                                    files={ungroupedFiles}
                                    onDrop={handleFileDrop}
                                    color="gray"
                                />
                            </Stack>
                        </Grid.Col>
                        <Grid.Col span={8}>
                            <Stack h="600px" justify="space-between">
                                <Grid>
                                    <Grid.Col span={4}>
                                        <CategoryDropZone
                                            category={FILE_CATEGORIES.LECTURE}
                                            title="Lectures"
                                            files={lectureFiles}
                                            onDrop={handleFileDrop}
                                            color="blue"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={4}>
                                        <CategoryDropZone
                                            category={FILE_CATEGORIES.TEXTBOOK}
                                            title="Textbooks"
                                            files={textbookFiles}
                                            onDrop={handleFileDrop}
                                            color="green"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={4}>
                                        <CategoryDropZone
                                            category={FILE_CATEGORIES.HOMEWORK}
                                            title="Homeworks"
                                            files={homeworkFiles}
                                            onDrop={handleFileDrop}
                                            color="orange"
                                        />
                                    </Grid.Col>
                                </Grid>
                                <Grid>
                                    <Grid.Col span={12}>
                                        <CategoryDropZone
                                            category={FILE_CATEGORIES.FILE}
                                            title="Other"
                                            files={otherFiles}
                                            onDrop={handleFileDrop}
                                            color="violet"
                                        />
                                    </Grid.Col>
                                </Grid>
                            </Stack>
                        </Grid.Col>
                    </Grid>
                </DndProvider>

                {movingFile && (
                    <Box mt="md" ta="center">
                        <Loader size="sm" /> <Text span ml="xs">Moving file...</Text>
                    </Box>
                )}
            </Paper>
        </Container>
    </ClassLayout >
}