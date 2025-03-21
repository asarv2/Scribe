/**
 * ViewerPanel.tsx
 * Component for viewing documents, lectures, and textbooks
 */

import { Card, Stack, Group, Text, ActionIcon, Box, Button } from "@mantine/core";
import { IconMinus, IconPlus, IconX } from "@tabler/icons-react";
import LectureViewer from "../../Viewer/LectureViewer";
import { memo } from "react";
import { ChatMessage, Lecture, Textbook, ViewerMode } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import ChapterViewer from "../../Viewer/ChapterViewer";
import ExerciseViewer from "@/components/Viewer/ExerciseViewer";
import HomeworkViewer from "@/components/Viewer/HomeworkViewer";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getExercises } from "@/utils/queries/get-exercises";

interface ViewerPanelProps {
    viewerMode: ViewerMode;
    setViewerMode: React.Dispatch<React.SetStateAction<ViewerMode>>;
    activeChat: ChatMessage;
    addContextToChat: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    classId: string;
}

export const ViewerPanel = memo(({ viewerMode, setViewerMode, addContextToChat, classId, activeChat }: ViewerPanelProps) => {
    const supabase = useSupabaseBrowser();

    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId])
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId]),
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks?.map(t => t.id) ?? [])
    });

    const { data: homeworks } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId])
    });

    // Helper function to get viewer title
    const getViewerTitle = () => {
        if (viewerMode.lectureId) {
            const lecture = lectures?.find(l => l.id === viewerMode.lectureId);
            return lecture ? `${lecture.name}` : "Lecture Viewer";
        } else if (viewerMode.textbookId && viewerMode.chapterId) {
            const textbook = textbooks?.find(t => t.id === viewerMode.textbookId);
            const chapter = chapters?.find(c => c.id === viewerMode.chapterId);
            return textbook ? `${textbook.title} - ${chapter?.title}` : "Textbook Viewer";
        } else if (viewerMode.homeworkId) {
            const homework = homeworks?.find(h => h.id === viewerMode.homeworkId);
            return homework ? `${homework.title}` : "Homework Viewer";
        } else if (viewerMode.exerciseId && viewerMode.chapterId) {
            const chapter = chapters?.find(c => c.id === viewerMode.chapterId);
            return chapter ? `Chapter ${chapter.chapter_number} Exercises` : "Exercise Viewer";
        }
        return "Document Viewer";
    };

    // Modify the close handler to fully close the panel
    const handleClose = () => {
        if (viewerMode.immersive) {
            setViewerMode(prev => ({
                ...prev,
                active: false,
                open: false,
            }));
        } else {
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
            style={{ height: viewerMode.immersive ? "90vh" : "80vh" }}
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
                        onClick={handleClose}
                        variant="subtle"
                        ml="auto"
                    >
                        <IconX size={20} />
                    </ActionIcon>
                </Group>
                {viewerMode.lectureId ? (
                    <>
                        <Box style={{ flex: 1, overflow: 'hidden' }}>
                            <LectureViewer
                                key={`${viewerMode.lectureId}-${viewerMode.documentId}`}
                                classId={classId}
                                lectureId={viewerMode.lectureId}
                                initialDocumentId={viewerMode.documentId}
                            />
                        </Box>
                        {activeChat.context.lectures.includes(viewerMode.lectureId ?? "") ? null : <Button
                            leftSection={<IconPlus size={16} />}
                            onClick={() => addContextToChat("lectures", viewerMode.lectureId ?? "")}
                            color="blue"
                        >Add Lecture to Chat</Button>}
                    </>
                ) : viewerMode.chapterId ? (
                    viewerMode.exerciseId ? (
                        <>
                            <Box style={{ flex: 1, overflow: 'hidden' }}>
                                <ExerciseViewer
                                    key={`${viewerMode.chapterId}-${viewerMode.exerciseId}`}
                                    classId={classId}
                                    chapterId={viewerMode.chapterId}
                                    initialExerciseId={viewerMode.exerciseId}
                                />

                            </Box>
                            {activeChat.context.exercises.includes(viewerMode.exerciseId ?? "") ? null : <Button
                                leftSection={<IconPlus size={16} />}
                                onClick={() => addContextToChat("exercises", viewerMode.chapterId ?? "")} // adding all the exercises for the chapter
                                color="teal"
                            >Add Exercises to Chat</Button>}
                        </>
                    ) : viewerMode.textbookId ? (
                        <>
                            <Box style={{ flex: 1, overflow: 'hidden' }}>
                                <ChapterViewer
                                    key={`${viewerMode.textbookId}-${viewerMode.chapterId}`}
                                    classId={classId}
                                    textbookId={viewerMode.textbookId}
                                    chapterId={viewerMode.chapterId}
                                    initialDocumentId={viewerMode.documentId}
                                />
                            </Box>
                            {activeChat.context.chapters.includes(viewerMode.chapterId ?? "") ? null : <Button
                                leftSection={<IconPlus size={16} />}
                                onClick={() => addContextToChat("chapters", viewerMode.chapterId ?? "")}
                                color="green"
                            >Add Chapter to Chat</Button>}
                        </>
                    ) : null
                ) : viewerMode.homeworkId ? (
                    <>
                        <Box style={{ flex: 1, overflow: 'hidden' }}>
                            <HomeworkViewer
                                key={`${viewerMode.homeworkId}-${viewerMode.exerciseId}`}
                                classId={classId}
                                homeworkId={viewerMode.homeworkId}
                                initialExerciseId={viewerMode.exerciseId}
                            />

                        </Box>
                        {activeChat.context.homeworks.includes(viewerMode.homeworkId ?? "") ? null : <Button
                            leftSection={<IconPlus size={16} />}
                            onClick={() => addContextToChat("homeworks", viewerMode.homeworkId ?? "")}
                        >Add Homework to Chat</Button>}
                    </>
                ) : null}

            </Stack>
        </Card >
    );
});

ViewerPanel.displayName = 'ViewerPanel';
