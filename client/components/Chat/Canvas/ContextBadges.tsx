/**
 * ContextBadges.tsx
 * Used to show the context badges in the chat.
 */

import { Badge, Group, Avatar, Text, ActionIcon, Box } from "@mantine/core";
import { IconFile, IconPlus, IconWand, IconX } from "@tabler/icons-react";
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getExercises } from "@/utils/queries/get-exercises";
import { Chapter, Subchapter, ChatMessage, Document, ViewerMode, File } from "@/types";
import { handleDocumentClick } from "@/utils/chat/chat-helpers";
import { getLectureDocuments } from "@/utils/queries/get-lecture-docs";
import { getTextbookDocuments } from "@/utils/queries/get-textbook-docs";
import { getFiles } from "@/utils/queries/get-files";
import { getFileDocuments } from "@/utils/queries/get-file-docs";
import { getUser } from "@/utils/queries/get-user";
import { getProfile } from "@/utils/queries/get-profile";
import { RecordedVideo } from "./ChatCanvas";

interface ContextBadgesProps {
    activeChat: ChatMessage;
    classId: string;
    onRemoveContext?: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    onScrollToSection?: (sectionId: string) => void;
    setViewerMode?: React.Dispatch<React.SetStateAction<ViewerMode>>;
    expandedSections: Set<string>;
    toggleSection: (section: string) => void;
    recordedVideos: RecordedVideo[];
    setRecordedVideos: React.Dispatch<React.SetStateAction<RecordedVideo[]>>;
}

