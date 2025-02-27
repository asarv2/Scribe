/**
 * ViewerPanel.tsx
 * Component for viewing documents, lectures, and textbooks
 */

import { Card, Stack, Group, Text, ActionIcon, Box } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import LectureViewer from "../../Viewer/LectureViewer";
import { memo } from "react";
import { Lecture, Textbook, ViewerMode } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import ChapterViewer from "../../Viewer/ChapterViewer";
import ExerciseViewer from "@/components/Viewer/ExerciseViewer";
interface ViewerPanelProps {
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>
    classId: string;
}

export const ViewerPanel = memo(({ viewerMode, setViewerMode, classId}: ViewerPanelProps) => {
    const supabase = useSupabaseBrowser();

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    // Helper function to get viewer title
    const getViewerTitle = () => {
        if (viewerMode.lectureId) {
            const lecture = lectures?.find(l => l.id === viewerMode.lectureId);
            return lecture ? `${lecture.name}` : "Lecture Viewer";
        } else if (viewerMode.textbookId) {
            const textbook = textbooks?.find(t => t.id === viewerMode.textbookId);
            return textbook ? `${textbook.title}` : "Textbook Viewer";
        }
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
                    ) : viewerMode.textbookId && viewerMode.textbookId.chapterId ? (
                        <ChapterViewer
                            key={`${viewerMode.textbookId}-${viewerMode.documentId}`}
                            classId={classId}
                            textbookId={Object.values(viewerMode.textbookId)[0]}
                            chapterId={viewerMode.textbookId.chapterId}
                            initialDocumentId={viewerMode.documentId}
                            embedded={true}
                        />
                    ) : viewerMode.textbookId && viewerMode.textbookId.chapterId && viewerMode.textbookId.exerciseId ? (
                        <ExerciseViewer
                            key={`${viewerMode.textbookId}-${viewerMode.textbookId.chapterId}-${viewerMode.textbookId.exerciseId}`}
                            classId={classId}
                            textbookId={Object.values(viewerMode.textbookId)[0]}
                            chapterId={viewerMode.textbookId.chapterId}
                            initialExerciseId={viewerMode.textbookId.exerciseId}
                            embedded={true}
                        />
                    ) : null}
                </Box>
            </Stack>
        </Card>
    );
});

ViewerPanel.displayName = 'ViewerPanel';
