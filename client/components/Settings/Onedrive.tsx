/**
 * OneDrive.tsx
 * Used to show the folders for the onedrive integration.
 * @AshokSaravanan222
 * 04-14-2025
 */

import { Button, Container, Box, Text, Badge, Loader, Select, Group, Stack, Title, Paper, Grid, Modal, Tooltip } from "@mantine/core";
import { use, useState, useEffect } from "react";
import { getOneDrive } from "@/utils/queries/get-onedrive";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProfile } from "@/utils/queries/get-profile";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getUser } from "@/utils/queries/get-user";
import { updateRootFolder, deactivateAllOneDriveFiles, getOneDriveFolders, getOneDriveFolderStructure, getAndSyncOneDriveFiles } from "@/utils/services/microsoft";
import { getClass } from "@/utils/queries/get-class";
import { notifications } from "@mantine/notifications";
import { getOnedriveFiles } from "@/utils/queries/get-onedrive-files";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { IconWand, IconFolder, IconFolderOpen, IconFile, IconFileText, IconFileSpreadsheet, IconChevronRight, IconChevronDown, IconFileTypePdf, IconSlideshow } from "@tabler/icons-react";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getFiles } from "@/utils/queries/get-files";
import { createFile } from "@/utils/services/file";
import { FileType, OneDriveFile, OneDriveFolder } from "@/types";
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

