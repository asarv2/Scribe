/**
 * ViewerPanel.tsx
 * Component for viewing documents, lectures, and textbooks
 */

import { Group, Stack, Text, ActionIcon, Box, Tooltip } from "@mantine/core"; // Removed Collapse
import { IconMinus, IconPlus, IconSettings, IconTrash, IconX } from "@tabler/icons-react"; // Removed Chevrons, Added IconX
import { memo } from "react";
import { ChatMessage, ContentType, ViewerMode, File as ScribeFile } from "@/types"; // Added ScribeFile import
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import FileViewer from "@/components/Viewer/FileViewer";
import { getFiles } from "@/utils/queries/get-files";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import DeleteFileModal from "../Delete/DeleteFileModal";
import FileSettingsModal from "./FileSettingsModal";

// Define props interface
interface ViewerPanelProps {
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
    addFileToChat: (fileId: string) => void;
    addDocumentToChat: (documentId: string) => void;
    classId: string;
    activeChat: ChatMessage;
}

// Helper function to get content type label
const getContentTypeLabel = (contentType: ContentType | undefined): string => {
    switch (contentType) {
        case 'lecture': return 'Lecture';
        case 'homework': return 'Homework';
        case 'rubric': return 'Rubric';
        case 'textbook': return 'Textbook';
        default: return 'File';
    }
};

// Use memo for performance optimization
export const ViewerPanel = memo(({ viewerMode, setViewerMode, addFileToChat, addDocumentToChat, classId, activeChat }: ViewerPanelProps) => {
    const supabase = useSupabaseBrowser();

    const { data: user, isLoading: loadingUser } = useQuery({
        queryKey: ["user"],
        queryFn: () => getUser(supabase),
    })

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ["profile", user?.id],
        queryFn: () => getProfile(supabase, user!.id),
        enabled: !!user
    })

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", classId],
        queryFn: () => getFiles(supabase, classId!),
        enabled: !!profile
    });

    // Find the active file
    const activeFile = files?.find(f => f.id === viewerMode.fileId);
    const contentTypeLabel = getContentTypeLabel(activeFile?.content_type);

    // Check if the current file is already in the chat context
    const isFileInChat = activeChat.files.includes(viewerMode.fileId ?? "");

    const handleCloseViewer = () => {
        setViewerMode(prev => ({
            ...prev,
            active: false, // Set viewer inactive to show ContextPanel
            fileId: undefined,
            documentId: undefined,
            showPageDetails: false,
        }));
    };

    return (
        // Card container removed, starting directly with Stack
        <Stack
            style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: 'hidden',
                width: "100%",
                flex: 1,
            }}
        >
            {/* Header Section */}
            <Stack
                gap="xs"
                style={{
                    borderBottom: '1px solid var(--mantine-color-gray-3)',
                    padding: 'var(--mantine-spacing-sm)',
                }}
            >
                <Group justify="space-between" align="center" wrap="nowrap" style={{ width: '100%' }}>
                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={500} size="sm" truncate="end" style={{ maxWidth: '100%' }}>
                            {activeFile?.title ?? "File Viewer"}
                        </Text>
                        <Group gap="2" wrap="nowrap">
                            {/* Settings Icon */}
                            {viewerMode.fileId && <FileSettingsModal fileId={viewerMode.fileId} classId={classId} />}
                            {/* Delete Icon */}
                            {viewerMode.fileId && <DeleteFileModal fileId={viewerMode.fileId} classId={classId} />}
                        </Group>
                    </Group>
                    <Group gap="2" wrap="nowrap">
                        {/* Add to Chat Icon */}
                        {viewerMode.fileId && !isFileInChat && (
                            <Tooltip label={`Add ${contentTypeLabel} to Chat`}>
                                <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => addFileToChat(viewerMode.fileId ?? "")}
                                    size="lg"
                                >
                                    <IconPlus size={18} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        {/* Close Icon */}
                        {viewerMode.fileId && (
                            <Tooltip label="Close Viewer">
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    onClick={handleCloseViewer}
                                    size="lg"
                                >
                                    <IconX size={18} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </Group>
                </Group>
            </Stack>

            {/* Viewer Content */}
            <Box style={{
                flex: 1,
                overflow: 'hidden'
            }}>
                {viewerMode.fileId ? (
                    <FileViewer
                        classId={classId}
                        addDocumentToChat={addDocumentToChat}
                        activeChat={activeChat}
                        viewerMode={viewerMode}
                        setViewerMode={setViewerMode}
                    />
                ) : (
                    <Stack align="center" justify="center" style={{ height: '100%' }}>
                        <Text c="dimmed">Select a file to view</Text>
                    </Stack>
                )}
            </Box>
        </Stack>
    );
});

ViewerPanel.displayName = 'ViewerPanel'; // Add display name
