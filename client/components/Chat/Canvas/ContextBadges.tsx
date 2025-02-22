/**
 * ContextBadges.tsx
 * Used to show the context badges in the chat.
 */

import { Badge, Group } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import useSupabaseBrowser from "@/utils/supabase/supabase-browser";
import { getLectures } from "@/utils/queries/get-lectures";
import { getTextbooks } from "@/utils/queries/get-textbooks";
import { getChapters } from "@/utils/queries/get-chapters";
import { getSubchapters } from "@/utils/queries/get-subchapters";
import { getHomeworks } from "@/utils/queries/get-homeworks";
import { getProblems } from "@/utils/queries/get-problems";
import { getExercises } from "@/utils/queries/get-exercises";
import { Chapter, Subchapter, ChatMessage, Document } from "@/types";

interface ContextBadgesProps {
    activeChat: ChatMessage;
    classId: string;
    onRemoveContext?: (contextType: keyof ChatMessage['context'], contextId: string) => void;
    onScrollToSection?: (sectionId: string) => void;
    handleContextClick?: (
        contextType: string,
        contextId: string,
        documents: Document[],
        chapters: Chapter[],
        subchapters: Subchapter[],
        setViewerMode: React.Dispatch<React.SetStateAction<{
            active: boolean;
            documentId?: string;
            lectureId?: string;
            textbookId?: string;
            chapterId?: string;
        }>>
    ) => void;
    setViewerMode?: React.Dispatch<React.SetStateAction<{
        active: boolean;
        documentId?: string;
        lectureId?: string;
        textbookId?: string;
        chapterId?: string;
    }>>;
}

export const ContextBadges = memo(({
    activeChat,
    classId,
    onRemoveContext,
    onScrollToSection,
    handleContextClick,
    setViewerMode
}: ContextBadgesProps) => {
    const supabase = useSupabaseBrowser();

    // Queries for data
    const { data: lectures } = useQuery({
        queryKey: ["lectures", classId],
        queryFn: () => getLectures(supabase, classId)
    });

    const { data: textbooks } = useQuery({
        queryKey: ["textbooks", classId],
        queryFn: () => getTextbooks(supabase, classId),
    });

    const { data: chapters } = useQuery({
        queryKey: ["chapters", classId],
        queryFn: () => getChapters(supabase, textbooks!.map(t => t.id)),
        enabled: !!textbooks
    });

    const { data: subchapters } = useQuery({
        queryKey: ["subchapters", classId],
        queryFn: () => getSubchapters(supabase, chapters!.map(c => c.id)),
        enabled: !!chapters
    });

    const { data: homeworkData } = useQuery({
        queryKey: ["homeworks", classId],
        queryFn: () => getHomeworks(supabase, classId),
    });

    const { data: problems } = useQuery({
        queryKey: ["problems", classId],
        queryFn: () => getProblems(supabase, homeworkData!.map(h => h.id)),
        enabled: !!homeworkData
    });

    const { data: exercises } = useQuery({
        queryKey: ["exercises", classId],
        queryFn: () => getExercises(supabase, problems?.map(p => p.exercise).filter(e => e !== null) ?? []),
        enabled: !!problems
    });

    // Render active badges
    const renderActiveBadges = () => (
        <>
            {activeChat.context.lectures.map(lectureId => {
                const lecture = lectures?.find(l => l.id === lectureId);
                return lecture && (
                    <Badge
                        key={lectureId}
                        color="blue"
                        style={{ cursor: 'pointer' }}
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
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('lectures', lectureId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {lecture.name}
                    </Badge>
                );
            })}

            {activeChat.context.textbooks.map(textbookId => {
                const textbook = textbooks?.find(t => t.id === textbookId);
                return textbook && (
                    <Badge
                        key={textbookId}
                        color="green"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('textbooks', textbookId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('textbooks', textbookId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {textbook.title}
                    </Badge>
                );
            })}

            {activeChat.context.chapters.map(chapterId => {
                const chapter = chapters?.find(c => c.id === chapterId);
                return chapter && (
                    <Badge
                        key={chapterId}
                        color="orange"
                        style={{ cursor: 'pointer' }}
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
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('chapters', chapterId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {`Chapter ${chapter.chapter_number}: ${chapter.title}`}
                    </Badge>
                );
            })}

            {activeChat.context.exercises.map(exerciseId => {
                const exercise = exercises?.find(e => e.id === exerciseId);
                const chapter = exercise ? chapters?.find(c => c.id === exercise.chapter) : null;
                return exercise && chapter && (
                    <Badge
                        key={exerciseId}
                        color="cyan"
                        style={{ cursor: 'pointer' }}
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
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('exercises', exerciseId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {exercise.title !== "" ? exercise.title : `Exercise ${chapter.chapter_number}.${exercise.exercise_number}`}
                    </Badge>
                );
            })}

            {activeChat.context.subchapters.map(subchapterId => {
                const subchapter = subchapters?.find(s => s.id === subchapterId);
                return subchapter && (
                    <Badge
                        key={subchapterId}
                        color="purple"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('subchapters', subchapterId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('subchapters', subchapterId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {`Subchapter ${subchapter.subchapter_number}: ${subchapter.title}`}
                    </Badge>
                );
            })}

            {activeChat.context.homeworks.map(homeworkId => {
                const homework = homeworkData?.find(h => h.id === homeworkId);
                return homework && (
                    <Badge
                        key={homeworkId}
                        color="orange"
                        style={{ cursor: 'pointer' }}
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
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('homeworks', homeworkId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {homework.title}
                    </Badge>
                );
            })}

            {activeChat.context.problems.map(problemId => {
                const problem = problems?.find(p => p.id === problemId);
                const homework = homeworkData?.find(h => h.id === problem?.homework);
                return problem && homework && (
                    <Badge
                        key={problemId}
                        color="cyan"
                        style={{ cursor: 'pointer' }}
                        rightSection={onRemoveContext && (
                            <IconX
                                size={14}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveContext('problems', problemId);
                                }}
                            />
                        )}
                        onClick={(e) => {
                            if (handleContextClick && setViewerMode && !(e.target as HTMLElement).closest('.mantine-Badge-rightSection')) {
                                handleContextClick('problems', problemId, [], chapters ?? [], subchapters ?? [], setViewerMode);
                            }
                        }}
                    >
                        {`${homework.title}: Problem ${problem.problem_number}`}
                    </Badge>
                );
            })}
        </>
    );

    // Render "Add X" badges
    const renderAddBadges = () => (
        <>
            {activeChat.context.lectures.length === 0 && lectures && lectures.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onScrollToSection?.("lectures-section")}
                    style={{ cursor: "pointer" }}
                >
                    Add Lectures
                </Badge>
            )}

            {activeChat.context.textbooks.length === 0 && textbooks && textbooks.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onScrollToSection?.("textbooks-section")}
                    style={{ cursor: "pointer" }}
                >
                    Add Textbooks
                </Badge>
            )}

            {activeChat.context.homeworks.length === 0 && homeworkData && homeworkData.length !== 0 && (
                <Badge
                    color="gray"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => onScrollToSection?.("homeworks-section")}
                    style={{ cursor: "pointer" }}
                >
                    Add Homework
                </Badge>
            )}
        </>
    );

    return (
        <Group>
            {renderActiveBadges()}
            {renderAddBadges()}
        </Group>
    );
});

ContextBadges.displayName = 'ContextBadges';

