/**
 * ViewerPanel.tsx
 * Component for viewing documents, lectures, and textbooks
 */

import { Card, Stack, Group, Text, ActionIcon, Box, Button, Divider, Tooltip } from "@mantine/core";
import { IconPlus, IconX, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { memo } from "react";
import { ChatMessage, ContentType, ViewerMode } from "@/types";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import FileViewer from "@/components/Viewer/FileViewer";
import { getFiles } from "@/utils/queries/get-files";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import DeleteFileModal from "../Delete/DeleteFileModal";

interface ViewerPanelProps {
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
    activeChat: ChatMessage;
    addFileToChat: (fileId: string) => void;
    addDocumentToChat: (documentId: string) => void;
    classId: string;
}

const CONTENT_TYPES = {
    lecture: 'Lecture',
    textbook: 'Textbook',
    homework: 'Homework',
    other: 'File'
}

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


    // Helper function to get viewer title
    const getViewerTitle = () => {
        const file = files?.find(f => f.id === viewerMode.fileId);
        return file ? `${file.title}` : "File Viewer";
    };

    // Modify the close handler to fully close the panel
    const handleClose = () => {
        if (viewerMode.active) {
            setViewerMode(prev => ({
                ...prev,
                active: false,
            }));
        }
    };

    const renderExpiresAt = (fileId: string) => {
        const file = files?.find(f => f.id === fileId);
        return file && file.expires ? (
            <Text size="xs" fw={500} c="red" truncate="end">
                Expires at {new Date(file.expires).toLocaleString()}
            </Text>
        ) : null;
    }

    return (
        <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            h="calc(100vh - 100px)"
            style={{ position: 'relative', paddingTop: '30px' }}
        >
            {/* Horizontal minimize bar at the top */}
            <Tooltip label="Close viewer" openDelay={500}>
                <Box
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        left: '0',
                        top: '0',
                        width: '100%',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--mantine-color-blue-light)',
                        color: 'var(--mantine-color-blue-filled)',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 0 5px rgba(0,0,0,0.1)',
                        zIndex: 10
                    }}
                >
                    <IconChevronDown size={16} />
                </Box>
            </Tooltip>

            <Stack style={{ height: "100%" }}>
                <Group justify="space-between" wrap="nowrap" align="flex-start" style={{ width: '100%' }}>
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                        <Text
                            size="lg"
                            fw={700}
                            truncate="end"
                            style={{ width: '100%' }}
                        >
                            {getViewerTitle()}
                        </Text>
                        {viewerMode.fileId && renderExpiresAt(viewerMode.fileId)}
                    </Stack>
                    <DeleteFileModal
                        fileId={viewerMode.fileId ?? ""}
                        classId={classId}
                        onDelete={() => {
                            setViewerMode(prev => ({
                                ...prev,
                                active: false,
                            }));
                        }}
                    />
                </Group>
                <>
                    <Box style={{ flex: 1, overflow: 'hidden' }}>
                        <FileViewer
                            key={`${viewerMode.fileId}-${viewerMode.documentId}`}
                            classId={classId}
                            addDocumentToChat={addDocumentToChat}
                            activeChat={activeChat}
                            viewerMode={viewerMode}
                            setViewerMode={setViewerMode}
                        />
                    </Box>
                    {activeChat.files.includes(viewerMode.fileId ?? "") ? null : <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => addFileToChat(viewerMode.fileId ?? "")}
                    >Add {CONTENT_TYPES[files?.find(f => f.id === viewerMode.fileId)?.content_type as keyof typeof CONTENT_TYPES]} to Chat</Button>}
                </>

            </Stack>
        </Card >
    );
});

ViewerPanel.displayName = 'ViewerPanel';
