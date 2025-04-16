/**
 * ViewerPanel.tsx
 * Component for viewing documents, lectures, and textbooks
 */

import { Card, Stack, Group, Text, ActionIcon, Box, Button, Divider, Tooltip } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { memo } from "react";
import { ChatMessage, ViewerMode } from "@/types";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import FileViewer from "@/components/Viewer/FileViewer";
import { getFiles } from "@/utils/queries/get-files";
import DeleteFileModal from "@/components/Delete/DeleteFileModal";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";

interface ViewerPanelProps {
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
    activeChat: ChatMessage;
    addContextToChat: (contextId: string) => void;
    classId: string;
}

export const ViewerPanel = memo(({ viewerMode, setViewerMode, addContextToChat, classId, activeChat }: ViewerPanelProps) => {
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
        queryFn: () => getFiles(supabase, [classId]),
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

    return (
        <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            h="calc(100vh - 100px)"
        >
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
                        {viewerMode.fileId && <Text
                            size="xs"
                            fw={500}
                            c="red"
                            truncate="end"
                        > Expires at {files?.find(f => f.id === viewerMode.fileId)?.expires ? new Date(files?.find(f => f.id === viewerMode.fileId)?.expires ?? "").toLocaleString() : "No expiration date"}
                        </Text>}
                    </Stack>
                    <Tooltip label={`Close viewer`} openDelay={500} offset={8}>
                        <ActionIcon
                            onClick={handleClose}
                            variant="subtle"
                            color="gray"
                            ml={8}
                            style={{ flexShrink: 0 }}
                        >
                            <IconX size={20} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
                <>
                    <Box style={{ flex: 1, overflow: 'hidden' }}>
                        <FileViewer
                            key={`${viewerMode.fileId}-${viewerMode.documentId}`}
                            classId={classId}
                            fileId={viewerMode.fileId ?? ""}
                            initialDocumentId={viewerMode.documentId}
                        />
                    </Box>
                    {activeChat.context.includes(viewerMode.fileId ?? "") ? null : <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={() => addContextToChat(viewerMode.fileId ?? "")}
                    >Add File to Chat</Button>}
                </>

            </Stack>
        </Card >
    );
});

ViewerPanel.displayName = 'ViewerPanel';