export const ContextBadges = memo(({
    activeChat,
    classId,
    onRemoveContext,
    onScrollToSection,
    setViewerMode,
    expandedSections,
    toggleSection,
    recordedVideos,
    setRecordedVideos
}: ContextBadgesProps) => {
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

    // Queries for data
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, [classId])
    });

    const { data: lectureDocuments } = useQuery({
        queryKey: ["lectureDocuments", classId],
        queryFn: () => getLectureDocuments(supabase, lectures!.map(l => l.id)),
        enabled: !!lectures
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, [classId]),
    });

    const { data: textbookDocuments } = useQuery({
        queryKey: ["textbookDocuments", classId],
        queryFn: () => getTextbookDocuments(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: homeworkData } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, [classId]),
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, chapters?.map(c => c.id) ?? [], homeworkData?.map(h => h.id) ?? []),
        enabled: !!chapters && !!homeworkData
    });

    const { data: files, isLoading: loadingFiles } = useQuery({
        queryKey: ["files", profile?.id, classId],
        queryFn: () => getFiles(supabase, profile!.id, [classId]),
        enabled: !!profile
    });

    const { data: fileDocuments } = useQuery({
        queryKey: ["fileDocuments", classId],
        queryFn: () => getFileDocuments(supabase, files!.map(f => f.id)),
        enabled: !!files
    });

    const renderFileBadge = (fileId: string | undefined, showPreview: boolean) => {
        if (!fileId) return null;
        const file = files?.find(f => f.id === fileId);
        return file && (
            <Badge
                key={fileId}
                color="violet"
                style={{ cursor: 'pointer' }}
                leftSection={
                    showPreview ? <Avatar
                        src={fileDocuments?.find(d => d.file === fileId) ?
                            `${process.env.NEXT_PUBLIC_STORAGE_URL}/files/${classId}/${fileId}/${fileDocuments.find(d => d.file === fileId)?.id}.png` :
                            '/placeholder_image.svg'}
                        size="xs"
                        radius="sm"
                    /> : <IconFile size={14} />
                }
                rightSection={onRemoveContext && (
                    <IconX
                        size={14}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemoveContext('files', fileId);
                        }}
                    />
                )}
                onClick={(e) => {
                    if (setViewerMode) {
                        const document = fileDocuments?.find(d => d.file === fileId) // first page of the file
                        if (document) {
                            handleDocumentClick('files', fileId, setViewerMode, document.id);
                        }
                    }
                }}
            >
                {file?.title}
            </Badge>
        )

    }

    return (
        <>
            <Box style={{ width: '100%' }}>
                <Group gap={"xs"}>
                    {recordedVideos.map(video => {
                        // check if the video is in the activeChat.context.files or if the file id does not exist
                        const showVideo = activeChat.context.files.includes(video.fileId ?? '') || !video.fileId;
                        return showVideo && (
                            <Box
                                key={video.id}
                                style={{
                                    position: 'relative',
                                    width: '240px',
                                    height: '150px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    backgroundColor: '#f0f0f0',
                                    border: '1px solid #ddd',
                                    flexShrink: 0,
                                    pointerEvents: 'all',
                                    zIndex: 5
                                }}
                            >
                                <video
                                    src={video.url}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        opacity: !video.fileId ? 0.5 : 1,
                                        pointerEvents: 'all'
                                    }}
                                    controls
                                    playsInline
                                />

                                {!video.fileId ? (
                                    <Box style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: 'rgba(0,0,0,0.2)',
                                        pointerEvents: 'none'
                                    }}>
                                        <Text size="sm" fw={500} c="white">Uploading...</Text>
                                    </Box>
                                ) : (
                                    <Box style={{
                                        position: 'absolute',
                                        top: '4px',
                                        right: '4px',
                                        zIndex: 10,
                                        pointerEvents: 'auto'
                                    }}>
                                        {renderFileBadge(video.fileId, false)}
                                    </Box>
                                )}
                            </Box>
                        )
                    })}
                </Group>
            </Box>

            <Group gap={"xs"} pb={"sm"} pt={"sm"}>
                {activeChat.context.lectures.map(lectureId => {
                    const lecture = lectures?.find(l => l.id === lectureId);
                    return lecture && (
                        <Badge
                            key={lectureId}
                            color="blue"
                            style={{ cursor: 'pointer' }}
                            leftSection={
                                <Avatar
                                    src={lectureDocuments?.find(d => d.lecture === lectureId) ?
                                        `${process.env.NEXT_PUBLIC_STORAGE_URL}/lectures/${classId}/${lectureId}/${lectureDocuments.find(d => d.lecture === lectureId)?.id}.png` :
                                        '/placeholder_image.svg'}
                                    size="xs"
                                    radius="sm"
                                />
                            }
                            rightSection={onRemoveContext && (
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveContext('lectures', lectureId);
                                    }}
                                />
                            )}
                            onClick={(e) => {
                                if (setViewerMode) {
                                    const document = lectureDocuments?.find(d => d.lecture === lectureId) // first page of the lecture
                                    if (document) {
                                        handleDocumentClick('lectures', lectureId, setViewerMode, document.id);
                                    }
                                }
                            }}
                        >
                            {lecture.name}
                        </Badge>
                    );
                })}

                {activeChat.context.chapters.map(chapterId => {
                    const chapter = chapters?.find(c => c.id === chapterId);
                    return chapter && (
                        <Badge
                            key={chapterId}
                            color="green"
                            style={{ cursor: 'pointer' }}
                            leftSection={
                                <Avatar
                                    src={textbookDocuments?.find(d => d.page >= chapter.start_page && d.page <= chapter.end_page && d.textbook === chapter.textbook) ?
                                        `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${chapter.textbook}/${textbookDocuments.find(d => d.page >= chapter.start_page && d.page <= chapter.end_page && d.textbook === chapter.textbook)?.id}.png` :
                                        '/placeholder_image.svg'}
                                    size="xs"
                                    radius="sm"
                                />
                            }
                            rightSection={onRemoveContext && (
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveContext('chapters', chapterId);
                                    }}
                                />
                            )}
                            onClick={(e) => {
                                if (setViewerMode) {
                                    const textbook = textbooks?.find(t => t.id === chapter.textbook)
                                    if (textbook) {
                                        const document = textbookDocuments?.find(d => d.page >= chapter.start_page && d.page <= chapter.end_page && d.textbook === textbook.id) // first page of the chapter
                                        if (document) {
                                            handleDocumentClick('chapters', chapterId, setViewerMode, document.id, textbook.id);
                                        }
                                    }
                                }
                            }}
                        >
                            {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                        </Badge>
                    );
                })}

                {activeChat.context.exercises.map(exerciseId => {
                    const exercise = exercises?.find(e => e.id === exerciseId);
                    const chapter = chapters?.find(c => c.id === exercise?.chapter);
                    return exercise && chapter && (
                        <Badge
                            key={exerciseId}
                            color="teal"
                            style={{ cursor: 'pointer' }}
                            leftSection={
                                <Avatar
                                    src={exercises?.find(e => e.id === exerciseId) ?
                                        `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${chapter.textbook}/${exercise.id}.png` :
                                        '/placeholder_image.svg'}
                                    size="xs"
                                    radius="sm"
                                />
                            }
                            rightSection={onRemoveContext && (
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveContext('exercises', exerciseId);
                                    }}
                                />
                            )}
                            onClick={(e) => {
                                if (setViewerMode) {
                                    const exercise = exercises?.find(e => e.id === exerciseId) // find first exercise of the homework
                                    if (exercise) {
                                        handleDocumentClick('chapters', exerciseId, setViewerMode, undefined, undefined, exercise.id);
                                    }
                                }
                            }}
                        >
                            {exercise.title}
                        </Badge>
                    );
                })}

                {activeChat.context.homeworks.map(homeworkId => {
                    const homework = homeworkData?.find(h => h.id === homeworkId);

                    // find the first exercise in the homework
                    const exercise = exercises?.find(e => e.homework === homeworkId);
                    if (!exercise) return '/placeholder_image.svg';

                    let imageUrl = '/placeholder_image.svg';
                    // find the textbook document that has the same page number, but null for the chapter, homework and exercise
                    const textbookDocumentHomework = textbookDocuments?.find(d => d.homeworks.includes(homeworkId));
                    if (textbookDocumentHomework) {
                        imageUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL}/textbooks/${classId}/${textbookDocumentHomework.textbook}/${textbookDocumentHomework.id}.png`;
                    } else {
                        imageUrl = `${process.env.NEXT_PUBLIC_STORAGE_URL}/exercises/${classId}/${exercise.id}.png`;
                    }

                    return homework && (
                        <Badge
                            key={homeworkId}
                            color="orange"
                            style={{ cursor: 'pointer' }}
                            leftSection={
                                <Avatar
                                    src={imageUrl}
                                    size="xs"
                                    radius="sm"
                                />
                            }
                            rightSection={onRemoveContext && (
                                <IconX
                                    size={14}
                                    style={{ cursor: 'pointer' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveContext('homeworks', homeworkId);
                                    }}
                                />
                            )}
                            onClick={(e) => {
                                if (setViewerMode) {
                                    const exercise = exercises?.filter(e => e.homework === homeworkId).sort((a, b) => a.problem_number - b.problem_number).sort((a, b) => a.problem_part_number - b.problem_part_number)[0] // find first exercise of the homework
                                    if (exercise) {
                                        handleDocumentClick('homeworks', homeworkId, setViewerMode, undefined, undefined, exercise.id);
                                    }
                                }
                            }}
                        >
                            {homework.title}
                        </Badge>
                    );
                })}

                {activeChat.context.files.filter(fileId => !recordedVideos.some(video => video.fileId === fileId)).map(fileId => renderFileBadge(fileId, true))}
            </Group>
        </>
    )
});

ContextBadges.displayName = 'ContextBadges';

