/**
 * ViewerPanel.tsx
 * Component for viewing documents, lectures, and textbooks
 */

import { Card, Stack, Group, Text, ActionIcon, Box } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import LectureViewer from "../../Viewer/LectureViewer";
import TextbookViewer from "../../Viewer/TextbookViewer";
import { memo } from "react";

interface ViewerPanelProps {
    viewerMode: {
        active: boolean;
        documentId?: string;
        lectureId?: string;
        textbookId?: string;
        chapterId?: string;
    };
    setViewerMode: (mode: {
        active: boolean;
        documentId?: string;
        lectureId?: string;
        textbookId?: string;
        chapterId?: string;
    }) => void;
    classId: string;
}

export const ViewerPanel = memo(({ viewerMode, setViewerMode, classId }: ViewerPanelProps) => {
    const getViewerTitle = () => {
        if (viewerMode.lectureId) return "Lecture Viewer";
        if (viewerMode.textbookId) return "Textbook Viewer";
        return "Document Viewer";
    };

    return (
        <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{ height: "80vh" }}
        >
            <Stack style={{ height: "100%" }}>
                <Group justify="space-between" wrap="nowrap">
                    <Text
                        size="lg"
                        fw={700}
                        truncate="end"
                        style={{ flex: 1 }}
                    >
                        {getViewerTitle()}
                    </Text>
                    <ActionIcon
                        onClick={() => setViewerMode({ active: false })}
                        variant="subtle"
                        ml="auto"
                    >
                        <IconX size={20} />
                    </ActionIcon>
                </Group>
                <Box style={{ flex: 1, overflow: 'hidden' }}>
                    {viewerMode.lectureId ? (
                        <LectureViewer
                            key={`${viewerMode.lectureId}-${viewerMode.documentId}`}
                            classId={classId}
                            lectureId={viewerMode.lectureId}
                            initialDocumentId={viewerMode.documentId}
                            embedded={true}
                        />
                    ) : viewerMode.textbookId && viewerMode.chapterId ? (
                        <TextbookViewer
                            key={`${viewerMode.textbookId}-${viewerMode.documentId}`}
                            classId={classId}
                            textbookId={viewerMode.textbookId}
                            chapterId={viewerMode.chapterId}
                            initialDocumentId={viewerMode.documentId}
                            embedded={true}
                        />
                    ) : null}
                </Box>
            </Stack>
        </Card>
    );
});

ViewerPanel.displayName = 'ViewerPanel';