export default function OneDrive({ classId }: { classId: string }) {
    const supabase = useSupabaseBrowser();
    const queryClient = useQueryClient();
    const [movingFile, setMovingFile] = useState(false);
    const [classifying, setClassifying] = useState(false);
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [selectedFolderTemp, setSelectedFolderTemp] = useState<string | null>(null);

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


    // DATABASE QUERIES
    const { data: onedriveFiles, isLoading: loadingOnedriveFiles } = useQuery({
        queryKey: ["onedrive-files", classId],
        queryFn: () => getOnedriveFiles(supabase, classId),
    })

    const { data: oneDrive, isLoading: loadingOneDrive } = useQuery({
        queryKey: ["onedrive", user?.id],
        queryFn: () => getOneDrive(supabase, user!.id),
        enabled: !!user
    });

    // MICROSOFT GRAPH API QUERIES
    const { data: microsoftFolders, isLoading: loadingFolders } = useQuery({
        queryKey: ["microsoft-folders", oneDrive?.id],
        queryFn: () => getOneDriveFolders(oneDrive?.id || "", 3),
        enabled: !!oneDrive
    })

    const { data: folderStructure, isLoading: loadingFolderStructure } = useQuery({
        queryKey: ["folder-structure", classId],
        queryFn: () => getOneDriveFolderStructure(oneDrive?.id || "", classData?.root_folder || ""),
        enabled: !!oneDrive && !!classData
    })

    // Helper function to get file icon based on file type
    const getFileIcon = (fileName: string | undefined | null) => {
        if (!fileName) return <IconFile size={20} />;
        const extension = fileName.split('.').pop()?.toLowerCase();

        switch (extension) {
            case 'pdf':
                return <IconFileTypePdf size={20} />;
            case 'doc':
            case 'docx':
            case 'txt':
                return <IconFileText size={20} />;
            case 'xls':
            case 'xlsx':
            case 'csv':
                return <IconFileSpreadsheet size={20} />;
            case 'ppt':
            case 'pptx':
                return <IconSlideshow size={20} />;
            default:
                return <IconFile size={20} />;
        }
    };

    // Nested folder component
    const NestedFolderSelect = ({
        folders,
        selectedFolder,
        onSelect
    }: {
        folders: OneDriveFolder[],
        selectedFolder: string | null,
        onSelect: (folderId: string) => void
    }) => {
        // Track expanded state for each folder
        const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

        // Initialize with all top-level folders expanded
        useEffect(() => {
            const initialExpanded: Record<string, boolean> = {};
            folders
                .filter(folder => !folder.parentId)
                .forEach(folder => {
                    initialExpanded[folder.id] = true;
                });
            setExpandedFolders(initialExpanded);
        }, [folders]);

        const toggleFolder = (folderId: string, event?: React.MouseEvent) => {
            if (event) {
                // Stop propagation to prevent folder selection
                event.stopPropagation();
            }

            setExpandedFolders(prev => ({
                ...prev,
                [folderId]: !prev[folderId]
            }));
        };

        // Recursive function to render folder tree
        const renderFolder = (folder: OneDriveFolder, depth = 0) => {
            const hasChildren = folder.children && folder.children.length > 0;
            const isExpanded = expandedFolders[folder.id];
            const isSelected = selectedFolder === folder.id;

            return (
                <Box key={folder.id} ml={depth * 16}>
                    <Group
                        gap="xs"
                        onClick={() => onSelect(folder.id)}
                        style={{
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined
                        }}
                    >
                        {hasChildren ? (
                            <Box
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => toggleFolder(folder.id, e)}
                            >
                                {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            </Box>
                        ) : (
                            <Box ml={16} />
                        )}

                        {isExpanded ? <IconFolderOpen size={20} color="var(--mantine-color-blue-filled)" /> : <IconFolder size={20} color="var(--mantine-color-blue-filled)" />}
                        <Text>{folder.name}</Text>
                    </Group>

                    {hasChildren && isExpanded && (
                        <Box>
                            {folder.children?.map(childId => {
                                const childFolder = folders.find(f => f.id === childId.id);
                                if (childFolder) return renderFolder(childFolder, depth + 1);
                                return null;
                            })}
                        </Box>
                    )}
                </Box>
            );
        };

        // Get top-level folders
        const rootFolders = folders.filter(folder => !folder.parentId);

        return (
            <Paper withBorder p="md" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {rootFolders.map(folder => renderFolder(folder))}
            </Paper>
        );
    };

    // Simplified function to get files for a category
    const getFilesForCategory = (onedriveFiles: OneDriveFile[] = [], files: DriveItem[] = [], category: string) => {
        if (!onedriveFiles || !files) return [];

        // Filter onedrive files by category
        let filteredOnedriveFiles = onedriveFiles.filter(file => file.active);

        if (category === FILE_CATEGORIES.LECTURE) {
            filteredOnedriveFiles = filteredOnedriveFiles.filter(file => file.lecture !== null);
        } else if (category === FILE_CATEGORIES.TEXTBOOK) {
            filteredOnedriveFiles = filteredOnedriveFiles.filter(file => file.textbook !== null);
        } else if (category === FILE_CATEGORIES.HOMEWORK) {
            filteredOnedriveFiles = filteredOnedriveFiles.filter(file => file.homework !== null);
        } else if (category === FILE_CATEGORIES.FILE) {
            filteredOnedriveFiles = filteredOnedriveFiles.filter(file => file.file !== null);
        } else if (category === FILE_CATEGORIES.UNGROUPED) {
            // For ungrouped, get files that don't have any category assigned
            filteredOnedriveFiles = filteredOnedriveFiles.filter(file =>
                file.lecture === null && file.textbook === null &&
                file.homework === null && file.file === null
            );
        }

        // Map to actual file objects from Microsoft Graph
        const categoryFiles = filteredOnedriveFiles
            .map(onedriveFile => files.find(file => file.id === onedriveFile.item))
            .filter(Boolean) as DriveItem[];

        return categoryFiles;
    };

    // Simplified FileCard component that works for both files and folders
    const FileCard = ({
        item,
        category,
        isFolder = false,
        expanded = false,
        onToggleExpand,
        children
    }: {
        item: OneDriveFolder | DriveItem,
        category: string,
        isFolder?: boolean,
        expanded?: boolean,
        onToggleExpand?: () => void,
        children?: React.ReactNode
    }) => {
        const [{ isDragging }, drag] = useDrag(() => ({
            type: 'FILE_ITEM',
            item: { id: item.id, currentCategory: category },
            collect: (monitor) => ({
                isDragging: !!monitor.isDragging(),
            }),
            canDrag: !isFolder, // Only allow dragging of files, not folders
        }));

        return (
            <Box>
                <Paper
                    withBorder
                    ref={isFolder ? undefined : (drag as unknown as React.RefObject<HTMLDivElement>)}
                    style={{
                        opacity: isDragging ? 0.5 : 1,
                        cursor: isFolder ? 'pointer' : 'move',
                        padding: '8px',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        backgroundColor: isFolder ? 'var(--mantine-color-blue-light)' : undefined,
                    }}
                    onClick={isFolder && onToggleExpand ? onToggleExpand : undefined}
                >
                    <Group gap="xs">
                        {isFolder ? (
                            <>
                                {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                <IconFolder size={20} color="var(--mantine-color-blue-filled)" />
                            </>
                        ) : (
                            getFileIcon(item.name)
                        )}
                        <Text size="sm" style={{ flex: 1, wordBreak: 'break-word' }}>{item.name}</Text>
                    </Group>
                </Paper>
                {isFolder && expanded && children && (
                    <Box ml={24} mt={4}>
                        {children}
                    </Box>
                )}
            </Box>
        );
    };

    // Simplified FolderView component to display folders and files
    const FolderView = ({
        folders = [],
        files = [],
        category,
        onFileDrop
    }: {
        folders: OneDriveFolder[],
        files: DriveItem[],
        category: string,
        onFileDrop: (fileId: string, fromCategory: string, toCategory: string) => Promise<void>
    }) => {
        const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

        const toggleFolder = (folderId: string) => {
            setExpandedFolders(prev => ({
                ...prev,
                [folderId]: !prev[folderId]
            }));
        };

        // Render folders first, then files
        return (
            <Stack gap="xs">
                {/* Render folders */}
                {folders && folders.length > 0 && (
                    folders.map(folder => (
                        <FileCard
                            key={folder.id}
                            item={folder}
                            category={category}
                            isFolder={true}
                            expanded={!!expandedFolders[folder.id]}
                            onToggleExpand={() => toggleFolder(folder.id)}
                        >
                            {/* Render children when expanded */}
                            {expandedFolders[folder.id] && folder.children && (
                                <FolderView
                                    folders={folder.children.filter(child => typeof child === 'object')}
                                    files={files.filter(file => file.parentReference?.id === folder.id)}
                                    category={category}
                                    onFileDrop={onFileDrop}
                                />
                            )}
                        </FileCard>
                    ))
                )}

                {/* Render files */}
                {files && files.length > 0 && (
                    files.filter(file => !folders.find(folder => folder.id === file.parentReference?.id)).map(file => (
                        <FileCard
                            key={file.id}
                            item={file}
                            category={category}
                        />
                    ))
                )}

                {/* Show message if empty */}
                {(!folders || folders.length === 0) && (!files || files.length === 0) && (
                    <Text c="dimmed" ta="center">No items in this category</Text>
                )}
            </Stack>
        );
    };

    // Simplified CategoryDropZone component
    const CategoryDropZone = ({
        category,
        title,
        files = [],
        folders = [],
        onDrop,
        color = 'blue'
    }: {
        category: string,
        title: string,
        files: DriveItem[],
        folders?: OneDriveFolder[],
        onDrop: (fileId: string, currentCategory: string, newCategory: string) => Promise<void>,
        color?: string
    }) => {
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
                <Group justify="space-between" mb="md">
                    <Title order={4} c={color}>
                        {title} ({files.length})
                    </Title>
                </Group>

                <Box style={{ flex: 1, overflowY: 'auto', minHeight: '210px' }}>
                    <FolderView
                        folders={folders || []}
                        files={files}
                        category={category}
                        onFileDrop={onDrop}
                    />
                </Box>
            </Paper>
        );
    };


    // Handle file drop between categories
    const handleFileDrop = async (itemId: string, fromCategory: string, toCategory: string) => {
        if (fromCategory === toCategory) return;

        setMovingFile(true);
        try {
            if (!oneDrive?.id) {
                throw new Error("No OneDrive ID found");
            }
            // find the file in the files array
            const onedriveFile = onedriveFiles?.find(f => f.item === itemId);
            if (!onedriveFile) {
                throw new Error("File not found");
            }

            const response_url = `${process.env.NEXT_PUBLIC_API_URL}`;
            const formData = new FormData();
            formData.append('class_id', classId);
            formData.append('onedrive_id', oneDrive.id);
            formData.append('response_url', response_url);
            formData.append('start_upload', "false");

            // Create a JSON array with file ID and target category
            const fileData = JSON.stringify([[onedriveFile.id, toCategory]]);
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
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", classId] });
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", oneDrive?.id, classId] });

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
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", classId] });
            await getAndSyncOneDriveFiles(oneDrive?.id || "", classId, classData?.root_folder || undefined);
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
            queryClient.invalidateQueries({ queryKey: ["onedrive-files", classId] });
            await getAndSyncOneDriveFiles(oneDrive?.id || "", classId, newRootFolder);

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

    // Save the selected folder from the modal
    const saveSelectedFolder = () => {
        if (selectedFolderTemp) {
            handleRootFolderChange(selectedFolderTemp);
        }
        setFolderModalOpen(false);
    }

    // Folder selection modal component
    const FolderSelectionModal = () => (
        <Modal
            opened={folderModalOpen}
            onClose={() => setFolderModalOpen(false)}
            title="Select OneDrive Folder"
            size="lg"
        >
            <Box mb="md">
                <Text size="sm" c="dimmed">
                    Navigate through your OneDrive folders and select the one you want to use for this class.
                </Text>
            </Box>

            {loadingFolders ? (
                <Box ta="center" py="xl">
                    <Loader size="md" />
                    <Text mt="md">Loading folders...</Text>
                </Box>
            ) : classData?.root_folder && microsoftFolders && microsoftFolders.length > 0 ? (
                <Box style={{ height: '400px', overflowY: 'auto' }}>
                    <NestedFolderSelect
                        folders={microsoftFolders}
                        selectedFolder={selectedFolderTemp}
                        onSelect={(folderId) => setSelectedFolderTemp(folderId)}
                    />
                </Box>
            ) : (
                <Text ta="center" py="xl">No folders found in your OneDrive</Text>
            )}

            <Group justify="flex-end" mt="xl">
                <Button variant="outline" onClick={() => setFolderModalOpen(false)}>
                    Cancel
                </Button>
                <Button onClick={saveSelectedFolder}>
                    Save Changes
                </Button>
            </Group>
        </Modal>
    );

    const getFolderName = (folderId: string) => {
        const folder = microsoftFolders?.find(f => f.id === folderId);
        return folder?.path ? `${folder.path}/${folder.name}` : folder?.name || '';
    };

    return (
        <>
            <Group justify="space-between" mb="md">
                <Tooltip label="Click to select a folder">
                    <Paper
                        withBorder
                        p="xs"
                        onClick={() => setFolderModalOpen(true)}
                        style={{
                            cursor: 'pointer',
                        }}
                    >
                        <Group>
                            <IconFolder size={20} color="var(--mantine-color-blue-filled)" />
                            {classData?.root_folder ? (
                                <Text>{getFolderName(classData.root_folder)}</Text>
                            ) : (
                                <Text c="dimmed">Click to select a folder</Text>
                            )}
                        </Group>
                    </Paper>
                </Tooltip>
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
                                files={getFilesForCategory(onedriveFiles || [], folderStructure?.files || [], FILE_CATEGORIES.UNGROUPED)}
                                folders={folderStructure?.folders || []}
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
                                        files={getFilesForCategory(onedriveFiles || [], folderStructure?.files || [], FILE_CATEGORIES.LECTURE)}
                                        onDrop={handleFileDrop}
                                        color="blue"
                                    />
                                </Grid.Col>
                                <Grid.Col span={4}>
                                    <CategoryDropZone
                                        category={FILE_CATEGORIES.TEXTBOOK}
                                        title="Textbooks"
                                        files={getFilesForCategory(onedriveFiles || [], folderStructure?.files || [], FILE_CATEGORIES.TEXTBOOK)}
                                        onDrop={handleFileDrop}
                                        color="green"
                                    />
                                </Grid.Col>
                                <Grid.Col span={4}>
                                    <CategoryDropZone
                                        category={FILE_CATEGORIES.HOMEWORK}
                                        title="Homeworks"
                                        files={getFilesForCategory(onedriveFiles || [], folderStructure?.files || [], FILE_CATEGORIES.HOMEWORK)}
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
                                        files={getFilesForCategory(onedriveFiles || [], folderStructure?.files || [], FILE_CATEGORIES.FILE)}
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
            <FolderSelectionModal />
        </>
    )
}